import type {
  ArrivalStatus,
  JourneyLeg,
  JourneyOption,
  JourneySearchRequest,
  JourneySegment,
  NetworkData,
  SafarState,
} from "../types";
import {
  INCIDENT_ROUTE_DELAY_MINUTES,
  LATE_ALTERNATIVE_WINDOW_MINUTES,
  MAX_JOURNEY_LEGS,
  MAX_JOURNEY_OPTIONS,
  MIN_TRANSFER_BUFFER_MINUTES,
  NETWORK_DAY_START_MINUTES,
  ROUTE_BLOCKING_INCIDENT_TYPES,
  WALKING_ESTIMATE_NOTE,
} from "../constants";
import { isoAt, timeToMinutes } from "../time";
import {
  activeIncidentsForRoute,
  findBus,
  findDestination,
  findRoute,
  findVillage,
  getAccessPoints,
  getStopName,
  getStopWalkMinutes,
  isServiceOperable,
} from "../network";
import {
  calculateJourneyReliability,
  getReliabilityLabel,
} from "./reliability";

interface Leg {
  routeId: string;
  serviceId: string;
  serviceNumber: string;
  busId: string;
  busRegistration: string;
  fromStopId: string;
  toStopId: string;
  departureMin: number;
  arrivalMin: number;
  intermediateStopIds: string[];
}

interface RouteDelay {
  incidentMinutes: number;
  eventMinutes: number;
  sources: string[];
}

interface LegBuildResult {
  legs: Leg[];
  blockedRoutes: Map<string, string>;
  unavailableRoutes: Map<string, string>;
}

function legKey(leg: Leg): string {
  return `${leg.serviceId}:${leg.fromStopId}:${leg.toStopId}`;
}

function buildLegs(network: NetworkData, state: SafarState): LegBuildResult {
  const legs: Leg[] = [];
  const blockedRoutes = new Map<string, string>();
  const unavailableRoutes = new Map<string, string>();

  for (const service of network.services) {
    const route = findRoute(network, service.routeId);
    if (!route) continue;

    const blockingIncident = activeIncidentsForRoute(state, service.routeId).find((incident) =>
      (ROUTE_BLOCKING_INCIDENT_TYPES as readonly string[]).includes(incident.type),
    );
    if (blockingIncident) {
      blockedRoutes.set(
        service.routeId,
        `${service.routeId} is unavailable while confirmed ${blockingIncident.type} incident ${blockingIncident.id} is active.`,
      );
      continue;
    }

    if (!isServiceOperable(network, state, service)) {
      const bus = findBus(state.buses, service.busId);
      unavailableRoutes.set(
        service.routeId,
        `${service.routeId} has no operable bus (${bus ? `${bus.registration} is ${bus.status.toLowerCase()}` : "assigned bus missing"}).`,
      );
      continue;
    }

    const times = service.stopTimes.map((stopTime) => ({
      stopId: stopTime.stopId,
      minute: timeToMinutes(stopTime.time),
    }));
    for (let fromIndex = 0; fromIndex < times.length - 1; fromIndex += 1) {
      for (let toIndex = fromIndex + 1; toIndex < times.length; toIndex += 1) {
        const from = times[fromIndex];
        const to = times[toIndex];
        if (to.minute <= from.minute) continue;
        if (from.minute < NETWORK_DAY_START_MINUTES) continue;
        const bus = findBus(state.buses, service.busId);
        legs.push({
          routeId: service.routeId,
          serviceId: service.id,
          serviceNumber: service.serviceNumber,
          busId: service.busId,
          busRegistration: bus?.registration ?? service.busId,
          fromStopId: from.stopId,
          toStopId: to.stopId,
          departureMin: from.minute,
          arrivalMin: to.minute,
          intermediateStopIds: route.stopIds.slice(
            route.stopIds.indexOf(from.stopId) + 1,
            route.stopIds.indexOf(to.stopId),
          ),
        });
      }
    }
  }

  return { legs, blockedRoutes, unavailableRoutes };
}

