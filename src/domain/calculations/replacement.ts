import type {
  Bus,
  Incident,
  NetworkData,
  ReplacementCandidateScore,
  ReplacementRecommendation,
} from "../types";
import {
  MAX_RESPONSE_TIME_MINUTES,
  MIN_COMBINATION_COMPATIBILITY,
  MIN_PARTIAL_COVERAGE_SEATS,
  NO_FEASIBLE_REPLACEMENT_LABEL,
  REPLACEMENT_WEIGHTS,
} from "../constants";
import { clamp } from "../time";
import { findRoute, routeSharesStop } from "../network";

export interface AffectedDemandEstimate {
  routeId: string;
  requiredSeats: number;
  affectedStudentEstimate?: number;
  failedBusId?: string;
}

export interface ReplacementRankingContext {
  network?: NetworkData;
}

export interface ReplacementRankingResult {
  requiredSeats: number;
  candidates: ReplacementCandidateScore[];
  recommendedBusId?: string;
  combinedBusIds?: string[];
  combinedCoveredSeats?: number;
  coveredSeats: number;
  remainingShortage: number;
  status: "PENDING" | "NO_FEASIBLE_CANDIDATE";
  label: string;
  explanation: string;
  provenance: "CALCULATED";
}

export interface EligibilityCheck {
  eligible: boolean;
  reasons: string[];
}

/**
 * Non-negotiable eligibility rules. No score can override an ineligibility.
 */
export function checkReplacementEligibility(
  bus: Bus,
  incident: Incident,
  affectedDemand: AffectedDemandEstimate,
  network?: NetworkData,
): EligibilityCheck {
  const reasons: string[] = [];
  const remainingSeats = Math.max(0, bus.capacity - bus.occupiedSeats);

  if (incident.busId && bus.id === incident.busId) {
    reasons.push("The failed bus cannot replace itself.");
  }
  if (bus.status === "UNAVAILABLE") {
    reasons.push("Bus is unavailable.");
  }
  if (bus.status === "MAINTENANCE") {
    reasons.push("Bus is in maintenance.");
  }
  if (bus.status === "REPLACEMENT_ASSIGNED") {
    reasons.push("Bus is already committed as a replacement.");
  }
  if (bus.status !== "AVAILABLE" && bus.status !== "OPERATING") {
    if (!reasons.some((reason) => reason.includes("available") || reason.includes("maintenance") || reason.includes("committed"))) {
      reasons.push(`Bus status ${bus.status} is not assignable.`);
    }
  }
  if (bus.commitments.length > 0) {
    reasons.push(`Bus already has commitments (${bus.commitments.join(", ")}).`);
  }
  if (bus.occupiedSeats > bus.capacity) {
    reasons.push("Occupied seats exceed capacity; fleet record is invalid.");
  }
  if (remainingSeats < MIN_PARTIAL_COVERAGE_SEATS) {
    reasons.push(
      `Only ${remainingSeats} remaining seat(s); at least ${MIN_PARTIAL_COVERAGE_SEATS} are required for partial coverage.`,
    );
  }
  if (
    network &&
    bus.assignedRouteId &&
    bus.assignedRouteId !== affectedDemand.routeId &&
    !routeSharesStop(network, bus.assignedRouteId, affectedDemand.routeId)
  ) {
    reasons.push(
      `Bus is assigned to ${bus.assignedRouteId}, which shares no stop with ${affectedDemand.routeId}.`,
    );
  }
  if (!network && bus.assignedRouteId && bus.assignedRouteId !== affectedDemand.routeId) {
    reasons.push(
      `Bus is committed to route ${bus.assignedRouteId}; route compatibility cannot be verified.`,
    );
  }

  return { eligible: reasons.length === 0, reasons };
}

export function compatibilityScoreFor(
  bus: Bus,
  incident: Incident,
  affectedDemand: AffectedDemandEstimate,
  network?: NetworkData,
): { score: number; detail: string } {
  if (bus.assignedRouteId === affectedDemand.routeId) {
    return {
      score: 100,
      detail: `Already assigned to ${affectedDemand.routeId}.`,
    };
  }
  if (!bus.assignedRouteId) {
    return {
      score: 85,
      detail:
        "Depot pool bus with no route commitment; assignable subject to authority approval.",
    };
  }
  if (network && routeSharesStop(network, bus.assignedRouteId, affectedDemand.routeId)) {
    return {
      score: 70,
      detail: `Assigned to ${bus.assignedRouteId}, which shares at least one stop with ${affectedDemand.routeId}.`,
    };
  }
  return {
    score: 45,
    detail: `Assigned to ${bus.assignedRouteId}; requires withdrawal from its current route.`,
  };
}

