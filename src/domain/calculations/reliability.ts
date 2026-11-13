import type {
  JourneyOption,
  NetworkData,
  ReliabilityFactor,
  ReliabilityLabel,
  SafarState,
} from "../types";
import {
  MIN_TRANSFER_BUFFER_MINUTES,
  RELIABILITY_DISCLAIMER,
  RELIABILITY_LABELS,
  RELIABILITY_MAX_PENALTIES,
} from "../constants";
import { clamp, isoToMinutes } from "../time";
import { activeIncidentsForRoute, findBus } from "../network";

export interface ReliabilityContext {
  network: NetworkData;
  state: SafarState;
}

export interface ReliabilityResult {
  score: number;
  label: ReliabilityLabel;
  factors: ReliabilityFactor[];
  disclaimer: string;
  explanation: string;
  provenance: "CALCULATED";
}

export function getReliabilityLabel(score: number): ReliabilityLabel {
  const bounded = clamp(score, 0, 100);
  const band = RELIABILITY_LABELS.find((candidate) => bounded >= candidate.min);
  return (band?.label ?? "VERY_LOW") as ReliabilityLabel;
}

function minimumTransferGap(journey: JourneyOption): number | null {
  if (journey.legs.length < 2) return null;
  let minimum: number | null = null;
  for (let index = 1; index < journey.legs.length; index += 1) {
    const previous = journey.legs[index - 1];
    const next = journey.legs[index];
    const gap = isoToMinutes(next.departureAt) - isoToMinutes(previous.arrivalAt);
    if (gap < 0) return gap;
    minimum = minimum === null ? gap : Math.min(minimum, gap);
  }
  return minimum;
}

/**
 * Deterministic illustrative reliability score (0–100).
 *
 * Delay penalty uses incident delay only; event delay is expressed through the
 * event-impact factor so the same event minutes are not penalised twice.
 * All component caps are documented in `domain/constants.ts`.
 */
