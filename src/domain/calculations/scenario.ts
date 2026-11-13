// SAFAR — Scenario Execution
// Implements repeatable Scenario A (Festival + Breakdown) and Scenario B (Breakdown only).
// Uses reusable domain functions — no logic hardcoded in components.

import type { AppState, SafarEvent, Incident } from '../types';
import { calculateAllEventImpacts } from './eventImpact';
import { buildIncident, estimateAffectedPassengers, buildIncidentAlert } from './disruption';
import { rankReplacementBuses } from './replacement';

// ─── Scenario A: Festival + Breakdown ────────────────────────────────────────
export function runScenarioA(state: AppState): Partial<AppState> {
  const updates: Partial<AppState> = {};
  const stepLog: string[] = [];

  // Step 1: Festival event impacts
  const festival = state.events.find(e => e.id === 'EVT001');
  if (festival) {
    const impacts = calculateAllEventImpacts(festival, state.routes, {
      timetables: state.timetables,
      stops: state.stops,
    });
    updates.eventImpacts = [
      ...state.eventImpacts.filter(i => i.eventId !== 'EVT001'),
      ...impacts,
    ];
    stepLog.push(`Step 1: Festival event impact calculated for ${impacts.length} routes.`);
  }

  // Step 2: Confirm breakdown of KA-21-AB-102 (B001)
  const breakdownBus = state.buses.find(b => b.registration === 'KA-21-AB-102');
  if (!breakdownBus) {
    stepLog.push('Step 2: ERROR — KA-21-AB-102 not found in fleet.');
    return { ...updates, scenario: { ...state.scenario, steps: stepLog } };
  }

  const affectedPassengers = estimateAffectedPassengers(breakdownBus.assignedRouteId ?? '', state.buses);
  const incident: Incident = buildIncident({
    type: 'BUS_BREAKDOWN',
    busId: breakdownBus.id,
    routeId: breakdownBus.assignedRouteId,
    severity: 'HIGH',
    expectedResolution: 'Unknown — awaiting repair assessment',
    description: 'Scenario A: Simulated breakdown of KA-21-AB-102 on R101.',
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
  const rec = rankReplacementBuses(incident, updatedBuses, affectedPassengers);
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

// ─── Scenario B: Immediate Breakdown Only ─────────────────────────────────────
export function runScenarioB(busId: string, state: AppState): Partial<AppState> {
  const bus = state.buses.find(b => b.id === busId);
  if (!bus || bus.status !== 'OPERATING') {
    return {};
  }

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

  const rec = rankReplacementBuses(incident, updatedBuses, affectedPassengers);
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

  // Re-validate eligibility before approval
  const candidateBus = state.buses.find(b => b.id === rec.recommendedBusId);
  if (!candidateBus || candidateBus.status === 'UNAVAILABLE' || candidateBus.status === 'MAINTENANCE') {
    return {}; // stale — re-read and show error
  }

  const incident = state.incidents.find(i => i.id === rec.incidentId);

  const updatedBuses = state.buses.map(b =>
    b.id === rec.recommendedBusId
      ? { ...b, status: 'REPLACEMENT_ASSIGNED' as const, assignedRouteId: incident?.routeId, commitments: [...b.commitments, rec.incidentId] }
      : b
  );

  const updatedRecs = state.replacementRecommendations.map(r =>
    r.id === recommendationId
      ? { ...r, status: 'APPROVED' as const, decidedAt: new Date().toISOString(), decidedByRole: 'AUTHORITY' }
      : r
  );

  const approvalAlert = {
    id: `ALT-${Date.now()}`,
    type: 'REPLACEMENT_APPROVED' as const,
    severity: 'INFO' as const,
    title: 'REPLACEMENT APPROVED',
    message: `Bus ${candidateBus.registration} has been approved as replacement for ${incident?.routeId ?? 'affected route'}. Illustrative ETA: ~${candidateBus.estimatedResponseMinutes ?? '?'} min.`,
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
