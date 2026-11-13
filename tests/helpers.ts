import type { SafarState } from "../src/domain/types";
import { getInitialState } from "../src/state/initialState";
import { createMemoryStorage } from "../src/services/persistenceService";

export const SCENARIO_DATE = "2026-11-14";
export const TEST_NOW = new Date(2026, 10, 13, 9, 0, 0);

export function makeState(): SafarState {
  return getInitialState({ now: TEST_NOW, scenarioDate: SCENARIO_DATE });
}

export function makeStorage(seed?: Record<string, string>) {
  return createMemoryStorage(seed);
}

export const DEMO_REQUEST = {
  originVillageId: "V_VITTAL",
  destinationId: "DST_PGC",
  travelDate: SCENARIO_DATE,
  requiredArrivalTime: "09:00",
};

export function minutesOf(iso: string): number {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) throw new Error(`Bad ISO time ${iso}`);
  return Number(match[1]) * 60 + Number(match[2]);
}
