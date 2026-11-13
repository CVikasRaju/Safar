// SAFAR — Replacement Bus Ranking
// Weighted scoring per docs/07_FLEET_AND_REPLACEMENT.md
// Weights: Capacity 35%, Route Compatibility 30%, Response Time 25%, Availability 10%

import type { Bus, Incident, ReplacementCandidate, ReplacementRecommendation } from '../types';

const W_CAPACITY      = 0.35;
const W_COMPATIBILITY = 0.30;
const W_RESPONSE      = 0.25;
const W_AVAILABILITY  = 0.10;

function capacityScore(bus: Bus, requiredPassengers: number): number {
  const remaining = Math.max(0, bus.capacity - bus.occupiedSeats);
  if (remaining >= requiredPassengers) return 100;
  return Math.round((remaining / requiredPassengers) * 100);
}

function compatibilityScore(bus: Bus, incident: Incident): number {
  // Same route family (e.g., R101 ↔ R104 for Sullia corridor) → 100
  // Available bus with no route → 70
  // Different route → 50
  const incidentRoute = incident.routeId ?? '';
  if (!bus.assignedRouteId) return 70; // available, no current route
  if (bus.assignedRouteId === incidentRoute) return 100;
  // Compatible corridors
  const sulliaCorridor = ['R101', 'R104'];
  const uppinCorridor  = ['R102'];
  const vittalCorridor = ['R103'];
  const inSame = (arr: string[]) =>
    arr.includes(bus.assignedRouteId ?? '') && arr.includes(incidentRoute);
  if (inSame(sulliaCorridor) || inSame(uppinCorridor) || inSame(vittalCorridor)) return 80;
  return 50;
}

function responseTimeScore(bus: Bus): number {
  const minutes = bus.estimatedResponseMinutes ?? 60;
  // 0 min → 100, 60+ min → 0
  return Math.max(0, Math.round(100 - (minutes / 60) * 100));
}

function availabilityScore(bus: Bus): number {
  if (bus.status === 'AVAILABLE')           return 100;
  if (bus.status === 'OPERATING')           return 80;
  if (bus.status === 'REPLACEMENT_ASSIGNED') return 0;
  return 0;
}

function isEligible(bus: Bus, incidentBusId?: string): { eligible: boolean; reason?: string } {
  if (bus.id === incidentBusId) return { eligible: false, reason: 'This is the failed bus.' };
  if (bus.status === 'UNAVAILABLE') return { eligible: false, reason: 'Bus is unavailable.' };
  if (bus.status === 'MAINTENANCE') return { eligible: false, reason: 'Bus is in maintenance.' };
  if (bus.status === 'REPLACEMENT_ASSIGNED')
    return { eligible: false, reason: 'Already committed as replacement.' };
  return { eligible: true };
}

export function rankReplacementBuses(
  incident: Incident,
  fleet: Bus[],
  affectedPassengers: number,
): ReplacementRecommendation {
  const candidates: ReplacementCandidate[] = fleet.map(bus => {
    const { eligible, reason } = isEligible(bus, incident.busId);
    if (!eligible) {
      return {
        busId: bus.id,
        capacityScore: 0,
        compatibilityScore: 0,
        responseTimeScore: 0,
        availabilityScore: 0,
        finalScore: 0,
        eligible: false,
        ineligibilityReason: reason,
        explanation: `Ineligible: ${reason}`,
      };
    }

    const cap   = capacityScore(bus, affectedPassengers);
    const compat = compatibilityScore(bus, incident);
    const resp   = responseTimeScore(bus);
    const avail  = availabilityScore(bus);

    const final = Math.round(
      cap   * W_CAPACITY     +
      compat * W_COMPATIBILITY +
      resp   * W_RESPONSE    +
      avail  * W_AVAILABILITY
    );

    const remaining = Math.max(0, bus.capacity - bus.occupiedSeats);
    const explanation =
      `Score ${final}/100. ` +
      `Capacity: ${cap}/100 (${remaining} remaining seats vs ${affectedPassengers} needed). ` +
      `Route compatibility: ${compat}/100 (assigned: ${bus.assignedRouteId ?? 'none'}). ` +
      `Response time: ${resp}/100 (~${bus.estimatedResponseMinutes ?? 60} min ETA, illustrative). ` +
      `Operational availability: ${avail}/100 (status: ${bus.status}). ` +
      `Weights: Capacity 35%, Compatibility 30%, Response 25%, Availability 10%.`;

    return {
      busId: bus.id,
      capacityScore: cap,
      compatibilityScore: compat,
      responseTimeScore: resp,
      availabilityScore: avail,
      finalScore: final,
      eligible: true,
      explanation,
    };
  });

  // Sort: eligible first, then by finalScore descending
  const sorted = [...candidates].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.finalScore - a.finalScore;
  });

  const eligibleCandidates = sorted.filter(c => c.eligible);
  const recommendedBusId   = eligibleCandidates[0]?.busId;
  const status = eligibleCandidates.length === 0
    ? 'NO_FEASIBLE_CANDIDATE'
    : 'PENDING';

  return {
    id: `REC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    incidentId: incident.id,
    candidateBusIds: fleet.map(b => b.id),
    rankedCandidates: sorted,
    recommendedBusId,
    status,
    provenance: 'CALCULATED',
  };
}

export function generateRecommendationExplanation(rec: ReplacementRecommendation, buses: Bus[]): string {
  if (rec.status === 'NO_FEASIBLE_CANDIDATE') {
    return 'No feasible replacement bus is currently available. All candidates are either unavailable, in maintenance, or already committed. Authority action required.';
  }
  const best = rec.rankedCandidates.find(c => c.busId === rec.recommendedBusId);
  const bus  = buses.find(b => b.id === rec.recommendedBusId);
  if (!best || !bus) return 'Recommendation details unavailable.';
  return `Recommended replacement: ${bus.registration} (Score: ${best.finalScore}/100). ${best.explanation} This recommendation requires human authority approval before allocation.`;
}
