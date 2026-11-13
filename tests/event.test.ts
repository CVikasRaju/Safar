import { describe, expect, it } from "vitest";
import { makeState, SCENARIO_DATE } from "./helpers";
import {
  calculateAllRouteImpacts,
  calculateEventImpact,
  identifyAffectedRoutes,
  riskForScore,
} from "../src/domain/calculations/eventImpact";
import { getNetworkFromState } from "../src/domain/network";
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from "../src/services/eventService";

describe("event intelligence engine", () => {
  it("classifies the seeded festival as high or critical on R101 and R104", () => {
    const state = makeState();
    const event = state.events[0];
    const network = getNetworkFromState(state);
    const route101 = state.routes.find((route) => route.id === "R101")!;
    const route104 = state.routes.find((route) => route.id === "R104")!;

    const impact101 = calculateEventImpact(event, route101, {
      network,
      demandSeed: state.demandSeed,
      state,
    });
    const impact104 = calculateEventImpact(event, route104, {
      network,
      demandSeed: state.demandSeed,
      state,
    });

    expect(impact101.score).toBeGreaterThanOrEqual(50);
    expect(["HIGH", "CRITICAL"]).toContain(impact101.risk);
    expect(impact104.score).toBeGreaterThanOrEqual(50);
    expect(impact104.estimatedDelayMinutes).toBeLessThanOrEqual(20);
    expect(impact101.estimatedDelayMinutes).toBeGreaterThan(0);
    expect(impact101.explanation).toContain("not a verified road closure");
  });

  it("uses documented risk bands", () => {
    expect(riskForScore(0)).toBe("LOW");
    expect(riskForScore(24)).toBe("LOW");
    expect(riskForScore(25)).toBe("MODERATE");
    expect(riskForScore(49)).toBe("MODERATE");
    expect(riskForScore(50)).toBe("HIGH");
    expect(riskForScore(74)).toBe("HIGH");
    expect(riskForScore(75)).toBe("CRITICAL");
    expect(riskForScore(100)).toBe("CRITICAL");
  });

  it("renormalises weights and discloses missing factors instead of inventing data", () => {
    const state = makeState();
    const network = getNetworkFromState(state);
    const route = state.routes.find((candidate) => candidate.id === "R101")!;
    const event = {
      ...state.events[0],
      declaredAffectedRouteIds: [],
      nearbyVillageIds: [],
      latitude: undefined,
      longitude: undefined,
      preparationBuffer: undefined,
    };
    const impact = calculateEventImpact(event, route, {
      network,
      demandSeed: state.demandSeed,
      state,
    });
    expect(impact.missingFactors).toContain("routeProximity");
    expect(impact.factors.routeProximity).toBeNull();
    expect(impact.weightsUsed.routeProximity).toBeUndefined();
    expect(Object.values(impact.weightsUsed).reduce((sum, weight) => sum + (weight ?? 0), 0)).toBeCloseTo(1, 2);
    expect(impact.explanation).toContain("renormalising");
  });

  it("identifies only explicitly associated routes as affected in the seeded scenario", () => {
    const state = makeState();
    const event = state.events[0];
    const affected = identifyAffectedRoutes(event, {
      network: getNetworkFromState(state),
      demandSeed: state.demandSeed,
      state,
    });
    expect(affected.map((impact) => impact.routeId).sort()).toEqual(["R101", "R104"]);
    const all = calculateAllRouteImpacts(event, {
      network: getNetworkFromState(state),
      demandSeed: state.demandSeed,
      state,
    });
    expect(all.length).toBe(state.routes.length);
    // Canonical state publishes only declared affected routes, not every
    // route that an approximate proximity estimate could reach.
    expect(
      state.eventImpacts.map((impact) => impact.routeId).sort(),
    ).toEqual(["R101", "R104"]);
  });

  it("recalculates impact when an event is updated and removes it when deleted", () => {
    const state = makeState();
    const created = createEvent(
      {
        name: "Kadaba Village Fair",
        category: "VILLAGE_FAIR",
        locationLabel: "Kadaba grounds",
        villageId: "V_KADABA",
        date: SCENARIO_DATE,
        startTime: "08:00",
        endTime: "12:00",
        crowdLevel: "HIGH",
        nearbyVillageIds: ["V_KADABA"],
        affectedRoadLabels: ["Kadaba main road (illustrative)"],
        declaredAffectedRouteIds: ["R103"],
      },
      state,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const eventId = created.data.event.id;
    const initialImpact = created.state.eventImpacts.find(
      (impact) => impact.eventId === eventId && impact.routeId === "R103",
    );
    expect(initialImpact).toBeDefined();
    expect(initialImpact!.score).toBeGreaterThan(0);

    const updated = updateEvent(eventId, { crowdLevel: "LOW" }, created.state);
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    const updatedImpact = updated.state.eventImpacts.find(
      (impact) => impact.eventId === eventId && impact.routeId === "R103",
    );
    expect(updatedImpact!.score).toBeLessThan(initialImpact!.score);

    const deleted = deleteEvent(eventId, updated.state);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.state.events.some((event) => event.id === eventId)).toBe(false);
    expect(deleted.state.eventImpacts.some((impact) => impact.eventId === eventId)).toBe(false);
    expect(deleted.state.alerts.some((alert) => alert.eventId === eventId)).toBe(false);
  });

  it("rejects an event that references a route that does not exist", () => {
    const state = makeState();
    const created = createEvent(
      {
        name: "Invalid event",
        locationLabel: "Unknown",
        date: SCENARIO_DATE,
        startTime: "09:00",
        endTime: "10:00",
        declaredAffectedRouteIds: ["R999"],
      },
      state,
    );
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error).toContain("Unknown affected route");
  });

  it("does not invent an early impact window without a configured buffer", () => {
    const state = makeState();
    const network = getNetworkFromState(state);
    const route = state.routes.find((candidate) => candidate.id === "R101")!;
    const event = { ...state.events[0], preparationBuffer: undefined };
    const impact = calculateEventImpact(event, route, {
      network,
      demandSeed: state.demandSeed,
      state,
    });
    expect(impact.timeOverlapMinutes).toBeGreaterThanOrEqual(0);
    expect(impact.explanation).not.toContain("90-minute pre-event");
  });
});
