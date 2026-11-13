// SAFAR — Journey & Route Reliability (Member 3)
// Penalty-based illustrative score 0–100 per docs/09_RELIABILITY_AND_DELAY.md
//
// Maximum penalties (documented prototype caps):
//   Expected delay            25
//   Event impact              20
//   Transfer waiting          15
//   Connection-buffer risk    15
//   Bus availability          15
//   Transfer count            10
//
// score = clamp(100 - sum(penalties), 0, 100)
//
// The score is illustrative only. It is NOT a probability and has not been
// statistically validated. The exact disclaimer is exported below and must be
// shown wherever a score is displayed.

import type {
  JourneyOption,
  AppState,
  EventRouteImpact,
  Bus,
  Route,
} from '../types';
import { getRelevantEventImpacts } from './eventImpact';

export const RELIABILITY_DISCLAIMER =
  'Illustrative prototype reliability score. Not a statistically validated probability.';

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

export interface ReliabilityResult {
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

// ─── Penalty components ───────────────────────────────────────────────────────
function delayPenalty(delayMinutes: number): number {
  // 0 min → 0; 30+ min → maximum 25
  if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) return 0;
  return Math.min(25, Math.round((delayMinutes / 30) * 25));
}

function eventImpactPenalty(routeIds: string[], impacts: EventRouteImpact[]): number {
  if (routeIds.length === 0 || impacts.length === 0) return 0;
  const relevant = impacts.filter(impact => routeIds.includes(impact.routeId));
  if (relevant.length === 0) return 0;
  // Use the strongest single event for this journey; overlapping events are not
  // added together (avoid double counting the same corridor impact).
  const strongest = Math.max(...relevant.map(impact => impact.impactScore));
  return Math.min(20, Math.round((strongest / 100) * 20));
}

