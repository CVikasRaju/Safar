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

export type IncidentSeverity = "LOW" | "MODERATE" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CrowdIntensity = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" | "CRITICAL";

export type IncidentType =
  | "BREAKDOWN"
  | "BUS_BREAKDOWN"
  | "MECHANICAL_FAILURE"
  | "DRIVER_ISSUE"
  | "ROAD_CLOSURE"
  | "ROAD_BLOCKAGE"
  | "ROUTE_DIVERSION"
  | "CANCELLATION"
  | "CAPACITY_SHORTAGE"
  | "DELAY"
  | "OVERCROWDING"
  | "WEATHER"
  | "ACCIDENT"
  | "CUSTOM"
  | "OTHER";

export type ReportType =
  | "BUS_DELAYED"
  | "BUS_OVERCROWDED"
  | "BUS_BREAKDOWN"
  | "BUS_NOT_ARRIVED"
  | "MECHANICAL_FAILURE"
  | "DRIVER_ISSUE"
  | "CANCELLATION"
  | "ROAD_BLOCKED"
  | "ROAD_BLOCKAGE"
  | "ROUTE_DIVERSION"
  | "CAPACITY_SHORTAGE"
  | "STOP_INACCESSIBLE"
  | "CUSTOM"
  | "OTHER";

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
  lat?: number;
  lng?: number;
}

export interface Destination {
  id: string;
  name: string;
  villageId: string;
  /** Primary bus stop used as the drop-off reference (may be a short walk away). */
  stopId: string;
  coordinates: Coordinates;
  type?: "COLLEGE" | "HOSPITAL" | "MARKET" | "GOVERNMENT_OFFICE" | "OTHER";
  lat?: number;
  lng?: number;
}

export interface Stop {
  id: string;
  name: string;
  villageId: string;
  coordinates: Coordinates;
  lat?: number;
  lng?: number;
  sequence?: number;
}

export type RouteImportance = "PRIMARY" | "SECONDARY" | "FEEDER";

export interface Route {
  id: string;
  name: string;
  description: string;
  importance: RouteImportance;
  /** Ordered stop IDs. Sequence order is the direction of travel for OUTBOUND services. */
  stops: string[];
  stopIds?: string[];
  originVillageId?: string;
  destinationId?: string;
  provenance?: Provenance;
}

export interface TimetableStopTime {
  stopId: string;
  /** Minutes after local midnight. Arrival and departure are equal in this demo timetable. */
  arrivalMinute: number;
  departureMinute: number;
  scheduledArrival?: string;
  scheduledDeparture?: string;
}

