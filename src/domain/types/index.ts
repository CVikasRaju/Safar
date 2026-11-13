/**
 * Canonical SAFAR domain types.
 *
 * These mirror `docs/13_DATA_MODELS_AND_API.md` and are the shared contract
 * between the Student Portal (Member 2), the Control Centre foundation
 * (Member 1), Event Intelligence (Member 3) and Fleet/Replacement (Member 4).
 *
 * Names and optional fields may grow, but concepts and state transitions must
 * stay consistent. Do not fork these into a second model.
 */

export type Provenance =
  | "DEMO"
  | "SIMULATED"
  | "USER_ENTERED"
  | "CALCULATED"
  | "AI_GENERATED"
  | "VERIFIED";

export type BusStatus =
  | "OPERATING"
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "MAINTENANCE"
  | "REPLACEMENT_ASSIGNED";

export type ReportStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED" | "DUPLICATE" | "CLOSED";

export type IncidentStatus = "ACTIVE" | "RESOLVED" | "CLOSED";

export type ServiceDirection = "OUTBOUND" | "INBOUND";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Village {
  id: string;
  name: string;
  taluk: string;
  coordinates: Coordinates;
}

export interface Destination {
  id: string;
  name: string;
  villageId: string;
  /** Primary bus stop used as the drop-off reference (may be a short walk away). */
  stopId: string;
  coordinates: Coordinates;
}

export interface Stop {
  id: string;
  name: string;
  villageId: string;
  coordinates: Coordinates;
}

export type RouteImportance = "PRIMARY" | "SECONDARY" | "FEEDER";

export interface Route {
  id: string;
  name: string;
  description: string;
  importance: RouteImportance;
  /** Ordered stop IDs. Sequence order is the direction of travel for OUTBOUND services. */
  stops: string[];
}

export interface TimetableStopTime {
  stopId: string;
  /** Minutes after local midnight. Arrival and departure are equal in this demo timetable. */
  arrivalMinute: number;
  departureMinute: number;
}

export interface TimetableService {
  id: string;
  routeId: string;
  busId: string;
  direction: ServiceDirection;
  /** ISO weekday numbers, 0 = Sunday. */
  operatingDays: number[];
  stopTimes: TimetableStopTime[];
  provenance: Provenance;
}

export interface Bus {
  id: string;
  registration: string;
  assignedRouteId?: string;
  capacity: number;
  occupiedSeats: number;
  status: BusStatus;
  lastKnownLocationLabel: string;
  estimatedResponseMinutes?: number;
  commitments: string[];
  provenance: Provenance;
}

export type EventCategory =
  | "TEMPLE_FESTIVAL"
  | "RELIGIOUS_PROCESSION"
  | "VILLAGE_FAIR"
  | "WEEKLY_MARKET"
  | "EXAMINATION"
  | "SPORTS_EVENT"
  | "PUBLIC_GATHERING"
  | "POLITICAL_RALLY"
  | "NATIONAL_CELEBRATION"
  | "CONSTRUCTION"
  | "ROAD_CLOSURE"
  | "CUSTOM";

export type CrowdLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

export type EventVerificationStatus = "PREDICTED" | "UNVERIFIED" | "CONFIRMED";

export interface SafarEvent {
  id: string;
  name: string;
  category: EventCategory;
  locationLabel: string;
  coordinates?: Coordinates;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  startTime: string;
  endTime: string;
  expectedCrowdLevel: CrowdLevel;
  nearbyVillageIds: string[];
  affectedRoads: string[];
  affectedRouteIds: string[];
  impactWindow: { start: string; end: string };
  /** Minutes of preparation/arrival buffer supplied by scenario configuration (never invented). */
  impactWindowBufferMinutes: number;
  impactWindowBasis: string;
  description: string;
  source: string;
  verificationStatus: EventVerificationStatus;
  provenance: Provenance;
}

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

/**
 * Route-level impact. Owned and recalculated by the Event Intelligence module
 * (Member 3). The Student Portal only reads these records.
 */
export interface EventRouteImpact {
  id: string;
  eventId: string;
  routeId: string;
  impactScore: number;
  riskLevel: RiskLevel;
  overlapMinutes: number;
  proximityBasis: string;
  estimatedDelayMinutes?: number;
  explanation: string;
  computedAt: string;
  provenance: Provenance;
}

export interface DemandSeedRecord {
  routeId: string;
  expectedStudents: number;
  availableSeats: number;
  provenance: Provenance;
  note: string;
}

export interface StudentTravelRequest {
  id: string;
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  groupSize: number;
  submittedAt: string;
  provenance: "USER_ENTERED" | "SIMULATED";
  /** Demo session that submitted the request (no personal identity is stored). */
  submittedBySessionId?: string;
}

export interface DisruptionReport {
  id: string;
  routeId: string;
  expectedBusId?: string;
  stopId?: string;
  expectedArrivalAt?: string;
  reportType: string;
  description?: string;
  submittedAt: string;
  status: ReportStatus;
  reviewReason?: string;
  reviewedAt?: string;
  relatedIncidentId?: string;
  provenance: "USER_ENTERED" | "SIMULATED";
  /**
   * Demo session that submitted the report. Optional and additive so the
   * shared model stays compatible with the foundation implementation.
   */
  submittedBySessionId?: string;
}

export interface Incident {
  id: string;
  type: string;
  status: IncidentStatus;
  routeId?: string;
  busId?: string;
  affectedStopId?: string;
  occurredAt: string;
  severity: string;
  expectedResolution?: string;
  description?: string;
  relatedReportIds: string[];
  provenance: Provenance;
}

export interface ReplacementCandidateScore {
  busId: string;
  capacityScore: number;
  compatibilityScore: number;
  responseTimeScore: number;
  availabilityScore: number;
  finalScore: number;
  eligible: boolean;
  explanation: string;
}

export interface ReplacementRecommendation {
  id: string;
  incidentId: string;
  candidateBusIds: string[];
  rankedCandidates: ReplacementCandidateScore[];
  recommendedBusId?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NO_FEASIBLE_CANDIDATE";
  decisionReason?: string;
}

export type AlertAudience = "STUDENT" | "AUTHORITY" | "ALL";

export interface Alert {
  id: string;
  audience: AlertAudience;
  severity: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  title: string;
  body: string;
  createdAt: string;
  relatedRouteIds: string[];
  relatedIncidentId?: string;
  relatedReportId?: string;
  provenance: Provenance;
}

export type DemoActor = "STUDENT_DEMO" | "AUTHORITY_DEMO" | "SYSTEM";

export interface AuditEvent {
  id: string;
  actor: DemoActor;
  action: string;
  at: string;
  recordIds: string[];
  reason?: string;
}

export interface ScenarioState {
  id: string;
  status: "IDLE" | "RUNNING" | "COMPLETE";
  /** Configurable demo date; never assume the real calendar date. */
  scenarioDate: string;
  notes: string;
}

export interface SafarState {
  schemaVersion: number;
  seedVersion: string;
  villages: Village[];
  destinations: Destination[];
  stops: Stop[];
  routes: Route[];
  timetableServices: TimetableService[];
  buses: Bus[];
  events: SafarEvent[];
  eventRouteImpacts: EventRouteImpact[];
  demandSeed: DemandSeedRecord[];
  travelRequests: StudentTravelRequest[];
  disruptionReports: DisruptionReport[];
  incidents: Incident[];
  replacementRecommendations: ReplacementRecommendation[];
  alerts: Alert[];
  auditEvents: AuditEvent[];
  scenario: ScenarioState;
}
