import type { SafarState, ScenarioState } from "../../domain/types";
import { toIsoDate, addDaysIso } from "../../domain/calculations/time";
import { VILLAGES } from "./villages";
import { STOPS } from "./stops";
import { DESTINATIONS } from "./destinations";
import { ROUTES } from "./routes";
import { BUSES } from "./buses";
import { buildTimetableServices } from "./timetable";
import { buildSeedEventImpacts, buildSeedEvents } from "./events";
import { DEMAND_SEED } from "./demand";
import { validateState } from "../validation";

export const SCHEMA_VERSION = 1;
export const SEED_VERSION = "safar-demo-2026-11";

export interface SeedOptions {
  now?: Date;
  scenarioDate?: string;
}

function buildScenario(now: Date, scenarioDate?: string): ScenarioState {
  const date = scenarioDate ?? addDaysIso(toIsoDate(now), 1);
  return {
    id: "scn-safar-live",
    status: "IDLE",
    scenarioDate: date,
    notes:
      "Demo scenario date is derived from the current date (today + 1) so the festival scenario is always in the future. All values are illustrative.",
  };
}

/**
 * Builds a fresh, immutable demo state. Callers must treat the result as a new
 * object graph; `createSeedState()` never returns shared references.
 */
export function createSeedState(options: SeedOptions = {}): SafarState {
  const now = options.now ?? new Date();
  const scenario = buildScenario(now, options.scenarioDate);

  const state: SafarState = {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    villages: VILLAGES,
    destinations: DESTINATIONS,
    stops: STOPS,
    routes: ROUTES,
    timetableServices: buildTimetableServices(),
    buses: BUSES,
    events: buildSeedEvents(scenario.scenarioDate),
    eventRouteImpacts: buildSeedEventImpacts(now),
    demandSeed: DEMAND_SEED,
    travelRequests: [],
    disruptionReports: [],
    incidents: [],
    replacementRecommendations: [],
    alerts: [],
    auditEvents: [],
    scenario,
  };

  const issues = validateState(state).filter((issue) => issue.level === "error");
  if (issues.length > 0) {
    throw new Error(
      `Seed data failed referential validation: ${issues.map((issue) => issue.message).join("; ")}`,
    );
  }

  // Return an independent object graph so a reset can never alias live state.
  return structuredClone(state);
}

/** Deep clone used for reset and for safe LocalStorage restore. */
export function cloneSeedState(state: SafarState): SafarState {
  return structuredClone(state);
}
