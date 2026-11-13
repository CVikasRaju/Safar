import { describe, expect, it } from "vitest";
import { makeState, SCENARIO_DATE } from "./helpers";
import { calculateStudentDemand } from "../src/domain/calculations/demand";
import { validateSeedData } from "../src/domain/validation";
import { getNetworkFromState } from "../src/domain/network";
import { getInitialState } from "../src/state/initialState";

describe("canonical demo seed", () => {
  const state = makeState();

  it("contains the required network entities", () => {
    expect(state.villages.map((village) => village.name).sort()).toEqual([
      "Kadaba",
      "Puttur",
      "Sullia",
      "Uppinangady",
      "Vittal",
    ]);
    expect(state.destinations.length).toBeGreaterThanOrEqual(3);
    expect(state.destinations.map((destination) => destination.name)).toContain(
      "Puttur Government College",
    );
    expect(state.routes.map((route) => route.id).sort()).toEqual([
      "R101",
      "R102",
      "R103",
      "R104",
    ]);
    expect(state.stops.length).toBeGreaterThanOrEqual(10);
    expect(state.buses.length).toBeGreaterThanOrEqual(5);
    expect(state.events.length).toBeGreaterThanOrEqual(1);
  });

  it("assigns KA-21-AB-102 to R101 and starts it operating", () => {
    const bus = state.buses.find((candidate) => candidate.registration === "KA-21-AB-102");
    expect(bus).toBeDefined();
    expect(bus?.assignedRouteId).toBe("R101");
    expect(bus?.status).toBe("OPERATING");
  });

  it("validates every route, stop, service, bus, demand and event reference", () => {
    const validation = validateSeedData({
      network: getNetworkFromState(state),
      buses: state.buses,
      demandSeed: state.demandSeed,
      events: state.events,
      scenarioDate: state.scenario.scenarioDate,
    });
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });

  it("has chronological timetables whose stop order matches the route", () => {
    for (const service of state.services) {
      const route = state.routes.find((candidate) => candidate.id === service.routeId)!;
      expect(service.stopTimes.map((stop) => stop.stopId)).toEqual(route.stopIds);
      for (let index = 1; index < service.stopTimes.length; index += 1) {
        expect(service.stopTimes[index].time > service.stopTimes[index - 1].time).toBe(true);
      }
    }
  });

  it("produces the required illustrative demand totals: 420 students, 350 seats, 70 shortage", () => {
    const demand = calculateStudentDemand([], state.demandSeed, {
      network: getNetworkFromState(state),
      state,
    });
    expect(demand.totals.expectedStudents).toBe(420);
    expect(demand.totals.availableSeats).toBe(350);
    expect(demand.totals.shortage).toBe(70);
    expect(demand.routes.find((route) => route.routeId === "R101")?.expectedStudents).toBe(145);
    expect(demand.routes.find((route) => route.routeId === "R101")?.availableSeats).toBe(100);
    expect(demand.routes.find((route) => route.routeId === "R102")?.expectedStudents).toBe(90);
    expect(demand.routes.find((route) => route.routeId === "R102")?.availableSeats).toBe(110);
    expect(demand.routes.find((route) => route.routeId === "R103")?.expectedStudents).toBe(185);
    expect(demand.routes.find((route) => route.routeId === "R103")?.availableSeats).toBe(140);
  });

  it("seeds the festival event for the configured scenario date with R101 and R104 declared", () => {
    const event = state.events[0];
    expect(event.date).toBe(SCENARIO_DATE);
    expect(event.declaredAffectedRouteIds.sort()).toEqual(["R101", "R104"]);
    expect(event.provenance).toBe("SIMULATED");
    expect(event.description).toContain("not verified road closures");
  });

  it("builds a complete initial state with no reports, incidents or allocations", () => {
    expect(state.reports).toEqual([]);
    expect(state.incidents).toEqual([]);
    expect(state.recommendations).toEqual([]);
    expect(state.scenario.mode).toBe("NONE");
    expect(state.auditEvents).toEqual([]);
  });

  it("reset-style rebuild is deterministic for the same configured inputs", () => {
    const first = getInitialState({ now: new Date(2026, 10, 13, 9, 0, 0), scenarioDate: SCENARIO_DATE });
    const second = getInitialState({ now: new Date(2026, 10, 13, 9, 0, 0), scenarioDate: SCENARIO_DATE });
    expect(second).toEqual(first);
  });
});
