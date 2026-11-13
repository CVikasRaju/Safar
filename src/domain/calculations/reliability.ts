import type { ReliabilityLabel, ReliabilityPenalty, ReliabilityResult as JourneyReliabilityResult } from "../types/journey";
import type {
  JourneyOption,
  AppState,
  EventRouteImpact,
  Bus,
  Route,
} from "../types";
import { getRelevantEventImpacts } from "./eventImpact";

/**
 * Illustrative prototype reliability (docs/09).
 *
 * score = clamp(100 − sum(normalised penalties), 0, 100)
 *
 * Penalty caps follow the documented maximums (delay 25, event 20, transfer
 * waiting 15, connection-buffer risk 15, bus availability 15, transfer count
 * 10).
 */
export const RELIABILITY_DISCLAIMER =
  "Illustrative prototype reliability score. Not a statistically validated probability.";

export const RELIABILITY_FACTORS = {
  delayMaxMinutes: 45,
  delayMaxPenalty: 25,
  eventMaxPenalty: 20,
  transferWaitMaxMinutes: 60,
  transferWaitMaxPenalty: 15,
  connectionSlackTargetMinutes: 10,
  connectionBufferMaxPenalty: 15,
  availabilityMaxPenalty: 15,
  transferCountPenalty: [0, 6, 10],
} as const;

export interface ReliabilityFactors {
  delayMinutes: number;
  /** Highest event impact score (0–100) on any used route during the journey window. */
  eventImpactScore?: number;
  transferWaitMinutes: number;
  /** Smallest slack beyond the minimum transfer buffer. Undefined when there is no transfer. */
  minConnectionSlackMinutes?: number;
  transferCount: number;
  /** 0–1 risk contributed by bus status and unaccounted active disruptions. */
  availabilityRisk?: number;
}

export interface ReliabilityContext {
  eventImpacts: EventRouteImpact[];
  buses: Bus[];
  activeIncidentRouteIds: string[];
  /** Timetable service id → route id. Fixes service ids such as T101A → R101. */
  routeIdByServiceId?: Record<string, string>;
}

export interface ReliabilityPenalties {
  delay: number;
  eventImpact: number;
  transferWaiting: number;
  connectionBuffer: number;
  busAvailability: number;
  transferCount: number;
}

export interface Member3ReliabilityResult {
  score: number;
  label: string;
  penalties: ReliabilityPenalties;
  totalPenalty: number;
  routeIds: string[];
  eventDelayExcludedMinutes: number;
  disclaimer: string;
  notes: string[];
}

export interface RouteReliabilityResult {
  routeId: string;
  routeName: string;
  score: number;
  label: string;
  penalties: ReliabilityPenalties;
  totalPenalty: number;
  activeIncidentIds: string[];
  eventIds: string[];
  busStatusNotes: string[];
  explanation: string;
  disclaimer: string;
  updatedAt: string;
}

export type { JourneyReliabilityResult as ReliabilityResult };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function reliabilityLabel(score: number): ReliabilityLabel {
  if (score >= 80) return "High";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Low";
  return "Very Low";
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function delayPenalty(delayMinutes: number): number {
  if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) return 0;
  return Math.min(25, Math.round((delayMinutes / 30) * 25));
}

function eventImpactPenalty(routeIds: string[], impacts: EventRouteImpact[]): number {
  if (routeIds.length === 0 || impacts.length === 0) return 0;
  const relevant = impacts.filter((impact) => routeIds.includes(impact.routeId));
  if (relevant.length === 0) return 0;
  const strongest = Math.max(...relevant.map((impact) => impact.impactScore));
  return Math.min(20, Math.round((strongest / 100) * 20));
}

function transferWaitingPenalty(waitingMinutes: number): number {
  if (!Number.isFinite(waitingMinutes) || waitingMinutes <= 5) return 0;
  return Math.min(15, Math.round(((waitingMinutes - 5) / 25) * 15));
}

function connectionBufferPenalty(transferCount: number, waitingMinutes: number): number {
  if (transferCount === 0) return 0;
  const averageBuffer = waitingMinutes / transferCount;
  if (!Number.isFinite(averageBuffer) || averageBuffer >= 10) return 0;
  return Math.min(15, Math.round(((10 - averageBuffer) / 10) * 15));
}

function busAvailabilityPenalty(
  routeIds: string[],
  buses: Bus[],
  activeIncidentRouteIds: string[],
): number {
  if (routeIds.length === 0) return 10;
  if (routeIds.some((routeId) => activeIncidentRouteIds.includes(routeId))) return 15;

  const relevantBuses = buses.filter((bus) => routeIds.includes(bus.assignedRouteId ?? ""));
  if (relevantBuses.length === 0) return 10;

  const unavailable = relevantBuses.filter(
    (bus) => bus.status === "UNAVAILABLE" || bus.status === "MAINTENANCE",
  );
  if (unavailable.length > 0) return 15;

  return 0;
}

