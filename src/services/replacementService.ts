import type {
  Bus,
  Incident,
  ReplacementCandidateScore,
  ReplacementRecommendation,
  SafarState,
  ServiceResult,
} from "../domain/types";
import {
  NO_FEASIBLE_REPLACEMENT_LABEL,
  REPLACEMENT_APPROVED_LABEL,
  REPLACEMENT_RECOMMENDED_LABEL,
} from "../domain/constants";
import { nextId } from "../domain/time";
import { findBus, getNetworkFromState } from "../domain/network";
import {
  checkReplacementEligibility,
  generateRecommendationExplanation,
  rankReplacementBuses,
  type AffectedDemandEstimate,
} from "../domain/calculations/replacement";
import { applyReplacementAllocation } from "../domain/calculations/allocation";
import { getDemandSummary } from "./demandService";
import { appendAlert, appendAudit, fail, finalize, ok, timestamp, type ServiceOptions } from "./shared";

export interface RecommendationGeneration {
  recommendation: ReplacementRecommendation;
  requiredSeats: number;
  explanation: string;
}

export interface ApprovalResult {
  recommendation: ReplacementRecommendation;
  bus: Bus;
  routeId: string;
  coveredSeats: number;
  remainingShortage: number;
  explanation: string;
}

export interface ApprovalOptions extends ServiceOptions {
  /** Overrides the recommended bus, but the candidate is revalidated. */
  busId?: string;
  actor?: string;
  reason?: string;
}

export function computeAffectedDemand(
  incident: Incident,
  state: SafarState,
): AffectedDemandEstimate {
  const bus = incident.busId ? findBus(state.buses, incident.busId) : undefined;
  const routeId = incident.routeId ?? bus?.assignedRouteId ?? "";
  const demand = getDemandSummary(state);
  const routeDemand = demand.routes.find((route) => route.routeId === routeId);
  const routeExpected = routeDemand?.expectedStudents ?? 0;
  const requiredSeats = Math.round(
    bus ? Math.min(routeExpected, bus.capacity) : routeExpected,
  );
  return {
    routeId,
    requiredSeats,
    affectedStudentEstimate: requiredSeats,
    failedBusId: incident.busId,
  };
}

