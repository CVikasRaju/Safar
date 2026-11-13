import type {
  Alert,
  AuditEvent,
  Bus,
  Incident,
  ReplacementRecommendation,
  Route,
  SafarState,
  TimetableService,
} from "../types";
import { rankReplacementBuses } from "../calculations/fleetRanking";
import { calculateJourneyReliability } from "../calculations/reliability";

export type ActionResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export interface SimulateBreakdownResult {
  incident: Incident;
  recommendation: ReplacementRecommendation;
  updatedBuses: Bus[];
  alerts: Alert[];
  audit: AuditEvent;
  affectedRoute?: Route;
  affectedPassengers: number;
}

export interface ApproveReplacementResult {
  updatedBuses: Bus[];
  updatedRecommendation: ReplacementRecommendation;
  updatedTimetableServices: TimetableService[];
  alerts: Alert[];
  audit: AuditEvent;
}

export interface RejectReplacementResult {
  updatedRecommendation: ReplacementRecommendation;
  alerts: Alert[];
  audit: AuditEvent;
}

export interface LiveScenarioOperationalSummary {
  affectedRoutes: string[];
  affectedStudentsCount: number;
  eventImpact: {
    eventId: string;
    eventName: string;
    riskLevel: string;
    impactScore: number;
    affectedRoutes: string[];
    prepBufferMinutes: number;
  };
  failedBus: {
    id: string;
    registration: string;
    routeId: string;
    capacity: number;
    occupiedSeats: number;
    status: string;
  };
  recommendedBus?: {
    id: string;
    registration: string;
    capacity: number;
    responseTimeMinutes: number;
    suitabilityScore: number;
    isFullCoverage: boolean;
    capacityDeficit: number;
    explanation: string;
  };
  alternativeJourney: {
    routeId: string;
    advice: string;
    earlierDepartureMinutes: number;
  };
  updatedReliability: {
    score: number;
    label: string;
    disclaimer: string;
  };
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "NO_FEASIBLE_CANDIDATE";
}

/**
 * Simulates a bus breakdown on an Operating bus (docs/06, docs/07, docs/15).
 * Validates the bus is currently Operating, marks it Unavailable, creates a confirmed
 * incident, ranks candidate replacements using 35/30/25/10 weights, and generates shared alerts.
 */