function transferCountPenalty(transferCount: number): number {
  if (transferCount <= 0) return 0;
  if (transferCount === 1) return 3;
  if (transferCount === 2) return 7;
  return 10;
}

function journeyRouteIds(
  journey: JourneyOption,
  context: ReliabilityContext,
  notes: string[],
): string[] {
  const routeIds = new Set<string>();
  for (const segment of journey.segments) {
    if (segment.type !== "BUS" || !segment.serviceId) continue;
    const mapped = context.routeIdByServiceId?.[segment.serviceId];
    if (mapped) {
      routeIds.add(mapped);
      continue;
    }
    if (/^R\d{3}/.test(segment.serviceId)) {
      routeIds.add(segment.serviceId.slice(0, 4));
    } else {
      notes.push(
        `Service ${segment.serviceId} has no timetable route mapping; route-specific event and incident factors were not applied.`,
      );
    }
  }
  return [...routeIds];
}

function journeyWaitingMinutes(journey: JourneyOption): number {
  return journey.segments
    .filter((segment) => segment.type === "WAIT")
    .reduce((sum, segment) => sum + (segment.durationMinutes || 0), 0);
}

function calculateJourneyOptionReliability(
  journey: JourneyOption,
  context: ReliabilityContext,
): Member3ReliabilityResult {
  const notes: string[] = [];
  const routeIds = journeyRouteIds(journey, context, notes);
  const totalWaitMinutes = journeyWaitingMinutes(journey);

  const relevantImpacts = context.eventImpacts.filter((impact) =>
    routeIds.includes(impact.routeId),
  );
  const strongestEventDelay = relevantImpacts.reduce(
    (maximum, impact) => Math.max(maximum, impact.estimatedDelayMinutes ?? 0),
    0,
  );

  const eventDelayExcludedMinutes = Math.min(
    Math.max(0, journey.estimatedDelayMinutes || 0),
    strongestEventDelay,
  );
  const residualDelay = Math.max(0, (journey.estimatedDelayMinutes || 0) - eventDelayExcludedMinutes);

  const penalties: ReliabilityPenalties = {
    delay: delayPenalty(residualDelay),
    eventImpact: eventImpactPenalty(routeIds, context.eventImpacts),
    transferWaiting: transferWaitingPenalty(totalWaitMinutes),
    connectionBuffer: connectionBufferPenalty(journey.transferCount, totalWaitMinutes),
    busAvailability: busAvailabilityPenalty(
      routeIds,
      context.buses,
      context.activeIncidentRouteIds,
    ),
    transferCount: transferCountPenalty(journey.transferCount),
  };

  const totalPenalty = Object.values(penalties).reduce((sum, value) => sum + value, 0);
  const score = Math.min(100, Math.max(0, Math.round(100 - totalPenalty)));

  if (penalties.delay > 0) {
    notes.push(
      `Delay penalty ${penalties.delay}/25 based on ${residualDelay} min illustrative delay`,
    );
  }
  if (eventDelayExcludedMinutes > 0) {
    notes.push(
      `Excluded ${eventDelayExcludedMinutes} min from delay penalty to prevent double-counting event impact`,
    );
  }
  if (penalties.eventImpact > 0) {
    notes.push(
      `Event impact penalty ${penalties.eventImpact}/20 based on corridor event impact`,
    );
  }
  if (penalties.transferWaiting > 0) {
    notes.push(`Transfer waiting penalty ${penalties.transferWaiting}/15 (${totalWaitMinutes} min wait)`);
  }
  if (penalties.connectionBuffer > 0) {
    notes.push(`Connection buffer risk penalty ${penalties.connectionBuffer}/15`);
  }
  if (penalties.busAvailability > 0) {
    notes.push(`Bus availability penalty ${penalties.busAvailability}/15`);
  }
  if (penalties.transferCount > 0) {
    notes.push(`Transfer count penalty ${penalties.transferCount}/10 (${journey.transferCount} transfers)`);
  }
  if (notes.length === 0) {
    notes.push("Direct journey on an unimpaired route with no recorded operational risks.");
  }

  return {
    score,
    label: reliabilityLabel(score),
    penalties,
    totalPenalty,
    routeIds,
    eventDelayExcludedMinutes,
    disclaimer: RELIABILITY_DISCLAIMER,
    notes,
  };
}