/** Creates a ranked proposal only; never allocates a bus. */
export function generateReplacementRecommendation(
  incidentId: string,
  state: SafarState,
  options: ServiceOptions & { force?: boolean } = {},
): ServiceResult<RecommendationGeneration> {
  const incident = state.incidents.find((candidate) => candidate.id === incidentId);
  if (!incident) return fail(state, "INCIDENT_NOT_FOUND", `Unknown incident "${incidentId}".`);
  if (incident.status !== "ACTIVE") {
    return fail(
      state,
      "INCIDENT_NOT_ACTIVE",
      `Incident "${incidentId}" is not active; replacement evaluation is only available for active incidents.`,
    );
  }

  const existing = state.recommendations.find(
    (recommendation) =>
      recommendation.incidentId === incidentId && recommendation.status === "PENDING",
  );
  if (existing && !options.force) {
    return ok(state, {
      recommendation: existing,
      requiredSeats: existing.requiredSeats,
      explanation: generateRecommendationExplanation(existing),
    });
  }

  const affectedDemand = computeAffectedDemand(incident, state);
  if (!affectedDemand.routeId) {
    return fail(
      state,
      "RECOMMENDATION_NO_ROUTE",
      "The incident has no affected route, so a route replacement cannot be evaluated.",
    );
  }

  const now = timestamp(options);
  const network = getNetworkFromState(state);
  const ranking = rankReplacementBuses(incident, state.buses, affectedDemand, { network });
  const eligibleIds = ranking.candidates
    .filter((candidate) => candidate.eligible)
    .map((candidate) => candidate.busId);

  const recommendation: ReplacementRecommendation = {
    id: nextId(
      "rec",
      state.recommendations.map((candidate) => candidate.id),
    ),
    incidentId,
    routeId: affectedDemand.routeId,
    requiredSeats: ranking.requiredSeats,
    candidateBusIds: eligibleIds,
    rankedCandidates: ranking.candidates,
    recommendedBusId: ranking.recommendedBusId,
    combinedBusIds: ranking.combinedBusIds,
    combinedCoveredSeats: ranking.combinedCoveredSeats,
    coveredSeats: ranking.coveredSeats,
    remainingShortage: ranking.remainingShortage,
    status: ranking.status,
    createdAt: now,
    provenance: "CALCULATED",
  };

  let nextState: SafarState = {
    ...state,
    recommendations: [...state.recommendations, recommendation],
  };

  nextState = appendAlert(nextState, {
    audience: "AUTHORITY",
    severity: ranking.status === "NO_FEASIBLE_CANDIDATE" ? "CRITICAL" : "WARNING",
    category: "REPLACEMENT",
    title:
      ranking.status === "NO_FEASIBLE_CANDIDATE"
        ? NO_FEASIBLE_REPLACEMENT_LABEL
        : REPLACEMENT_RECOMMENDED_LABEL,
    message: ranking.explanation,
    routeId: affectedDemand.routeId,
    incidentId,
    recommendationId: recommendation.id,
    provenance: "CALCULATED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: "SYSTEM",
    action: "GENERATE_REPLACEMENT_RECOMMENDATION",
    entityType: "ReplacementRecommendation",
    entityIds: [recommendation.id],
    at: now,
    details: {
      incidentId,
      requiredSeats: recommendation.requiredSeats,
      recommendedBusId: recommendation.recommendedBusId ?? null,
      status: recommendation.status,
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    recommendation,
    requiredSeats: recommendation.requiredSeats,
    explanation: ranking.explanation,
  });
}

/**
 * Approves a pending recommendation with immediate revalidation against the
 * current fleet. Prevents stale approvals and double allocation.
 *
 * Both call shapes are supported:
 *   approveReplacement(recommendationId, busId, state, options?)
 *   approveReplacement(recommendationId, state, options?)
 */
export function approveReplacement(
  recommendationId: string,
  busId: string | null,
  state: SafarState,
  options?: ApprovalOptions,
): ServiceResult<ApprovalResult>;
export function approveReplacement(
  recommendationId: string,
  state: SafarState,
  options?: ApprovalOptions,
): ServiceResult<ApprovalResult>;
export function approveReplacement(
  recommendationId: string,
  busIdOrState: string | null | SafarState,
  stateOrOptions?: SafarState | ApprovalOptions,
  maybeOptions?: ApprovalOptions,
): ServiceResult<ApprovalResult> {
  const usingBusId = typeof busIdOrState === "string" || busIdOrState === null;
  const state = usingBusId
    ? (stateOrOptions as SafarState)
    : (busIdOrState as SafarState);
  const options: ApprovalOptions = usingBusId
    ? { ...(maybeOptions ?? {}), busId: busIdOrState ?? maybeOptions?.busId }
    : ((stateOrOptions as ApprovalOptions | undefined) ?? {});

  const recommendation = state.recommendations.find(
    (candidate) => candidate.id === recommendationId,
  );
  if (!recommendation) {
    return fail(state, "RECOMMENDATION_NOT_FOUND", `Unknown recommendation "${recommendationId}".`);
  }
  if (recommendation.status !== "PENDING") {
    return fail(
      state,
      "RECOMMENDATION_NOT_PENDING",
      `Recommendation "${recommendationId}" is ${recommendation.status.toLowerCase()} and cannot be approved again.`,
    );
  }

  const incident = state.incidents.find(
    (candidate) => candidate.id === recommendation.incidentId,
  );
  if (!incident) {
    return fail(state, "INCIDENT_NOT_FOUND", "The linked incident no longer exists.");
  }
  if (incident.status !== "ACTIVE") {
    return fail(
      state,
      "INCIDENT_NOT_ACTIVE",
      "The incident is no longer active; the recommendation cannot be approved.",
    );
  }

  const busId = options.busId ?? recommendation.recommendedBusId;
  if (!busId) {
    return fail(
      state,
      "NO_CANDIDATE_SELECTED",
      "This recommendation has no feasible candidate to approve.",
    );
  }
  const bus = findBus(state.buses, busId);
  if (!bus) return fail(state, "BUS_NOT_FOUND", `Unknown bus "${busId}".`);

  const candidate = recommendation.rankedCandidates.find(
    (entry) => entry.busId === busId,
  );
  if (!candidate || !candidate.eligible) {
    return fail(
      state,
      "CANDIDATE_NOT_ELIGIBLE",
      `${bus.registration} is not an eligible candidate for this recommendation.`,
    );
  }

  const affectedDemand = computeAffectedDemand(incident, state);
  const revalidation = checkReplacementEligibility(
    bus,
    incident,
    affectedDemand,
    getNetworkFromState(state),
  );
  if (!revalidation.eligible) {
    return fail(
      state,
      "CANDIDATE_STALE",
      `${bus.registration} is no longer assignable: ${revalidation.reasons.join(" ")}`,
    );
  }
  if (bus.status !== "AVAILABLE" || bus.commitments.length > 0) {
    return fail(
      state,
      "CANDIDATE_COMMITTED",
      `${bus.registration} is no longer in the available pool (status ${bus.status}, commitments ${bus.commitments.join(", ") || "none"}).`,
    );
  }
  if (incident.replacementBusId && incident.replacementBusId !== bus.id) {
    return fail(
      state,
      "INCIDENT_ALREADY_COVERED",
      "Another replacement bus is already allocated to this incident.",
    );
  }

  const now = timestamp(options);
  const allocation = applyReplacementAllocation(
    state.buses,
    state.incidents,
    incident.id,
    bus.id,
    now,
  );
  const coveredSeats = Math.max(0, bus.capacity - bus.occupiedSeats);
  const remainingShortage = Math.max(0, recommendation.requiredSeats - coveredSeats);
  const approved: ReplacementRecommendation = {
    ...recommendation,
    recommendedBusId: bus.id,
    coveredSeats,
    remainingShortage,
    status: "APPROVED",
    decidedAt: now,
    decidedBy: options.actor ?? "AUTHORITY",
    decisionReason:
      options.reason ??
      `Approved ${bus.registration} for ${incident.routeId ?? "the affected route"}.`,
  };

  let nextState: SafarState = {
    ...state,
    buses: allocation.buses,
    incidents: allocation.incidents,
    recommendations: state.recommendations.map((entry) =>
      entry.id === recommendation.id ? approved : entry,
    ),
  };
  nextState = appendAlert(nextState, {
    audience: "BOTH",
    severity: "SUCCESS",
    category: "REPLACEMENT",
    title: REPLACEMENT_APPROVED_LABEL,
    message: `${bus.registration} has been approved as the replacement for ${incident.routeId ?? "the affected route"}. ${coveredSeats} seat(s) of illustrative capacity assigned.${remainingShortage > 0 ? ` ${remainingShortage} seat(s) remain uncovered.` : ""}`,
    routeId: incident.routeId,
    incidentId: incident.id,
    recommendationId: recommendation.id,
    provenance: "VERIFIED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "APPROVE_REPLACEMENT",
    entityType: "ReplacementRecommendation",
    entityIds: [recommendation.id, bus.id, incident.id],
    at: now,
    reason: approved.decisionReason,
    details: {
      coveredSeats,
      remainingShortage,
      revalidated: true,
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    recommendation: approved,
    bus: allocation.bus,
    routeId: allocation.routeId,
    coveredSeats,
    remainingShortage,
    explanation: generateRecommendationExplanation(approved),
  });
}

export function rejectReplacement(
  recommendationId: string,
  reason: string,
  state: SafarState,
  options: ApprovalOptions = {},
): ServiceResult<{ recommendation: ReplacementRecommendation }> {
  const recommendation = state.recommendations.find(
    (candidate) => candidate.id === recommendationId,
  );
  if (!recommendation) {
    return fail(state, "RECOMMENDATION_NOT_FOUND", `Unknown recommendation "${recommendationId}".`);
  }
  if (recommendation.status !== "PENDING") {
    return fail(
      state,
      "RECOMMENDATION_NOT_PENDING",
      `Recommendation "${recommendationId}" is ${recommendation.status.toLowerCase()} and cannot be rejected.`,
    );
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return fail(state, "REJECTION_REASON_REQUIRED", "A rejection reason of at least 3 characters is required.");
  }

  const now = timestamp(options);
  const rejected: ReplacementRecommendation = {
    ...recommendation,
    status: "REJECTED",
    decisionReason: reason.trim(),
    decidedAt: now,
    decidedBy: options.actor ?? "AUTHORITY",
  };

  let nextState: SafarState = {
    ...state,
    recommendations: state.recommendations.map((entry) =>
      entry.id === recommendation.id ? rejected : entry,
    ),
  };
  nextState = appendAlert(nextState, {
    audience: "AUTHORITY",
    severity: "INFO",
    category: "REPLACEMENT",
    title: "Replacement recommendation rejected",
    message: `No bus was allocated for incident ${recommendation.incidentId}. Reason: ${rejected.decisionReason}`,
    routeId: recommendation.routeId,
    incidentId: recommendation.incidentId,
    recommendationId: recommendation.id,
    provenance: "VERIFIED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "REJECT_REPLACEMENT",
    entityType: "ReplacementRecommendation",
    entityIds: [recommendation.id, recommendation.incidentId],
    at: now,
    reason: rejected.decisionReason,
  });
  nextState = finalize(nextState, now);

  return ok(nextState, { recommendation: rejected });
}

export function getRecommendations(
  state: SafarState,
  status?: ReplacementRecommendation["status"],
): ReplacementRecommendation[] {
  return status
    ? state.recommendations.filter((recommendation) => recommendation.status === status)
    : [...state.recommendations];
}

export {
  checkReplacementEligibility,
  generateRecommendationExplanation,
  rankReplacementBuses,
};

export type { AffectedDemandEstimate, ReplacementCandidateScore };

export const replacementService = {
  rankReplacementBuses,
  generateReplacementRecommendation,
  approveReplacement,
  rejectReplacement,
  getRecommendations,
  computeAffectedDemand,
  generateRecommendationExplanation,
};
