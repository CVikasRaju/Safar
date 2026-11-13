import { useMemo } from "react";
import { useSafarState } from "../../state/SafarStateContext";
import { analyseEmergency, buildBeforeAfterComparison } from "../../domain/emergency/scenario";
import { predictUpcomingEvents } from "../../domain/emergency/eventPrediction";

/**
 * Emergency calculations are pure and memoised per state snapshot, so the UI
 * always reflects the current state and a repeated run is idempotent.
 */
export function useEmergencyAnalysis() {
  const { state } = useSafarState();
  const analysis = useMemo(() => analyseEmergency(state), [state]);
  const comparison = useMemo(() => buildBeforeAfterComparison(state), [state]);
  return { state, analysis, comparison };
}

export function useEventPredictions(now: Date = new Date()) {
  const { state } = useSafarState();
  return useMemo(() => predictUpcomingEvents(state, now), [state, now]);
}