export function calculateJourneyReliability(
  journey: JourneyOption,
  context: ReliabilityContext,
): ReliabilityResult {
  const { state, network } = context;

  const incidentDelayMinutes = journey.legs.reduce(
    (total, leg) => total + Math.max(0, leg.incidentDelayMinutes),
    0,
  );
  const delayPenalty = clamp(
    incidentDelayMinutes,
    0,
    RELIABILITY_MAX_PENALTIES.EXPECTED_DELAY,
  );

  const impacts = state.eventImpacts.filter((impact) =>
    journey.routeIds.includes(impact.routeId),
  );
  const maxEventImpact = impacts.reduce(
    (maximum, impact) => Math.max(maximum, impact.score),
    0,
  );
  const eventPenalty = clamp(
    maxEventImpact * 0.2,
    0,
    RELIABILITY_MAX_PENALTIES.EVENT_IMPACT,
  );

  const waitingPenalty = clamp(
    journey.waitingMinutes * 0.25,
    0,
    RELIABILITY_MAX_PENALTIES.TRANSFER_WAITING,
  );

  const gap = minimumTransferGap(journey);
  const bufferPenalty =
    journey.transferCount === 0 || gap === null
      ? 0
      : clamp(
          RELIABILITY_MAX_PENALTIES.CONNECTION_BUFFER *
            (1 - clamp((gap - MIN_TRANSFER_BUFFER_MINUTES) / 25, 0, 1)),
          0,
          RELIABILITY_MAX_PENALTIES.CONNECTION_BUFFER,
        );

  const busRisks: number[] = journey.legs.map((leg) => {
    const bus = findBus(state.buses, leg.busId);
    if (!bus) return 1;
    if (bus.status === "UNAVAILABLE" || bus.status === "MAINTENANCE") return 1;
    if (bus.status === "REPLACEMENT_ASSIGNED") return 0.5;
    return 0;
  });
  const averageBusRisk =
    busRisks.length === 0 ? 0 : busRisks.reduce((sum, risk) => sum + risk, 0) / busRisks.length;
  const availabilityPenalty = clamp(
    averageBusRisk * RELIABILITY_MAX_PENALTIES.BUS_AVAILABILITY,
    0,
    RELIABILITY_MAX_PENALTIES.BUS_AVAILABILITY,
  );

  const transferPenalty = clamp(
    journey.transferCount * 4,
    0,
    RELIABILITY_MAX_PENALTIES.TRANSFER_COUNT,
  );

  const activeIncidents = journey.routeIds.flatMap((routeId) =>
    activeIncidentsForRoute(state, routeId),
  );
  // Active disruptions are already reflected in the delay and availability
  // penalties; a separate penalty would double count them.
  const disruptionPenalty = 0;

  const factors: ReliabilityFactor[] = [
    {
      key: "EXPECTED_DELAY",
      label: "Expected incident delay",
      penalty: round1(delayPenalty),
      maxPenalty: RELIABILITY_MAX_PENALTIES.EXPECTED_DELAY,
      detail:
        incidentDelayMinutes > 0
          ? `${incidentDelayMinutes} illustrative incident-delay minute(s) on this journey; scored at 1 point per minute up to the cap.`
          : "No incident-delay minutes on the selected legs.",
    },
    {
      key: "EVENT_IMPACT",
      label: "Event impact",
      penalty: round1(eventPenalty),
      maxPenalty: RELIABILITY_MAX_PENALTIES.EVENT_IMPACT,
      detail:
        maxEventImpact > 0
          ? `Highest predicted event-impact score on these routes is ${round1(maxEventImpact)}/100 (scored at 0.2 points per impact point).`
          : "No predicted event impact associated with these routes.",
    },
    {
      key: "TRANSFER_WAITING",
      label: "Waiting time",
      penalty: round1(waitingPenalty),
      maxPenalty: RELIABILITY_MAX_PENALTIES.TRANSFER_WAITING,
      detail: `${journey.waitingMinutes} waiting minute(s) across the journey (0.25 points per minute, capped).`,
    },
    {
      key: "CONNECTION_BUFFER",
      label: "Connection buffer",
      penalty: round1(bufferPenalty),
      maxPenalty: RELIABILITY_MAX_PENALTIES.CONNECTION_BUFFER,
      detail:
        gap === null
          ? "No transfer on this journey."
          : `Smallest transfer gap is ${gap} minute(s); a ${MIN_TRANSFER_BUFFER_MINUTES}-minute minimum is required.`,
    },
    {
      key: "BUS_AVAILABILITY",
      label: "Bus availability",
      penalty: round1(availabilityPenalty),
      maxPenalty: RELIABILITY_MAX_PENALTIES.BUS_AVAILABILITY,
      detail:
        averageBusRisk === 0
          ? "All assigned buses are operating or available."
          : `Average vehicle-availability risk across legs is ${round1(averageBusRisk * 100)}%.`,
    },
    {
      key: "TRANSFER_COUNT",
      label: "Number of transfers",
      penalty: round1(transferPenalty),
      maxPenalty: RELIABILITY_MAX_PENALTIES.TRANSFER_COUNT,
      detail: `${journey.transferCount} transfer(s); scored at 4 points each, capped at 10.`,
    },
    {
      key: "ACTIVE_DISRUPTION",
      label: "Active disruptions",
      penalty: disruptionPenalty,
      maxPenalty: RELIABILITY_MAX_PENALTIES.ACTIVE_DISRUPTION,
      detail:
        activeIncidents.length === 0
          ? "No active confirmed incident on these routes."
          : `${activeIncidents.length} active confirmed incident(s) on these routes; their effect is already included in the delay and availability penalties.`,
    },
  ];

  const totalPenalty = factors.reduce((sum, factor) => sum + factor.penalty, 0);
  const score = clamp(Math.round(100 - totalPenalty), 0, 100);
  const label = getReliabilityLabel(score);

  const largest = [...factors]
    .filter((factor) => factor.penalty > 0)
    .sort((a, b) => b.penalty - a.penalty)
    .slice(0, 2);
  const explanation =
    largest.length === 0
      ? `Score ${score}/100 (${label}). No penalty factors applied. ${RELIABILITY_DISCLAIMER}`
      : `Score ${score}/100 (${label}). Largest contributors: ${largest
          .map((factor) => `${factor.label} ${factor.penalty}`)
          .join(", ")}. ${RELIABILITY_DISCLAIMER}`;

  return {
    score,
    label,
    factors,
    disclaimer: RELIABILITY_DISCLAIMER,
    explanation,
    provenance: "CALCULATED",
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
