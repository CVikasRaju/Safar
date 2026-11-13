import { describe, expect, it } from "vitest";
import { createSeedState } from "../src/data/seed";
import {
  calculateCapacityScore,
  calculateFleetIndicators,
  calculateResponseTimeScore,
  calculateRouteCompatibilityScore,
  isCandidateEligible,
  rankReplacementBuses,
  REPLACEMENT_WEIGHTS,
} from "../src/domain/calculations/fleetRanking";
import {
  prepareApproveReplacement,
  prepareRejectReplacement,
  prepareSimulateBreakdown,
  runLiveDemonstrationScenario,
} from "../src/domain/services/fleetActions";
import { reducer } from "../src/state/reducer";
import { buildStudentAlerts } from "../src/features/student/alerts";
import type { Bus } from "../src/domain/types";

const NOW = new Date("2026-11-13T07:30:00.000Z");
const state = createSeedState({ scenarioDate: "2026-11-14", now: NOW });

describe("fleet indicators calculation (docs/03, docs/07)", () => {
  it("calculates accurate fleet counts and seed demand values", () => {
    const indicators = calculateFleetIndicators(state);
    expect(indicators.totalBuses).toBe(7);
    expect(indicators.operatingBuses).toBe(4);
    expect(indicators.availableBuses).toBe(2);
    expect(indicators.maintenanceBuses).toBe(1);
    expect(indicators.unavailableBuses).toBe(0);

    // Documented seed totals (docs/08): 420 expected, 350 available, 70 shortage
    expect(indicators.expectedStudentDemand).toBe(420);
    expect(indicators.availableSeats).toBe(350);
    expect(indicators.capacityShortage).toBe(70);

    // Routes requiring attention initially include R101 (shortage 45) and R103 (shortage 45)
    expect(indicators.routesRequiringAttention).toContain("R101");
    expect(indicators.routesRequiringAttention).toContain("R103");
  });
});

describe("replacement eligibility and ranking rules (docs/07, docs/13)", () => {
  const failedBus = state.buses.find((b) => b.id === "bus-ka21ab102")!;
  const r101 = state.routes.find((r) => r.id === "R101")!;

  it("excludes failed bus, unavailable bus, maintenance bus and committed buses", () => {
    // Failed bus itself
    expect(isCandidateEligible(failedBus, failedBus)).toBe(false);

    // Maintenance bus KA-21-JK-512
    const maintenanceBus = state.buses.find((b) => b.id === "bus-ka21jk512")!;
    expect(isCandidateEligible(maintenanceBus, failedBus)).toBe(false);

    // Unavailable bus
    const unavailableBus: Bus = { ...maintenanceBus, status: "UNAVAILABLE" };
    expect(isCandidateEligible(unavailableBus, failedBus)).toBe(false);

    // Available buses are eligible
    const availableBus1 = state.buses.find((b) => b.id === "bus-ka21gh407")!;
    const availableBus2 = state.buses.find((b) => b.id === "bus-ka21lm609")!;
    expect(isCandidateEligible(availableBus1, failedBus)).toBe(true);
    expect(isCandidateEligible(availableBus2, failedBus)).toBe(true);
  });

  it("applies documented weights (35% capacity, 30% compatibility, 25% response, 10% availability)", () => {
    expect(REPLACEMENT_WEIGHTS.capacity).toBe(0.35);
    expect(REPLACEMENT_WEIGHTS.routeCompatibility).toBe(0.30);
    expect(REPLACEMENT_WEIGHTS.responseTime).toBe(0.25);
    expect(REPLACEMENT_WEIGHTS.operationalAvailability).toBe(0.10);

    // Sum of weights must equal 1.0 (100%)
    const sum =
      REPLACEMENT_WEIGHTS.capacity +
      REPLACEMENT_WEIGHTS.routeCompatibility +
      REPLACEMENT_WEIGHTS.responseTime +
      REPLACEMENT_WEIGHTS.operationalAvailability;
    expect(sum).toBeCloseTo(1.0);
  });

  it("evaluates capacity score and detects partial coverage shortages", () => {
    // Full coverage: candidate 56 seats vs 52 required
    const full = calculateCapacityScore(56, 52);
    expect(full.score).toBe(100);
    expect(full.isFullCoverage).toBe(true);
    expect(full.deficit).toBe(0);

    // Partial coverage: candidate 40 seats vs 52 required
    const partial = calculateCapacityScore(40, 52);
    expect(partial.score).toBe(77); // 40/52 * 100 = 76.92 -> 77
    expect(partial.isFullCoverage).toBe(false);
    expect(partial.deficit).toBe(12);
  });

  it("evaluates response time scoring (shorter is better) and route compatibility", () => {
    expect(calculateResponseTimeScore(0)).toBe(100);
    expect(calculateResponseTimeScore(12)).toBe(80);
    expect(calculateResponseTimeScore(25)).toBe(58);
    expect(calculateResponseTimeScore(60)).toBe(0);

    const compat = calculateRouteCompatibilityScore(state.buses[4], r101);
    expect(compat).toBeGreaterThanOrEqual(80);
  });

  it("ranks eligible candidates and marks ineligible buses", () => {
    const ranked = rankReplacementBuses(failedBus, state.buses, {
      affectedRoute: r101,
      requiredCapacity: 52,
      occupiedPassengers: 41,
    });

    expect(ranked.length).toBe(state.buses.length);

    // Ineligible buses are at the bottom
    const eligibleList = ranked.filter((r) => r.eligible);
    const ineligibleList = ranked.filter((r) => !r.eligible);

    expect(eligibleList.length).toBeGreaterThan(0);
    expect(ineligibleList.some((r) => r.busId === "bus-ka21jk512")).toBe(true);
    expect(ineligibleList.some((r) => r.busId === failedBus.id)).toBe(true);

    // Top ranked candidate has high suitability score
    expect(ranked[0].finalScore).toBeGreaterThanOrEqual(80);
    expect(ranked[0].explanation).toBeDefined();
  });
});

