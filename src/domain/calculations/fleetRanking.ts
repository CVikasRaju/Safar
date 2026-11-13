import type { Bus, ReplacementCandidateScore, Route, SafarState } from "../types";

/**
 * Fleet and Replacement Ranking Methodology (docs/07, docs/13).
 *
 * Illustrative weights:
 * - Capacity: 35%
 * - Route compatibility: 30%
 * - Response time: 25%
 * - Operational availability: 10%
 *
 * Ineligible candidates (e.g. unavailable, maintenance, already committed, or the failed bus)
 * are excluded from recommendation and cannot have their ineligibility overridden by a high score.
 */

export const REPLACEMENT_WEIGHTS = {
  capacity: 0.35,
  routeCompatibility: 0.30,
  responseTime: 0.25,
  operationalAvailability: 0.10,
} as const;

export interface FleetIndicators {
  totalBuses: number;
  operatingBuses: number;
  availableBuses: number;
  unavailableBuses: number;
  maintenanceBuses: number;
  replacementAssignedBuses: number;
  expectedStudentDemand: number;
  availableSeats: number;
  capacityShortage: number;
  activeDisruptions: number;
  unverifiedReports: number;
  routesRequiringAttention: string[];
}

export interface CandidateEvaluationContext {
  failedBus: Bus;
  affectedRoute?: Route;
  requiredCapacity?: number;
  occupiedPassengers?: number;
}

export interface CandidateEvaluationResult extends ReplacementCandidateScore {
  bus: Bus;
  capacityDeficit: number;
  isFullCoverage: boolean;
  componentDetails: {
    capacity: { score: number; candidateCapacity: number; requiredCapacity: number; isFull: boolean };
    compatibility: { score: number; depotLocation: string; routeName?: string };
    responseTime: { score: number; minutes: number };
    availability: { score: number; status: string; commitmentsCount: number };
  };
}

/**
 * Calculates high-level operational indicators for the Government Control Centre dashboard.
 */
export function calculateFleetIndicators(state: SafarState): FleetIndicators {
  const totalBuses = state.buses.length;
  const operatingBuses = state.buses.filter((b) => b.status === "OPERATING").length;
  const availableBuses = state.buses.filter((b) => b.status === "AVAILABLE").length;
  const unavailableBuses = state.buses.filter((b) => b.status === "UNAVAILABLE").length;
  const maintenanceBuses = state.buses.filter((b) => b.status === "MAINTENANCE").length;
  const replacementAssignedBuses = state.buses.filter((b) => b.status === "REPLACEMENT_ASSIGNED").length;

  const expectedStudentDemand = state.demandSeed.reduce((sum, d) => sum + d.expectedStudents, 0);
  const availableSeats = state.demandSeed.reduce((sum, d) => sum + d.availableSeats, 0);
  const capacityShortage = Math.max(0, expectedStudentDemand - availableSeats);

  const activeDisruptions = state.incidents.filter((i) => i.status === "ACTIVE").length;
  const unverifiedReports = state.disruptionReports.filter((r) => r.status === "UNVERIFIED").length;

  // Identify routes requiring operational attention:
  // - Routes with active incidents
  // - Routes with unverified student disruption reports
  // - Routes with initial seed shortage (e.g. R101: 145 vs 100, R103: 185 vs 140)
  // - Routes with high/critical event impact
  const attentionRouteIds = new Set<string>();

  for (const incident of state.incidents) {
    if (incident.status === "ACTIVE" && incident.routeId) {
      attentionRouteIds.add(incident.routeId);
    }
  }

  for (const report of state.disruptionReports) {
    if (report.status === "UNVERIFIED" && report.routeId) {
      attentionRouteIds.add(report.routeId);
    }
  }

  for (const impact of state.eventRouteImpacts) {
    if ((impact.riskLevel === "HIGH" || impact.riskLevel === "CRITICAL") && impact.routeId) {
      attentionRouteIds.add(impact.routeId);
    }
  }

  for (const seed of state.demandSeed) {
    if (seed.expectedStudents > seed.availableSeats) {
      attentionRouteIds.add(seed.routeId);
    }
  }

  return {
    totalBuses,
    operatingBuses,
    availableBuses,
    unavailableBuses,
    maintenanceBuses,
    replacementAssignedBuses,
    expectedStudentDemand,
    availableSeats,
    capacityShortage,
    activeDisruptions,
    unverifiedReports,
    routesRequiringAttention: Array.from(attentionRouteIds),
  };
}

/**
 * Checks if a candidate bus is fundamentally eligible for replacement deployment.
 * Never recommends a bus that is unavailable, under maintenance, or committed to an incompatible task.
 */
