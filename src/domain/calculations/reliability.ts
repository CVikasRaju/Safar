import type { ReliabilityLabel, ReliabilityPenalty, ReliabilityResult } from "../types/journey";

/**
 * Illustrative prototype reliability (docs/09).
 *
 * score = clamp(100 − sum(normalised penalties), 0, 100)
 *
 * Penalty caps follow the documented maximums (delay 25, event 20, transfer
 * waiting 15, connection-buffer risk 15, bus availability 15, transfer count
 * 10). "Active route disruptions" are folded into the bus-availability cap so
 * the total maximum penalty stays at the documented 100, and a confirmed
 * incident that already produced a delay is not penalised a second time.
 */
export const RELIABILITY_DISCLAIMER =
  "Illustrative prototype reliability score. Not a statistically validated probability.";

export const RELIABILITY_FACTORS = {
  delayMaxMinutes: 45,
  delayMaxPenalty: 25,
  eventMaxPenalty: 20,
  transferWaitMaxMinutes: 60,
  transferWaitMaxPenalty: 15,
  connectionSlackTargetMinutes: 10,
  connectionBufferMaxPenalty: 15,
  availabilityMaxPenalty: 15,
  transferCountPenalty: [0, 6, 10],
} as const;

export interface ReliabilityFactors {
  delayMinutes: number;
  /** Highest event impact score (0–100) on any used route during the journey window. */
  eventImpactScore?: number;
  transferWaitMinutes: number;
  /** Smallest slack beyond the minimum transfer buffer. Undefined when there is no transfer. */
  minConnectionSlackMinutes?: number;
  transferCount: number;
  /** 0–1 risk contributed by bus status and unaccounted active disruptions. */
  availabilityRisk?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function reliabilityLabel(score: number): ReliabilityLabel {
  if (score >= 80) return "High";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Low";
  return "Very Low";
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function calculateJourneyReliability(factors: ReliabilityFactors): ReliabilityResult {
  const penalties: ReliabilityPenalty[] = [];

  const delayRatio = clamp(factors.delayMinutes / RELIABILITY_FACTORS.delayMaxMinutes, 0, 1);
  penalties.push({
    key: "delay",
    label: "Expected delay",
    maxPenalty: RELIABILITY_FACTORS.delayMaxPenalty,
    value: Math.round(delayRatio * RELIABILITY_FACTORS.delayMaxPenalty),
    reason:
      factors.delayMinutes > 0
        ? `${factors.delayMinutes} min illustrative delay applied from confirmed operational records.`
        : "No confirmed delay recorded for the services used.",
  });

  const eventScore = clamp(factors.eventImpactScore ?? 0, 0, 100);
  penalties.push({
    key: "event",
    label: "Event impact",
    maxPenalty: RELIABILITY_FACTORS.eventMaxPenalty,
    value: Math.round((eventScore / 100) * RELIABILITY_FACTORS.eventMaxPenalty),
    reason:
      eventScore > 0
        ? `Highest predicted event impact score on a used route is ${eventScore}/100.`
        : "No predicted event impact overlaps this journey.",
  });

  const waitRatio = clamp(
    factors.transferWaitMinutes / RELIABILITY_FACTORS.transferWaitMaxMinutes,
    0,
    1,
  );
  penalties.push({
    key: "transferWait",
    label: "Transfer waiting",
    maxPenalty: RELIABILITY_FACTORS.transferWaitMaxPenalty,
    value: Math.round(waitRatio * RELIABILITY_FACTORS.transferWaitMaxPenalty),
    reason:
      factors.transferWaitMinutes > 0
        ? `${factors.transferWaitMinutes} min total connection waiting.`
        : "No connection waiting time.",
  });

  const slack = factors.minConnectionSlackMinutes;
  const bufferPenalty =
    slack === undefined
      ? 0
      : Math.round(
          clamp(
            (RELIABILITY_FACTORS.connectionSlackTargetMinutes - slack) /
              RELIABILITY_FACTORS.connectionSlackTargetMinutes,
            0,
            1,
          ) * RELIABILITY_FACTORS.connectionBufferMaxPenalty,
        );
  penalties.push({
    key: "connectionBuffer",
    label: "Connection buffer",
    maxPenalty: RELIABILITY_FACTORS.connectionBufferMaxPenalty,
    value: bufferPenalty,
    reason:
      slack === undefined
        ? "No transfer, so no connection risk."
        : `Tightest connection has ${Math.max(0, slack)} min spare after the 4 min minimum buffer.`,
  });

  const availabilityRisk = clamp(factors.availabilityRisk ?? 0, 0, 1);
  penalties.push({
    key: "availability",
    label: "Bus availability",
    maxPenalty: RELIABILITY_FACTORS.availabilityMaxPenalty,
    value: Math.round(availabilityRisk * RELIABILITY_FACTORS.availabilityMaxPenalty),
    reason:
      availabilityRisk > 0
        ? "Includes replacement-bus operation or an active disruption without a delay estimate."
        : "Assigned buses are operating normally in the demo fleet.",
  });

  const transferPenalty =
    RELIABILITY_FACTORS.transferCountPenalty[
      Math.min(factors.transferCount, RELIABILITY_FACTORS.transferCountPenalty.length - 1)
    ] ?? 10;
  penalties.push({
    key: "transfers",
    label: "Number of transfers",
    maxPenalty: 10,
    value: transferPenalty,
    reason:
      factors.transferCount === 0
        ? "Direct journey with no bus change."
        : `${factors.transferCount} bus change${factors.transferCount > 1 ? "s" : ""}.`,
  });

  const totalPenalty = penalties.reduce((sum, item) => sum + item.value, 0);
  const score = roundScore(100 - totalPenalty);

  return {
    score,
    label: reliabilityLabel(score),
    penalties,
    disclaimer: RELIABILITY_DISCLAIMER,
  };
}
