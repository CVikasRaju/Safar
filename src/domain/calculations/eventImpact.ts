// SAFAR — Regional Event Impact Calculation (Member 3)
// Deterministic weighted score 0–100 per docs/05_EVENT_INTELLIGENCE.md
//
// Factors and starting weights (documented prototype methodology):
//   Crowd intensity      25 %
//   Proximity to route   25 %
//   Time overlap         20 %
//   Route importance     15 %
//   Event duration       15 %
//
// If a factor is genuinely unavailable (for example no timetable data for a
// route), its weight is removed and the remaining weights are renormalised.
// The missing input is disclosed in the explanation — nothing is invented.
//
// These are illustrative prototype weights and thresholds, not validated
// traffic-engineering standards. The delay figure is a documented illustrative
// conversion, not a traffic forecast.

import type {
  SafarEvent,
  Route,
  EventRouteImpact,
  CrowdIntensity,
  RiskLevel,
  TimetableService,
  Stop,
  AppState,
  Provenance,
} from '../types';

// ─── Context ──────────────────────────────────────────────────────────────────
export interface EventImpactContext {
  timetables?: TimetableService[];
  stops?: Stop[];
}

export interface EventImpactFactor {
  key: EventImpactFactorKey;
  label: string;
  weight: number;        // configured weight (0–1)
  rawScore: number;      // 0–100 before weighting
  available: boolean;    // false when the input data does not exist
  contribution: number;  // points contributed after renormalisation
  basis: string;         // human-readable evidence for this factor
}

export type EventImpactFactorKey =
  | 'crowd'
  | 'proximity'
  | 'overlap'
  | 'routeImportance'
  | 'duration';

export interface EventImpactWindow {
  valid: boolean;
  startTime: string;
  endTime: string;
  bufferMinutes: number;
  bufferSource: string;
  startsAtMinutes: number;
  endsAtMinutes: number;
}