function transferWaitingPenalty(waitingMinutes: number): number {
  // Waiting itself is not a fault; long waits reduce the score progressively.
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
  if (routeIds.some(routeId => activeIncidentRouteIds.includes(routeId))) return 15;

  const relevantBuses = buses.filter(bus => routeIds.includes(bus.assignedRouteId ?? ''));
  if (relevantBuses.length === 0) return 10;

  const unavailable = relevantBuses.filter(
    bus => bus.status === 'UNAVAILABLE' || bus.status === 'MAINTENANCE',
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

// ─── Score label ──────────────────────────────────────────────────────────────
export function reliabilityLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Low';
  return 'Very Low';
}

// ─── Journey-level calculation ────────────────────────────────────────────────
function journeyRouteIds(
  journey: JourneyOption,
  context: ReliabilityContext,
  notes: string[],
): string[] {
  const routeIds = new Set<string>();
  for (const segment of journey.segments) {
    if (segment.type !== 'BUS' || !segment.serviceId) continue;
    const mapped = context.routeIdByServiceId?.[segment.serviceId];
    if (mapped) {
      routeIds.add(mapped);
      continue;
    }
    // Legacy fallback only (e.g. service id "R101-1"); a service id such as
    // T101A cannot be turned into a route id reliably, so report it instead of
    // silently inventing a mapping.
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

export function calculateJourneyReliability(
  journey: JourneyOption,
  context: ReliabilityContext,
): ReliabilityResult {
  const notes: string[] = [];
  const routeIds = journeyRouteIds(journey, context, notes);

  const totalWaitMinutes = journey.segments
    .filter(segment => segment.type === 'WAIT')
    .reduce((sum, segment) => sum + segment.durationMinutes, 0);

  const relevantImpacts = context.eventImpacts.filter(impact =>
    routeIds.includes(impact.routeId),
  );
  const strongestEventDelay = relevantImpacts.reduce(
    (maximum, impact) => Math.max(maximum, impact.estimatedDelayMinutes ?? 0),
    0,
  );

  // Event-attributable delay is represented by the capped event penalty below,
  // so it is removed from the raw delay penalty to avoid counting the same
  // event delay twice.
  const eventDelayExcludedMinutes = Math.min(
    Math.max(0, journey.estimatedDelayMinutes),
    strongestEventDelay,
  );
  const residualDelay = Math.max(0, journey.estimatedDelayMinutes - eventDelayExcludedMinutes);

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

  if (relevantImpacts.length > 0) {
    notes.push(
      `${relevantImpacts.length} relevant event impact(s) on this corridor; only the strongest is penalised.`,
    );
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

// ─── Context builder ──────────────────────────────────────────────────────────
export function buildReliabilityContext(state: AppState): ReliabilityContext {
  const routeIdByServiceId: Record<string, string> = {};
  for (const service of state.timetables) {
    routeIdByServiceId[service.id] = service.routeId;
  }

  const activeIncidentRouteIds = state.incidents
    .filter(incident => incident.status === 'ACTIVE')
    .map(incident => incident.routeId)
    .filter((routeId): routeId is string => routeId !== undefined);

  return {
    eventImpacts: getRelevantEventImpacts(state),
    buses: state.buses,
    activeIncidentRouteIds,
    routeIdByServiceId,
  };
}

/** Recalculate a journey's score against current shared state. */
export function recalculateJourneyReliability(
  journey: JourneyOption,
  state: AppState,
): ReliabilityResult {
  return calculateJourneyReliability(journey, buildReliabilityContext(state));
}

// ─── Route-level reliability ──────────────────────────────────────────────────
/**
 * Operational route estimate used by the intelligence dashboard. Transfer and
 * connection-buffer factors are journey-specific, so they are reported as not
 * applicable at route level rather than invented.
 */
export function calculateRouteReliability(
  routeId: string,
  state: AppState,
): RouteReliabilityResult {
  const route: Route | undefined = state.routes.find(item => item.id === routeId);
  const routeName = route?.name ?? routeId;

  const relevantImpacts = getRelevantEventImpacts(state).filter(
    impact => impact.routeId === routeId,
  );
  const activeIncidents = state.incidents.filter(
    incident => incident.status === 'ACTIVE' && incident.routeId === routeId,
  );
  const routeBuses = state.buses.filter(bus => bus.assignedRouteId === routeId);
  const impairedBuses = routeBuses.filter(
    bus => bus.status === 'UNAVAILABLE' || bus.status === 'MAINTENANCE',
  );

  const strongestImpact = relevantImpacts.reduce(
    (maximum, impact) => Math.max(maximum, impact.impactScore),
    0,
  );

  // Documented illustrative incident delay used for the route estimate.
  const illustrativeIncidentDelay = activeIncidents.length > 0 ? 20 : 0;

  const penalties: ReliabilityPenalties = {
    delay: delayPenalty(illustrativeIncidentDelay),
    eventImpact: Math.min(20, Math.round((strongestImpact / 100) * 20)),
    transferWaiting: 0, // not applicable at route level
    connectionBuffer: 0, // not applicable at route level
    busAvailability:
      activeIncidents.length > 0 || impairedBuses.length > 0
        ? 15
        : routeBuses.length === 0
          ? 10
          : 0,
    transferCount: 0, // not applicable at route level
  };

  const totalPenalty = Object.values(penalties).reduce((sum, value) => sum + value, 0);
  const score = Math.min(100, Math.max(0, Math.round(100 - totalPenalty)));

  const eventNames = relevantImpacts.map(impact => {
    const event = state.events.find(item => item.id === impact.eventId);
    return `${event?.name ?? impact.eventId} (${impact.impactScore}/100 ${impact.riskLevel})`;
  });
  const incidentDescriptions = activeIncidents.map(
    incident => `${incident.type.replace(/_/g, ' ').toLowerCase()} incident ${incident.id}`,
  );
  const busNotes = routeBuses.map(
    bus => `${bus.registration}: ${bus.status.replace(/_/g, ' ').toLowerCase()}`,
  );

  const explanationParts = [
    `Route ${routeId}: ${score}/100 (${reliabilityLabel(score)}).`,
    relevantImpacts.length > 0
      ? `Relevant event impact: ${eventNames.join('; ')}.`
      : 'No upcoming/relevant event impact is recorded for this route.',
    activeIncidents.length > 0
      ? `Active confirmed incident(s): ${incidentDescriptions.join('; ')} — illustrative 20 min delay factor applied.`
      : 'No active confirmed incident on this route.',
    routeBuses.length === 0
      ? 'No bus is currently assigned to this route.'
      : `Fleet: ${busNotes.join('; ')}.`,
    'Transfer waiting, connection buffer and transfer count are journey-specific and are not applied to the route estimate.',
  ];

  return {
    routeId,
    routeName,
    score,
    label: reliabilityLabel(score),
    penalties,
    totalPenalty,
    activeIncidentIds: activeIncidents.map(incident => incident.id),
    eventIds: relevantImpacts.map(impact => impact.eventId),
    busStatusNotes: busNotes,
    explanation: explanationParts.join(' '),
    disclaimer: RELIABILITY_DISCLAIMER,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateAllRouteReliability(state: AppState): RouteReliabilityResult[] {
  return state.routes.map(route => calculateRouteReliability(route.id, state));
}