export function capacityScoreFor(remainingSeats: number, requiredSeats: number): number {
  if (requiredSeats <= 0) return 100;
  return clamp(Math.round((remainingSeats / requiredSeats) * 100), 0, 100);
}

export function responseTimeScoreFor(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) return 0;
  return clamp(Math.round(100 - (minutes / MAX_RESPONSE_TIME_MINUTES) * 100), 0, 100);
}

export function availabilityScoreFor(bus: Bus): number {
  if (bus.status === "AVAILABLE") return 100;
  if (bus.status === "OPERATING") return 70;
  return 0;
}

/**
 * Deterministic weighted replacement ranking.
 *
 * Returns a ranked proposal only. A recommendation is never an allocation:
 * `status: "PENDING"` requires explicit authority approval with revalidation.
 */
export function rankReplacementBuses(
  incident: Incident,
  fleet: Bus[],
  affectedDemand: AffectedDemandEstimate,
  context: ReplacementRankingContext = {},
): ReplacementRankingResult {
  const { network } = context;
  const requiredSeats = Math.max(0, Math.round(affectedDemand.requiredSeats));
  const failedBusId = incident.busId ?? affectedDemand.failedBusId;

  const candidates: ReplacementCandidateScore[] = fleet.map((bus) => {
    const eligibility = checkReplacementEligibility(
      bus,
      { ...incident, busId: failedBusId },
      affectedDemand,
      network,
    );
    const remainingSeats = Math.max(0, bus.capacity - bus.occupiedSeats);
    const capacityScore = capacityScoreFor(remainingSeats, requiredSeats);
    const compatibility = compatibilityScoreFor(bus, incident, affectedDemand, network);
    const responseTimeScore = responseTimeScoreFor(bus.estimatedResponseMinutes);
    const availabilityScore = availabilityScoreFor(bus);
    const finalScore = Math.round(
      capacityScore * REPLACEMENT_WEIGHTS.capacity +
        compatibility.score * REPLACEMENT_WEIGHTS.compatibility +
        responseTimeScore * REPLACEMENT_WEIGHTS.responseTime +
        availabilityScore * REPLACEMENT_WEIGHTS.availability,
    );
    const coverage = remainingSeats >= requiredSeats ? "FULL" : "PARTIAL";

    const explanation = eligibility.eligible
      ? `${bus.registration}: capacity ${capacityScore}/100 (${remainingSeats} seats vs ${requiredSeats} required, ${coverage.toLowerCase()} coverage), route compatibility ${compatibility.score}/100, response time ${responseTimeScore}/100 (${bus.estimatedResponseMinutes} illustrative minutes), availability ${availabilityScore}/100. Weighted score ${finalScore}/100.`
      : `${bus.registration}: ineligible — ${eligibility.reasons.join(" ")}`;

    return {
      busId: bus.id,
      registration: bus.registration,
      eligible: eligibility.eligible,
      ineligibleReasons: eligibility.reasons,
      remainingSeats,
      requiredSeats,
      coverage,
      capacityScore,
      compatibilityScore: compatibility.score,
      responseTimeScore,
      availabilityScore,
      finalScore,
      explanation,
      componentDetails: {
        capacity: `${remainingSeats}/${requiredSeats} seats, ${coverage.toLowerCase()} coverage.`,
        compatibility: compatibility.detail,
        responseTime: `${bus.estimatedResponseMinutes} illustrative minute(s) response time (score ${responseTimeScore}/100).`,
        availability: `Status ${bus.status} (score ${availabilityScore}/100).`,
      },
    };
  });

  const eligible = candidates
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => b.finalScore - a.finalScore || b.remainingSeats - a.remainingSeats);

  const fullCoverage = eligible.find((candidate) => candidate.coverage === "FULL");
  const recommended = fullCoverage ?? eligible[0];

  let combinedBusIds: string[] | undefined;
  let combinedCoveredSeats: number | undefined;
  if (!fullCoverage && eligible.length > 0) {
    const combination = eligible.filter(
      (candidate) => candidate.compatibilityScore >= MIN_COMBINATION_COMPATIBILITY,
    );
    let cumulative = 0;
    const ids: string[] = [];
    for (const candidate of combination) {
      ids.push(candidate.busId);
      cumulative += candidate.remainingSeats;
      if (cumulative >= requiredSeats) break;
    }
    if (cumulative >= requiredSeats && ids.length > 1) {
      combinedBusIds = ids;
      combinedCoveredSeats = cumulative;
    }
  }

  const coveredSeats = recommended?.remainingSeats ?? 0;
  const remainingShortage = Math.max(0, requiredSeats - coveredSeats);

  if (!recommended) {
    return {
      requiredSeats,
      candidates,
      coveredSeats: 0,
      remainingShortage,
      status: "NO_FEASIBLE_CANDIDATE",
      label: NO_FEASIBLE_REPLACEMENT_LABEL,
      explanation: `No eligible replacement bus is available for ${affectedDemand.routeId}. ${requiredSeats} seat(s) remain uncovered. Nearby operating buses may be listed for information only; no bus is assigned.`,
      provenance: "CALCULATED",
    };
  }

  const remainingNote =
    remainingShortage > 0
      ? ` One bus cannot cover the full demand: ${remainingShortage} seat(s) remain uncovered.`
      : "";
  const combinationNote = combinedBusIds
    ? ` A combination of ${combinedBusIds.length} buses (${combinedCoveredSeats} seats) could cover the deficit only as a separate operational decision; it is not allocated by this recommendation.`
    : "";

  return {
    requiredSeats,
    candidates,
    recommendedBusId: recommended.busId,
    combinedBusIds,
    combinedCoveredSeats,
    coveredSeats,
    remainingShortage,
    status: "PENDING",
    label: "REPLACEMENT RECOMMENDED — AWAITING APPROVAL",
    explanation: `${recommended.registration} is recommended for ${affectedDemand.routeId} with weighted suitability ${recommended.finalScore}/100. Capacity ${recommended.capacityScore}/100 (${recommended.remainingSeats} seats vs ${requiredSeats} required), compatibility ${recommended.compatibilityScore}/100, response ${recommended.responseTimeScore}/100, availability ${recommended.availabilityScore}/100. Response time is an illustrative estimate, not live GPS.${remainingNote}${combinationNote} This is a recommendation; no bus has been allocated until an authority approves it.`,
    provenance: "CALCULATED",
  };
}

