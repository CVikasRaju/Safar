/**
 * SAFAR — Documented prototype constants, weights and disclaimers.
 * These are illustrative prototype values, not validated transport standards.
 */

export const SCHEMA_VERSION = 1;
export const SEED_VERSION = "safar-seed-1";
export const STORAGE_KEY = "safar-state-v1";

export const RELIABILITY_DISCLAIMER =
  "Illustrative prototype reliability score. Not a statistically validated probability.";

export const DEMO_DATA_LABEL = "DEMO DATA";
export const SIMULATED_DATA_LABEL = "SIMULATED / DEMO DATA";
export const PREDICTED_EVENT_IMPACT_LABEL = "PREDICTED EVENT IMPACT";
export const UNVERIFIED_REPORT_LABEL = "UNVERIFIED STUDENT REPORT";
export const VERIFIED_REPORT_NOT_CONFIRMED_LABEL =
  "VERIFIED REPORT — INCIDENT NOT YET CONFIRMED";
export const CONFIRMED_INCIDENT_LABEL = "CONFIRMED INCIDENT";
export const REPLACEMENT_RECOMMENDED_LABEL = "REPLACEMENT RECOMMENDED — AWAITING APPROVAL";
export const REPLACEMENT_APPROVED_LABEL = "REPLACEMENT APPROVED";
export const NO_FEASIBLE_REPLACEMENT_LABEL = "NO FEASIBLE REPLACEMENT";

/* ------------------------------------------------------------------ */
/* Event impact                                                       */
/* ------------------------------------------------------------------ */

/** Starting weights from the specification. Renormalised when data is missing. */
export const EVENT_IMPACT_WEIGHTS = {
  crowdIntensity: 0.25,
  routeProximity: 0.25,
  timeOverlap: 0.2,
  routeImportance: 0.15,
  eventDuration: 0.15,
} as const;

export const CROWD_LEVEL_SCORE = {
  LOW: 25,
  MODERATE: 50,
  HIGH: 75,
  VERY_HIGH: 100,
} as const;

/** Duration in minutes that maps to a full duration factor. */
export const EVENT_FULL_DURATION_MINUTES = 240;

/** Illustrative maximum event-related delay in minutes at impact score 100. */
export const EVENT_MAX_DELAY_MINUTES = 20;

export const RISK_BANDS = [
  { level: "LOW", min: 0, max: 24 },
  { level: "MODERATE", min: 25, max: 49 },
  { level: "HIGH", min: 50, max: 74 },
  { level: "CRITICAL", min: 75, max: 100 },
] as const;

/** Minimum impact score for a route to count as "affected" in alerts/summaries. */
export const EVENT_AFFECTED_ROUTE_THRESHOLD = 25;

/* ------------------------------------------------------------------ */
/* Reliability                                                        */
/* ------------------------------------------------------------------ */

export const RELIABILITY_MAX_PENALTIES = {
  EXPECTED_DELAY: 25,
  EVENT_IMPACT: 20,
  TRANSFER_WAITING: 15,
  CONNECTION_BUFFER: 15,
  BUS_AVAILABILITY: 15,
  TRANSFER_COUNT: 10,
  ACTIVE_DISRUPTION: 0,
} as const;

export const RELIABILITY_LABELS = [
  { label: "HIGH", min: 80 },
  { label: "MODERATE", min: 60 },
  { label: "LOW", min: 40 },
  { label: "VERY_LOW", min: 0 },
] as const;

/** Illustrative minutes of delay per 1 point of event impact score. */
export const RELIABILITY_EVENT_IMPACT_DELAY_FACTOR = EVENT_MAX_DELAY_MINUTES / 100;

/* ------------------------------------------------------------------ */
/* Demand                                                             */
/* ------------------------------------------------------------------ */

export const DEMAND_REQUIRED_TOTALS = {
  expectedStudents: 420,
  availableSeats: 350,
  shortage: 70,
} as const;

/** Load-factor thresholds for illustrative overcrowding risk. */
export const OVERCROWDING_THRESHOLDS = {
  MODERATE: 0.7,
  HIGH: 0.85,
  CRITICAL: 1,
} as const;

/* ------------------------------------------------------------------ */
/* Replacement ranking                                                */
/* ------------------------------------------------------------------ */

