// SAFAR — Seed Data: Index
// Assembles the full initial AppState from all seed files.
// Use cloneSeedState() — never mutate the seed directly.
import type { AppState, ScenarioState } from '../../domain/types';
import { SEED_VILLAGES } from './villages';
import { SEED_DESTINATIONS } from './destinations';
import { SEED_STOPS } from './stops';
import { SEED_ROUTES } from './routes';
import { SEED_BUSES } from './buses';
import { SEED_TIMETABLES } from './timetables';
import { SEED_EVENTS } from './events';
import { SEED_DEMAND } from './demand';
import { calculateAllEventImpacts } from '../../domain/calculations/eventImpact';

const SCHEMA_VERSION = 1;

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const INITIAL_SCENARIO: ScenarioState = {
  status: 'IDLE',
  scenarioDate: getTomorrowDate(),
  steps: [],
};

export function buildSeedState(): AppState {
  const events = structuredClone(SEED_EVENTS).map(e => ({
    ...e,
    date: e.date === 'SCENARIO_DATE' ? getTomorrowDate() : e.date,
  }));

  // Event impacts are derived canonical data: calculate them from the seeded
  // events so dashboards, journeys and reliability are consistent at start-up.
  const eventImpacts = events.flatMap(event =>
    calculateAllEventImpacts(event, SEED_ROUTES, {
      timetables: SEED_TIMETABLES,
      stops: SEED_STOPS,
    }),
  );

  return {
    villages: structuredClone(SEED_VILLAGES),
    destinations: structuredClone(SEED_DESTINATIONS),
    stops: structuredClone(SEED_STOPS),
    routes: structuredClone(SEED_ROUTES),
    timetables: structuredClone(SEED_TIMETABLES),
    buses: structuredClone(SEED_BUSES),
    events,
    eventImpacts,
    disruptionReports: [],
    incidents: [],
    replacementRecommendations: [],
    demandSeed: structuredClone(SEED_DEMAND),
    travelRequests: [],
    alerts: [],
    auditEvents: [],
    scenario: { ...INITIAL_SCENARIO },
    schemaVersion: SCHEMA_VERSION,
  };
}

export const SEED_SCHEMA_VERSION = SCHEMA_VERSION;
