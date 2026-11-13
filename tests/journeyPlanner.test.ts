import { describe, expect, it } from "vitest";
import { createSeedState } from "../src/data/seed";
import { generateJourneyOptions } from "../src/domain/calculations/journeyPlanner";
import type { JourneySearchRequest } from "../src/domain/types/journey";
import type { SafarState } from "../src/domain/types";

const NOW = new Date("2026-11-13T06:00:00.000Z");
const baseState = createSeedState({ scenarioDate: "2026-11-14", now: NOW });

const collegeSearch: JourneySearchRequest = {
  originVillageId: "v-vittal",
  destinationId: "d-pgc",
  travelDate: "2026-11-14",
  requiredArrivalTime: "09:00",
};

function planFor(state: SafarState, request: JourneySearchRequest) {
  return generateJourneyOptions(state, request, NOW);
}

describe("journey planner (docs/04)", () => {
  const plan = planFor(baseState, collegeSearch);

  it("finds feasible journeys from Vittal to Puttur Government College before 09:00", () => {
    expect(plan.meetingRequiredArrival.length).toBeGreaterThan(0);
    expect(plan.noRouteReason).toBeUndefined();
  });

  it("returns exactly three independently ranked recommendation categories", () => {
    expect(plan.recommendations.map((recommendation) => recommendation.category)).toEqual([
      "FASTEST",
      "MOST_RELIABLE",
      "FEWEST_TRANSFERS",
    ]);
    for (const recommendation of plan.recommendations) {
      expect(recommendation.journey.meetsRequiredArrival).toBe(true);
      expect(recommendation.reason.length).toBeGreaterThan(0);
    }
  });

  it("ranks the fastest recommendation by lowest total duration", () => {
    const fastest = plan.recommendations.find((entry) => entry.category === "FASTEST")?.journey;
    const minimum = Math.min(...plan.meetingRequiredArrival.map((journey) => journey.totalDurationMinutes));
    expect(fastest?.totalDurationMinutes).toBe(minimum);
  });

  it("ranks the most reliable recommendation by highest calculated score", () => {
    const reliable = plan.recommendations.find((entry) => entry.category === "MOST_RELIABLE")?.journey;
    const maximum = Math.max(...plan.meetingRequiredArrival.map((journey) => journey.reliability.score));
    expect(reliable?.reliability.score).toBe(maximum);
  });

  it("ranks fewest transfers by the lowest bus-change count", () => {
    const fewest = plan.recommendations.find((entry) => entry.category === "FEWEST_TRANSFERS")?.journey;
    const minimum = Math.min(...plan.meetingRequiredArrival.map((journey) => journey.transferCount));
    expect(fewest?.transferCount).toBe(minimum);
  });

  it("never presents the same itinerary under a misleading new label", () => {
    const fastest = plan.recommendations.find((entry) => entry.category === "FASTEST");
    const fewest = plan.recommendations.find((entry) => entry.category === "FEWEST_TRANSFERS");
    expect(fastest && fewest).toBeTruthy();
    if (fastest && fewest && fastest.journey.id === fewest.journey.id) {
      // Coincidences are allowed by the specification, but must be declared.
      expect(fastest.alsoWins.length + fewest.alsoWins.length).toBeGreaterThan(0);
    } else if (fastest && fewest) {
      expect(fastest.journey.transferCount).toBeGreaterThanOrEqual(fewest.journey.transferCount);
      expect(fastest.journey.totalDurationMinutes).toBeLessThanOrEqual(
        fewest.journey.totalDurationMinutes,
      );
    }
  });

  it("produces chronological, internally consistent itineraries", () => {
    for (const journey of plan.options) {
      expect(journey.transferCount).toBe(Math.max(0, journey.legs.length - 1));
      expect(journey.segments.length).toBeGreaterThan(0);

      const startTimes = journey.segments.map((segment) => new Date(segment.startTime).getTime());
      expect(startTimes).toEqual([...startTimes].sort((a, b) => a - b));

      for (const segment of journey.segments) {
        expect(new Date(segment.endTime).getTime()).toBeGreaterThanOrEqual(
          new Date(segment.startTime).getTime(),
        );
        expect(segment.durationMinutes).toBeGreaterThanOrEqual(0);
      }

      const first = journey.segments[0];
      const last = journey.segments[journey.segments.length - 1];
      expect(new Date(journey.departureTime).getTime()).toBe(new Date(first.startTime).getTime());
      expect(new Date(journey.arrivalTime).getTime()).toBe(new Date(last.endTime).getTime());
      expect(journey.walkingMinutes).toBeGreaterThanOrEqual(0);
      expect(journey.waitingMinutes).toBeGreaterThanOrEqual(0);
      expect(journey.reliability.score).toBeGreaterThanOrEqual(0);
      expect(journey.reliability.score).toBeLessThanOrEqual(100);
    }
  });

  it("represents every walking value as a labelled approximation", () => {
    for (const journey of plan.options) {
      for (const estimate of journey.walkingEstimates) {
        expect(estimate.isApproximate).toBe(true);
        expect(estimate.provenance).toBe("CALCULATED");
        expect(estimate.method).toContain("straight-line");
      }
    }
  });

  it("includes walking, waiting and bus segments in the itinerary", () => {
    const journey = plan.meetingRequiredArrival[0];
    const kinds = new Set(journey.segments.map((segment) => segment.kind));
    expect(kinds.has("BUS_RIDE")).toBe(true);
    expect(kinds.has("BOARD_WAIT")).toBe(true);
    expect([...kinds].some((kind) => kind.endsWith("WALK"))).toBe(true);
  });

  it("marks journeys that miss the required arrival time instead of recommending them", () => {
    const early = planFor(baseState, { ...collegeSearch, requiredArrivalTime: "06:00" });
    expect(early.recommendations).toEqual([]);
    expect(early.noRouteReason).toBeTruthy();
    expect(early.meetingRequiredArrival).toEqual([]);
    expect(early.lateAlternatives.length).toBeGreaterThan(0);
    for (const journey of early.lateAlternatives) {
      expect(journey.meetsRequiredArrival).toBe(false);
      expect(journey.minutesRelativeToRequiredArrival).toBeGreaterThan(0);
    }
  });

  it("works for different origin villages with different routes", () => {
    const fromSullia = planFor(baseState, { ...collegeSearch, originVillageId: "v-sullia" });
    const fromUppinangady = planFor(baseState, { ...collegeSearch, originVillageId: "v-uppinangady" });
    const fromKadaba = planFor(baseState, { ...collegeSearch, originVillageId: "v-kadaba" });

    for (const planResult of [fromSullia, fromUppinangady, fromKadaba]) {
      expect(planResult.meetingRequiredArrival.length).toBeGreaterThan(0);
      expect(planResult.recommendations).toHaveLength(3);
    }

    const sulliaRoutes = new Set(fromSullia.meetingRequiredArrival.flatMap((journey) => journey.usedRouteIds));
    const uppinangadyRoutes = new Set(
      fromUppinangady.meetingRequiredArrival.flatMap((journey) => journey.usedRouteIds),
    );
    expect([...sulliaRoutes]).toContain("R101");
    expect([...uppinangadyRoutes]).toContain("R103");
    expect([...sulliaRoutes].sort().join(",")).not.toBe([...uppinangadyRoutes].sort().join(","));
  });

  it("offers a walk-only option for a very short trip in the same village", () => {
    const walkPlan = planFor(baseState, {
      originVillageId: "v-kadaba",
      destinationId: "d-kadaba-pu",
      travelDate: "2026-11-14",
      requiredArrivalTime: "09:00",
    });
    const walkOnly = walkPlan.options.find((journey) => journey.kind === "WALK_ONLY");
    expect(walkOnly).toBeDefined();
    expect(walkOnly?.transferCount).toBe(0);
    expect(walkOnly?.walkingEstimates[0].isApproximate).toBe(true);
  });

  it("excludes services whose bus is unavailable and reports the honest no-route state", () => {
    const withoutR101Bus: SafarState = {
      ...baseState,
      buses: baseState.buses.map((bus) =>
        bus.id === "bus-ka21ab102" ? { ...bus, status: "UNAVAILABLE" as const } : bus,
      ),
    };
    const rerouted = planFor(withoutR101Bus, { ...collegeSearch, originVillageId: "v-sullia" });
    expect(rerouted.meetingRequiredArrival).toEqual([]);
    expect(rerouted.noRouteReason).toBeTruthy();
    expect(rerouted.notes.join(" ")).toContain("KA-21-AB-102");
  });

  it("applies an illustrative delay from a confirmed incident to expected times", () => {
    const withIncident: SafarState = {
      ...baseState,
      incidents: [
        {
          id: "inc-r102-breakdown",
          type: "BUS_BREAKDOWN",
          status: "ACTIVE",
          routeId: "R102",
          busId: "bus-ka21ab118",
          occurredAt: "2026-11-14T01:30:00.000Z",
          severity: "HIGH",
          relatedReportIds: [],
          provenance: "SIMULATED",
        },
      ],
    };
    const delayed = planFor(withIncident, collegeSearch);
    const usingR102 = delayed.meetingRequiredArrival.find((journey) =>
      journey.usedRouteIds.includes("R102"),
    );
    expect(usingR102).toBeDefined();
    expect(usingR102?.estimatedDelayMinutes).toBeGreaterThan(0);
    expect(new Date(usingR102!.arrivalTime).getTime()).toBeGreaterThan(
      new Date(usingR102!.scheduledArrivalTime).getTime(),
    );
  });

  it("surfaces the predicted event impact on impacted routes", () => {
    const journeysWithImpact = plan.meetingRequiredArrival.filter((journey) =>
      journey.usedRouteIds.some((routeId) => routeId === "R101" || routeId === "R104"),
    );
    expect(journeysWithImpact.length).toBeGreaterThan(0);
    const withWarning = journeysWithImpact.find((journey) =>
      journey.warnings.some((warning) => warning.code === "PREDICTED_EVENT_IMPACT"),
    );
    expect(withWarning).toBeDefined();
  });

  it("reports no route honestly for an unknown pairing instead of inventing one", () => {
    const impossible = planFor(baseState, {
      originVillageId: "v-vittal",
      destinationId: "d-uppinangady-college",
      travelDate: "2026-11-14",
      requiredArrivalTime: "07:15",
    });
    if (impossible.recommendations.length === 0) {
      expect(impossible.noRouteReason).toBeTruthy();
      expect(impossible.meetingRequiredArrival).toEqual([]);
    }
    for (const journey of impossible.options) {
      expect(journey.segments.length).toBeGreaterThan(0);
    }
  });
});
