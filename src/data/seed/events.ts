// SAFAR — Seed Data: Events (Illustrative)
// One festival event affecting R101 and R104 — required by scenario A.
import type { SafarEvent } from '../../domain/types';

// Scenario date is relative — stored as offset label, actual date set by scenario runner.
// Using a placeholder date string; ScenarioControl will override this with the configured scenario date.
export const SCENARIO_EVENT_ID = 'EVT001';

export const SEED_EVENTS: SafarEvent[] = [
  {
    id: SCENARIO_EVENT_ID,
    name: 'Kombettu Brahmakalashotsava Festival',
    category: 'TEMPLE_FESTIVAL',
    location: 'Kombettu Cross, near Puttur–Sullia Highway',
    lat: 12.7400,
    lng: 75.1800,
    date: 'SCENARIO_DATE', // replaced at runtime by scenario runner
    startTime: '08:00',
    endTime: '20:00',
    crowdIntensity: 'VERY_HIGH',
    nearbyVillageIds: ['V001', 'V002', 'V004'],
    affectedRoadLabels: ['Puttur–Sullia Highway (NH-13 segment)', 'Kombettu Cross Junction'],
    affectedRouteIds: ['R101', 'R104'],
    impactWindowMinutes: 90, // 90 min before event start (scenario-configured)
    description:
      'Major annual temple festival at Kombettu. Very high crowd expected. Procession crosses the main highway used by R101 and R104.',
    source: 'District Event Calendar (Illustrative Demo)',
    provenance: 'DEMO',
    verificationStatus: 'UNVERIFIED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'EVT002',
    name: 'Class 10 Board Examination',
    category: 'EXAMINATION',
    location: 'Puttur Government High School',
    lat: 12.7595,
    lng: 75.2030,
    date: 'SCENARIO_DATE',
    startTime: '10:00',
    endTime: '13:00',
    crowdIntensity: 'MODERATE',
    nearbyVillageIds: ['V001'],
    affectedRoadLabels: ['School Road, Puttur'],
    affectedRouteIds: ['R102', 'R103'],
    impactWindowMinutes: 30,
    description: 'State Board Class 10 examination. Increased student traffic in the morning.',
    source: 'Karnataka SSLC Board (Illustrative Demo)',
    provenance: 'DEMO',
    verificationStatus: 'UNVERIFIED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
