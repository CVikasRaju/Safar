import { describe, expect, it } from "vitest";
import { makeState, TEST_NOW } from "./helpers";
import { rankReplacementBuses } from "../src/domain/calculations/replacement";
import { getNetworkFromState } from "../src/domain/network";
import {
  approveReplacement,
  generateRecommendationExplanation,
  generateReplacementRecommendation,
  rejectReplacement,
} from "../src/services/replacementService";
import { simulateBusBreakdown } from "../src/services/fleetService";
import { getDemandSummary } from "../src/services/demandService";

function breakdown(state = makeState()) {
  const result = simulateBusBreakdown({ busId: "bus-101" }, state);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("bus breakdown and replacement optimisation", () => {
  it("excludes the failed, unavailable, maintenance and already committed buses", () => {
    const result = breakdown();
    const incident = result.data.incident;
    const network = getNetworkFromState(result.state);
    const ranking = rankReplacementBuses(
      incident,
      result.state.buses,
      { routeId: "R101", requiredSeats: 60, failedBusId: "bus-101" },
      { network },
    );

    const byId = new Map(ranking.candidates.map((candidate) => [candidate.busId, candidate]));
    expect(byId.get("bus-101")?.eligible).toBe(false);
    expect(byId.get("bus-106")?.eligible).toBe(false);
    expect(byId.get("bus-102")?.eligible).toBe(false);
    expect(byId.get("bus-103")?.eligible).toBe(false);
    expect(byId.get("bus-107")?.eligible).toBe(false);
    expect(byId.get("bus-104")?.eligible).toBe(true);
    expect(byId.get("bus-105")?.eligible).toBe(true);
    expect(byId.get("bus-108")?.eligible).toBe(true);
    expect(ranking.recommendedBusId).toBe("bus-104");
    expect(byId.get("bus-104")?.coverage).toBe("FULL");
    expect(ranking.status).toBe("PENDING");
  });

  it("produces a recommendation that does not allocate a bus", () => {
    const result = breakdown();
    expect(result.data.recommendation?.status).toBe("PENDING");
    expect(result.data.incident.status).toBe("ACTIVE");
    expect(result.state.buses.some((bus) => bus.status === "REPLACEMENT_ASSIGNED")).toBe(false);
    expect(result.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("UNAVAILABLE");
    expect(result.state.incidents[0].replacementBusId).toBeUndefined();
  });

  it("scores the weighted components and explains the recommendation", () => {
    const result = breakdown();
    const candidate = result.data.recommendation?.rankedCandidates.find(
      (entry) => entry.busId === "bus-104",
    )!;
    expect(candidate.capacityScore).toBe(100);
    expect(candidate.responseTimeScore).toBe(80);
    expect(candidate.availabilityScore).toBe(100);
    expect(candidate.finalScore).toBe(
      Math.round(
        candidate.capacityScore * 0.35 +
          candidate.compatibilityScore * 0.3 +
          candidate.responseTimeScore * 0.25 +
          candidate.availabilityScore * 0.1,
      ),
    );
    expect(candidate.explanation).toContain("Weighted score");
    expect(
      generateRecommendationExplanation(result.data.recommendation!),
    ).toContain("Recommended");
  });

  it("approves a replacement, updates fleet, demand capacity and student alerts", () => {
    const result = breakdown();
    const recommendation = result.data.recommendation!;
    const approved = approveReplacement(recommendation.id, result.state, {
      now: TEST_NOW,
      reason: "Approved to restore R101 coverage.",
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    const replacementBus = approved.state.buses.find((bus) => bus.id === "bus-104");
    expect(replacementBus?.status).toBe("REPLACEMENT_ASSIGNED");
    expect(replacementBus?.assignedRouteId).toBe("R101");
    expect(replacementBus?.commitments).toContain("incident:inc-1");
    expect(approved.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("UNAVAILABLE");
    expect(approved.data.recommendation.status).toBe("APPROVED");
    expect(approved.data.coveredSeats).toBe(65);
    expect(approved.data.remainingShortage).toBe(0);

    const demand = getDemandSummary(approved.state);
    expect(demand.routes.find((route) => route.routeId === "R101")?.availableSeats).toBe(165);
    expect(demand.totals.availableSeats).toBe(415);
    expect(demand.totals.shortage).toBe(5);

    expect(
      approved.state.alerts.some(
        (alert) => alert.audience === "BOTH" && alert.title === "REPLACEMENT APPROVED",
      ),
    ).toBe(true);
    expect(approved.state.auditEvents.some((event) => event.action === "APPROVE_REPLACEMENT")).toBe(true);
  });

  it("supports the documented approveReplacement(recommendationId, busId, state) call order", () => {
    const result = breakdown();
    const approved = approveReplacement(
      result.data.recommendation!.id,
      "bus-104",
      result.state,
      { now: TEST_NOW },
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.data.bus.registration).toBe("KA-21-CD-201");
    expect(approved.data.recommendation.status).toBe("APPROVED");
  });

  it("prevents approving the same recommendation twice", () => {
    const result = breakdown();
    const first = approveReplacement(result.data.recommendation!.id, result.state, { now: TEST_NOW });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = approveReplacement(result.data.recommendation!.id, first.state, { now: TEST_NOW });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("RECOMMENDATION_NOT_PENDING");
  });

  it("revalidates a stale candidate immediately before approval", () => {
    const result = breakdown();
    const staleState = {
      ...result.state,
      buses: result.state.buses.map((bus) =>
        bus.id === "bus-104" ? { ...bus, status: "UNAVAILABLE" as const } : bus,
      ),
    };
    const approved = approveReplacement(result.data.recommendation!.id, staleState, { now: TEST_NOW });
    expect(approved.ok).toBe(false);
    if (approved.ok) return;
    expect(approved.code).toBe("CANDIDATE_STALE");
    expect(staleState.buses.some((bus) => bus.status === "REPLACEMENT_ASSIGNED")).toBe(false);
  });

  it("rejects a recommendation without allocating a bus", () => {
    const result = breakdown();
    const withoutReason = rejectReplacement(result.data.recommendation!.id, "", result.state);
    expect(withoutReason.ok).toBe(false);

    const rejected = rejectReplacement(
      result.data.recommendation!.id,
      "Defer to the next depot shift.",
      result.state,
      { now: TEST_NOW },
    );
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.data.recommendation.status).toBe("REJECTED");
    expect(result.state.buses.some((bus) => bus.status === "REPLACEMENT_ASSIGNED")).toBe(false);
    expect(rejected.state.incidents.find((incident) => incident.id === result.data.incident.id)?.status).toBe("ACTIVE");
  });

  it("marks a lower-capacity bus as partial coverage rather than a full replacement", () => {
    const base = makeState();
    const state = {
      ...base,
      buses: base.buses.map((bus) => {
        if (bus.id === "bus-104") return { ...bus, status: "UNAVAILABLE" as const };
        if (bus.id === "bus-108") return { ...bus, status: "UNAVAILABLE" as const };
        return bus;
      }),
    };
    const result = breakdown(state);
    const recommendation = result.data.recommendation!;
    const candidate = recommendation.rankedCandidates.find((entry) => entry.busId === "bus-105")!;
    expect(candidate.coverage).toBe("PARTIAL");
    expect(candidate.remainingSeats).toBe(45);
    expect(recommendation.coveredSeats).toBe(45);
    expect(recommendation.remainingShortage).toBe(15);
    expect(recommendation.status).toBe("PENDING");
  });

  it("returns NO_FEASIBLE_CANDIDATE honestly when no bus can cover the incident", () => {
    const base = makeState();
    const state = {
      ...base,
      buses: base.buses.map((bus) =>
        bus.status === "AVAILABLE" ? { ...bus, status: "UNAVAILABLE" as const } : bus,
      ),
    };
    const result = breakdown(state);
    const recommendation = result.data.recommendation!;
    expect(recommendation.status).toBe("NO_FEASIBLE_CANDIDATE");
    expect(recommendation.recommendedBusId).toBeUndefined();
    expect(recommendation.remainingShortage).toBe(60);
    expect(result.state.buses.some((bus) => bus.status === "REPLACEMENT_ASSIGNED")).toBe(false);

    const approved = approveReplacement(recommendation.id, result.state, { now: TEST_NOW });
    expect(approved.ok).toBe(false);
  });

  it("cannot regenerate a duplicate pending recommendation for the same incident", () => {
    const result = breakdown();
    const again = generateReplacementRecommendation(result.data.incident.id, result.state);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.data.recommendation.id).toBe(result.data.recommendation?.id);
    expect(again.state.recommendations).toHaveLength(1);
  });
});
