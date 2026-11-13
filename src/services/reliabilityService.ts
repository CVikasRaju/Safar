import type {
  JourneyOption,
  ReliabilityLabel,
  SafarState,
} from "../domain/types";
import { RELIABILITY_DISCLAIMER } from "../domain/constants";
import { getNetworkFromState } from "../domain/network";
import {
  calculateJourneyReliability,
  getReliabilityLabel,
  type ReliabilityResult,
} from "../domain/calculations/reliability";

export type { ReliabilityResult };

export function recalculateJourneyReliability(
  journey: JourneyOption,
  state: SafarState,
): ReliabilityResult {
  return calculateJourneyReliability(journey, {
    network: getNetworkFromState(state),
    state,
  });
}

export function reliabilityLabelFor(score: number): ReliabilityLabel {
  return getReliabilityLabel(score);
}

export function getReliabilityDisclaimer(): string {
  return RELIABILITY_DISCLAIMER;
}

export const reliabilityService = {
  calculateJourneyReliability: recalculateJourneyReliability,
  reliabilityLabelFor,
  getReliabilityDisclaimer,
  disclaimer: RELIABILITY_DISCLAIMER,
};
