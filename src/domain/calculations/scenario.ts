import type { AppState, ReplacementRecommendation } from '../types';
import { calculateAllEventImpacts } from './eventImpact';
import { buildIncident, estimateAffectedPassengers, buildIncidentAlert } from './disruption';
import { rankReplacementBuses } from './fleetRanking';

// ─── Scenario A: Festival + Breakdown ────────────────────────────────────────
export function runScenarioA(state: AppState): Partial<AppState> {
  const updates: Partial<AppState> = {};
  const stepLog: string[] = [];

  // Step 1: Festival event impacts
  const festival = state.events.find(e => e.id === 'EVT001');
  if (festival) {
    const impacts = calculateAllEventImpacts(festival, state.routes, {
      timetables: state.timetables ?? state.timetableServices,
      stops: state.stops,
    });
    const currentImpacts = state.eventImpacts ?? state.eventRouteImpacts ?? [];
    updates.eventRouteImpacts = [
      ...currentImpacts.filter(i => i.eventId !== 'EVT001'),
      ...impacts,
    ];
    updates.eventImpacts = updates.eventRouteImpacts;
    stepLog.push(`Step 1: Event impacts calculated for ${festival.name} — affected routes: R101, R104.`);
  }

  // Step 2: Simulate breakdown of KA-21-AB-102 on R101
  const breakdownBus = state.buses.find(b => b.registration === 'KA-21-AB-102');
  if (!breakdownBus) {
    return { ...updates, scenario: { ...state.scenario, steps: stepLog } };
  }

  const affectedPassengers = estimateAffectedPassengers(breakdownBus.assignedRouteId ?? '', state.buses);
  const incident = buildIncident({
    type: 'BUS_BREAKDOWN',
    busId: breakdownBus.id,
    routeId: breakdownBus.assignedRouteId,
    severity: 'HIGH',
    description: `Simulated breakdown of ${breakdownBus.registration} on route R101.`,
    relatedReportIds: [],
    estimatedAffectedPassengers: affectedPassengers,
  });
  stepLog.push(`Step 2: Incident ${incident.id} confirmed — KA-21-AB-102 on R101. ~${affectedPassengers} passengers affected.`);

  // Step 3: Mark bus unavailable
  const updatedBuses = state.buses.map(b =>
    b.id === breakdownBus.id ? { ...b, status: 'UNAVAILABLE' as const } : b
  );
  updates.buses = updatedBuses;
  updates.incidents = [...state.incidents, incident];
  stepLog.push('Step 3: KA-21-AB-102 marked UNAVAILABLE.');

  // Step 4: Rank replacements
  const ranked = rankReplacementBuses(breakdownBus, updatedBuses, {
    requiredCapacity: breakdownBus.capacity,
    occupiedPassengers: affectedPassengers,
  });
  const bestCandidate = ranked.find(c => c.eligible);
  const rec: ReplacementRecommendation = {
    id: `REC-${Date.now()}`,
    incidentId: incident.id,
    candidateBusIds: ranked.map(c => c.busId),
    rankedCandidates: ranked.map(r => ({
      busId: r.busId,
      capacityScore: r.capacityScore,
      compatibilityScore: r.compatibilityScore,
      responseTimeScore: r.responseTimeScore,
      availabilityScore: r.availabilityScore,
      finalScore: r.finalScore,
      eligible: r.eligible,
      explanation: r.explanation,
    })),
    recommendedBusId: bestCandidate?.busId,
    status: bestCandidate ? 'PENDING' : 'NO_FEASIBLE_CANDIDATE',
  };
  updates.replacementRecommendations = [...state.replacementRecommendations, rec];
  stepLog.push(`Step 4: Replacement recommendation generated — ${rec.status} (best: ${rec.recommendedBusId ?? 'none'}).`);

  // Step 5: Alert
  const alert = buildIncidentAlert(incident, 'Route R101');
  updates.alerts = [...state.alerts, alert];
  stepLog.push('Step 5: Alert published to Student Portal and Authority dashboard.');

  return {
    ...updates,
    scenario: {
      ...state.scenario,
      status: 'RUNNING',
      festivalEventId: festival?.id,
      breakdownBusId: breakdownBus.id,
      breakdownIncidentId: incident.id,
      replacementRecommendationId: rec.id,
      steps: stepLog,
    },
  };
}