describe("bus breakdown simulation workflow (docs/06, docs/07, docs/15)", () => {
  it("fails if attempting to breakdown a bus that is not OPERATING", () => {
    const availableBus = state.buses.find((b) => b.status === "AVAILABLE")!;
    const res = prepareSimulateBreakdown(state, availableBus.id, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]).toContain("Operating");
    }
  });

  it("simulates breakdown on operating bus KA-21-AB-102 and updates state", () => {
    const res = prepareSimulateBreakdown(state, "bus-ka21ab102", NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const { incident, recommendation, updatedBuses, alerts, audit } = res.value;

    expect(incident.status).toBe("ACTIVE");
    expect(incident.busId).toBe("bus-ka21ab102");
    expect(incident.routeId).toBe("R101");
    expect(incident.severity).toBe("HIGH");

    // The broken bus is marked UNAVAILABLE
    const failed = updatedBuses.find((b) => b.id === "bus-ka21ab102")!;
    expect(failed.status).toBe("UNAVAILABLE");

    // Recommendation is created in PENDING status
    expect(recommendation.status).toBe("PENDING");
    expect(recommendation.recommendedBusId).toBeDefined();
    expect(recommendation.rankedCandidates.length).toBeGreaterThan(0);

    // Reducer application
    const nextState = reducer(state, {
      type: "SIMULATE_BREAKDOWN",
      incident,
      recommendation,
      updatedBuses,
      alerts,
      audit,
    });

    expect(nextState.incidents).toHaveLength(1);
    expect(nextState.incidents[0].status).toBe("ACTIVE");
    expect(nextState.replacementRecommendations).toHaveLength(1);

    const busInState = nextState.buses.find((b) => b.id === "bus-ka21ab102")!;
    expect(busInState.status).toBe("UNAVAILABLE");

    // Check Student Portal alerts reflect this incident immediately
    const studentAlerts = buildStudentAlerts({ state: nextState, sessionId: "student-demo-01", now: NOW });
    const incidentAlert = studentAlerts.find((a) => a.category === "INCIDENT");
    expect(incidentAlert).toBeDefined();
    expect(incidentAlert?.severity).toBe("CRITICAL");
    expect(incidentAlert?.title).toContain("CONFIRMED INCIDENT on R101");
  });
});

