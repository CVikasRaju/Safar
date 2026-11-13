import { describe, expect, it } from "vitest";
import {
  RELIABILITY_DISCLAIMER,
  calculateJourneyReliability,
  reliabilityLabel,
} from "../src/domain/calculations/reliability";

describe("illustrative reliability model (docs/09)", () => {
  it("returns 100 for a clean direct journey with no recorded risk", () => {
    const result = calculateJourneyReliability({
      delayMinutes: 0,
      transferWaitMinutes: 0,
      transferCount: 0,
    });
    expect(result.score).toBe(100);
    expect(result.label).toBe("High");
  });

  it("caps the delay penalty at 25 for realistic delays", () => {
    const result = calculateJourneyReliability({
      delayMinutes: 45,
      transferWaitMinutes: 0,
      transferCount: 0,
    });
    expect(result.score).toBe(75);
    const delayPenalty = result.penalties.find((penalty) => penalty.key === "delay");
    expect(delayPenalty?.value).toBe(25);
  });

  it("never leaves the 0–100 range even with every risk factor present", () => {
    const result = calculateJourneyReliability({
      delayMinutes: 120,
      eventImpactScore: 100,
      transferWaitMinutes: 120,
      minConnectionSlackMinutes: 0,
      transferCount: 2,
      availabilityRisk: 1,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.label).toBe("Very Low");
  });

  it("does not apply a connection-buffer penalty to a direct journey", () => {
    const result = calculateJourneyReliability({
      delayMinutes: 0,
      transferWaitMinutes: 0,
      transferCount: 0,
    });
    const bufferPenalty = result.penalties.find((penalty) => penalty.key === "connectionBuffer");
    expect(bufferPenalty?.value).toBe(0);
  });

  it("penalises a tight connection more than a comfortable one", () => {
    const tight = calculateJourneyReliability({
      delayMinutes: 0,
      transferWaitMinutes: 5,
      minConnectionSlackMinutes: 1,
      transferCount: 1,
    });
    const comfortable = calculateJourneyReliability({
      delayMinutes: 0,
      transferWaitMinutes: 5,
      minConnectionSlackMinutes: 20,
      transferCount: 1,
    });
    expect(tight.score).toBeLessThan(comfortable.score);
  });

  it("uses the exact required disclaimer", () => {
    const result = calculateJourneyReliability({
      delayMinutes: 0,
      transferWaitMinutes: 0,
      transferCount: 0,
    });
    expect(result.disclaimer).toBe(
      "Illustrative prototype reliability score. Not a statistically validated probability.",
    );
    expect(RELIABILITY_DISCLAIMER).toBe(result.disclaimer);
  });

  it("uses the documented descriptive bands", () => {
    expect(reliabilityLabel(100)).toBe("High");
    expect(reliabilityLabel(80)).toBe("High");
    expect(reliabilityLabel(79)).toBe("Moderate");
    expect(reliabilityLabel(60)).toBe("Moderate");
    expect(reliabilityLabel(59)).toBe("Low");
    expect(reliabilityLabel(40)).toBe("Low");
    expect(reliabilityLabel(39)).toBe("Very Low");
  });
});