export function isCandidateEligible(candidate: Bus, failedBus: Bus): boolean {
  // Cannot replace with the failed bus itself
  if (candidate.id === failedBus.id) return false;

  // Must not be UNAVAILABLE or MAINTENANCE
  if (candidate.status === "UNAVAILABLE" || candidate.status === "MAINTENANCE") {
    return false;
  }

  // Must not be already assigned as a replacement (prevent double booking)
  if (candidate.status === "REPLACEMENT_ASSIGNED") {
    return false;
  }

  // Must not have incompatible commitments
  const hasIncompatibleCommitment = candidate.commitments.some((c) => {
    const lower = c.toLowerCase();
    return lower.includes("maintenance") || lower.includes("incompatible") || lower.includes("charter");
  });
  if (hasIncompatibleCommitment) return false;

  // Must be AVAILABLE (or OPERATING on non-critical service with surplus)
  return candidate.status === "AVAILABLE" || candidate.status === "OPERATING";
}

/**
 * Evaluates route compatibility (0–100) based on depot location and route geometry.
 */
export function calculateRouteCompatibilityScore(candidate: Bus, affectedRoute?: Route): number {
  if (!affectedRoute) return 70;

  const loc = candidate.lastKnownLocationLabel.toLowerCase();
  const routeName = (affectedRoute.name + " " + affectedRoute.description).toLowerCase();

  // If candidate is at the depot or hub matching the route start or key hub
  if (affectedRoute.id === "R101" || affectedRoute.id === "R104") {
    if (loc.includes("puttur")) return 100;
    if (loc.includes("uppinangady")) return 80;
    if (loc.includes("kadaba") || loc.includes("sullia")) return 90;
  } else if (affectedRoute.id === "R102") {
    if (loc.includes("vittal")) return 100;
    if (loc.includes("puttur")) return 85;
  } else if (affectedRoute.id === "R103") {
    if (loc.includes("uppinangady")) return 100;
    if (loc.includes("puttur")) return 85;
  }

  // Default regional compatibility
  if (loc.includes("puttur") || routeName.includes("puttur")) return 75;
  return 65;
}

/**
 * Normalises response time into a 0–100 score.
 * Lower response time yields a higher score.
 * 0 mins = 100 pts, 60 mins = 0 pts.
 */
export function calculateResponseTimeScore(responseMinutes?: number): number {
  const mins = responseMinutes ?? 30;
  const clamped = Math.max(0, Math.min(60, mins));
  return Math.round(100 - (clamped / 60) * 100);
}

/**
 * Evaluates capacity score (0–100) and identifies any capacity deficit.
 */
export function calculateCapacityScore(
  candidateCapacity: number,
  requiredCapacity: number,
): { score: number; deficit: number; isFullCoverage: boolean } {
  if (requiredCapacity <= 0) return { score: 100, deficit: 0, isFullCoverage: true };

  if (candidateCapacity >= requiredCapacity) {
    return { score: 100, deficit: 0, isFullCoverage: true };
  }

  const deficit = requiredCapacity - candidateCapacity;
  const score = Math.round((candidateCapacity / requiredCapacity) * 100);
  return { score, deficit, isFullCoverage: false };
}

/**
 * Evaluates operational availability score (0–100).
 */
export function calculateAvailabilityScore(candidate: Bus): number {
  if (candidate.status === "AVAILABLE" && candidate.commitments.length === 0) {
    return 100;
  }
  if (candidate.status === "AVAILABLE" && candidate.commitments.length > 0) {
    return 75;
  }
  if (candidate.status === "OPERATING") {
    // Operating buses can theoretically be reassigned, but have lower availability
    return 40;
  }
  return 0;
}

/**
 * Evaluates a single candidate bus against the failed bus context.
 */
