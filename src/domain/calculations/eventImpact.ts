import type {
  EventImpactFactors,
  EventRouteImpact,
  JourneyOption,
  NetworkData,
  RegionalEvent,
  RiskLevel,
  Route,
  RouteDemandSeed,
  SafarState,
  StudentTravelRequest,
} from "../types";
import {
  CROWD_LEVEL_SCORE,
  EVENT_AFFECTED_ROUTE_THRESHOLD,
  EVENT_FULL_DURATION_MINUTES,
  EVENT_IMPACT_WEIGHTS,
  EVENT_MAX_DELAY_MINUTES,
  RISK_BANDS,
} from "../constants";
import { clamp, timeToMinutes } from "../time";
import { findRoute, getRouteServiceSpan, getRouteStops } from "../network";
import { routeImportanceScore } from "./demand";
import { generateJourneyOptions } from "./journey";

export interface EventImpactContext {
  network: NetworkData;
  demandSeed: RouteDemandSeed[];
  state?: SafarState;
}

export interface EventImpactComputation {
  score: number;
  risk: RiskLevel;
  factors: EventImpactFactors;
  weightsUsed: Partial<Record<keyof EventImpactFactors, number>>;
  missingFactors: Array<keyof EventImpactFactors>;
  estimatedDelayMinutes: number;
  proximityBasis: string;
  timeOverlapMinutes: number;
  explanation: string;
  suggestedAction: string;
  provenance: "CALCULATED";
}

export function riskForScore(score: number): RiskLevel {
  const bounded = clamp(score, 0, 100);
  const band = RISK_BANDS.find((candidate) => bounded >= candidate.min && bounded <= candidate.max);
  return (band?.level ?? "LOW") as RiskLevel;
}