export function getRouteDelays(state: SafarState): Map<string, RouteDelay> {
  const delays = new Map<string, RouteDelay>();

  for (const incident of state.incidents) {
    if (incident.status !== "ACTIVE" || !incident.routeId) continue;
    const current = delays.get(incident.routeId) ?? {
      incidentMinutes: 0,
      eventMinutes: 0,
      sources: [],
    };
    let minutes: number = INCIDENT_ROUTE_DELAY_MINUTES[incident.type] ?? 8;
    if (incident.replacementBusId) {
      // An approved replacement restores the route; only residual disruption remains.
      minutes = Math.min(minutes, 5);
    }
    current.incidentMinutes += minutes;
    current.sources.push(
      `${incident.type.replaceAll("_", " ").toLowerCase()} incident ${incident.id}${incident.replacementBusId ? " (replacement approved)" : ""}`,
    );
    delays.set(incident.routeId, current);
  }

  for (const impact of state.eventImpacts) {
    if (impact.estimatedDelayMinutes <= 0) continue;
    const current = delays.get(impact.routeId) ?? {
      incidentMinutes: 0,
      eventMinutes: 0,
      sources: [],
    };
    current.eventMinutes = Math.max(current.eventMinutes, impact.estimatedDelayMinutes);
    current.sources.push(
      `predicted event impact ${impact.eventId} (${impact.risk.toLowerCase()} risk)`,
    );
    delays.set(impact.routeId, current);
  }

  return delays;
}

interface AccessPointWithStop {
  stopId: string;
  walkMinutes: number;
}

function journeyMatchesAccess(
  leg: Leg,
  destinationAccess: AccessPointWithStop[],
): AccessPointWithStop | null {
  return destinationAccess.find((access) => access.stopId === leg.toStopId) ?? null;
}

function transferOpportunities(
  network: NetworkData,
  leg: Leg,
  legsByStop: Map<string, Leg[]>,
): Array<{ next: Leg; walkMinutes: number }> {
  const opportunities: Array<{ next: Leg; walkMinutes: number }> = [];
  const sameStop = legsByStop.get(leg.toStopId) ?? [];
  for (const candidate of sameStop) {
    if (candidate.serviceId === leg.serviceId) continue;
    if (candidate.departureMin - leg.arrivalMin < MIN_TRANSFER_BUFFER_MINUTES) continue;
    opportunities.push({ next: candidate, walkMinutes: 0 });
  }

  // Interchange walking is only permitted through explicit demo stop links.
  const linkedStops = network.stopWalkLinks.filter(
    (link) => link.fromStopId === leg.toStopId,
  );
  for (const link of linkedStops) {
    const walkMinutes = getStopWalkMinutes(network, leg.toStopId, link.toStopId);
    if (walkMinutes === null) continue;
    for (const candidate of legsByStop.get(link.toStopId) ?? []) {
      if (candidate.serviceId === leg.serviceId) continue;
      if (candidate.departureMin - leg.arrivalMin < walkMinutes + MIN_TRANSFER_BUFFER_MINUTES) {
        continue;
      }
      opportunities.push({ next: candidate, walkMinutes });
    }
  }
  return opportunities;
}

export interface BuildJourneyContext {
  network: NetworkData;
  state: SafarState;
  request: JourneySearchRequest;
  legs: Leg[];
  delays: Map<string, RouteDelay>;
}

