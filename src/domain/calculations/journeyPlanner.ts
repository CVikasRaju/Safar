import type {
  Bus,
  Destination,
  EventRouteImpact,
  Route,
  SafarEvent,
  SafarState,
  Stop,
  TimetableService,
  Village,
} from "../types";
import type {
  JourneyLeg,
  JourneyOption,
  JourneyOptionSet,
  JourneyPlanResult,
  JourneyRecommendationCategory,
  JourneySearchRequest,
  JourneySegment,
  JourneyWarning,
  WalkingEstimate,
} from "../types/journey";
import {
  formatClock,
  formatDuration,
  hhmmToMinutes,
  minutesToIso,
  rangesOverlap,
  weekdayOfIsoDate,
} from "./time";
import {
  BOARD_BUFFER_MINUTES,
  MAX_ACCESS_WALK_METERS,
  MAX_TRANSFER_WALK_METERS,
  MIN_TRANSFER_BUFFER_MINUTES,
  estimateWalking,
  haversineMeters,
} from "./walking";
import { calculateJourneyReliability } from "./reliability";
import { closedRoadIds, routeDetour } from "../emergency/roads";
import { INCIDENT_SEVERITY_DELAY_MINUTES, ROUTE_BLOCKING_INCIDENT_TYPES } from "../constants";

/**
 * Deterministic journey planning (docs/04).
 *
 * Feasibility, duration, waiting, transfer count and the arrival deadline are
 * calculated here and are never delegated to a UI component or an AI provider.
 *
 * Prototype limits (documented for students in the UI):
 *  - at most one bus change per journey;
 *  - timetable services are illustrative demo data;
 *  - walking values are labelled approximations (see walking.ts);
 *  - journeys using an Unavailable or Maintenance bus are excluded.
 */
export const MAX_TRANSFERS = 1;
export const MAX_WALK_ONLY_METERS = 2500;
export const EARLIEST_DEPARTURE_MINUTE = 4 * 60;
export const LATE_ALTERNATIVE_WINDOW_MINUTES = 180;

export const JOURNEY_ASSUMPTIONS: string[] = [
  "Timetable, delay, event and walking values are illustrative demo data — not official schedules or live measurements.",
  "Walking values are approximate (straight-line distance × 1.35 detour factor), never a road-routed pedestrian distance.",
  "This prototype plans at most one bus change per journey.",
  "Journeys that rely on a bus marked Unavailable or Maintenance are excluded instead of being offered.",
  "Estimated delay uses a documented prototype conversion from the severity of confirmed incidents, plus any computed event impact for the journey window.",
];

interface ActiveIncidentSummary {
  id: string;
  type: string;
  severity: string;
  description?: string;
  affectedStopId?: string;
}

interface RouteEventImpact {
  impact: EventRouteImpact;
  event: SafarEvent;
}

interface RouteContext {
  routeId: string;
  activeIncidents: ActiveIncidentSummary[];
  /** A confirmed road blockage or diversion removes this route from planning. */
  blocked: boolean;
  baseDelayMinutes: number;
  delayReasons: string[];
  eventImpacts: RouteEventImpact[];
}

export type RouteContextMap = Map<string, RouteContext>;

export function buildRouteContexts(state: SafarState): RouteContextMap {
  const contexts: RouteContextMap = new Map();
  for (const route of state.routes) {
    contexts.set(route.id, {
      routeId: route.id,
      activeIncidents: [],
      blocked: false,
      baseDelayMinutes: 0,
      delayReasons: [],
      eventImpacts: [],
    });
  }

  for (const incident of state.incidents) {
    if (incident.status !== "ACTIVE" || !incident.routeId) continue;
    const context = contexts.get(incident.routeId);
    if (!context) continue;
    context.activeIncidents.push({
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      description: incident.description,
      affectedStopId: incident.affectedStopId,
    });
    if (ROUTE_BLOCKING_INCIDENT_TYPES.includes(incident.type)) {
      context.blocked = true;
      context.delayReasons.push(
        `${incident.type} confirmed on ${incident.routeId}; the route is not offered for planning.`,
      );
    } else {
      const delay = INCIDENT_SEVERITY_DELAY_MINUTES[incident.severity] ?? 10;
      context.baseDelayMinutes = Math.max(context.baseDelayMinutes, delay);
      context.delayReasons.push(
        `Confirmed ${incident.type.toLowerCase().replace(/_/g, " ")} (${incident.severity}) adds an estimated ${delay} min.`,
      );
    }
  }

  const eventsById = new Map(state.events.map((event) => [event.id, event]));
  for (const impact of state.eventRouteImpacts) {
    const context = contexts.get(impact.routeId);
    const event = eventsById.get(impact.eventId);
    if (!context || !event) continue;
    context.eventImpacts.push({ impact, event });
  }

  // Active emergency: closed roads add the calculated detour time to affected
  // routes so journey estimates react to the flood instead of ignoring it.
  if (state.emergency) {
    const blockedRoadIds = closedRoadIds(state.emergency.roadConditions);
    if (blockedRoadIds.length > 0) {
      for (const route of state.routes) {
        const context = contexts.get(route.id);
        if (!context) continue;
        const detour = routeDetour(state.emergency.roads, route, blockedRoadIds);
        if (detour.blockedRoadIds.length === 0) continue;
        context.baseDelayMinutes = Math.max(
          context.baseDelayMinutes,
          detour.additionalMinutes,
        );
        context.delayReasons.push(
          `Flooded road closed: ${route.id} is re-routed via the ring road (+${detour.additionalDistanceKm} km, +${detour.additionalMinutes} min).`,
        );
      }
    }
  }

  return contexts;
}

