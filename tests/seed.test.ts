import { describe, expect, it } from "vitest";
import { createSeedState } from "../src/data/seed";
import { validateState } from "../src/data/validation";
import { DEMAND_SEED_TOTALS } from "../src/data/seed/demand";

const state = createSeedState({
  scenarioDate: "2026-11-14",
  now: new Date("2026-11-13T06:00:00.000Z"),
});

describe("demo seed dataset (docs/10, docs/17)", () => {
  it("passes referential validation", () => {
    const errors = validateState(state).filter((issue) => issue.level === "error");
    expect(errors).toEqual([]);
  });

  it("seeds routes R101, R102, R103 and R104", () => {
    expect(state.routes.map((route) => route.id).sort()).toEqual(["R101", "R102", "R103", "R104"]);
  });

  it("seeds the required minimum records", () => {
    expect(state.villages.length).toBeGreaterThanOrEqual(5);
    expect(state.destinations.length).toBeGreaterThanOrEqual(3);
    expect(state.stops.length).toBeGreaterThanOrEqual(10);
    expect(state.buses.length).toBeGreaterThanOrEqual(5);
    expect(state.timetableServices.length).toBeGreaterThan(0);
    expect(state.events.length).toBeGreaterThanOrEqual(1);
  });

  it("includes Puttur Government College as a destination", () => {
    expect(state.destinations.map((destination) => destination.name)).toContain(
      "Puttur Government College",
    );
  });

  it("assigns KA-21-AB-102 to R101 initially", () => {
    const bus = state.buses.find((entry) => entry.registration === "KA-21-AB-102");
    expect(bus).toBeDefined();
    expect(bus?.assignedRouteId).toBe("R101");
    expect(bus?.status).toBe("OPERATING");
  });

  it("matches the required demand seed totals and shortage", () => {
    expect(DEMAND_SEED_TOTALS).toEqual({ expectedStudents: 420, availableSeats: 350 });
    const shortage = Math.max(0, DEMAND_SEED_TOTALS.expectedStudents - DEMAND_SEED_TOTALS.availableSeats);
    expect(shortage).toBe(70);
  });

  it("keeps every route, bus and timetable reference resolvable", () => {
    const stopIds = new Set(state.stops.map((stop) => stop.id));
    const routeIds = new Set(state.routes.map((route) => route.id));
    const busIds = new Set(state.buses.map((bus) => bus.id));

    for (const route of state.routes) {
      for (const stopId of route.stops) expect(stopIds.has(stopId)).toBe(true);
    }
    for (const service of state.timetableServices) {
      expect(routeIds.has(service.routeId)).toBe(true);
      expect(busIds.has(service.busId)).toBe(true);
      for (let index = 1; index < service.stopTimes.length; index += 1) {
        expect(service.stopTimes[index].arrivalMinute).toBeGreaterThan(
          service.stopTimes[index - 1].arrivalMinute,
        );
      }
    }
    for (const bus of state.buses) {
      if (bus.assignedRouteId) expect(routeIds.has(bus.assignedRouteId)).toBe(true);
    }
  });

  it("returns a fresh object graph on every call", () => {
    const first = createSeedState({ scenarioDate: "2026-11-14" });
    const second = createSeedState({ scenarioDate: "2026-11-14" });
    expect(first).not.toBe(second);
    first.buses[0].status = "UNAVAILABLE";
    expect(second.buses[0].status).toBe("OPERATING");
  });

  it("labels seed data as illustrative rather than verified", () => {
    expect(state.buses.every((bus) => bus.provenance === "DEMO")).toBe(true);
    expect(state.events.every((event) => event.provenance === "DEMO")).toBe(true);
    expect(state.eventRouteImpacts.every((impact) => impact.provenance === "DEMO")).toBe(true);
  });
});