function buildSegments(
  date: string,
  network: NetworkData,
  originName: string,
  destinationName: string,
  journeyStartMin: number,
  originAccess: AccessPointWithStop,
  destinationAccess: AccessPointWithStop,
  legs: Leg[],
  transferWalkMinutes: number,
): { segments: JourneySegment[]; waitingMinutes: number; walkingMinutes: number; finalArrivalMin: number } {
  const segments: JourneySegment[] = [];
  let segmentIndex = 0;
  let waitingMinutes = 0;
  let walkingMinutes = 0;
  const push = (segment: Omit<JourneySegment, "id">) => {
    segments.push({ id: `seg-${segmentIndex + 1}`, ...segment });
    segmentIndex += 1;
  };

  const walkEnd = journeyStartMin + originAccess.walkMinutes;
  push({
    kind: "WALK",
    fromLabel: originName,
    toLabel: getStopName(network, originAccess.stopId),
    startAt: isoAt(date, journeyStartMin),
    endAt: isoAt(date, walkEnd),
    durationMinutes: originAccess.walkMinutes,
    stopId: originAccess.stopId,
    illustrativeWalkingEstimate: true,
    note: WALKING_ESTIMATE_NOTE,
    provenance: "CALCULATED",
  });
  walkingMinutes += originAccess.walkMinutes;

  legs.forEach((leg, index) => {
    const stopName = getStopName(network, leg.fromStopId);
    if (leg.departureMin > walkEnd || index > 0) {
      const waitStart = index === 0 ? walkEnd : leg.departureMin;
      if (index > 0) {
        const previousArrival = legs[index - 1].arrivalMin;
        if (transferWalkMinutes > 0) {
          push({
            kind: "WALK",
            fromLabel: getStopName(network, legs[index - 1].toStopId),
            toLabel: stopName,
            startAt: isoAt(date, previousArrival),
            endAt: isoAt(date, previousArrival + transferWalkMinutes),
            durationMinutes: transferWalkMinutes,
            stopId: leg.fromStopId,
            illustrativeWalkingEstimate: true,
            note: WALKING_ESTIMATE_NOTE,
            provenance: "CALCULATED",
          });
          walkingMinutes += transferWalkMinutes;
        }
        const waitFrom = previousArrival + transferWalkMinutes;
        if (leg.departureMin > waitFrom) {
          const duration = leg.departureMin - waitFrom;
          push({
            kind: "TRANSFER",
            fromLabel: stopName,
            toLabel: stopName,
            startAt: isoAt(date, waitFrom),
            endAt: isoAt(date, leg.departureMin),
            durationMinutes: duration,
            stopId: leg.fromStopId,
            note: "Connection waiting time.",
            provenance: "CALCULATED",
          });
          waitingMinutes += duration;
        }
      } else if (leg.departureMin > waitStart) {
        const duration = leg.departureMin - waitStart;
        push({
          kind: "WAIT",
          fromLabel: stopName,
          toLabel: stopName,
          startAt: isoAt(date, waitStart),
          endAt: isoAt(date, leg.departureMin),
          durationMinutes: duration,
          stopId: leg.fromStopId,
          note: "Waiting at the boarding stop.",
          provenance: "CALCULATED",
        });
        waitingMinutes += duration;
      }
    }

    push({
      kind: "BUS",
      fromLabel: stopName,
      toLabel: getStopName(network, leg.toStopId),
      startAt: isoAt(date, leg.departureMin),
      endAt: isoAt(date, leg.arrivalMin),
      durationMinutes: leg.arrivalMin - leg.departureMin,
      routeId: leg.routeId,
      serviceId: leg.serviceId,
      busId: leg.busId,
      busRegistration: leg.busRegistration,
      stopId: leg.fromStopId,
      note:
        leg.intermediateStopIds.length > 0
          ? `${leg.intermediateStopIds.length} intermediate stop(s).`
          : "Direct segment.",
      provenance: "CALCULATED",
    });
  });

  const finalBusArrival = legs[legs.length - 1].arrivalMin;
  push({
    kind: "WALK",
    fromLabel: getStopName(network, destinationAccess.stopId),
    toLabel: destinationName,
    startAt: isoAt(date, finalBusArrival),
    endAt: isoAt(date, finalBusArrival + destinationAccess.walkMinutes),
    durationMinutes: destinationAccess.walkMinutes,
    stopId: destinationAccess.stopId,
    illustrativeWalkingEstimate: true,
    note: WALKING_ESTIMATE_NOTE,
    provenance: "CALCULATED",
  });
  walkingMinutes += destinationAccess.walkMinutes;

  return {
    segments,
    waitingMinutes,
    walkingMinutes,
    finalArrivalMin: finalBusArrival + destinationAccess.walkMinutes,
  };
}

function buildWarnings(
  network: NetworkData,
  state: SafarState,
  legs: Leg[],
  arrivalStatus: ArrivalStatus,
  finalArrivalMin: number,
  requiredArrivalMin: number,
  transferGapMinutes: number | null,
): string[] {
  const warnings: string[] = [];
  if (arrivalStatus === "LATE") {
    warnings.push(
      `Expected arrival is ${Math.round(finalArrivalMin - requiredArrivalMin)} minute(s) after the required arrival time.`,
    );
  }
  if (legs.length > 1 && transferGapMinutes !== null && transferGapMinutes < 10) {
    warnings.push(
      `Short connection buffer of ${transferGapMinutes} minute(s); a small delay may break this transfer.`,
    );
  }
  const routeIds = [...new Set(legs.map((leg) => leg.routeId))];
  for (const routeId of routeIds) {
    const impacts = state.eventImpacts.filter((impact) => impact.routeId === routeId);
    for (const impact of impacts) {
      if (impact.score < 25) continue;
      const event = state.events.find((candidate) => candidate.id === impact.eventId);
      warnings.push(
        `PREDICTED EVENT IMPACT — ${event?.name ?? impact.eventId} (${impact.risk}): ${impact.suggestedAction}`,
      );
    }
    for (const incident of activeIncidentsForRoute(state, routeId)) {
      warnings.push(
        `CONFIRMED INCIDENT — ${incident.type.replaceAll("_", " ").toLowerCase()} on ${routeId}${incident.replacementBusId ? "; a replacement has been approved." : "."}`,
      );
    }
  }
  return warnings;
}