export function evaluateCandidateBus(
  candidate: Bus,
  context: CandidateEvaluationContext,
): CandidateEvaluationResult {
  const { failedBus, affectedRoute } = context;
  const requiredCapacity = context.requiredCapacity ?? failedBus.capacity;

  const eligible = isCandidateEligible(candidate, failedBus);

  if (!eligible) {
    let ineligibleReason = "Bus is ineligible for replacement deployment";
    if (candidate.id === failedBus.id) {
      ineligibleReason = "Cannot select the failed bus as its own replacement.";
    } else if (candidate.status === "MAINTENANCE") {
      ineligibleReason = "Bus is currently under scheduled maintenance in workshop.";
    } else if (candidate.status === "UNAVAILABLE") {
      ineligibleReason = "Bus is currently unavailable.";
    } else if (candidate.status === "REPLACEMENT_ASSIGNED") {
      ineligibleReason = "Bus is already assigned as a replacement to another route.";
    } else if (candidate.commitments.length > 0) {
      ineligibleReason = `Incompatible operational commitments: ${candidate.commitments.join(", ")}.`;
    }

    return {
      busId: candidate.id,
      bus: candidate,
      capacityScore: 0,
      compatibilityScore: 0,
      responseTimeScore: 0,
      availabilityScore: 0,
      finalScore: 0,
      eligible: false,
      capacityDeficit: requiredCapacity,
      isFullCoverage: false,
      explanation: ineligibleReason,
      componentDetails: {
        capacity: { score: 0, candidateCapacity: candidate.capacity, requiredCapacity, isFull: false },
        compatibility: { score: 0, depotLocation: candidate.lastKnownLocationLabel, routeName: affectedRoute?.name },
        responseTime: { score: 0, minutes: candidate.estimatedResponseMinutes ?? 30 },
        availability: { score: 0, status: candidate.status, commitmentsCount: candidate.commitments.length },
      },
    };
  }

  // Component evaluations
  const cap = calculateCapacityScore(candidate.capacity, requiredCapacity);
  const compatibilityScore = calculateRouteCompatibilityScore(candidate, affectedRoute);
  const responseTimeScore = calculateResponseTimeScore(candidate.estimatedResponseMinutes);
  const availabilityScore = calculateAvailabilityScore(candidate);

  // Weighted sum formula:
  // Capacity: 35%, Route compatibility: 30%, Response time: 25%, Operational availability: 10%
  const finalScore = Math.round(
    cap.score * REPLACEMENT_WEIGHTS.capacity +
      compatibilityScore * REPLACEMENT_WEIGHTS.routeCompatibility +
      responseTimeScore * REPLACEMENT_WEIGHTS.responseTime +
      availabilityScore * REPLACEMENT_WEIGHTS.operationalAvailability,
  );

  // Construct transparent explanation
  const coverageLabel = cap.isFullCoverage
    ? `Full route capacity coverage (${candidate.capacity} seats for ${requiredCapacity} needed)`
    : `Partial coverage: ${candidate.capacity} seats leaves ${cap.deficit} seat shortage`;

  const respMinutes = candidate.estimatedResponseMinutes ?? 20;
  const explanation = `${coverageLabel}. Estimated response time: ${respMinutes} min from ${candidate.lastKnownLocationLabel}. Compatibility score: ${compatibilityScore}/100. Overall suitability: ${finalScore}/100.`;

  return {
    busId: candidate.id,
    bus: candidate,
    capacityScore: cap.score,
    compatibilityScore,
    responseTimeScore,
    availabilityScore,
    finalScore,
    eligible: true,
    capacityDeficit: cap.deficit,
    isFullCoverage: cap.isFullCoverage,
    explanation,
    componentDetails: {
      capacity: { score: cap.score, candidateCapacity: candidate.capacity, requiredCapacity, isFull: cap.isFullCoverage },
      compatibility: { score: compatibilityScore, depotLocation: candidate.lastKnownLocationLabel, routeName: affectedRoute?.name },
      responseTime: { score: responseTimeScore, minutes: respMinutes },
      availability: { score: availabilityScore, status: candidate.status, commitmentsCount: candidate.commitments.length },
    },
  };
}

/**
 * Ranks all replacement candidates in the fleet for a broken-down bus.
 * Returns sorted list of candidates (highest finalScore first, with ineligibles at bottom).
 */
export function rankReplacementBuses(
  failedBus: Bus,
  fleet: Bus[],
  context: { affectedRoute?: Route; requiredCapacity?: number; occupiedPassengers?: number } = {},
): CandidateEvaluationResult[] {
  const evalContext: CandidateEvaluationContext = {
    failedBus,
    affectedRoute: context.affectedRoute,
    requiredCapacity: context.requiredCapacity ?? failedBus.capacity,
    occupiedPassengers: context.occupiedPassengers ?? failedBus.occupiedSeats,
  };

  const results = fleet.map((candidate) => evaluateCandidateBus(candidate, evalContext));

  // Sort eligible candidates by finalScore descending.
  // Ineligible candidates sorted to the end.
  return results.sort((a, b) => {
    if (a.eligible && !b.eligible) return -1;
    if (!a.eligible && b.eligible) return 1;
    if (a.eligible && b.eligible) {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      // Tie-breaker 1: full coverage preferred
      if (a.isFullCoverage && !b.isFullCoverage) return -1;
      if (!a.isFullCoverage && b.isFullCoverage) return 1;
      // Tie-breaker 2: lower response time
      const respA = a.bus.estimatedResponseMinutes ?? 60;
      const respB = b.bus.estimatedResponseMinutes ?? 60;
      return respA - respB;
    }
    return 0;
  });
}