interface InternalLeg {
  service: TimetableService;
  route: Route;
  bus: Bus;
  boardIndex: number;
  alightIndex: number;
  boardStop: Stop;
  alightStop: Stop;
  departMinute: number;
  arriveMinute: number;
  delayMinutes: number;
  eventScore: number;
  eventDelayMinutes: number;
  eventNames: string[];
  incidents: ActiveIncidentSummary[];
}

interface EventOverlap {
  score: number;
  delayMinutes: number;
  event: SafarEvent;
  impact: EventRouteImpact;
}

function eventOverlapForWindow(
  routeContext: RouteContext,
  dateISO: string,
  startMinute: number,
  endMinute: number,
): EventOverlap | undefined {
  const startIso = minutesToIso(dateISO, startMinute);
  const endIso = minutesToIso(dateISO, endMinute);
  let best: EventOverlap | undefined;
  for (const { impact, event } of routeContext.eventImpacts) {
    const windowStart = event.impactWindow?.start ?? `${event.date}T${event.startTime}:00`;
    const windowEnd = event.impactWindow?.end ?? `${event.date}T${event.endTime}:00`;
    if (!rangesOverlap(startIso, endIso, windowStart, windowEnd)) continue;
    const candidate: EventOverlap = {
      score: impact.impactScore,
      delayMinutes: impact.estimatedDelayMinutes ?? 0,
      event,
      impact,
    };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function isBusOperational(bus: Bus | undefined): bus is Bus {
  return bus !== undefined && bus.status !== "UNAVAILABLE" && bus.status !== "MAINTENANCE";
}

function buildLegs(
  state: SafarState,
  request: JourneySearchRequest,
  contexts: RouteContextMap,
): InternalLeg[] {
  const weekday = weekdayOfIsoDate(request.travelDate);
  const stopsById = new Map(state.stops.map((stop) => [stop.id, stop]));
  const routesById = new Map(state.routes.map((route) => [route.id, route]));
  const busesById = new Map(state.buses.map((bus) => [bus.id, bus]));
  const legs: InternalLeg[] = [];

  for (const service of state.timetableServices) {
    if (!service.operatingDays.includes(weekday)) continue;
    const route = routesById.get(service.routeId);
    const bus = busesById.get(service.busId);
    const context = contexts.get(service.routeId);
    if (!route || !isBusOperational(bus) || !context || context.blocked) continue;
    if (service.stopTimes.length !== route.stops.length) continue;

    for (let boardIndex = 0; boardIndex < service.stopTimes.length - 1; boardIndex += 1) {
      const boardTime = service.stopTimes[boardIndex];
      if (boardTime.departureMinute < EARLIEST_DEPARTURE_MINUTE) continue;
      const boardStop = stopsById.get(boardTime.stopId);
      if (!boardStop) continue;

      for (let alightIndex = boardIndex + 1; alightIndex < service.stopTimes.length; alightIndex += 1) {
        const alightTime = service.stopTimes[alightIndex];
        const alightStop = stopsById.get(alightTime.stopId);
        if (!alightStop) continue;

        const overlap = eventOverlapForWindow(
          context,
          request.travelDate,
          boardTime.departureMinute,
          alightTime.arrivalMinute,
        );

        legs.push({
          service,
          route,
          bus,
          boardIndex,
          alightIndex,
          boardStop,
          alightStop,
          departMinute: boardTime.departureMinute,
          arriveMinute: alightTime.arrivalMinute,
          delayMinutes: context.baseDelayMinutes + (overlap?.delayMinutes ?? 0),
          eventScore: overlap?.score ?? 0,
          eventDelayMinutes: overlap?.delayMinutes ?? 0,
          eventNames: overlap ? [overlap.event.name] : [],
          incidents: context.activeIncidents,
        });
      }
    }
  }

  return legs;
}

function routeLabel(route: Route): string {
  return `${route.id} · ${route.name}`;
}

function stopLocation(stop: Stop): { label: string; stopId: string; coordinates: { lat: number; lon: number } } {
  return { label: stop.name, stopId: stop.id, coordinates: stop.coordinates };
}

function legSignature(legs: InternalLeg[]): string {
  return legs
    .map((leg) => `${leg.service.id}:${leg.boardStop.id}:${leg.alightStop.id}`)
    .join(">");
}

interface BuildJourneyInput {
  legs: InternalLeg[];
  originVillage: Village;
  destination: Destination;
  request: JourneySearchRequest;
  requiredMinute: number;
}

function dedupeWarnings(warnings: JourneyWarning[]): JourneyWarning[] {
  const seen = new Set<string>();
  const unique: JourneyWarning[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(warning);
  }
  return unique;
}

function isOriginStopNear(
  stop: Stop,
  village: Village,
): boolean {
  if (stop.villageId === village.id) return true;
  return haversineMeters(village.coordinates, stop.coordinates) * 1.35 <= MAX_ACCESS_WALK_METERS;
}

function isDropStopNear(stop: Stop, destination: Destination): boolean {
  if (stop.id === destination.stopId) return true;
  return (
    haversineMeters(destination.coordinates, stop.coordinates) * 1.35 <= MAX_ACCESS_WALK_METERS
  );
}

function buildBusJourney(input: BuildJourneyInput): JourneyOption | null {
  const { legs, originVillage, destination, request, requiredMinute } = input;
  if (legs.length === 0 || legs.length > MAX_TRANSFERS + 1) return null;

  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const accessWalk = estimateWalking(originVillage.coordinates, firstLeg.boardStop.coordinates);
  const egressWalk = estimateWalking(lastLeg.alightStop.coordinates, destination.coordinates);

  const departureMinute = firstLeg.departMinute - accessWalk.minutes - BOARD_BUFFER_MINUTES;
  if (departureMinute < EARLIEST_DEPARTURE_MINUTE) return null;

  const initialWait = BOARD_BUFFER_MINUTES;
  const boardBufferDelta =
    firstLeg.departMinute - (departureMinute + accessWalk.minutes);

  const legs2: JourneyLeg[] = [];
  const segments: JourneySegment[] = [];
  const warnings: JourneyWarning[] = [];
  const waitingParts: number[] = [initialWait];
  const transferWaits: number[] = [];
  const connectionSlacks: number[] = [];
  const transferWalks: WalkingEstimate[] = [];
  const journeySignature = legSignature(legs);
  const journeyId = `j-${journeySignature.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  const walkingEstimates = [accessWalk, egressWalk, ...transferWalks];
  let expectedCursor = firstLeg.departMinute;
  let segmentIndex = 0;
  const nextSegmentId = () => `${journeyId}-s${segmentIndex++}`;

  if (accessWalk.minutes > 0) {
    segments.push({
      id: nextSegmentId(),
      type: "WALK",
      kind: "ACCESS_WALK",
      title: `Walk to ${firstLeg.boardStop.name}`,
      startLocation: {
        label: `${originVillage.name} (demo origin point)`,
        villageId: originVillage.id,
        coordinates: originVillage.coordinates,
      },
      endLocation: stopLocation(firstLeg.boardStop),
      startTime: minutesToIso(request.travelDate, departureMinute),
      endTime: minutesToIso(request.travelDate, departureMinute + accessWalk.minutes),
      durationMinutes: accessWalk.minutes,
      walking: accessWalk,
      note: "Approximate walking estimate — see method below.",
    });
  }

  segments.push({
    id: nextSegmentId(),
    type: "WAIT",
    kind: "BOARD_WAIT",
    title: `Wait ${Math.max(0, Math.round(boardBufferDelta))} min for ${firstLeg.route.id}`,
    startLocation: stopLocation(firstLeg.boardStop),
    endLocation: stopLocation(firstLeg.boardStop),
    startTime: minutesToIso(request.travelDate, departureMinute + accessWalk.minutes),
    endTime: minutesToIso(request.travelDate, firstLeg.departMinute),
    durationMinutes: Math.max(0, Math.round(boardBufferDelta)),
    note: "Arrive a couple of minutes before the scheduled departure.",
  });

  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index];
    const legDelay = leg.delayMinutes;
    expectedCursor = leg.departMinute + legDelay;

    if (index > 0) {
      const previous = legs[index - 1];
      const transferWalk = estimateWalking(
        previous.alightStop.coordinates,
        leg.boardStop.coordinates,
      );
      transferWalks.push(transferWalk);
      const arriveAtBoard = previous.arriveMinute + previous.delayMinutes + transferWalk.minutes;
      const wait = Math.max(0, leg.departMinute - arriveAtBoard);
      transferWaits.push(wait);
      waitingParts.push(wait);
      connectionSlacks.push(wait - MIN_TRANSFER_BUFFER_MINUTES);

      if (transferWalk.minutes > 0) {
        segments.push({
          id: nextSegmentId(),
          type: "WALK",
          kind: "TRANSFER_WALK",
          title: `Walk to ${leg.boardStop.name}`,
          detail: `Transfer from ${previous.alightStop.name}`,
          startLocation: stopLocation(previous.alightStop),
          endLocation: stopLocation(leg.boardStop),
          startTime: minutesToIso(request.travelDate, previous.arriveMinute + previous.delayMinutes),
          endTime: minutesToIso(
            request.travelDate,
            previous.arriveMinute + previous.delayMinutes + transferWalk.minutes,
          ),
          durationMinutes: transferWalk.minutes,
          walking: transferWalk,
          note: "Approximate transfer walking estimate.",
        });
      }

      if (wait > 0) {
        segments.push({
          id: nextSegmentId(),
          type: "TRANSFER",
          kind: "TRANSFER_WAIT",
          title: `Wait ${wait} min at ${leg.boardStop.name}`,
          detail: `Next: ${leg.route.id} towards ${leg.alightStop.name}`,
          startLocation: stopLocation(leg.boardStop),
          endLocation: stopLocation(leg.boardStop),
          startTime: minutesToIso(
            request.travelDate,
            previous.arriveMinute + previous.delayMinutes + transferWalk.minutes,
          ),
          endTime: minutesToIso(request.travelDate, leg.departMinute),
          durationMinutes: wait,
          note: "Gap between arrival and the next scheduled departure.",
        });
      }

      if (wait - MIN_TRANSFER_BUFFER_MINUTES < 6) {
        warnings.push({
          code: "TIGHT_CONNECTION",
          severity: "WARNING",
          message: `Tight connection at ${leg.boardStop.name}: only ${Math.max(0, wait)} min between arriving and the next departure.`,
          provenance: "CALCULATED",
        });
      }
    }

    const intermediateStopIds = leg.service.stopTimes
      .slice(leg.boardIndex + 1, leg.alightIndex)
      .map((stopTime) => stopTime.stopId);

    segments.push({
      id: nextSegmentId(),
      type: "BUS",
      kind: "BUS_RIDE",
      title: `${leg.route.id} to ${leg.alightStop.name}`,
      detail: `${leg.bus.registration} · board at ${leg.boardStop.name}`,
      startLocation: stopLocation(leg.boardStop),
      endLocation: stopLocation(leg.alightStop),
      startTime: minutesToIso(request.travelDate, leg.departMinute + legDelay),
      endTime: minutesToIso(request.travelDate, leg.arriveMinute + legDelay),
      durationMinutes: leg.arriveMinute - leg.departMinute,
      serviceId: leg.service.id,
      routeId: leg.route.id,
      routeLabel: routeLabel(leg.route),
      busId: leg.bus.id,
      busRegistration: leg.bus.registration,
      intermediateStopIds,
      note:
        intermediateStopIds.length > 0
          ? `${intermediateStopIds.length} intermediate stop${intermediateStopIds.length > 1 ? "s" : ""} before your stop.`
          : "Next stop is your stop.",
    });

    for (const incident of leg.incidents) {
      warnings.push({
        code: "ACTIVE_INCIDENT",
        severity: "CRITICAL",
        message: `CONFIRMED INCIDENT on ${leg.route.id}: ${incident.type.toLowerCase().replace(/_/g, " ")} (${incident.severity}). Estimated ${leg.delayMinutes} min delay.`,
        provenance: "VERIFIED",
      });
    }

    if (leg.eventScore > 0) {
      warnings.push({
        code: "PREDICTED_EVENT_IMPACT",
        severity: "WARNING",
        message: `PREDICTED EVENT IMPACT on ${leg.route.id}: ${leg.eventNames.join(", ")} (impact score ${leg.eventScore}/100). Estimated ${leg.eventDelayMinutes} min delay — an estimate, not a road closure.`,
        provenance: "DEMO",
      });
    }

    if (leg.bus.status === "REPLACEMENT_ASSIGNED") {
      warnings.push({
        code: "REPLACEMENT_BUS",
        severity: "INFO",
        message: `${leg.bus.registration} is an approved replacement bus on ${leg.route.id}.`,
        provenance: "VERIFIED",
      });
    }

    if (transferWalks[index] && transferWalks[index].approxMeters > 300) {
      warnings.push({
        code: "TRANSFER_WALK",
        severity: "INFO",
        message: `Transfer at ${leg.boardStop.name} needs about ${transferWalks[index].approxMeters} m of walking (approximate).`,
        provenance: "CALCULATED",
      });
    }

    const waitForLeg = waitingParts[index];
    if (waitForLeg > 30) {
      warnings.push({
        code: "LONG_WAIT",
        severity: "INFO",
        message: `Includes a ${waitForLeg} min wait at ${leg.boardStop.name}.`,
        provenance: "CALCULATED",
      });
    }

    legs2.push({
      serviceId: leg.service.id,
      routeId: leg.route.id,
      routeLabel: routeLabel(leg.route),
      busId: leg.bus.id,
      busRegistration: leg.bus.registration,
      direction: leg.service.direction,
      boardStopId: leg.boardStop.id,
      boardStopName: leg.boardStop.name,
      alightStopId: leg.alightStop.id,
      alightStopName: leg.alightStop.name,
      intermediateStopIds,
      scheduledDeparture: minutesToIso(request.travelDate, leg.departMinute),
      scheduledArrival: minutesToIso(request.travelDate, leg.arriveMinute),
      expectedDeparture: minutesToIso(request.travelDate, leg.departMinute + legDelay),
      expectedArrival: minutesToIso(request.travelDate, leg.arriveMinute + legDelay),
      delayMinutes: legDelay,
      waitBeforeMinutes: waitForLeg,
      transferWalk: index > 0 ? transferWalks[index - 1] : undefined,
    });

    expectedCursor = leg.arriveMinute + legDelay;
  }

  if (egressWalk.minutes > 0) {
    segments.push({
      id: nextSegmentId(),
      type: "WALK",
      kind: "EGRESS_WALK",
      title: `Walk to ${destination.name}`,
      startLocation: stopLocation(lastLeg.alightStop),
      endLocation: {
        label: destination.name,
        coordinates: destination.coordinates,
      },
      startTime: minutesToIso(request.travelDate, expectedCursor),
      endTime: minutesToIso(request.travelDate, expectedCursor + egressWalk.minutes),
      durationMinutes: egressWalk.minutes,
      walking: egressWalk,
      note: "Approximate walking estimate to the destination entrance.",
    });
  }

  const arrivalMinute = expectedCursor + egressWalk.minutes;
  if (arrivalMinute > requiredMinute + LATE_ALTERNATIVE_WINDOW_MINUTES) return null;

  const walkingMinutes = walkingEstimates.reduce((sum, walk) => sum + walk.minutes, 0);
  const walkingMetersApprox = walkingEstimates.reduce((sum, walk) => sum + walk.approxMeters, 0);
  const transferWaitMinutes = transferWaits.reduce((sum, wait) => sum + wait, 0);
  const totalWaiting = waitingParts.reduce((sum, wait) => sum + wait, 0);
  const delayMinutes = legs.reduce((sum, leg) => sum + leg.delayMinutes, 0);
  const eventScore = legs.reduce((max, leg) => Math.max(max, leg.eventScore), 0);
  const routeIds = [...new Set(legs.map((leg) => leg.route.id))];

  const incidentWithoutDelay = legs.some(
    (leg) => leg.incidents.length > 0 && leg.delayMinutes === 0,
  );
  const usesReplacement = legs.some((leg) => leg.bus.status === "REPLACEMENT_ASSIGNED");
  const availabilityRisk = Math.min(1, (usesReplacement ? 0.35 : 0) + (incidentWithoutDelay ? 0.35 : 0));

  const reliability = calculateJourneyReliability({
    delayMinutes,
    eventImpactScore: eventScore,
    transferWaitMinutes,
    minConnectionSlackMinutes:
      connectionSlacks.length > 0 ? Math.min(...connectionSlacks) : undefined,
    transferCount: legs.length - 1,
    availabilityRisk,
  });

  if (walkingMetersApprox > 0) {
    warnings.push({
      code: "WALKING_ESTIMATE",
      severity: "INFO",
      message: `Walking distances are approximate (${walkingMetersApprox} m total, straight-line × 1.35) — not road-routed pedestrian distances.`,
      provenance: "CALCULATED",
    });
  }

  const meetsRequiredArrival = arrivalMinute <= requiredMinute;
  if (!meetsRequiredArrival) {
    warnings.push({
      code: "LATE_ARRIVAL",
      severity: "CRITICAL",
      message: `Arrives ${arrivalMinute - requiredMinute} min after your required arrival time.`,
      provenance: "CALCULATED",
    });
  }

  return {
    id: journeyId,
    kind: "BUS",
    originVillageId: originVillage.id,
    destinationId: destination.id,
    travelDate: request.travelDate,
    requiredArrivalTime: request.requiredArrivalTime,
    departureTime: minutesToIso(request.travelDate, departureMinute),
    arrivalTime: minutesToIso(request.travelDate, arrivalMinute),
    scheduledArrivalTime: minutesToIso(
      request.travelDate,
      lastLeg.arriveMinute + egressWalk.minutes,
    ),
    totalDurationMinutes: arrivalMinute - departureMinute,
    transferCount: legs.length - 1,
    waitingMinutes: totalWaiting,
    walkingMinutes,
    walkingMetersApprox,
    legs: legs2,
    segments,
    estimatedDelayMinutes: delayMinutes,
    reliability,
    warnings: dedupeWarnings(warnings),
    meetsRequiredArrival,
    minutesRelativeToRequiredArrival: arrivalMinute - requiredMinute,
    usedRouteIds: routeIds,
    walkingEstimates,
    rankings: {},
    provenance: "CALCULATED",
  };
}

function buildWalkOnlyJourney(
  originVillage: Village,
  destination: Destination,
  request: JourneySearchRequest,
  requiredMinute: number,
): JourneyOption | null {
  const walk = estimateWalking(originVillage.coordinates, destination.coordinates);
  if (walk.approxMeters < 25 || walk.approxMeters > MAX_WALK_ONLY_METERS) return null;

  const departureMinute = requiredMinute - walk.minutes - 5;
  if (departureMinute < EARLIEST_DEPARTURE_MINUTE) return null;

  const journeyId = `j-walk-${originVillage.id}-${destination.id}`;
  const arrivalMinute = departureMinute + walk.minutes;
  const segments: JourneySegment[] = [
    {
      id: `${journeyId}-s0`,
      type: "WALK",
      kind: "ACCESS_WALK",
      title: `Walk to ${destination.name}`,
      startLocation: {
        label: `${originVillage.name} (demo origin point)`,
        villageId: originVillage.id,
        coordinates: originVillage.coordinates,
      },
      endLocation: { label: destination.name, coordinates: destination.coordinates },
      startTime: minutesToIso(request.travelDate, departureMinute),
      endTime: minutesToIso(request.travelDate, arrivalMinute),
      durationMinutes: walk.minutes,
      walking: walk,
      note: "Walk-only option: no bus service is required for this trip.",
    },
  ];

  return {
    id: journeyId,
    kind: "WALK_ONLY",
    originVillageId: originVillage.id,
    destinationId: destination.id,
    travelDate: request.travelDate,
    requiredArrivalTime: request.requiredArrivalTime,
    departureTime: minutesToIso(request.travelDate, departureMinute),
    arrivalTime: minutesToIso(request.travelDate, arrivalMinute),
    scheduledArrivalTime: minutesToIso(request.travelDate, arrivalMinute),
    totalDurationMinutes: walk.minutes,
    transferCount: 0,
    waitingMinutes: 0,
    walkingMinutes: walk.minutes,
    walkingMetersApprox: walk.approxMeters,
    legs: [],
    segments,
    estimatedDelayMinutes: 0,
    reliability: calculateJourneyReliability({
      delayMinutes: 0,
      transferWaitMinutes: 0,
      transferCount: 0,
    }),
    warnings: [
      {
        code: "WALK_ONLY",
        severity: "INFO",
        message: `Walk-only option: about ${walk.approxMeters} m (${walk.minutes} min, approximate) with no bus required.`,
        provenance: "CALCULATED",
      },
      {
        code: "WALKING_ESTIMATE",
        severity: "INFO",
        message:
          "Walking distance is an approximation (straight-line × 1.35), not a road-routed pedestrian distance.",
        provenance: "CALCULATED",
      },
    ],
    meetsRequiredArrival: arrivalMinute <= requiredMinute,
    minutesRelativeToRequiredArrival: arrivalMinute - requiredMinute,
    usedRouteIds: [],
    walkingEstimates: [walk],
    rankings: {},
    provenance: "CALCULATED",
  };
}

function compareFastest(a: JourneyOption, b: JourneyOption): number {
  return (
    a.totalDurationMinutes - b.totalDurationMinutes ||
    new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime() ||
    a.transferCount - b.transferCount
  );
}

function compareReliability(a: JourneyOption, b: JourneyOption): number {
  return (
    b.reliability.score - a.reliability.score ||
    new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime() ||
    a.transferCount - b.transferCount
  );
}

function compareTransfers(a: JourneyOption, b: JourneyOption): number {
  return (
    a.transferCount - b.transferCount ||
    b.reliability.score - a.reliability.score ||
    new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
  );
}

function assignRanks(options: JourneyOption[]): void {
  const rank = (category: JourneyRecommendationCategory, comparator: (a: JourneyOption, b: JourneyOption) => number) => {
    [...options].sort(comparator).forEach((option, index) => {
      option.rankings[category] = index + 1;
    });
  };
  rank("FASTEST", compareFastest);
  rank("MOST_RELIABLE", compareReliability);
  rank("FEWEST_TRANSFERS", compareTransfers);
}

function buildRecommendations(
  meeting: JourneyOption[],
): JourneyOptionSet[] {
  if (meeting.length === 0) return [];
  const fastest = [...meeting].sort(compareFastest)[0];
  const reliable = [...meeting].sort(compareReliability)[0];
  const fewest = [...meeting].sort(compareTransfers)[0];

  const winners: Array<{
    category: JourneyRecommendationCategory;
    title: string;
    journey: JourneyOption;
    reason: string;
  }> = [
    {
      category: "FASTEST",
      title: "Fastest Route",
      journey: fastest,
      reason: `Shortest total elapsed time: ${formatDuration(fastest.totalDurationMinutes)} door to door.`,
    },
    {
      category: "MOST_RELIABLE",
      title: "Most Reliable Route",
      journey: reliable,
      reason: `Highest illustrative reliability score (${reliable.reliability.score}/100, ${reliable.reliability.label.toLowerCase()}) among feasible journeys.`,
    },
    {
      category: "FEWEST_TRANSFERS",
      title: "Fewest Transfers",
      journey: fewest,
      reason:
        fewest.transferCount === 0
          ? "Direct journey with no bus change."
          : `${fewest.transferCount} bus change — the fewest available for this search.`,
    },
  ];

  return winners.map((winner) => {
    const alsoWins = winners
      .filter((other) => other.category !== winner.category && other.journey.id === winner.journey.id)
      .map((other) => other.category);
    return {
      category: winner.category,
      title: winner.title,
      journey: winner.journey,
      reason: winner.reason,
      alsoWins,
    };
  });
}

export function requestKey(request: JourneySearchRequest): string {
  return [
    request.originVillageId,
    request.destinationId,
    request.travelDate,
    request.requiredArrivalTime,
  ].join("|");
}

export function journeySignature(option: JourneyOption): string {
  if (option.kind === "WALK_ONLY") return `walk:${option.originVillageId}:${option.destinationId}`;
  return option.legs.map((leg) => `${leg.serviceId}@${leg.boardStopId}>${leg.alightStopId}`).join("|");
}

export function describeJourney(option: JourneyOption): string {
  if (option.kind === "WALK_ONLY") return "Walk-only";
  return option.legs
    .map(
      (leg) =>
        `${leg.routeId} ${formatClock(leg.expectedDeparture)} ${leg.boardStopName} → ${leg.alightStopName}`,
    )
    .join(" · ");
}

export function generateJourneyOptions(
  state: SafarState,
  request: JourneySearchRequest,
  now: Date = new Date(),
): JourneyPlanResult {
  const notes: string[] = [];
  const originVillage = state.villages.find((village) => village.id === request.originVillageId);
  const destination = state.destinations.find((entry) => entry.id === request.destinationId);
  const requiredMinute = hhmmToMinutes(request.requiredArrivalTime);

  const emptyResult = (reason: string): JourneyPlanResult => ({
    request,
    generatedAt: now.toISOString(),
    options: [],
    meetingRequiredArrival: [],
    lateAlternatives: [],
    recommendations: [],
    noRouteReason: reason,
    notes,
    assumptions: JOURNEY_ASSUMPTIONS,
  });

  if (!originVillage || !destination) {
    return emptyResult("The selected origin village or destination is not in the demo dataset.");
  }

  if (originVillage.id === destination.villageId) {
    notes.push(
      `Your origin and destination are both in ${originVillage.name}. Bus journeys are still calculated, and a walk-only option appears if the distance is short.`,
    );
  }

  const contexts = buildRouteContexts(state);
  const allLegs = buildLegs(state, request, contexts);

  const candidateJourneys: JourneyOption[] = [];
  const seen = new Set<string>();

  const pushJourney = (journey: JourneyOption | null) => {
    if (!journey) return;
    const signature = `${journeySignature(journey)}|${journey.departureTime}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    candidateJourneys.push(journey);
  };

  const singleLegs = allLegs.filter(
    (leg) => isOriginStopNear(leg.boardStop, originVillage) && isDropStopNear(leg.alightStop, destination),
  );
  for (const leg of singleLegs) {
    pushJourney(
      buildBusJourney({
        legs: [leg],
        originVillage,
        destination,
        request,
        requiredMinute,
      }),
    );
  }

  if (MAX_TRANSFERS >= 1) {
    const legsByBoardStop = new Map<string, InternalLeg[]>();
    for (const leg of allLegs) {
      const list = legsByBoardStop.get(leg.boardStop.id);
      if (list) list.push(leg);
      else legsByBoardStop.set(leg.boardStop.id, [leg]);
    }

    const stopsById = new Map(state.stops.map((stop) => [stop.id, stop]));
    const nearbyByStop = new Map<string, Stop[]>();
    for (const stop of state.stops) {
      nearbyByStop.set(
        stop.id,
        state.stops.filter(
          (candidate) =>
            candidate.id === stop.id ||
            haversineMeters(stop.coordinates, candidate.coordinates) * 1.35 <=
              MAX_TRANSFER_WALK_METERS,
        ),
      );
    }

    for (const firstLeg of allLegs) {
      if (!isOriginStopNear(firstLeg.boardStop, originVillage)) continue;
      const neighbours = nearbyByStop.get(firstLeg.alightStop.id) ?? [];
      for (const transferStop of neighbours) {
        if (!stopsById.has(transferStop.id)) continue;
        for (const secondLeg of legsByBoardStop.get(transferStop.id) ?? []) {
          if (secondLeg.route.id === firstLeg.route.id) continue;
          if (secondLeg.service.id === firstLeg.service.id) continue;
          if (!isDropStopNear(secondLeg.alightStop, destination)) continue;

          const transferWalk = estimateWalking(
            firstLeg.alightStop.coordinates,
            secondLeg.boardStop.coordinates,
          );
          const earliestBoard =
            firstLeg.arriveMinute +
            firstLeg.delayMinutes +
            transferWalk.minutes +
            MIN_TRANSFER_BUFFER_MINUTES;
          if (secondLeg.departMinute < earliestBoard) continue;
          if (secondLeg.departMinute > requiredMinute + LATE_ALTERNATIVE_WINDOW_MINUTES) continue;

          pushJourney(
            buildBusJourney({
              legs: [firstLeg, secondLeg],
              originVillage,
              destination,
              request,
              requiredMinute,
            }),
          );
        }
      }
    }
  }

  pushJourney(buildWalkOnlyJourney(originVillage, destination, request, requiredMinute));

  const meeting = candidateJourneys
    .filter((journey) => journey.meetsRequiredArrival)
    .sort(compareFastest);
  const late = candidateJourneys
    .filter((journey) => !journey.meetsRequiredArrival)
    .sort(
      (a, b) =>
        a.minutesRelativeToRequiredArrival - b.minutesRelativeToRequiredArrival ||
        compareFastest(a, b),
    )
    .slice(0, 5);

  assignRanks(meeting);

  const blockedRouteIds = state.routes
    .filter((route) => contexts.get(route.id)?.blocked)
    .map((route) => route.id);
  if (blockedRouteIds.length > 0) {
    notes.push(
      `Route${blockedRouteIds.length > 1 ? "s" : ""} ${blockedRouteIds.join(", ")} excluded from planning because a confirmed road blockage or diversion is active.`,
    );
  }

  const unavailableBuses = state.buses.filter(
    (bus) => bus.status === "UNAVAILABLE" || bus.status === "MAINTENANCE",
  );
  if (unavailableBuses.length > 0) {
    notes.push(
      `Services using unavailable or maintenance buses are excluded (${unavailableBuses
        .map((bus) => bus.registration)
        .join(", ")}).`,
    );
  }

  let noRouteReason: string | undefined;
  if (meeting.length === 0) {
    noRouteReason =
      late.length > 0
        ? `No journey meets your ${request.requiredArrivalTime} required arrival time. Late alternatives are shown below — they arrive after your deadline.`
        : `No feasible journey was found from ${originVillage.name} to ${destination.name} on your selected date with the current demo timetable.`;
  }

  return {
    request,
    generatedAt: now.toISOString(),
    options: [...meeting, ...late],
    meetingRequiredArrival: meeting,
    lateAlternatives: late,
    recommendations: buildRecommendations(meeting),
    noRouteReason,
    notes,
    assumptions: JOURNEY_ASSUMPTIONS,
  };
}