function calculateJourneyFactorsReliability(
  factors: ReliabilityFactors,
): JourneyReliabilityResult & { totalPenalty: number } {
  const penalties: ReliabilityPenalty[] = [];

  const delayRatio = clamp(factors.delayMinutes / RELIABILITY_FACTORS.delayMaxMinutes, 0, 1);
  penalties.push({
    key: "delay",
    label: "Expected delay",
    maxPenalty: RELIABILITY_FACTORS.delayMaxPenalty,
    value: Math.round(delayRatio * RELIABILITY_FACTORS.delayMaxPenalty),
    reason:
      factors.delayMinutes > 0
        ? `${factors.delayMinutes} min illustrative delay applied from confirmed operational records.`
        : "No confirmed delay recorded for the services used.",
  });

  const eventScore = clamp(factors.eventImpactScore ?? 0, 0, 100);
  penalties.push({
    key: "event",
    label: "Event impact",
    maxPenalty: RELIABILITY_FACTORS.eventMaxPenalty,
    value: Math.round((eventScore / 100) * RELIABILITY_FACTORS.eventMaxPenalty),
    reason:
      eventScore > 0
        ? `Highest predicted event impact score on a used route is ${eventScore}/100.`
        : "No predicted event impact overlaps this journey.",
  });

  const waitRatio = clamp(
    factors.transferWaitMinutes / RELIABILITY_FACTORS.transferWaitMaxMinutes,
    0,
    1,
  );
  penalties.push({
    key: "transferWait",
    label: "Transfer waiting",
    maxPenalty: RELIABILITY_FACTORS.transferWaitMaxPenalty,
    value: Math.round(waitRatio * RELIABILITY_FACTORS.transferWaitMaxPenalty),
    reason:
      factors.transferWaitMinutes > 0
        ? `${factors.transferWaitMinutes} min total connection waiting.`
        : "No connection waiting time.",
  });

  const slack = factors.minConnectionSlackMinutes;
  const bufferPenalty =
    slack === undefined
      ? 0
      : Math.round(
          clamp(
            (RELIABILITY_FACTORS.connectionSlackTargetMinutes - slack) /
              RELIABILITY_FACTORS.connectionSlackTargetMinutes,
            0,
            1,
          ) * RELIABILITY_FACTORS.connectionBufferMaxPenalty,
        );
  penalties.push({
    key: "connectionBuffer",
    label: "Connection buffer",
    maxPenalty: RELIABILITY_FACTORS.connectionBufferMaxPenalty,
    value: bufferPenalty,
    reason:
      slack === undefined
        ? "No transfer, so no connection risk."
        : `Tightest connection has ${Math.max(0, slack)} min spare after the 4 min minimum buffer.`,
  });

  const availabilityRisk = clamp(factors.availabilityRisk ?? 0, 0, 1);
  penalties.push({
    key: "availability",
    label: "Bus availability",
    maxPenalty: RELIABILITY_FACTORS.availabilityMaxPenalty,
    value: Math.round(availabilityRisk * RELIABILITY_FACTORS.availabilityMaxPenalty),
    reason:
      availabilityRisk > 0
        ? "Includes replacement-bus operation or an active disruption without a delay estimate."
        : "Assigned buses are operating normally in the demo fleet.",
  });

  const transferPenalty =
    RELIABILITY_FACTORS.transferCountPenalty[
      Math.min(factors.transferCount, RELIABILITY_FACTORS.transferCountPenalty.length - 1)
    ] ?? 10;
  penalties.push({
    key: "transfers",
    label: "Number of transfers",
    maxPenalty: 10,
    value: transferPenalty,
    reason:
      factors.transferCount === 0
        ? "Direct journey with no bus change."
        : `${factors.transferCount} bus change${factors.transferCount > 1 ? "s" : ""}.`,
  });

  const totalPenalty = penalties.reduce((sum, item) => sum + item.value, 0);
  const score = roundScore(100 - totalPenalty);

  return {
    score,
    label: reliabilityLabel(score),
    penalties,
    totalPenalty,
    disclaimer: RELIABILITY_DISCLAIMER,
  };
}

export function calculateJourneyReliability(factors: ReliabilityFactors): JourneyReliabilityResult & { totalPenalty: number };
export function calculateJourneyReliability(journey: JourneyOption, context: ReliabilityContext): Member3ReliabilityResult;
export function calculateJourneyReliability(
  first: ReliabilityFactors | JourneyOption,
  second?: ReliabilityContext,
): any {
  if (second !== undefined || "segments" in first) {
    return calculateJourneyOptionReliability(first as JourneyOption, second!);
  }
  return calculateJourneyFactorsReliability(first as ReliabilityFactors);
}