export interface EventImpactBreakdown {
  eventId: string;
  routeId: string;
  impactScore: number;
  riskLevel: RiskLevel;
  factors: EventImpactFactor[];
  weightsUsed: Record<EventImpactFactorKey, number>;
  missingInputs: string[];
  impactWindow: EventImpactWindow;
  estimatedDelayMinutes: number;
  explanation: string;
  calculatedAt: string;
  provenance: Provenance;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WEIGHTS: Record<EventImpactFactorKey, number> = {
  crowd: 0.25,
  proximity: 0.25,
  overlap: 0.20,
  routeImportance: 0.15,
  duration: 0.15,
};

const FACTOR_LABELS: Record<EventImpactFactorKey, string> = {
  crowd: 'Crowd intensity',
  proximity: 'Proximity to route',
  overlap: 'Time overlap',
  routeImportance: 'Route importance',
  duration: 'Event duration',
};

// Illustrative route-importance configuration. This is a prototype weighting
// of how important each seeded corridor is for student travel — not an
// official transport classification.
export const ROUTE_IMPORTANCE: Record<string, { score: number; basis: string }> = {
  R101: { score: 100, basis: 'Primary corridor — highest scheduled student load' },
  R104: { score: 90, basis: 'Express corridor sharing the R101 event segment' },
  R102: { score: 75, basis: 'Secondary corridor — Uppinangady connection' },
  R103: { score: 70, basis: 'Secondary corridor — Vittal connection' },
};

const DEFAULT_IMPORTANCE = {
  score: 60,
  basis: 'Unclassified route — default illustrative importance',
};

const CROWD_SCORES: Record<CrowdIntensity, number> = {
  LOW: 20,
  MODERATE: 50,
  HIGH: 75,
  VERY_HIGH: 100,
};

// Straight-line proximity bands (km). Only used when an event carries
// coordinates and the route has stop coordinates; always labelled estimated.
const PROXIMITY_FULL_SCORE_KM = 0.5;
const PROXIMITY_ZERO_SCORE_KM = 5;

// ─── Small helpers ────────────────────────────────────────────────────────────
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Parse "HH:MM" into minutes; returns null for invalid or out-of-range input. */
export function safeTimeToMinutes(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const normalised = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalised / 60);
  const minutes = normalised % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function straightLineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ─── Impact window ────────────────────────────────────────────────────────────
/**
 * The impact window may start before the official event start only when the
 * event record supplies an explicit preparation buffer (`impactWindowMinutes`).
 * The source of that buffer is always disclosed.
 */
export function eventImpactWindow(event: SafarEvent): EventImpactWindow {
  const bufferMinutes =
    Number.isFinite(event.impactWindowMinutes) && event.impactWindowMinutes > 0
      ? Math.round(event.impactWindowMinutes)
      : 0;

  const start = safeTimeToMinutes(event.startTime);
  const end = safeTimeToMinutes(event.endTime);

  if (start == null || end == null) {
    return {
      valid: false,
      startTime: 'unavailable',
      endTime: 'unavailable',
      bufferMinutes,
      bufferSource: 'Event start/end time is missing or invalid',
      startsAtMinutes: 0,
      endsAtMinutes: 0,
    };
  }

  const valid = end > start;
  const startsAt = Math.max(0, start - bufferMinutes);
  const endsAt = valid ? end : start;

  return {
    valid,
    startTime: minutesToTime(startsAt),
    endTime: minutesToTime(endsAt),
    bufferMinutes,
    bufferSource:
      bufferMinutes > 0
        ? `Event record supplies a scenario-configured ${bufferMinutes}-minute preparation buffer before ${event.startTime}`
        : 'No preparation buffer supplied; impact window starts at the official event start',
    startsAtMinutes: startsAt,
    endsAtMinutes: endsAt,
  };
}

export function eventDurationMinutes(event: SafarEvent): number | null {
  const start = safeTimeToMinutes(event.startTime);
  const end = safeTimeToMinutes(event.endTime);
  if (start == null || end == null) return null;
  const duration = end - start;
  return duration > 0 ? duration : null;
}

// ─── Individual factors ───────────────────────────────────────────────────────
function crowdFactor(event: SafarEvent): EventImpactFactor {
  const rawScore = CROWD_SCORES[event.crowdIntensity] ?? 0;
  return {
    key: 'crowd',
    label: FACTOR_LABELS.crowd,
    weight: WEIGHTS.crowd,
    rawScore,
    available: true,
    contribution: 0,
    basis: `Recorded crowd intensity ${event.crowdIntensity.replace('_', ' ').toLowerCase()}`,
  };
}

function proximityFactor(
  event: SafarEvent,
  route: Route,
  stops: Stop[] | undefined,
): EventImpactFactor {
  if (event.affectedRouteIds.includes(route.id)) {
    return {
      key: 'proximity',
      label: FACTOR_LABELS.proximity,
      weight: WEIGHTS.proximity,
      rawScore: 100,
      available: true,
      contribution: 0,
      basis: 'Explicit event–route association recorded on the event (authority/seed data)',
    };
  }

  const routeStops = (stops ?? []).filter(stop => route.stopIds.includes(stop.id));
  if (event.lat != null && event.lng != null && routeStops.length > 0) {
    let nearest: { stop: Stop; km: number } | null = null;
    for (const stop of routeStops) {
      const km = straightLineKm(event.lat, event.lng, stop.lat, stop.lng);
      if (!nearest || km < nearest.km) nearest = { stop, km };
    }
    if (nearest) {
      const score =
        nearest.km <= PROXIMITY_FULL_SCORE_KM
          ? 100
          : clamp(
              Math.round(
                100 -
                  ((nearest.km - PROXIMITY_FULL_SCORE_KM) /
                    (PROXIMITY_ZERO_SCORE_KM - PROXIMITY_FULL_SCORE_KM)) *
                    100,
              ),
              0,
              100,
            );
      return {
        key: 'proximity',
        label: FACTOR_LABELS.proximity,
        weight: WEIGHTS.proximity,
        rawScore: score,
        available: true,
        contribution: 0,
        basis: `Estimated proximity: ${nearest.km.toFixed(1)} km straight-line from the event to nearest route stop "${nearest.stop.name}" (not a road distance and not proof that the event lies on this road)`,
      };
    }
  }

  return {
    key: 'proximity',
    label: FACTOR_LABELS.proximity,
    weight: WEIGHTS.proximity,
    rawScore: 0,
    available: false,
    contribution: 0,
    basis: 'No explicit route association and no event coordinates for a proximity estimate',
  };
}

function overlapFactor(
  event: SafarEvent,
  route: Route,
  timetables: TimetableService[] | undefined,
): EventImpactFactor {
  const window = eventImpactWindow(event);
  if (!window.valid) {
    return {
      key: 'overlap',
      label: FACTOR_LABELS.overlap,
      weight: WEIGHTS.overlap,
      rawScore: 0,
      available: false,
      contribution: 0,
      basis: 'Event time span is invalid, so overlap cannot be calculated',
    };
  }

  const services = (timetables ?? []).filter(service => service.routeId === route.id);
  if (services.length === 0) {
    return {
      key: 'overlap',
      label: FACTOR_LABELS.overlap,
      weight: WEIGHTS.overlap,
      rawScore: 0,
      available: false,
      contribution: 0,
      basis: 'No timetable service data available for this route',
    };
  }

  let serviceMinutes = 0;
  let overlapMinutes = 0;

  for (const service of services) {
    const first = service.stopTimes[0];
    const last = service.stopTimes[service.stopTimes.length - 1];
    if (!first || !last) continue;
    const depart = safeTimeToMinutes(first.scheduledDeparture);
    const arrive = safeTimeToMinutes(last.scheduledArrival);
    if (depart == null || arrive == null || arrive <= depart) continue;
    serviceMinutes += arrive - depart;
    overlapMinutes += Math.max(
      0,
      Math.min(arrive, window.endsAtMinutes) - Math.max(depart, window.startsAtMinutes),
    );
  }

  if (serviceMinutes === 0) {
    return {
      key: 'overlap',
      label: FACTOR_LABELS.overlap,
      weight: WEIGHTS.overlap,
      rawScore: 0,
      available: false,
      contribution: 0,
      basis: 'Timetable stop times for this route are missing or not chronological',
    };
  }

  const rawScore = clamp(Math.round((overlapMinutes / serviceMinutes) * 100), 0, 100);
  return {
    key: 'overlap',
    label: FACTOR_LABELS.overlap,
    weight: WEIGHTS.overlap,
    rawScore,
    available: true,
    contribution: 0,
    basis: `${overlapMinutes} of ${serviceMinutes} scheduled service minutes fall inside the impact window ${window.startTime}–${window.endTime} (date match is assessed separately)`,
  };
}

function importanceFactor(route: Route): EventImpactFactor {
  const importance = ROUTE_IMPORTANCE[route.id] ?? DEFAULT_IMPORTANCE;
  return {
    key: 'routeImportance',
    label: FACTOR_LABELS.routeImportance,
    weight: WEIGHTS.routeImportance,
    rawScore: importance.score,
    available: true,
    contribution: 0,
    basis: importance.basis,
  };
}

function durationFactor(event: SafarEvent): EventImpactFactor {
  const duration = eventDurationMinutes(event);
  if (duration == null) {
    return {
      key: 'duration',
      label: FACTOR_LABELS.duration,
      weight: WEIGHTS.duration,
      rawScore: 0,
      available: false,
      contribution: 0,
      basis: 'Event end time is missing or not after the start time',
    };
  }

  let rawScore: number;
  if (duration < 120) rawScore = 25;
  else if (duration < 240) rawScore = 50;
  else if (duration < 480) rawScore = 75;
  else rawScore = 100;

  return {
    key: 'duration',
    label: FACTOR_LABELS.duration,
    weight: WEIGHTS.duration,
    rawScore,
    available: true,
    contribution: 0,
    basis: `${duration} min duration (illustrative bands: <2 h 25, 2–4 h 50, 4–8 h 75, >8 h 100)`,
  };
}

// ─── Risk and delay conversions ───────────────────────────────────────────────
/** Prototype risk bands, not validated traffic standards. */
export function riskFromScore(score: number): RiskLevel {
  const safe = clamp(Math.round(Number.isFinite(score) ? score : 0), 0, 100);
  if (safe < 25) return 'LOW';
  if (safe < 50) return 'MODERATE';
  if (safe < 75) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Documented illustrative conversion from impact score to delay minutes
 * (0 → 0 min, 100 → 45 min). This is NOT a validated traffic forecast and is
 * not measured delay.
 */
export function estimatedDelayFromScore(score: number): number {
  const safe = clamp(Number.isFinite(score) ? score : 0, 0, 100);
  return Math.round((safe / 100) * 45);
}

// ─── Full breakdown ───────────────────────────────────────────────────────────
export function explainEventImpact(
  event: SafarEvent,
  route: Route,
  context: EventImpactContext = {},
): EventImpactBreakdown {
  const factors: EventImpactFactor[] = [
    crowdFactor(event),
    proximityFactor(event, route, context.stops),
    overlapFactor(event, route, context.timetables),
    importanceFactor(route),
    durationFactor(event),
  ];

  const availableFactors = factors.filter(factor => factor.available);
  const totalWeight = availableFactors.reduce((sum, factor) => sum + factor.weight, 0);

  const weightsUsed: Record<EventImpactFactorKey, number> = {
    crowd: 0,
    proximity: 0,
    overlap: 0,
    routeImportance: 0,
    duration: 0,
  };

  let weightedTotal = 0;
  if (totalWeight > 0) {
    for (const factor of factors) {
      if (!factor.available) continue;
      weightedTotal += factor.rawScore * factor.weight;
      factor.contribution =
        Math.round(((factor.rawScore * factor.weight) / totalWeight) * 10) / 10;
      weightsUsed[factor.key] = Math.round((factor.weight / totalWeight) * 1000) / 10;
    }
  }

  const impactScore = clamp(
    Math.round(totalWeight > 0 ? weightedTotal / totalWeight : 0),
    0,
    100,
  );
  const riskLevel = riskFromScore(impactScore);
  const delay = estimatedDelayFromScore(impactScore);
  const window = eventImpactWindow(event);
  const missingInputs = factors
    .filter(factor => !factor.available)
    .map(factor => factor.label);

  const factorSummary = factors
    .map(factor => {
      if (!factor.available) {
        return `${factor.label}: unavailable (${factor.basis})`;
      }
      return `${factor.label}: ${factor.rawScore}/100 — ${factor.basis}; effective weight ${weightsUsed[factor.key]}%`;
    })
    .join(' ');

  const renormalisationNote =
    missingInputs.length > 0
      ? `Missing inputs: ${missingInputs.join(', ')}. Weights were renormalised across the available factors; no value was invented.`
      : 'All documented factors were available; configured weights were used unchanged.';

  const explanation =
    `PREDICTED EVENT IMPACT — deterministic prototype estimate for ${route.id}: ` +
    `${impactScore}/100 (${riskLevel}). ${factorSummary} ${renormalisationNote} ` +
    `Illustrative delay conversion: ~${delay} min (0–45 min mapping from the impact score; not measured traffic delay). ` +
    `Impact window: ${window.startTime}–${window.endTime}. ${window.bufferSource}. ` +
    `This is a weighted prototype score, not a validated congestion forecast and not a verified road closure.`;

  return {
    eventId: event.id,
    routeId: route.id,
    impactScore,
    riskLevel,
    factors,
    weightsUsed,
    missingInputs,
    impactWindow: window,
    estimatedDelayMinutes: delay,
    explanation,
    calculatedAt: new Date().toISOString(),
    provenance: 'CALCULATED',
  };
}

// ─── Public calculation API ───────────────────────────────────────────────────
export function calculateEventImpact(
  event: SafarEvent,
  route: Route,
  context: EventImpactContext = {},
): EventRouteImpact {
  const breakdown = explainEventImpact(event, route, context);
  const find = (key: EventImpactFactorKey) =>
    breakdown.factors.find(factor => factor.key === key)?.rawScore ?? 0;

  return {
    eventId: event.id,
    routeId: route.id,
    impactScore: breakdown.impactScore,
    riskLevel: breakdown.riskLevel,
    crowdScore: find('crowd'),
    proximityScore: find('proximity'),
    overlapScore: find('overlap'),
    routeImportanceScore: find('routeImportance'),
    durationScore: find('duration'),
    explanation: breakdown.explanation,
    estimatedDelayMinutes: breakdown.estimatedDelayMinutes,
    calculatedAt: breakdown.calculatedAt,
    provenance: 'CALCULATED',
  };
}

/**
 * Impacts are calculated for the routes explicitly associated with the event.
 * Approximate proximity is only used for suggestions (`identifyAffectedRoutes`)
 * and is labelled estimated — never claimed as an on-road relationship.
 */
export function calculateAllEventImpacts(
  event: SafarEvent,
  routes: Route[],
  context: EventImpactContext = {},
): EventRouteImpact[] {
  return event.affectedRouteIds
    .map(routeId => routes.find(route => route.id === routeId))
    .filter((route): route is Route => route !== undefined)
    .map(route => calculateEventImpact(event, route, context));
}

export interface SuggestedRouteAssociation {
  routeId: string;
  basis: 'EXPLICIT' | 'ESTIMATED_PROXIMITY';
  detail: string;
}

/**
 * Route identification for the UI. Explicit associations are authoritative;
 * proximity proposals are clearly marked as estimated and are never saved
 * automatically.
 */
export function identifyAffectedRoutes(
  event: SafarEvent,
  routes: Route[],
  stops: Stop[] = [],
): SuggestedRouteAssociation[] {
  const suggestions: SuggestedRouteAssociation[] = [];

  for (const route of routes) {
    if (event.affectedRouteIds.includes(route.id)) {
      suggestions.push({
        routeId: route.id,
        basis: 'EXPLICIT',
        detail: 'Recorded event–route association',
      });
      continue;
    }
    if (event.lat == null || event.lng == null) continue;
    const routeStops = stops.filter(stop => route.stopIds.includes(stop.id));
    if (routeStops.length === 0) continue;
    const nearestKm = Math.min(
      ...routeStops.map(stop => straightLineKm(event.lat!, event.lng!, stop.lat, stop.lng)),
    );
    if (nearestKm <= PROXIMITY_ZERO_SCORE_KM) {
      suggestions.push({
        routeId: route.id,
        basis: 'ESTIMATED_PROXIMITY',
        detail: `Estimated ${nearestKm.toFixed(1)} km straight-line from the event to a route stop — not proof the event is on this road`,
      });
    }
  }

  return suggestions;
}

// ─── Relevance helpers ────────────────────────────────────────────────────────
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Impacts that may affect current operations: the event is today or upcoming
 * and has not been rejected as a data record. Rejected records stay visible in
 * the event register but do not drive operational calculations.
 */
export function getRelevantEventImpacts(
  state: AppState,
  referenceDate: string = todayIso(),
): EventRouteImpact[] {
  const eventsById = new Map(state.events.map(event => [event.id, event]));
  return state.eventImpacts.filter(impact => {
    const event = eventsById.get(impact.eventId);
    if (!event) return false;
    if (event.verificationStatus === 'REJECTED') return false;
    return event.date >= referenceDate;
  });
}

export function getRelevantEvents(
  state: AppState,
  referenceDate: string = todayIso(),
): SafarEvent[] {
  return state.events
    .filter(event => event.verificationStatus !== 'REJECTED' && event.date >= referenceDate)
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}