// ─── Scenario B: Breakdown Only ───────────────────────────────────────────────
export function runScenarioB(busId: string, state: AppState): Partial<AppState> {
  const bus = state.buses.find(b => b.id === busId);
  if (!bus) return {};

  const affectedPassengers = estimateAffectedPassengers(bus.assignedRouteId ?? '', state.buses);
  const incident = buildIncident({
    type: 'BUS_BREAKDOWN',
    busId: bus.id,
    routeId: bus.assignedRouteId,
    severity: 'HIGH',
    description: `Scenario B: Simulated immediate breakdown of ${bus.registration}.`,
    relatedReportIds: [],
    estimatedAffectedPassengers: affectedPassengers,
  });

  const updatedBuses = state.buses.map(b =>
    b.id === busId ? { ...b, status: 'UNAVAILABLE' as const } : b
  );

  const ranked = rankReplacementBuses(bus, updatedBuses, {
    requiredCapacity: bus.capacity,
    occupiedPassengers: affectedPassengers,
  });
  const bestCandidate = ranked.find(c => c.eligible);
  const rec: ReplacementRecommendation = {
    id: `REC-${Date.now()}`,
    incidentId: incident.id,
    candidateBusIds: ranked.map(c => c.busId),
    rankedCandidates: ranked.map(r => ({
      busId: r.busId,
      capacityScore: r.capacityScore,
      compatibilityScore: r.compatibilityScore,
      responseTimeScore: r.responseTimeScore,
      availabilityScore: r.availabilityScore,
      finalScore: r.finalScore,
      eligible: r.eligible,
      explanation: r.explanation,
    })),
    recommendedBusId: bestCandidate?.busId,
    status: bestCandidate ? 'PENDING' : 'NO_FEASIBLE_CANDIDATE',
  };
  const alert = buildIncidentAlert(incident, `Route ${bus.assignedRouteId ?? '?'}`);

  return {
    buses: updatedBuses,
    incidents: [...state.incidents, incident],
    replacementRecommendations: [...state.replacementRecommendations, rec],
    alerts: [...state.alerts, alert],
  };
}

// ─── Approve Replacement ──────────────────────────────────────────────────────
export function approveReplacement(
  recommendationId: string,
  state: AppState,
): Partial<AppState> {
  const rec = state.replacementRecommendations.find(r => r.id === recommendationId);
  if (!rec || rec.status !== 'PENDING' || !rec.recommendedBusId) return {};

  const candidateBus = state.buses.find(b => b.id === rec.recommendedBusId);
  if (!candidateBus) return {};

  const incident = state.incidents.find(i => i.id === rec.incidentId);

  const updatedBuses = state.buses.map(b => {
    if (b.id === candidateBus.id) {
      return {
        ...b,
        status: 'REPLACEMENT_ASSIGNED' as const,
        assignedRouteId: incident?.routeId ?? b.assignedRouteId,
        commitments: [...b.commitments, `Replacement for incident ${rec.incidentId}`],
      };
    }
    return b;
  });

  const updatedRecs = state.replacementRecommendations.map(r =>
    r.id === recommendationId
      ? { ...r, status: 'APPROVED' as const, decidedAt: new Date().toISOString() }
      : r
  );

  const approvalAlert = {
    id: `ALT-${Date.now()}`,
    audience: 'ALL' as const,
    type: 'REPLACEMENT_APPROVED' as const,
    severity: 'INFO' as const,
    title: 'REPLACEMENT APPROVED',
    body: `Bus ${candidateBus.registration} has been approved as replacement for ${incident?.routeId ?? 'affected route'}. Illustrative ETA: ~${candidateBus.estimatedResponseMinutes ?? '?'} min.`,
    relatedRouteIds: incident?.routeId ? [incident.routeId] : [],
    routeId: incident?.routeId,
    busId: candidateBus.id,
    incidentId: incident?.id,
    createdAt: new Date().toISOString(),
    read: false,
    provenance: 'SIMULATED' as const,
  };

  return {
    buses: updatedBuses,
    replacementRecommendations: updatedRecs,
    alerts: [...state.alerts, approvalAlert],
    scenario: {
      ...state.scenario,
      approvedReplacementBusId: candidateBus.id,
      status: 'COMPLETE',
    },
  };
}
