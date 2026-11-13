/** Human-readable labels and shared enumerations. */

export const REPORT_TYPE_LABELS: Record<string, string> = {
  BUS_NOT_ARRIVED: "Bus not arrived",
  BUS_BREAKDOWN: "Bus breakdown",
  MECHANICAL_FAILURE: "Mechanical failure",
  DRIVER_REPORTED_ISSUE: "Driver-reported issue",
  CANCELLATION: "Unexpected cancellation",
  ROAD_BLOCKAGE: "Road blockage",
  ROUTE_DIVERSION: "Route diversion",
  INSUFFICIENT_CAPACITY: "Insufficient capacity / overcrowding",
  OTHER: "Other issue",
};

export const REPORT_TYPE_OPTIONS = Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const REPORT_STATUS_LABELS: Record<string, string> = {
  UNVERIFIED: "UNVERIFIED STUDENT REPORT",
  VERIFIED: "VERIFIED REPORT — INCIDENT NOT YET CONFIRMED",
  REJECTED: "REPORT REJECTED",
  DUPLICATE: "MARKED DUPLICATE",
  CLOSED: "CLOSED",
};

export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  BUS_NOT_ARRIVED: "Bus not arrived",
  BUS_BREAKDOWN: "Bus breakdown",
  MECHANICAL_FAILURE: "Mechanical failure",
  DRIVER_REPORTED_ISSUE: "Driver-reported issue",
  CANCELLATION: "Unexpected cancellation",
  ROAD_BLOCKAGE: "Road blockage",
  ROUTE_DIVERSION: "Route diversion",
  INSUFFICIENT_CAPACITY: "Insufficient capacity",
  OTHER: "Other",
};

export const BUS_STATUS_LABELS: Record<string, string> = {
  OPERATING: "Operating",
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
  MAINTENANCE: "Maintenance",
  REPLACEMENT_ASSIGNED: "Replacement assigned",
};

export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  TEMPLE_FESTIVAL: "Temple festival",
  RELIGIOUS_PROCESSION: "Religious procession",
  VILLAGE_FAIR: "Village fair",
  WEEKLY_MARKET: "Weekly market",
  EXAMINATION: "Examination",
  SPORTS_EVENT: "Sports event",
  PUBLIC_GATHERING: "Public gathering",
  POLITICAL_RALLY: "Political rally",
  NATIONAL_CELEBRATION: "National celebration",
  CONSTRUCTION: "Construction",
  ROAD_CLOSURE: "Road closure",
  CUSTOM: "Custom event",
};

export const CROWD_LEVEL_LABELS: Record<string, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very high",
};

/**
 * Illustrative conversion from a confirmed incident severity to schedule delay.
 * This is a prototype assumption, not a measured value. It exists so that
 * journey estimates and reliability react to confirmed incidents, and is shown
 * to students as an estimate.
 */
export const INCIDENT_SEVERITY_DELAY_MINUTES: Record<string, number> = {
  LOW: 8,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 45,
};

/** Incident types that make a route inoperable for planning. */
export const ROUTE_BLOCKING_INCIDENT_TYPES = ["ROAD_BLOCKAGE", "ROUTE_DIVERSION"];

export const DEMO_DATA_LABEL = "SIMULATED / DEMO DATA";

export const SAFAR_TAGLINE = "Predict Disruptions. Protect Student Journeys. Connect Every Village.";