export const REPLACEMENT_WEIGHTS = {
  capacity: 0.35,
  compatibility: 0.3,
  responseTime: 0.25,
  availability: 0.1,
} as const;

/** Response time (minutes) that maps to a response-time score of zero. */
export const MAX_RESPONSE_TIME_MINUTES = 60;

/** Minimum seats a candidate must provide to be eligible as partial coverage. */
export const MIN_PARTIAL_COVERAGE_SEATS = 10;

/** Compatibility score required for a candidate to be part of a combined suggestion. */
export const MIN_COMBINATION_COMPATIBILITY = 60;

/* ------------------------------------------------------------------ */
/* Journey planning                                                   */
/* ------------------------------------------------------------------ */

export const NETWORK_DAY_START_MINUTES = 5 * 60; // 05:00
export const MIN_TRANSFER_BUFFER_MINUTES = 5;
/** Late alternatives are still listed up to this many minutes after the deadline. */
export const LATE_ALTERNATIVE_WINDOW_MINUTES = 90;
export const MAX_JOURNEY_OPTIONS = 60;
export const MAX_JOURNEY_LEGS = 2;
/**
 * Illustrative walking minutes are explicit demo values (see seed accessStops).
 * Straight-line distance is never presented as walking distance.
 */
export const WALKING_ESTIMATE_NOTE =
  "Illustrative demo walking time. Not routed pedestrian distance.";

/* ------------------------------------------------------------------ */
/* Incident effects                                                   */
/* ------------------------------------------------------------------ */

/** Documented illustrative delay minutes applied while an incident is ACTIVE. */
export const INCIDENT_ROUTE_DELAY_MINUTES = {
  BUS_NOT_ARRIVED: 12,
  BUS_BREAKDOWN: 20,
  MECHANICAL_FAILURE: 20,
  DRIVER_REPORTED_ISSUE: 18,
  UNEXPECTED_CANCELLATION: 20,
  ROAD_BLOCKAGE: 15,
  ROUTE_DIVERSION: 15,
  INSUFFICIENT_CAPACITY: 10,
  OTHER: 8,
} as const;

/** Incident types that make route services infeasible while ACTIVE. */
export const ROUTE_BLOCKING_INCIDENT_TYPES = ["ROAD_BLOCKAGE", "ROUTE_DIVERSION"] as const;

export const REPORT_TYPE_LABELS: Record<string, string> = {
  BUS_NOT_ARRIVED: "Bus not arrived",
  BUS_BREAKDOWN: "Bus breakdown",
  MECHANICAL_FAILURE: "Mechanical failure",
  DRIVER_REPORTED_ISSUE: "Driver-reported issue",
  UNEXPECTED_CANCELLATION: "Unexpected cancellation",
  ROAD_BLOCKAGE: "Road blockage",
  ROUTE_DIVERSION: "Route diversion",
  INSUFFICIENT_CAPACITY: "Insufficient capacity",
  OTHER: "Other issue",
};

/* ------------------------------------------------------------------ */
/* Scenario                                                           */
/* ------------------------------------------------------------------ */

export const SCENARIO_STEP_IDS = {
  EVENT_CREATED: "event-affects-r101-r104",
  EVENT_IMPACT_PREDICTED: "event-impact-predicted",
  STUDENT_REQUEST_ADDED: "student-request-added",
  BREAKDOWN_CONFIRMED: "bus-breakdown-confirmed",
  AFFECTED_JOURNEYS_IDENTIFIED: "affected-journeys-identified",
  REPLACEMENT_RECOMMENDED: "replacement-recommended",
  REPLACEMENT_APPROVED: "replacement-approved",
} as const;

export const SCENARIO_EVENT_ID = "evt-town-b-festival";
export const SCENARIO_BUS_REGISTRATION = "KA-21-AB-102";
export const SCENARIO_EVENT_PREPARATION_BUFFER_MINUTES = 90;
export const SCENARIO_DEMO_ORIGIN_VILLAGE_ID = "V_VITTAL";
export const SCENARIO_DEMO_DESTINATION_ID = "DST_PGC";
export const SCENARIO_REQUIRED_ARRIVAL_TIME = "09:00";