function suggestedActionFor(risk: RiskLevel): string {
  switch (risk) {
    case "CRITICAL":
      return "Recommend an earlier departure or an alternative route, and pre-position replacement capacity before the impact window.";
    case "HIGH":
      return "Warn students and monitor the corridor before and during the impact window.";
    case "MODERATE":
      return "Monitor the route and confirm departure status before travel.";
    default:
      return "No preventive action required beyond normal monitoring.";
  }
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

/** Illustrative proximity only. Straight-line distance is never used as walking distance. */
function approximateDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(latitudeB - latitudeA);
  const deltaLon = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

function proximityScore(distanceKm: number): number {
  if (distanceKm <= 1) return 100;
  if (distanceKm <= 3) return 80;
  if (distanceKm <= 5) return 60;
  if (distanceKm <= 8) return 40;
  if (distanceKm <= 12) return 20;
  return 5;
}

function computeEventWindow(event: RegionalEvent): {
  startMin: number;
  endMin: number;
  durationMinutes: number;
  bufferSource?: string;
} | null {
  try {
    const startMin = timeToMinutes(event.startTime);
    const endMin = timeToMinutes(event.endTime);
    if (endMin <= startMin) return null;
    const buffer = event.preparationBuffer?.minutes ?? 0;
    return {
      startMin: Math.max(0, startMin - buffer),
      endMin,
      durationMinutes: endMin - Math.max(0, startMin - buffer),
      bufferSource: event.preparationBuffer?.source,
    };
  } catch {
    return null;
  }
}

/**
 * Deterministic illustrative event-impact score (0–100) for one route.
 *
 * Weights are renormalised across available factors; missing data is never
 * invented. An event's congestion estimate is explicitly not a verified road
 * closure or a live traffic measurement.
 */
export function calculateEventImpact(
  event: RegionalEvent,
  route: Route,
  context: EventImpactContext,
): EventImpactComputation {
  const { network, demandSeed } = context;
  const missingFactors: Array<keyof EventImpactFactors> = [];

  const crowdIntensity = CROWD_LEVEL_SCORE[event.crowdLevel] ?? null;
  if (crowdIntensity === null) missingFactors.push("crowdIntensity");

  // Proximity: explicit event-route association first, then nearby villages,
  // then labelled straight-line proximity to route stops.
  let routeProximity: number | null = null;
  let proximityBasis = "";
  if (event.declaredAffectedRouteIds.includes(route.id)) {
    routeProximity = 100;
    proximityBasis = "Explicit event–route association declared in the event record.";
  } else {
    const routeStopVillageIds = new Set(
      getRouteStops(network, route.id).map((stop) => stop.villageId),
    );
    const nearbyVillageMatch = event.nearbyVillageIds.some((villageId) =>
      routeStopVillageIds.has(villageId),
    );
    if (nearbyVillageMatch) {
      routeProximity = 70;
      proximityBasis =
        "Estimated: the route serves a village configured as nearby the event. Not a verified road location.";
    } else if (event.latitude !== undefined && event.longitude !== undefined) {
      const stops = getRouteStops(network, route.id);
      const distances = stops.map((stop) =>
        approximateDistanceKm(event.latitude!, event.longitude!, stop.latitude, stop.longitude),
      );
      if (distances.length > 0) {
        const nearest = Math.min(...distances);
        routeProximity = proximityScore(nearest);
        proximityBasis = `Estimated straight-line proximity: nearest route stop is about ${nearest.toFixed(1)} km away. Not a routed road distance.`;
      }
    }
    if (routeProximity === null) {
      missingFactors.push("routeProximity");
      proximityBasis = "No event-route association, nearby village or event coordinates available.";
    }
  }

  const eventWindow = computeEventWindow(event);
  const serviceSpan = getRouteServiceSpan(network, route.id);
  let timeOverlap: number | null = null;
  let timeOverlapMinutes = 0;
  let overlapBasis = "";
  if (!eventWindow) {
    missingFactors.push("timeOverlap");
    overlapBasis = "Event start/end time is missing or invalid.";
  } else if (!serviceSpan) {
    missingFactors.push("timeOverlap");
    overlapBasis = "The route has no timetable span.";
  } else {
    const overlapStart = Math.max(eventWindow.startMin, serviceSpan.firstDeparture);
    const overlapEnd = Math.min(eventWindow.endMin, serviceSpan.lastArrival);
    timeOverlapMinutes = Math.max(0, overlapEnd - overlapStart);
    timeOverlap = clamp(
      Math.round((timeOverlapMinutes / eventWindow.durationMinutes) * 100),
      0,
      100,
    );
    overlapBasis = `${timeOverlapMinutes} minute(s) of the ${eventWindow.durationMinutes}-minute event impact window overlap this route's ${Math.floor(serviceSpan.firstDeparture / 60)}:${String(serviceSpan.firstDeparture % 60).padStart(2, "0")}–${Math.floor(serviceSpan.lastArrival / 60)}:${String(serviceSpan.lastArrival % 60).padStart(2, "0")} service span.${eventWindow.bufferSource ? ` Impact window includes: ${eventWindow.bufferSource}.` : ""}`;
  }

  const routeImportance = routeImportanceScore(route.id, demandSeed);

  let eventDuration: number | null = null;
  if (eventWindow) {
    eventDuration = clamp(
      Math.round((eventWindow.durationMinutes / EVENT_FULL_DURATION_MINUTES) * 100),
      0,
      100,
    );
  } else {
    missingFactors.push("eventDuration");
  }

  const factors: EventImpactFactors = {
    crowdIntensity,
    routeProximity,
    timeOverlap,
    routeImportance,
    eventDuration,
  };

  const availableKeys = (Object.keys(EVENT_IMPACT_WEIGHTS) as Array<keyof EventImpactFactors>).filter(
    (key) => factors[key] !== null,
  );
  const availableWeight = availableKeys.reduce(
    (sum, key) => sum + EVENT_IMPACT_WEIGHTS[key],
    0,
  );

  const weightsUsed: Partial<Record<keyof EventImpactFactors, number>> = {};
  let weightedSum = 0;
  for (const key of availableKeys) {
    const normalizedWeight = EVENT_IMPACT_WEIGHTS[key] / availableWeight;
    weightsUsed[key] = Math.round(normalizedWeight * 1000) / 1000;
    weightedSum += (factors[key] as number) * normalizedWeight;
  }

  const score = clamp(Math.round(weightedSum), 0, 100);
  const risk = riskForScore(score);
  const estimatedDelayMinutes = Math.round((score / 100) * EVENT_MAX_DELAY_MINUTES);

  const factorSummary = availableKeys
    .map(
      (key) =>
        `${key} ${Math.round(factors[key] as number)} × ${Math.round((weightsUsed[key] ?? 0) * 100)}%`,
    )
    .join(", ");

  const explanation = `Predicted event impact ${score}/100 (${risk}) for ${route.id}. Weighted factors: ${factorSummary}. ${overlapBasis} ${proximityBasis} ${
    missingFactors.length > 0
      ? `${missingFactors.length} factor(s) unavailable and excluded by renormalising weights (${missingFactors.join(", ")}).`
      : "All five factors were available."
  } This is an illustrative congestion estimate, not a verified road closure or live traffic measurement.`;

  return {
    score,
    risk,
    factors,
    weightsUsed,
    missingFactors,
    estimatedDelayMinutes,
    proximityBasis,
    timeOverlapMinutes,
    explanation,
    suggestedAction: suggestedActionFor(risk),
    provenance: "CALCULATED",
  };
}

export function buildEventRouteImpact(
  event: RegionalEvent,
  routeId: string,
  context: EventImpactContext,
): EventRouteImpact | null {
  const route = findRoute(context.network, routeId);
  if (!route) return null;
  const computation = calculateEventImpact(event, route, context);
  return {
    eventId: event.id,
    routeId,
    score: computation.score,
    risk: computation.risk,
    factors: computation.factors,
    weightsUsed: computation.weightsUsed,
    missingFactors: computation.missingFactors,
    estimatedDelayMinutes: computation.estimatedDelayMinutes,
    proximityBasis: computation.proximityBasis,
    timeOverlapMinutes: computation.timeOverlapMinutes,
    explanation: computation.explanation,
    suggestedAction: computation.suggestedAction,
    provenance: "CALCULATED",
  };
}

/** Calculates impact for every route in the network, ordered high to low. */
export function calculateAllRouteImpacts(
  event: RegionalEvent,
  context: EventImpactContext,
): EventRouteImpact[] {
  return context.network.routes
    .map((route) => buildEventRouteImpact(event, route.id, context))
    .filter((impact): impact is EventRouteImpact => Boolean(impact))
    .sort((a, b) => b.score - a.score || a.routeId.localeCompare(b.routeId));
}

/**
 * Routes considered affected for warnings and summaries.
 * When an event record declares its affected routes, that explicit
 * event–route association is authoritative and prevents SAFAR from claiming
 * extra routes are affected on the strength of an approximate proximity score.
 */
export function identifyAffectedRoutes(
  event: RegionalEvent,
  context: EventImpactContext,
): EventRouteImpact[] {
  const allImpacts = calculateAllRouteImpacts(event, context);
  const scoped =
    event.declaredAffectedRouteIds.length > 0
      ? allImpacts.filter((impact) =>
          event.declaredAffectedRouteIds.includes(impact.routeId),
        )
      : allImpacts;
  return scoped.filter((impact) => impact.score >= EVENT_AFFECTED_ROUTE_THRESHOLD);
}

export interface AffectedJourney {
  request: StudentTravelRequest;
  journey: JourneyOption;
  affectedRouteIds: string[];
  impactScores: Record<string, number>;
}

/**
 * Identifies journeys from submitted travel requests that use an affected route.
 * Returns an empty array honestly when no submitted journey is affected.
 */
export function identifyAffectedJourneys(
  event: RegionalEvent,
  state: SafarState,
  options: {
    requests?: StudentTravelRequest[];
    includeLateAlternatives?: boolean;
  } = {},
): AffectedJourney[] {
  const network: NetworkData = {
    villages: state.villages,
    destinations: state.destinations,
    stops: state.stops,
    routes: state.routes,
    services: state.services,
    stopWalkLinks: state.stopWalkLinks,
  };
  const impacts = identifyAffectedRoutes(event, {
    network,
    demandSeed: state.demandSeed,
    state,
  });
  const impactByRoute = new Map(impacts.map((impact) => [impact.routeId, impact.score]));
  const requests = options.requests ?? state.travelRequests;
  const affected: AffectedJourney[] = [];

  for (const request of requests) {
    let journeys: JourneyOption[] = [];
    try {
      journeys = generateJourneyOptions(
        {
          originVillageId: request.originVillageId,
          destinationId: request.destinationId,
          travelDate: request.travelDate,
          requiredArrivalTime: request.requiredArrivalTime,
          passengers: request.groupSize,
        },
        network,
        state,
      );
    } catch {
      continue;
    }
    if (!options.includeLateAlternatives) {
      journeys = journeys.filter((journey) => journey.meetsRequiredArrival);
    }
    for (const journey of journeys) {
      const affectedRoutes = journey.routeIds.filter((routeId) =>
        impactByRoute.has(routeId),
      );
      if (affectedRoutes.length === 0) continue;
      affected.push({
        request,
        journey,
        affectedRouteIds: affectedRoutes,
        impactScores: Object.fromEntries(
          affectedRoutes.map((routeId) => [routeId, impactByRoute.get(routeId) ?? 0]),
        ),
      });
    }
  }
  return affected;
}
