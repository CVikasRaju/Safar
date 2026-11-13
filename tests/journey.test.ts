import { describe, expect, it } from "vitest";
import { DEMO_REQUEST, makeState, minutesOf, SCENARIO_DATE } from "./helpers";
import { generateJourneyOptions, rankJourneyCategories } from "../src/domain/calculations/journey";
import { getNetworkFromState } from "../src/domain/network";
import { RELIABILITY_DISCLAIMER } from "../src/domain/constants";
import { searchJourneys, getAlternativeJourneys } from "../src/services/journeyService";
import { simulateBusBreakdown } from "../src/services/fleetService";

describe("journey planning engine", () => {
  it("generates feasible journeys from Vittal to Puttur Government College", () => {
    const state = makeState();
    const options = generateJourneyOptions(DEMO_REQUEST, getNetworkFromState(state), state);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].meetsRequiredArrival).toBe(true);
    expect(options[0].expectedArrivalAt.slice(11, 16) <= "09:00").toBe(true);
  });

  it("keeps bus segments chronological with non-negative durations", () => {
    const state = makeState();
    const options = generateJourneyOptions(DEMO_REQUEST, getNetworkFromState(state), state);
    for (const option of options) {
      for (const leg of option.legs) {
        expect(minutesOf(leg.arrivalAt)).toBeGreaterThan(minutesOf(leg.departureAt));
        expect(leg.boardingStopId).not.toBe(leg.alightingStopId);
      }
      for (let index = 1; index < option.segments.length; index += 1) {
        expect(option.segments[index].startAt >= option.segments[index - 1].startAt).toBe(true);
        expect(option.segments[index].durationMinutes).toBeGreaterThanOrEqual(0);
      }
      expect(option.totalDurationMinutes).toBe(
        minutesOf(option.expectedArrivalAt) - minutesOf(option.departureAt),
      );
      expect(option.transferCount).toBe(option.legs.length - 1);
      expect(option.walkingMinutes).toBeGreaterThan(0);
      expect(option.walkingMinutes).toBe(
        option.segments
          .filter((segment) => segment.kind === "WALK")
          .reduce((sum, segment) => sum + segment.durationMinutes, 0),
      );
      expect(option.waitingMinutes).toBe(
        option.segments
          .filter((segment) => segment.kind === "WAIT" || segment.kind === "TRANSFER")
          .reduce((sum, segment) => sum + segment.durationMinutes, 0),
      );
    }
  });

  it("respects the required-arrival deadline and labels late journeys honestly", () => {
    const state = makeState();
    const result = searchJourneys(
      { ...DEMO_REQUEST, requiredArrivalTime: "07:00" },
      state,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.options.length).toBeGreaterThan(0);
    for (const option of result.data.options) {
      expect(option.meetsRequiredArrival).toBe(false);
      expect(option.arrivalStatus).toBe("LATE");
      expect(option.warnings.some((warning) => warning.includes("after the required arrival"))).toBe(true);
    }
    expect(result.data.fastest?.meetsRequiredArrival).toBe(false);
  });

  it("provides three independently ranked categories without inventing routes", () => {
    const state = makeState();
    const options = generateJourneyOptions(DEMO_REQUEST, getNetworkFromState(state), state);
    const categories = rankJourneyCategories(options);
    expect(categories.fastest).toBeTruthy();
    expect(categories.mostReliable).toBeTruthy();
    expect(categories.fewestTransfers).toBeTruthy();
    expect(categories.fastest?.totalDurationMinutes).toBe(
      Math.min(...options.map((option) => option.totalDurationMinutes)),
    );
    expect(categories.mostReliable?.reliabilityScore).toBe(
      Math.max(...options.map((option) => option.reliabilityScore)),
    );
    expect(categories.fewestTransfers?.transferCount).toBe(
      Math.min(...options.map((option) => option.transferCount)),
    );
    expect(categories.fastest?.rankingCategories).toContain("FASTEST");
    expect(categories.mostReliable?.rankingCategories).toContain("MOST_RELIABLE");
    expect(categories.fewestTransfers?.rankingCategories).toContain("FEWEST_TRANSFERS");
    for (const option of options) {
      expect(option.routeIds.every((routeId) => ["R101", "R102", "R103", "R104"].includes(routeId))).toBe(true);
      expect(option.busIds.length).toBeGreaterThan(0);
    }
  });

  it("finds a valid one-transfer journey with the documented buffer", () => {
    const state = makeState();
    const options = generateJourneyOptions(
      {
        originVillageId: "V_KADABA",
        destinationId: "DST_PGC",
        travelDate: SCENARIO_DATE,
        requiredArrivalTime: "09:00",
      },
      getNetworkFromState(state),
      state,
    );
    const transfers = options.filter((option) => option.transferCount >= 1);
    expect(transfers.length).toBeGreaterThan(0);
    for (const option of transfers) {
      const gap = minutesOf(option.legs[1].departureAt) - minutesOf(option.legs[0].arrivalAt);
      expect(gap).toBeGreaterThanOrEqual(5);
    }
  });

  it("returns a bounded reliability score with the exact disclaimer", () => {
    const state = makeState();
    const options = generateJourneyOptions(DEMO_REQUEST, getNetworkFromState(state), state);
    for (const option of options) {
      expect(option.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(option.reliabilityScore).toBeLessThanOrEqual(100);
      expect(option.reliabilityDisclaimer).toBe(RELIABILITY_DISCLAIMER);
      expect(option.reliabilityFactors.length).toBe(7);
      expect(option.reliabilityFactors.reduce((sum, factor) => sum + factor.penalty, 0)).toBeLessThanOrEqual(100);
    }
  });

  it("reports no feasible route honestly instead of inventing a connection", () => {
    const state = makeState();
    const withoutBuses = {
      ...state,
      buses: state.buses.map((bus) => ({ ...bus, status: "UNAVAILABLE" as const })),
    };
    const result = searchJourneys(DEMO_REQUEST, withoutBuses);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.options).toEqual([]);
    expect(result.data.fastest).toBeNull();
    expect(result.data.noRouteReason).toContain("No feasible journey");
    expect(result.data.noRouteReason).toContain("no operable bus");
  });

  it("recalculates a feasible alternative after the R101 bus breaks down", () => {
    const state = makeState();
    const simulation = simulateBusBreakdown({ busId: "bus-101" }, state);
    expect(simulation.ok).toBe(true);
    if (!simulation.ok) return;
    const alternatives = getAlternativeJourneys(
      simulation.data.incident.id,
      DEMO_REQUEST,
      simulation.state,
    );
    expect(alternatives.ok).toBe(true);
    if (!alternatives.ok) return;
    expect(alternatives.data.options.length).toBeGreaterThan(0);
    for (const option of alternatives.data.options) {
      expect(option.routeIds).not.toContain("R101");
    }
    expect(alternatives.data.recommendedAlternative?.routeIds).toContain("R104");
    expect(alternatives.data.noFeasibleOption).toBe(false);
    expect(alternatives.data.explanation).toContain("Best feasible alternative");
  });
});