describe("authority approval & rejection workflows (docs/07)", () => {
  it("approves replacement bus and updates fleet allocation and timetable", () => {
    // 1. Simulate breakdown
    const breakdownRes = prepareSimulateBreakdown(state, "bus-ka21ab102", NOW);
    if (!breakdownRes.ok) throw new Error("breakdown simulation failed");

    const stateWithBreakdown = reducer(state, {
      type: "SIMULATE_BREAKDOWN",
      ...breakdownRes.value,
    });

    const rec = stateWithBreakdown.replacementRecommendations[0];
    const candidateBusId = rec.recommendedBusId!;

    // 2. Approve replacement
    const approveRes = prepareApproveReplacement(stateWithBreakdown, rec.id, candidateBusId, NOW);
    expect(approveRes.ok).toBe(true);
    if (!approveRes.ok) return;

    const stateAfterApproval = reducer(stateWithBreakdown, {
      type: "APPROVE_REPLACEMENT",
      ...approveRes.value,
    });

    // Check replacement bus is REPLACEMENT_ASSIGNED to R101
    const allocatedBus = stateAfterApproval.buses.find((b) => b.id === candidateBusId)!;
    expect(allocatedBus.status).toBe("REPLACEMENT_ASSIGNED");
    expect(allocatedBus.assignedRouteId).toBe("R101");

    // Failed bus remains UNAVAILABLE
    const failedBus = stateAfterApproval.buses.find((b) => b.id === "bus-ka21ab102")!;
    expect(failedBus.status).toBe("UNAVAILABLE");

    // Recommendation is marked APPROVED
    const updatedRec = stateAfterApproval.replacementRecommendations.find((r) => r.id === rec.id)!;
    expect(updatedRec.status).toBe("APPROVED");

    // Timetable services for R101 now reference the approved replacement bus
    const r101Services = stateAfterApproval.timetableServices.filter((s) => s.routeId === "R101");
    expect(r101Services.some((s) => s.busId === candidateBusId)).toBe(true);

    // Student Portal alerts show REPLACEMENT APPROVED
    const studentAlerts = buildStudentAlerts({ state: stateAfterApproval, sessionId: "student-demo-01", now: NOW });
    const repAlert = studentAlerts.find((a) => a.category === "REPLACEMENT" && a.severity === "SUCCESS");
    expect(repAlert).toBeDefined();
    expect(repAlert?.title).toBe("REPLACEMENT APPROVED");
  });

  it("rejects recommendation without changing fleet allocation", () => {
    const breakdownRes = prepareSimulateBreakdown(state, "bus-ka21ab102", NOW);
    if (!breakdownRes.ok) throw new Error("breakdown simulation failed");

    const stateWithBreakdown = reducer(state, {
      type: "SIMULATE_BREAKDOWN",
      ...breakdownRes.value,
    });

    const rec = stateWithBreakdown.replacementRecommendations[0];
    const rejectRes = prepareRejectReplacement(stateWithBreakdown, rec.id, "Depot reserve needed for evening rush", NOW);
    expect(rejectRes.ok).toBe(true);
    if (!rejectRes.ok) return;

    const stateAfterRejection = reducer(stateWithBreakdown, {
      type: "REJECT_REPLACEMENT",
      ...rejectRes.value,
    });

    const updatedRec = stateAfterRejection.replacementRecommendations.find((r) => r.id === rec.id)!;
    expect(updatedRec.status).toBe("REJECTED");
    expect(updatedRec.decisionReason).toContain("evening rush");

    // Candidate buses remain Available in fleet
    const candidateBus = stateAfterRejection.buses.find((b) => b.id === rec.recommendedBusId)!;
    expect(candidateBus.status).toBe("AVAILABLE");

    // Incident remains active
    expect(stateAfterRejection.incidents[0].status).toBe("ACTIVE");
  });
});

describe("central SAFAR live scenario runner & reset (docs/15 Scenario A)", () => {
  it("runs the complete scenario sequence and produces a comprehensive operational summary", () => {
    const { state: finalState, summary } = runLiveDemonstrationScenario(state, NOW);

    // State verifications
    expect(finalState.incidents.length).toBeGreaterThan(0);
    expect(finalState.replacementRecommendations[0].status).toBe("APPROVED");
    expect(finalState.scenario.status).toBe("COMPLETE");

    // Operational summary verifications
    expect(summary.affectedRoutes).toContain("R101");
    expect(summary.affectedRoutes).toContain("R104");
    expect(summary.affectedStudentsCount).toBe(41);
    expect(summary.failedBus.registration).toBe("KA-21-AB-102");
    expect(summary.failedBus.status).toBe("UNAVAILABLE");
    expect(summary.recommendedBus).toBeDefined();
    expect(summary.recommendedBus?.suitabilityScore).toBeGreaterThan(70);
    expect(summary.updatedReliability.score).toBeGreaterThan(0);
    expect(summary.updatedReliability.disclaimer).toContain("Illustrative prototype reliability score");

    // Test RESET restores initial seed cleanly
    const resetState = reducer(finalState, { type: "RESET_SCENARIO" });
    expect(resetState.incidents).toEqual([]);
    expect(resetState.replacementRecommendations).toEqual([]);
    expect(resetState.buses.find((b) => b.id === "bus-ka21ab102")!.status).toBe("OPERATING");
    expect(resetState.scenario.status).toBe("IDLE");
  });

  it("is fully repeatable: running twice after reset produces identical deterministic results", () => {
    const run1 = runLiveDemonstrationScenario(state, NOW);
    const resetState = reducer(run1.state, { type: "RESET_SCENARIO" });
    const run2 = runLiveDemonstrationScenario(resetState, NOW);

    expect(run1.summary.affectedStudentsCount).toBe(run2.summary.affectedStudentsCount);
    expect(run1.summary.failedBus.registration).toBe(run2.summary.failedBus.registration);
    expect(run1.summary.recommendedBus?.registration).toBe(run2.summary.recommendedBus?.registration);
    expect(run1.summary.recommendedBus?.suitabilityScore).toBe(run2.summary.recommendedBus?.suitabilityScore);
    expect(run1.summary.updatedReliability.score).toBe(run2.summary.updatedReliability.score);
  });
});