/** Plain-language explanation used by services and the deterministic fallback. */
export function generateRecommendationExplanation(
  recommendation: ReplacementRecommendation,
): string {
  if (recommendation.status === "NO_FEASIBLE_CANDIDATE") {
    return `No feasible replacement candidate was found for incident ${recommendation.incidentId}. ${recommendation.requiredSeats} seat(s) remain uncovered. No bus has been allocated.`;
  }
  const recommended = recommendation.rankedCandidates.find(
    (candidate) => candidate.busId === recommendation.recommendedBusId,
  );
  const parts: string[] = [];
  if (recommended) {
    parts.push(`Recommended ${recommended.registration} (score ${recommended.finalScore}/100).`);
    parts.push(recommended.componentDetails.capacity);
    parts.push(recommended.componentDetails.compatibility);
    parts.push(recommended.componentDetails.responseTime);
    parts.push(recommended.componentDetails.availability);
  }
  if (recommendation.remainingShortage > 0) {
    parts.push(`${recommendation.remainingShortage} seat(s) remain uncovered.`);
  }
  if (recommendation.combinedBusIds?.length) {
    parts.push(
      `Combined option (not allocated): ${recommendation.combinedBusIds.length} buses covering ${recommendation.combinedCoveredSeats ?? 0} seats.`,
    );
  }
  parts.push(
    recommendation.status === "APPROVED"
      ? "Authority approval recorded; the replacement is allocated."
      : recommendation.status === "REJECTED"
        ? "Recommendation rejected; no bus was allocated."
        : "Awaiting explicit authority approval; no bus is allocated yet.",
  );
  return parts.join(" ");
}

export function routeIdForIncident(incident: Incident, fleet: Bus[]): string | null {
  if (incident.routeId) return incident.routeId;
  const bus = fleet.find((candidate) => candidate.id === incident.busId);
  return bus?.assignedRouteId ?? null;
}

export function routeExists(network: NetworkData, routeId: string): boolean {
  return Boolean(findRoute(network, routeId));
}