export interface TimetableService {
  id: string;
  routeId: string;
  busId: string;
  direction: ServiceDirection;
  /** ISO weekday numbers, 0 = Sunday, or day strings. */
  operatingDays: (number | string)[];
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
  | "CELEBRATION"
  | "CONSTRUCTION"
  | "ROAD_CLOSURE"
  | "CUSTOM";

export type CrowdLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

export type EventVerificationStatus = "PREDICTED" | "UNVERIFIED" | "CONFIRMED" | "VERIFIED" | "REJECTED";

export interface SafarEvent {
  id: string;
  name: string;
  category: EventCategory;
  locationLabel?: string;
  location?: string;
  coordinates?: Coordinates;
  lat?: number;
  lng?: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  startTime: string;
  endTime: string;
  expectedCrowdLevel?: CrowdLevel;
  crowdIntensity?: CrowdIntensity;
  nearbyVillageIds: string[];
  affectedRoads?: string[];
  affectedRoadLabels?: string[];
  affectedRouteIds: string[];
  impactWindow?: { start: string; end: string };
  impactWindowMinutes?: number;
  /** Minutes of preparation/arrival buffer supplied by scenario configuration (never invented). */
  impactWindowBufferMinutes?: number;
  impactWindowBasis?: string;
  description?: string;
  source: string;
  verificationStatus: EventVerificationStatus;
  provenance: Provenance;
  createdAt?: string;
  updatedAt?: string;
}

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

/**
 * Route-level impact. Owned and recalculated by the Event Intelligence module
 * (Member 3). The Student Portal only reads these records.
 */
export interface EventRouteImpact {
  id?: string;
  eventId: string;
  routeId: string;
  impactScore: number;
  riskLevel: RiskLevel;
  overlapMinutes?: number;
  proximityBasis?: string;
  estimatedDelayMinutes?: number;
  explanation: string;
  computedAt?: string;
  calculatedAt?: string;
  provenance: Provenance;
  crowdScore?: number;
  proximityScore?: number;
  overlapScore?: number;
  routeImportanceScore?: number;
  durationScore?: number;
}

export interface DemandSeedRecord {
  routeId: string;
  expectedStudents: number;
  availableSeats: number;
  provenance: Provenance;
  note: string;
}

export type DemandSeed = DemandSeedRecord;

export interface RouteDemand {
  routeId: string;
  expectedStudents: number;
  availableSeats: number;
  occupiedSeats: number;
  remainingSeats: number;
  shortage: number;
  surplus: number;
  overcrowdingRisk: boolean;
  provenance: Provenance;
}

export type SegmentType = "WALK" | "BUS" | "WAIT" | "TRANSFER";

export interface JourneySegment {
  id: string;
  type: SegmentType;
  fromLabel: string;
  toLabel: string;
  fromStopId?: string;
  toStopId?: string;
  serviceId?: string;
  busId?: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  distanceLabel?: string;
  notes?: string;
}

export interface JourneyOption {
  id: string;
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  segments: JourneySegment[];
  totalDurationMinutes: number;
  transferCount: number;
  walkingSegments: number;
  departureTime: string;
  expectedArrivalTime: string;
  estimatedDelayMinutes: number;
  reliabilityScore: number;
  meetsArrivalDeadline: boolean;
  warnings: string[];
  submittedAt?: string;
  category?: string;
  provenance: Provenance;
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
  reviewedByRole?: string;
  relatedIncidentId?: string;
  category?: string;
  location?: string;
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
  affectedJourneyIds?: string[];
  estimatedAffectedPassengers?: number;
  confirmedByRole?: string;
  confirmedAt?: string;
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
  decidedAt?: string;
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
  type?: string;
  category?: string;
  read?: boolean;
}

export type DemoActor = "STUDENT_DEMO" | "AUTHORITY_DEMO" | "SYSTEM" | "AUTHORITY";

export interface AuditEvent {
  id: string;
  actor?: DemoActor;
  action: string;
  at?: string;
  timestamp?: string;
  recordIds?: string[];
  reason?: string;
  entityType?: string;
  performedByRole?: string;
  affectedRecordType?: string;
  affectedRecordId?: string;
}

export interface ScenarioState {
  id: string;
  status: "IDLE" | "RUNNING" | "COMPLETE";
  /** Configurable demo date; never assume the real calendar date. */
  scenarioDate: string;
  notes: string;
  steps?: string[];
  festivalEventId?: string;
  breakdownBusId?: string;
  breakdownIncidentId?: string;
  replacementRecommendationId?: string;
  approvedReplacementBusId?: string;
}

export interface SafarState {
  schemaVersion: number;
  /**
   * Active emergency scenario inputs, added additively by the emergency
   * intelligence engine. Allocations are recomputed from these inputs rather
   * than stored, so repeated runs cannot duplicate assignments.
   */
  emergency?: import("./emergency").EmergencyState;
  seedVersion: string;
  villages: Village[];
  destinations: Destination[];
  stops: Stop[];
  routes: Route[];
  timetableServices: TimetableService[];
  timetables: TimetableService[];
  buses: Bus[];
  events: SafarEvent[];
  eventRouteImpacts: EventRouteImpact[];
  eventImpacts: EventRouteImpact[];
  demandSeed: DemandSeedRecord[];
  travelRequests: StudentTravelRequest[];
  disruptionReports: DisruptionReport[];
  incidents: Incident[];
  replacementRecommendations: ReplacementRecommendation[];
  alerts: Alert[];
  auditEvents: AuditEvent[];
  scenario: ScenarioState;
  lastSavedAt?: string;
}

export type AppState = SafarState;