export function prepareSimulateBreakdown(
  state: SafarState,
  busId: string,
  now: Date = new Date(),
): ActionResult<SimulateBreakdownResult> {
  const bus = state.buses.find((b) => b.id === busId);
  if (!bus) {
    return { ok: false, errors: ["Selected bus does not exist in the fleet."] };
  }

  if (bus.status !== "OPERATING") {
    return {
      ok: false,
      errors: [
        `Cannot simulate breakdown on ${bus.registration}: current status is ${bus.status}. Breakdown simulation requires an Operating bus.`,
      ],
    };
  }

  const route = state.routes.find((r) => r.id === bus.assignedRouteId);
  const affectedPassengers = bus.occupiedSeats;
  const nowIso = now.toISOString();

  // Create confirmed breakdown incident record
  const incidentId = `inc-breakdown-${bus.registration.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
  const incident: Incident = {
    id: incidentId,
    type: "MECHANICAL_FAILURE",
    status: "ACTIVE",
    routeId: bus.assignedRouteId,
    busId: bus.id,
    affectedStopId: route?.stops[0] ?? "st-puttur-busstand",
    occurredAt: nowIso,
    severity: "HIGH",
    description: `Simulated mechanical breakdown of ${bus.registration} on route ${bus.assignedRouteId ?? "unassigned"}. ${affectedPassengers} passengers/students directly affected.`,
    relatedReportIds: [],
    provenance: "SIMULATED",
  };

  // Mark the bus as UNAVAILABLE in the updated fleet
  const updatedBuses: Bus[] = state.buses.map((b) =>
    b.id === bus.id
      ? {
          ...b,
          status: "UNAVAILABLE",
          commitments: ["Mechanical breakdown — awaiting maintenance/depot return"],
          provenance: "SIMULATED",
        }
      : b,
  );

  // Evaluate and rank replacement candidates
  const ranked = rankReplacementBuses(bus, updatedBuses, {
    affectedRoute: route,
    requiredCapacity: bus.capacity,
    occupiedPassengers: bus.occupiedSeats,
  });

  const bestCandidate = ranked.find((c) => c.eligible);
  const recStatus = bestCandidate ? "PENDING" : "NO_FEASIBLE_CANDIDATE";
  const decisionReason = bestCandidate
    ? `Top recommendation: ${bestCandidate.bus.registration} with score ${bestCandidate.finalScore}/100. ${bestCandidate.explanation}`
    : "No eligible replacement buses currently available in fleet with sufficient operational status.";

  const recommendation: ReplacementRecommendation = {
    id: `rec-${incident.id}`,
    incidentId: incident.id,
    candidateBusIds: ranked.map((c) => c.busId),
    rankedCandidates: ranked.map((r) => ({
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
    status: recStatus,
    decisionReason,
  };

  // Shared alerts for both Student Portal and Control Centre
  const alerts: Alert[] = [
    {
      id: `alert-breakdown-${incident.id}`,
      audience: "ALL",
      severity: "CRITICAL",
      title: `CONFIRMED INCIDENT: ${bus.registration} Breakdown`,
      body: `Bus ${bus.registration} on ${route ? `${route.id} (${route.name})` : "route"} has broken down. ${
        bestCandidate
          ? `Replacement bus ${bestCandidate.bus.registration} proposed (estimated response: ${bestCandidate.bus.estimatedResponseMinutes ?? 15} min) awaiting authority approval.`
          : "No replacement bus currently available; alternate departures advised."
      }`,
      createdAt: nowIso,
      relatedRouteIds: bus.assignedRouteId ? [bus.assignedRouteId] : [],
      relatedIncidentId: incident.id,
      provenance: "SIMULATED",
    },
  ];

  const audit: AuditEvent = {
    id: `audit-${incident.id}`,
    actor: "AUTHORITY_DEMO",
    action: "SIMULATE_BUS_BREAKDOWN",
    at: nowIso,
    recordIds: [incident.id, bus.id],
    reason: `Authority simulated breakdown for ${bus.registration} on ${bus.assignedRouteId}. ${ranked.length} replacement candidates evaluated.`,
  };

  return {
    ok: true,
    value: {
      incident,
      recommendation,
      updatedBuses,
      alerts,
      audit,
      affectedRoute: route,
      affectedPassengers,
    },
  };
}

/**
 * Authority Approval Workflow for Replacement Bus Recommendation (docs/07).
 * Re-validates eligibility before approval, allocates candidate bus, updates timetable services,
 * publishes student-facing operational alert, and records audit.
 */
export function prepareApproveReplacement(
  state: SafarState,
  recommendationId: string,
  approvedBusId?: string,
  now: Date = new Date(),
): ActionResult<ApproveReplacementResult> {
  const rec = state.replacementRecommendations.find((r) => r.id === recommendationId);
  if (!rec) {
    return { ok: false, errors: ["Replacement recommendation not found."] };
  }

  if (rec.status === "APPROVED") {
    return { ok: false, errors: ["This replacement recommendation has already been approved."] };
  }

  const targetBusId = approvedBusId ?? rec.recommendedBusId;
  if (!targetBusId) {
    return { ok: false, errors: ["No candidate bus specified for approval."] };
  }

  const candidateBus = state.buses.find((b) => b.id === targetBusId);
  if (!candidateBus) {
    return { ok: false, errors: ["Candidate replacement bus not found in fleet."] };
  }

  // Pre-condition re-validation to prevent stale or double booking
  if (candidateBus.status !== "AVAILABLE" && candidateBus.status !== "OPERATING") {
    return {
      ok: false,
      errors: [
        `Cannot approve ${candidateBus.registration}: bus status has changed to ${candidateBus.status} (stale allocation check).`,
      ],
    };
  }

  const incident = state.incidents.find((i) => i.id === rec.incidentId);
  const routeId = incident?.routeId ?? "R101";
  const nowIso = now.toISOString();

  // Update fleet: candidate bus becomes REPLACEMENT_ASSIGNED on the route
  const updatedBuses: Bus[] = state.buses.map((b) => {
    if (b.id === candidateBus.id) {
      return {
        ...b,
        status: "REPLACEMENT_ASSIGNED",
        assignedRouteId: routeId,
        commitments: [`Replacement service on ${routeId} replacing incident ${incident?.id ?? "active"}`],
        provenance: "SIMULATED",
      };
    }
    return b;
  });

  // Re-assign timetable services previously referencing failed bus to the approved replacement bus
  const failedBusId = incident?.busId;
  const updatedTimetableServices: TimetableService[] = state.timetableServices.map((service) => {
    if (failedBusId && service.busId === failedBusId && service.routeId === routeId) {
      return {
        ...service,
        busId: candidateBus.id,
      };
    }
    return service;
  });

  const updatedRecommendation: ReplacementRecommendation = {
    ...rec,
    recommendedBusId: candidateBus.id,
    status: "APPROVED",
    decisionReason: `Approved by transport authority on ${nowIso.slice(0, 10)}. Replaced with ${candidateBus.registration}.`,
  };

  const alerts: Alert[] = [
    {
      id: `alert-approved-${rec.id}`,
      audience: "ALL",
      severity: "SUCCESS",
      title: "REPLACEMENT BUS APPROVED AND DEPLOYED",
      body: `Authority has approved replacement bus ${candidateBus.registration} for route ${routeId}. Estimated response time: ${
        candidateBus.estimatedResponseMinutes ?? 15
      } minutes. Student journeys are restored.`,
      createdAt: nowIso,
      relatedRouteIds: [routeId],
      relatedIncidentId: incident?.id,
      provenance: "VERIFIED",
    },
  ];

  const audit: AuditEvent = {
    id: `audit-approve-${rec.id}`,
    actor: "AUTHORITY_DEMO",
    action: "APPROVE_REPLACEMENT",
    at: nowIso,
    recordIds: [rec.id, candidateBus.id, incident?.id ?? ""].filter(Boolean),
    reason: `Authority approved replacement bus ${candidateBus.registration} for ${routeId}.`,
  };

  return {
    ok: true,
    value: {
      updatedBuses,
      updatedRecommendation,
      updatedTimetableServices,
      alerts,
      audit,
    },
  };
}

/**
 * Authority Rejection Workflow for Replacement Recommendation.
 * Keeps incident active and records decision reason without changing bus allocation.
 */
export function prepareRejectReplacement(
  state: SafarState,
  recommendationId: string,
  reason: string,
  now: Date = new Date(),
): ActionResult<RejectReplacementResult> {
  const rec = state.replacementRecommendations.find((r) => r.id === recommendationId);
  if (!rec) {
    return { ok: false, errors: ["Replacement recommendation not found."] };
  }

  const nowIso = now.toISOString();
  const trimmedReason = reason.trim() || "Rejected by authority — alternative operational arrangement preferred.";

  const updatedRecommendation: ReplacementRecommendation = {
    ...rec,
    status: "REJECTED",
    decisionReason: trimmedReason,
  };

  const alerts: Alert[] = [
    {
      id: `alert-reject-${rec.id}`,
      audience: "AUTHORITY",
      severity: "WARNING",
      title: "Replacement Recommendation Rejected",
      body: `Replacement proposal for incident ${rec.incidentId} was rejected. Reason: ${trimmedReason}. Incident remains active.`,
      createdAt: nowIso,
      relatedRouteIds: [],
      relatedIncidentId: rec.incidentId,
      provenance: "VERIFIED",
    },
  ];

  const audit: AuditEvent = {
    id: `audit-reject-${rec.id}`,
    actor: "AUTHORITY_DEMO",
    action: "REJECT_REPLACEMENT",
    at: nowIso,
    recordIds: [rec.id, rec.incidentId],
    reason: trimmedReason,
  };

  return {
    ok: true,
    value: {
      updatedRecommendation,
      alerts,
      audit,
    },
  };
}

/**
 * Builds the comprehensive Operational Summary for the SAFAR Live Demonstration Scenario (docs/15).
 */
export function buildLiveScenarioSummary(state: SafarState): LiveScenarioOperationalSummary {
  const activeIncident = state.incidents.find((i) => i.status === "ACTIVE" && i.busId === "bus-ka21ab102") ??
    state.incidents.find((i) => i.status === "ACTIVE");

  const rec = state.replacementRecommendations.find(
    (r) => activeIncident && r.incidentId === activeIncident.id,
  ) ?? state.replacementRecommendations[0];

  const failedBus = state.buses.find((b) => b.id === (activeIncident?.busId ?? "bus-ka21ab102")) ?? state.buses[0];

  const recommendedBusRecord = rec?.recommendedBusId
    ? state.buses.find((b) => b.id === rec.recommendedBusId)
    : undefined;

  const topCandidateScore = rec?.rankedCandidates.find((c) => c.busId === rec.recommendedBusId);

  const event = state.events[0];
  const impacts = state.eventRouteImpacts.filter((i) => i.eventId === event?.id);

  // Recalculate route reliability under current incident & replacement conditions
  const reliability = calculateJourneyReliability({
    delayMinutes: activeIncident ? (rec?.status === "APPROVED" ? 10 : 25) : 0,
    eventImpactScore: impacts.find((i) => i.routeId === "R101")?.impactScore ?? 62,
    transferWaitMinutes: 12,
    minConnectionSlackMinutes: 6,
    transferCount: 1,
    availabilityRisk: activeIncident && rec?.status !== "APPROVED" ? 0.8 : 0.2,
  });

  return {
    affectedRoutes: ["R101", "R104"],
    affectedStudentsCount: failedBus?.occupiedSeats ?? 41,
    eventImpact: {
      eventId: event?.id ?? "evt-puttur-festival",
      eventName: event?.name ?? "Puttur Mahalingeshwara Temple Festival",
      riskLevel: impacts.find((i) => i.routeId === "R101")?.riskLevel ?? "HIGH",
      impactScore: impacts.find((i) => i.routeId === "R101")?.impactScore ?? 62,
      affectedRoutes: event?.affectedRouteIds ?? ["R101", "R104"],
      prepBufferMinutes: event?.impactWindowBufferMinutes ?? 90,
    },
    failedBus: {
      id: failedBus.id,
      registration: failedBus.registration,
      routeId: failedBus.assignedRouteId ?? "R101",
      capacity: failedBus.capacity,
      occupiedSeats: failedBus.occupiedSeats,
      status: failedBus.status,
    },
    recommendedBus: recommendedBusRecord
      ? {
          id: recommendedBusRecord.id,
          registration: recommendedBusRecord.registration,
          capacity: recommendedBusRecord.capacity,
          responseTimeMinutes: recommendedBusRecord.estimatedResponseMinutes ?? 12,
          suitabilityScore: topCandidateScore?.finalScore ?? 87,
          isFullCoverage: recommendedBusRecord.capacity >= failedBus.capacity,
          capacityDeficit: Math.max(0, failedBus.capacity - recommendedBusRecord.capacity),
          explanation: topCandidateScore?.explanation ?? "Evaluated using 35% capacity, 30% compatibility, 25% response time, 10% availability.",
        }
      : undefined,
    alternativeJourney: {
      routeId: "R104 Feeder Connection / Earlier R101 Service",
      advice: "Take earlier 07:15 departure from Panaje or transfer to R104 feeder at Puttur Bus Stand.",
      earlierDepartureMinutes: 30,
    },
    updatedReliability: {
      score: reliability.score,
      label: reliability.label,
      disclaimer: reliability.disclaimer,
    },
    approvalStatus: rec?.status ?? "PENDING",
  };
}

/**
 * Runs the complete central demonstration scenario sequence (docs/15 Scenario A).
 * Repeatable and operates purely on shared state.
 */
export function runLiveDemonstrationScenario(
  state: SafarState,
  now: Date = new Date(),
): { state: SafarState; summary: LiveScenarioOperationalSummary } {
  // 1. Bus KA-21-AB-102 on R101 breakdown
  const breakdownRes = prepareSimulateBreakdown(state, "bus-ka21ab102", now);
  let nextState: SafarState;

  if (breakdownRes.ok) {
    const { incident, recommendation, updatedBuses, alerts, audit } = breakdownRes.value;

    // 2. Automatically apply authority approval for the recommended candidate (e.g. KA-21-GH-407)
    const approveRes = prepareApproveReplacement(
      {
        ...state,
        buses: updatedBuses,
        incidents: [incident, ...state.incidents],
        replacementRecommendations: [recommendation, ...state.replacementRecommendations],
        alerts: [...alerts, ...state.alerts],
        auditEvents: [audit, ...state.auditEvents],
      },
      recommendation.id,
      recommendation.recommendedBusId,
      now,
    );

    if (approveRes.ok) {
      nextState = {
        ...state,
        buses: approveRes.value.updatedBuses,
        incidents: [incident, ...state.incidents],
        replacementRecommendations: [
          approveRes.value.updatedRecommendation,
          ...state.replacementRecommendations.filter((r) => r.id !== recommendation.id),
        ],
        timetableServices: approveRes.value.updatedTimetableServices,
        alerts: [...approveRes.value.alerts, ...alerts, ...state.alerts],
        auditEvents: [approveRes.value.audit, audit, ...state.auditEvents],
        scenario: {
          ...state.scenario,
          status: "COMPLETE",
          notes: "Central SAFAR live demonstration scenario completed successfully.",
        },
      };
    } else {
      nextState = {
        ...state,
        buses: updatedBuses,
        incidents: [incident, ...state.incidents],
        replacementRecommendations: [recommendation, ...state.replacementRecommendations],
        alerts: [...alerts, ...state.alerts],
        auditEvents: [audit, ...state.auditEvents],
      };
    }
  } else {
    nextState = state;
  }

  const summary = buildLiveScenarioSummary(nextState);
  return { state: nextState, summary };
}
