import { describe, expect, it } from "vitest";
import { makeState, SCENARIO_DATE, TEST_NOW } from "./helpers";
import {
  approveScenarioReplacement,
  getScenarioSummary,
  resetState,
  runBreakdownScenario,
  runScenario,
} from "../src/services/scenarioService";
import { getDemandSummary } from "../src/services/demandService";
import { getAlerts, getDashboardMetrics } from "../src/services/dataService";

describe("central SAFAR live scenario", () => {
  it("runs the complete predictive + breakdown sequence without allocating a replacement", () => {
    const state = makeState();
    const run = runScenario({ now: TEST_NOW }, state);
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    const summary = run.data;
    expect(summary.mode).toBe("CENTRAL");
    expect(summary.scenarioDate).toBe(SCENARIO_DATE);
    expect(summary.event?.date).toBe(SCENARIO_DATE);
    expect(summary.affectedRoutes.map((impact) => impact.routeId).sort()).toEqual(["R101", "R104"]);
    // R101 baseline 145 + the scenario's simulated student request allocated to R104.
    expect(summary.affectedStudentEstimate).toBe(146);
    expect(summary.failedBus?.registration).toBe("KA-21-AB-102");
    expect(summary.incident?.status).toBe("ACTIVE");
    expect(summary.recommendation?.status).toBe("PENDING");
    expect(summary.awaitingApproval).toBe(true);
    expect(summary.recommendedAlternative?.routeIds).toContain("R104");
    expect(summary.recommendedAlternative?.routeIds).not.toContain("R101");
    expect(summary.updatedReliability).toBeGreaterThan(0);

    const stepsDone = summary.steps.filter((step) => step.completed).map((step) => step.id);
    expect(stepsDone).toContain("bus-breakdown-confirmed");
    expect(stepsDone).toContain("replacement-recommended");
    expect(stepsDone).not.toContain("replacement-approved");

    expect(run.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("UNAVAILABLE");
    expect(run.state.buses.some((bus) => bus.status === "REPLACEMENT_ASSIGNED")).toBe(false);
    expect(run.state.travelRequests).toHaveLength(1);
    expect(run.state.travelRequests[0].anonymousRef).toBe("SCENARIO-CENTRAL");
  });

  it("is repeatable without duplicating incidents, requests or recommendations", () => {
    const first = runScenario({ now: TEST_NOW }, makeState());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = runScenario({ now: TEST_NOW }, first.state);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.incidents).toHaveLength(1);
    expect(second.state.recommendations).toHaveLength(1);
    expect(second.state.travelRequests).toHaveLength(1);
    expect(second.data.incident?.id).toBe(first.data.incident?.id);
  });

  it("propagates the approved replacement into fleet, demand, alerts and both dashboards", () => {
    const run = runScenario({ now: TEST_NOW }, makeState());
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    const approved = approveScenarioReplacement(run.state, {
      now: TEST_NOW,
      reason: "Authority approved the recommended bus.",
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    const bus = approved.state.buses.find((candidate) => candidate.id === "bus-104");
    expect(bus?.status).toBe("REPLACEMENT_ASSIGNED");
    expect(bus?.assignedRouteId).toBe("R101");
    expect(approved.state.buses.find((candidate) => candidate.id === "bus-101")?.status).toBe("UNAVAILABLE");

    const demand = getDemandSummary(approved.state);
    expect(demand.totals.expectedStudents).toBe(421);
    expect(demand.totals.availableSeats).toBe(415);
    expect(demand.totals.shortage).toBe(6);

    const studentAlerts = getAlerts(approved.state, "STUDENT");
    expect(studentAlerts.some((alert) => alert.title === "REPLACEMENT APPROVED")).toBe(true);
    expect(studentAlerts.some((alert) => alert.title === "CONFIRMED INCIDENT")).toBe(true);

    const metrics = getDashboardMetrics(approved.state);
    expect(metrics.replacementAssignedBuses).toBe(1);
    expect(metrics.unavailableBuses).toBe(1);
    expect(metrics.activeIncidents).toBe(1);
    expect(metrics.approvedReplacements).toBe(1);
    expect(metrics.pendingRecommendations).toBe(0);

    expect(approved.data.summary.isComplete).toBe(true);
    expect(approved.data.summary.approvedReplacement?.registration).toBe("KA-21-CD-201");
    expect(approved.data.summary.steps.every((step) => step.completed)).toBe(true);
    expect(approved.data.summary.awaitingApproval).toBe(false);
  });

  it("resets to the exact original demo state", () => {
    const run = runScenario({ now: TEST_NOW }, makeState());
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const approved = approveScenarioReplacement(run.state, { now: TEST_NOW });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    const reset = resetState({ now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(reset).toEqual(makeState());
    expect(reset.buses.find((bus) => bus.id === "bus-101")?.status).toBe("OPERATING");
    expect(reset.incidents).toEqual([]);
    expect(reset.recommendations).toEqual([]);
    expect(reset.alerts).toEqual([]);
    expect(reset.scenario.mode).toBe("NONE");
  });

  it("requires the scenario to be run before approving its replacement", () => {
    const approved = approveScenarioReplacement(makeState(), { now: TEST_NOW });
    expect(approved.ok).toBe(false);
    if (approved.ok) return;
    expect(approved.code).toBe("SCENARIO_NOT_RUNNING");
  });

  it("supports an isolated breakdown demo without the festival scenario", () => {
    const state = makeState();
    const run = runBreakdownScenario({ now: TEST_NOW }, state);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.data.mode).toBe("BREAKDOWN");
    expect(run.data.event).toBeNull();
    expect(run.data.incident?.status).toBe("ACTIVE");
    expect(run.data.failedBus?.registration).toBe("KA-21-AB-102");
    expect(run.data.recommendation?.status).toBe("PENDING");
    expect(run.data.steps.some((step) => step.id === "event-affects-r101-r104" && step.completed)).toBe(false);
    expect(run.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("UNAVAILABLE");
  });

  it("handles the no-feasible-replacement scenario honestly end to end", () => {
    const state = makeState();
    const constrained = {
      ...state,
      buses: state.buses.map((bus) =>
        bus.status === "AVAILABLE" ? { ...bus, status: "UNAVAILABLE" as const } : bus,
      ),
    };
    const run = runBreakdownScenario({ now: TEST_NOW }, constrained);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.data.noFeasibleReplacement).toBe(true);
    expect(run.data.recommendation?.status).toBe("NO_FEASIBLE_CANDIDATE");
    expect(run.data.approvedReplacement).toBeNull();
    expect(run.state.buses.some((bus) => bus.status === "REPLACEMENT_ASSIGNED")).toBe(false);

    const approval = approveScenarioReplacement(run.state, { now: TEST_NOW });
    expect(approval.ok).toBe(false);
  });

  it("keeps the derived summary consistent with canonical state", () => {
    const run = runScenario({ now: TEST_NOW }, makeState());
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const summary = getScenarioSummary(run.state);
    expect(summary.failedBus?.id).toBe(run.data.failedBus?.id);
    expect(summary.recommendation?.id).toBe(run.data.recommendation?.id);
    expect(summary.affectedRoutes).toEqual(run.data.affectedRoutes);
    expect(summary.isComplete).toBe(false);
    expect(summary.provenance).toBe("CALCULATED");
  });
});