export function buildReliabilityContext(state: AppState): ReliabilityContext {
  const routeIdByServiceId: Record<string, string> = {
    T101A: "R101",
    T101B: "R101",
    T102A: "R102",
    T103A: "R103",
    T104A: "R104",
  };
  const timetables = state.timetables ?? state.timetableServices ?? [];
  for (const service of timetables) {
    routeIdByServiceId[service.id] = service.routeId;
  }

  const activeIncidentRouteIds = state.incidents
    .filter((incident) => incident.status === "ACTIVE")
    .map((incident) => incident.routeId)
    .filter((routeId): routeId is string => routeId !== undefined);

  return {
    eventImpacts: getRelevantEventImpacts(state),
    buses: state.buses,
    activeIncidentRouteIds,
    routeIdByServiceId,
  };
}

export function recalculateJourneyReliability(
  journey: JourneyOption,
  state: AppState,
): Member3ReliabilityResult {
  return calculateJourneyReliability(journey, buildReliabilityContext(state));
}

export function calculateRouteReliability(
  routeId: string,
  state: AppState,
): RouteReliabilityResult {
  const route: Route | undefined = state.routes.find((item) => item.id === routeId);
  const routeName = route?.name ?? routeId;

  const relevantImpacts = getRelevantEventImpacts(state).filter(
    (impact) => impact.routeId === routeId,
  );
  const activeIncidents = state.incidents.filter(
    (incident) => incident.status === "ACTIVE" && incident.routeId === routeId,
  );
  const routeBuses = state.buses.filter((bus) => bus.assignedRouteId === routeId);
  const impairedBuses = routeBuses.filter(
    (bus) => bus.status === "UNAVAILABLE" || bus.status === "MAINTENANCE",
  );

  const strongestImpact = relevantImpacts.reduce(
    (maximum, impact) => Math.max(maximum, impact.impactScore),
    0,
  );

  const illustrativeIncidentDelay = activeIncidents.length > 0 ? 20 : 0;

  const penalties: ReliabilityPenalties = {
    delay: delayPenalty(illustrativeIncidentDelay),
    eventImpact: Math.min(20, Math.round((strongestImpact / 100) * 20)),
    transferWaiting: 0,
    connectionBuffer: 0,
    busAvailability:
      activeIncidents.length > 0 || impairedBuses.length > 0
        ? 15
        : routeBuses.length === 0
          ? 10
          : 0,
    transferCount: 0,
  };

  const totalPenalty = Object.values(penalties).reduce((sum, value) => sum + value, 0);
  const score = Math.min(100, Math.max(0, Math.round(100 - totalPenalty)));

  const eventNames = relevantImpacts.map((impact) => {
    const event = state.events.find((item) => item.id === impact.eventId);
    return `${event?.name ?? impact.eventId} (${impact.impactScore}/100 ${impact.riskLevel})`;
  });
  const incidentDescriptions = activeIncidents.map(
    (incident) => `${incident.type.replace(/_/g, " ").toLowerCase()} incident ${incident.id}`,
  );
  const busNotes = routeBuses.map(
    (bus) => `${bus.registration}: ${bus.status.replace(/_/g, " ").toLowerCase()}`,
  );

  const explanationParts = [
    `Route ${routeId}: ${score}/100 (${reliabilityLabel(score)}).`,
    relevantImpacts.length > 0
      ? `Relevant event impact: ${eventNames.join("; ")}.`
      : "No upcoming/relevant event impact is recorded for this route.",
    activeIncidents.length > 0
      ? `Active confirmed incident(s): ${incidentDescriptions.join("; ")} — illustrative 20 min delay factor applied.`
      : "No active confirmed incident on this route.",
    routeBuses.length === 0
      ? "No bus is currently assigned to this route."
      : `Fleet: ${busNotes.join("; ")}.`,
    "Transfer waiting, connection buffer and transfer count are journey-specific and are not applied to the route estimate.",
  ];

  return {
    routeId,
    routeName,
    score,
    label: reliabilityLabel(score),
    penalties,
    totalPenalty,
    activeIncidentIds: activeIncidents.map((incident) => incident.id),
    eventIds: relevantImpacts.map((impact) => impact.eventId),
    busStatusNotes: busNotes,
    explanation: explanationParts.join(" "),
    disclaimer: RELIABILITY_DISCLAIMER,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateAllRouteReliability(state: AppState): RouteReliabilityResult[] {
  return state.routes.map((route) => calculateRouteReliability(route.id, state));
}