/**
 * Generates timetable-feasible journey options for a request.
 *
 * Feasibility rules:
 * - Stops must follow the service's published order.
 * - A connection requires at least the minimum transfer buffer, plus any
 *   explicit interchange walking time.
 * - Services with an unavailable/maintenance bus or a blocking confirmed
 *   incident are excluded rather than silently rerouted.
 * - Journeys later than the required arrival are labelled LATE and only
 *   listed within the documented late-alternative window.
 */
export function generateJourneyOptions(
  request: JourneySearchRequest,
  network: NetworkData,
  state: SafarState,
): JourneyOption[] {
  const origin = findVillage(network, request.originVillageId);
  const destination = findDestination(network, request.destinationId);
  if (!origin) {
    throw new Error(`Unknown origin village "${request.originVillageId}".`);
  }
  if (!destination) {
    throw new Error(`Unknown destination "${request.destinationId}".`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.travelDate)) {
    throw new Error(`Invalid travel date "${request.travelDate}". Expected YYYY-MM-DD.`);
  }
  let requiredArrivalMin: number;
  try {
    requiredArrivalMin = timeToMinutes(request.requiredArrivalTime);
  } catch {
    throw new Error(`Invalid required arrival time "${request.requiredArrivalTime}".`);
  }

  const { legs, blockedRoutes, unavailableRoutes } = buildLegs(network, state);
  const delays = getRouteDelays(state);

  const legsByStop = new Map<string, Leg[]>();
  for (const leg of legs) {
    const list = legsByStop.get(leg.fromStopId) ?? [];
    list.push(leg);
    legsByStop.set(leg.fromStopId, list);
  }
  for (const list of legsByStop.values()) {
    list.sort((a, b) => a.departureMin - b.departureMin || a.arrivalMin - b.arrivalMin);
  }

  const originAccess = getAccessPoints(origin, network);
  const destinationAccess = getAccessPoints(destination, network);
  const windowEndMin = requiredArrivalMin + LATE_ALTERNATIVE_WINDOW_MINUTES;
  const options: JourneyOption[] = [];
  const seen = new Set<string>();

  const consider = (
    candidateLegs: Leg[],
    originAccessPoint: AccessPointWithStop,
    destinationAccessPoint: AccessPointWithStop,
    transferWalkMinutes: number,
  ) => {
    const firstLeg = candidateLegs[0];
    const lastLeg = candidateLegs[candidateLegs.length - 1];
    const journeyStartMin = firstLeg.departureMin - originAccessPoint.walkMinutes;
    if (journeyStartMin < 0) return;

    const { segments, waitingMinutes, walkingMinutes, finalArrivalMin } = buildSegments(
      request.travelDate,
      network,
      origin.name,
      destination.name,
      journeyStartMin,
      originAccessPoint,
      destinationAccessPoint,
      candidateLegs,
      transferWalkMinutes,
    );
    if (finalArrivalMin > windowEndMin) return;
    if (finalArrivalMin >= 24 * 60) return;

    const signature = `${originAccessPoint.stopId}|${candidateLegs
      .map(legKey)
      .join("|")}|${destinationAccessPoint.stopId}`;
    if (seen.has(signature)) return;
    seen.add(signature);

    const routeIds = [...new Set(candidateLegs.map((leg) => leg.routeId))];
    const journeyLegs: JourneyLeg[] = candidateLegs.map((leg) => {
      const delay = delays.get(leg.routeId);
      return {
        routeId: leg.routeId,
        serviceId: leg.serviceId,
        serviceNumber: leg.serviceNumber,
        busId: leg.busId,
        busRegistration: leg.busRegistration,
        boardingStopId: leg.fromStopId,
        alightingStopId: leg.toStopId,
        intermediateStopIds: leg.intermediateStopIds,
        departureAt: isoAt(request.travelDate, leg.departureMin),
        arrivalAt: isoAt(request.travelDate, leg.arrivalMin),
        delayMinutes: (delay?.incidentMinutes ?? 0) + (delay?.eventMinutes ?? 0),
        incidentDelayMinutes: delay?.incidentMinutes ?? 0,
        eventDelayMinutes: delay?.eventMinutes ?? 0,
      };
    });

    const transferGaps: number[] = [];
    for (let index = 1; index < candidateLegs.length; index += 1) {
      transferGaps.push(
        candidateLegs[index].departureMin - candidateLegs[index - 1].arrivalMin,
      );
    }
    const smallestGap = transferGaps.length > 0 ? Math.min(...transferGaps) : null;

    const arrivalStatus: ArrivalStatus =
      finalArrivalMin <= requiredArrivalMin ? "MEETS_REQUIRED_ARRIVAL" : "LATE";

    const estimatedDelay = journeyLegs.reduce((sum, leg) => sum + leg.delayMinutes, 0);
    const delaySources = [
      ...new Set(candidateLegs.flatMap((leg) => delays.get(leg.routeId)?.sources ?? [])),
    ];

    const draft: JourneyOption = {
      id: `jny-${options.length + 1}`,
      request: { ...request },
      originVillageId: request.originVillageId,
      destinationId: request.destinationId,
      travelDate: request.travelDate,
      requiredArrivalTime: request.requiredArrivalTime,
      segments,
      legs: journeyLegs,
      routeIds,
      serviceIds: journeyLegs.map((leg) => leg.serviceId),
      busIds: journeyLegs.map((leg) => leg.busId),
      busRegistrations: journeyLegs.map((leg) => leg.busRegistration),
      boardingStopId: firstLeg.fromStopId,
      alightingStopId: lastLeg.toStopId,
      departureAt: isoAt(request.travelDate, journeyStartMin),
      expectedArrivalAt: isoAt(request.travelDate, finalArrivalMin),
      requiredArrivalAt: isoAt(request.travelDate, requiredArrivalMin),
      totalDurationMinutes: finalArrivalMin - journeyStartMin,
      walkingMinutes,
      waitingMinutes,
      transferCount: candidateLegs.length - 1,
      estimatedDelayMinutes: estimatedDelay,
      delaySources,
      arrivalStatus,
      meetsRequiredArrival: arrivalStatus === "MEETS_REQUIRED_ARRIVAL",
      reliabilityScore: 0,
      reliabilityLabel: "MODERATE",
      reliabilityDisclaimer: "",
      reliabilityFactors: [],
      warnings: buildWarnings(
        network,
        state,
        candidateLegs,
        arrivalStatus,
        finalArrivalMin,
        requiredArrivalMin,
        smallestGap,
      ),
      provenance: "CALCULATED",
      rankingCategories: [],
    };

    const reliability = calculateJourneyReliability(draft, { network, state });
    draft.reliabilityScore = reliability.score;
    draft.reliabilityLabel = getReliabilityLabel(reliability.score);
    draft.reliabilityDisclaimer = reliability.disclaimer;
    draft.reliabilityFactors = reliability.factors;
    options.push(draft);
  };

  for (const originAccessPoint of originAccess) {
    const firstLegs = legsByStop.get(originAccessPoint.stopId) ?? [];
    for (const firstLeg of firstLegs) {
      // Direct journey.
      const directDestination = journeyMatchesAccess(firstLeg, destinationAccess);
      if (directDestination) {
        consider([firstLeg], originAccessPoint, directDestination, 0);
      }

      if (MAX_JOURNEY_LEGS < 2) continue;

      // One-transfer journeys.
      for (const transfer of transferOpportunities(network, firstLeg, legsByStop)) {
        const secondLeg = transfer.next;
        const transferDestination = journeyMatchesAccess(secondLeg, destinationAccess);
        if (!transferDestination) continue;
        consider(
          [firstLeg, secondLeg],
          originAccessPoint,
          transferDestination,
          transfer.walkMinutes,
        );
      }
    }
  }

  options.sort((a, b) => {
    if (a.totalDurationMinutes !== b.totalDurationMinutes) {
      return a.totalDurationMinutes - b.totalDurationMinutes;
    }
    if (a.reliabilityScore !== b.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
    if (a.expectedArrivalAt !== b.expectedArrivalAt) {
      return a.expectedArrivalAt < b.expectedArrivalAt ? -1 : 1;
    }
    return a.transferCount - b.transferCount;
  });

  const limited = options.slice(0, MAX_JOURNEY_OPTIONS).map((option, index) => ({
    ...option,
    id: `jny-${index + 1}`,
  }));

  applyRankingCategories(limited);
  return limited;
}

export function applyRankingCategories(options: JourneyOption[]): JourneyOption[] {
  if (options.length === 0) return options;

  const fastest = [...options].sort((a, b) => {
    if (a.totalDurationMinutes !== b.totalDurationMinutes) {
      return a.totalDurationMinutes - b.totalDurationMinutes;
    }
    if (a.reliabilityScore !== b.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
    if (a.expectedArrivalAt !== b.expectedArrivalAt) {
      return a.expectedArrivalAt < b.expectedArrivalAt ? -1 : 1;
    }
    return a.transferCount - b.transferCount;
  })[0];

  const mostReliable = [...options].sort((a, b) => {
    if (a.reliabilityScore !== b.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
    if (a.totalDurationMinutes !== b.totalDurationMinutes) {
      return a.totalDurationMinutes - b.totalDurationMinutes;
    }
    if (a.expectedArrivalAt !== b.expectedArrivalAt) {
      return a.expectedArrivalAt < b.expectedArrivalAt ? -1 : 1;
    }
    return a.transferCount - b.transferCount;
  })[0];

  const fewestTransfers = [...options].sort((a, b) => {
    if (a.transferCount !== b.transferCount) return a.transferCount - b.transferCount;
    if (a.reliabilityScore !== b.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
    if (a.totalDurationMinutes !== b.totalDurationMinutes) {
      return a.totalDurationMinutes - b.totalDurationMinutes;
    }
    return a.expectedArrivalAt < b.expectedArrivalAt ? -1 : 1;
  })[0];

  for (const option of options) {
    const categories: JourneyOption["rankingCategories"] = [];
    if (option.id === fastest.id) categories.push("FASTEST");
    if (option.id === mostReliable.id) categories.push("MOST_RELIABLE");
    if (option.id === fewestTransfers.id) categories.push("FEWEST_TRANSFERS");
    option.rankingCategories = categories;
  }
  return options;
}

export function describeNoRouteReason(
  request: JourneySearchRequest,
  network: NetworkData,
  state: SafarState,
): string {
  const origin = findVillage(network, request.originVillageId);
  const destination = findDestination(network, request.destinationId);
  if (!origin || !destination) return "Unknown origin or destination.";

  const { blockedRoutes, unavailableRoutes } = buildLegs(network, state);
  const originAccessStopIds = origin.accessStops.map((access) => access.stopId);
  const servingRoutes = network.routes.filter((route) =>
    route.stopIds.some((stopId) => originAccessStopIds.includes(stopId)),
  );

  const details: string[] = [];
  for (const [routeId, reason] of blockedRoutes) details.push(reason);
  for (const [routeId, reason] of unavailableRoutes) {
    if (servingRoutes.some((route) => route.id === routeId)) details.push(reason);
  }
  if (servingRoutes.length === 0) {
    details.push(`No seeded route serves ${origin.name}.`);
  }
  if (details.length === 0) {
    details.push(
      "No connection satisfies the timetable, transfer-buffer and required-arrival constraints.",
    );
  }
  return `No feasible journey from ${origin.name} to ${destination.name} by ${request.requiredArrivalTime}. ${details.join(" ")}`;
}

/** Groups a generated option list into the three independent rankings. */
export function rankJourneyCategories(options: JourneyOption[]): {
  fastest: JourneyOption | null;
  mostReliable: JourneyOption | null;
  fewestTransfers: JourneyOption | null;
} {
  const byCategory = (category: JourneyOption["rankingCategories"][number]) =>
    options.find((option) => option.rankingCategories.includes(category)) ?? null;
  return {
    fastest: byCategory("FASTEST"),
    mostReliable: byCategory("MOST_RELIABLE"),
    fewestTransfers: byCategory("FEWEST_TRANSFERS"),
  };
}

