import { describe, expect, it } from "vitest";
import { DEMO_REQUEST, makeState, SCENARIO_DATE } from "./helpers";
import { calculateStudentDemand } from "../src/domain/calculations/demand";
import { getNetworkFromState } from "../src/domain/network";
import { submitTravelRequest, getDemandSummary } from "../src/services/demandService";
import { recalculateEventImpacts } from "../src/services/eventService";
import { SIMULATED_DATA_LABEL } from "../src/domain/constants";

describe("demand and capacity engine", () => {
  it("reports route-level deficits, route surplus and the required 70-seat aggregate shortage", () => {
    const state = makeState();
    const demand = calculateStudentDemand([], state.demandSeed, {
      network: getNetworkFromState(state),
      state,
    });
    const r101 = demand.routes.find((route) => route.routeId === "R101")!;
    const r102 = demand.routes.find((route) => route.routeId === "R102")!;
    const r103 = demand.routes.find((route) => route.routeId === "R103")!;

    expect(r101.shortage).toBe(45);
    expect(r102.shortage).toBe(0);
    expect(r102.surplus).toBe(20);
    expect(r103.shortage).toBe(45);
    expect(demand.totals.routeLevelShortage).toBe(90);
    expect(demand.totals.shortage).toBe(70);
    expect(demand.totals.expectedStudents - demand.totals.availableSeats).toBe(70);
    expect(demand.totals.overcrowdingRisk).toBe("CRITICAL");
  });

  it("allocates a submitted group to exactly one route (no double counting)", () => {
    const state = makeState();
    const submitted = submitTravelRequest(
      {
        ...DEMO_REQUEST,
        groupSize: 5,
        travelDate: SCENARIO_DATE,
        provenance: "USER_ENTERED",
        anonymousRef: "STU-TEST",
      },
      state,
    );
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const demand = getDemandSummary(submitted.state);
    expect(demand.totals.expectedStudents).toBe(425);
    const routesWithSubmission = demand.routes.filter((route) => route.submittedStudents > 0);
    expect(routesWithSubmission.length).toBe(1);
    expect(routesWithSubmission[0].submittedStudents).toBe(5);
    expect(demand.villageDemand.length).toBe(1);
    expect(demand.destinationDemand.length).toBe(1);
    expect(demand.submittedGroups).toBe(1);
  });

  it("validates travel submissions and rejects invalid input", () => {
    const state = makeState();
    expect(
      submitTravelRequest(
        { ...DEMO_REQUEST, groupSize: 0 },
        state,
      ).ok,
    ).toBe(false);
    expect(
      submitTravelRequest({ ...DEMO_REQUEST, originVillageId: "V_UNKNOWN", groupSize: 1 }, state).ok,
    ).toBe(false);
    expect(
      submitTravelRequest({ ...DEMO_REQUEST, travelDate: "14-11-2026", groupSize: 1 }, state).ok,
    ).toBe(false);
    expect(
      submitTravelRequest({ ...DEMO_REQUEST, requiredArrivalTime: "25:00", groupSize: 1 }, state).ok,
    ).toBe(false);
  });

  it("does not automatically increase demand because an event exists", () => {
    const state = makeState();
    const withEvent = recalculateEventImpacts(state);
    const before = getDemandSummary(state);
    const after = getDemandSummary(withEvent);
    expect(after.totals.expectedStudents).toBe(before.totals.expectedStudents);
    expect(after.totals.availableSeats).toBe(before.totals.availableSeats);
  });

  it("labels demand data as illustrative", () => {
    const state = makeState();
    const demand = getDemandSummary(state);
    expect(demand.provenance).toBe("CALCULATED");
    expect(demand.notes.join(" ")).toContain("Illustrative demand");
    expect(demand.notes.join(" ")).toContain("420 students");
    expect(SIMULATED_DATA_LABEL).toContain("SIMULATED");
  });
});
