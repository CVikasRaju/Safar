import type { SafarState } from "../domain/types";
import { SCHEMA_VERSION, SEED_VERSION, SIMULATED_DATA_LABEL } from "../domain/constants";
import { nowISO } from "../domain/time";
import { createSeedData, type SeedOptions } from "../data/seed";
import { identifyAffectedRoutes } from "../domain/calculations/eventImpact";
import { validateSeedData } from "../domain/validation";

export interface InitialStateOptions extends SeedOptions {}

/**
 * Builds a fresh canonical state from the immutable demo seed.
 * Every run/reset starts here, so reset restores the exact original scenario.
 */
export function getInitialState(options: InitialStateOptions = {}): SafarState {
  const seed = createSeedData(options);
  const timestamp = nowISO(options.now);

  const eventImpacts = seed.events.flatMap((event) =>
    identifyAffectedRoutes(event, {
      network: seed.network,
      demandSeed: seed.demandSeed,
    }),
  );

  const validation = validateSeedData({
    network: seed.network,
    buses: seed.buses,
    demandSeed: seed.demandSeed,
    events: seed.events,
    scenarioDate: seed.scenarioDate,
  });
  if (!validation.valid) {
    // Seed data is developer-controlled. Fail loudly instead of running invalid data.
    throw new Error(`SAFAR seed data is invalid: ${validation.errors.join(" | ")}`);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    villages: seed.network.villages,
    destinations: seed.network.destinations,
    stops: seed.network.stops,
    routes: seed.network.routes,
    services: seed.network.services,
    stopWalkLinks: seed.network.stopWalkLinks,
    buses: seed.buses,
    demandSeed: seed.demandSeed,
    events: seed.events,
    eventImpacts,
    travelRequests: [],
    reports: [],
    incidents: [],
    recommendations: [],
    alerts: [],
    scenario: {
      mode: "NONE",
      scenarioDate: seed.scenarioDate,
      completedStepIds: [],
      notes: [
        `${SIMULATED_DATA_LABEL}: all routes, timetables, buses, demand and events are illustrative prototype data.`,
      ],
    },
    auditEvents: [],
    meta: {
      schemaVersion: SCHEMA_VERSION,
      seedVersion: SEED_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}
