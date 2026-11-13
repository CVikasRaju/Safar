/**
 * SAFAR — Canonical domain types and shared data contracts.
 *
 * This module is the single source of truth for entities exchanged between
 * the Student Portal, the Government Control Centre and the domain services.
 *
 * Integration rules:
 * - Do not duplicate these models in feature folders.
 * - Times are ISO-8601 local date-time strings ("YYYY-MM-DDTHH:MM:00") unless a
 *   field name explicitly ends in `Time` (then "HH:MM") or `Date` ("YYYY-MM-DD").
 * - Every illustrative/demo value carries a `provenance` label.
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

export type ReportStatus =
  | "UNVERIFIED"
  | "VERIFIED"
  | "REJECTED"
  | "DUPLICATE"
  | "CLOSED";

export type IncidentStatus = "ACTIVE" | "RESOLVED" | "CLOSED";

export type Severity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type ReportType =
  | "BUS_NOT_ARRIVED"
  | "BUS_BREAKDOWN"
  | "MECHANICAL_FAILURE"
  | "DRIVER_REPORTED_ISSUE"
  | "UNEXPECTED_CANCELLATION"
  | "ROAD_BLOCKAGE"
  | "ROUTE_DIVERSION"
  | "INSUFFICIENT_CAPACITY"
  | "OTHER";

export type IncidentType = ReportType;

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

export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "SIMULATED";

export type AlertAudience = "STUDENT" | "AUTHORITY" | "BOTH";

export type AlertSeverity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";

export type DemoActor = "STUDENT_DEMO" | "AUTHORITY" | "SYSTEM";

export type JourneyCategory =
  | "FASTEST"
  | "MOST_RELIABLE"
  | "FEWEST_TRANSFERS";

export type ArrivalStatus = "MEETS_REQUIRED_ARRIVAL" | "LATE";

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

export interface AccessPoint {
  stopId: string;
  /** Illustrative walking minutes between the village/destination and the stop. */
  walkMinutes: number;
  provenance: Provenance;
  note?: string;
}

export interface Village {
  id: string;
  name: string;
  kind: "VILLAGE" | "TOWN";
  latitude: number;
  longitude: number;
  accessStops: AccessPoint[];
  provenance: Provenance;
}

export interface Destination {
  id: string;
  name: string;
  villageId: string;
  latitude: number;
  longitude: number;
  accessStops: AccessPoint[];
  provenance: Provenance;
}

export interface Stop {
  id: string;
  name: string;
  villageId: string;
  latitude: number;
  longitude: number;
  provenance: Provenance;
}

export interface Route {
  id: string;
  name: string;
  originVillageId: string;
  destinationVillageId: string;
  /** Ordered stop IDs. Index order is the travel order. */
  stopIds: string[];
  /** Illustrative route length; not used for walking or routing claims. */
  demoLengthKm: number;
  provenance: Provenance;
}

export interface TimetableStopTime {
  stopId: string;
  /** Scheduled time at the stop, "HH:MM" 24-hour. */
  time: string;
}

export interface TimetableService {
  id: string;
  routeId: string;
  busId: string;
  serviceNumber: string;
  direction: "OUTBOUND" | "INBOUND";
  /** Ordered by route stop sequence. */
  stopTimes: TimetableStopTime[];
  operatesOn: "WEEKDAYS" | "DAILY";
  provenance: Provenance;
}

export interface StopWalkLink {
  fromStopId: string;
  toStopId: string;
  walkMinutes: number;
  provenance: Provenance;
}

export interface NetworkData {
  villages: Village[];
  destinations: Destination[];
  stops: Stop[];
  routes: Route[];
  services: TimetableService[];
  stopWalkLinks: StopWalkLink[];
}

/* ------------------------------------------------------------------ */
/* Fleet                                                               */
/* ------------------------------------------------------------------ */

export interface Bus {
  id: string;
  registration: string;
  assignedRouteId: string | null;
  capacity: number;
  occupiedSeats: number;
  status: BusStatus;
  lastKnownLocationLabel: string;
  /** Illustrative response time in minutes; not live GPS-derived. */
  estimatedResponseMinutes: number;
  /** Operational commitments (e.g. "route:R101", "incident:inc-1"). */
  commitments: string[];
  provenance: Provenance;
}

/* ------------------------------------------------------------------ */
/* Demand                                                              */
/* ------------------------------------------------------------------ */

export interface RouteDemandSeed {
  routeId: string;
  expectedStudents: number;
  availableSeats: number;
  provenance: Provenance;
  note?: string;
}

export interface StudentTravelRequest {
  id: string;
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  /** "HH:MM" */
  requiredArrivalTime: string;
  groupSize: number;
  submittedAt: string;
  anonymousRef: string;
  provenance: "USER_ENTERED" | "SIMULATED";
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export interface PreparationBuffer {
  minutes: number;
  /** Where the pre-event buffer came from. Never invented silently. */
  source: string;
}

export interface RegionalEvent {
  id: string;
  name: string;
  category: EventCategory;
  locationLabel: string;
  villageId?: string;
  latitude?: number;
  longitude?: number;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  startTime: string;
  /** "HH:MM" */
  endTime: string;
  crowdLevel: CrowdLevel;
  nearbyVillageIds: string[];
  affectedRoadLabels: string[];
  /** Explicit event-route association. Only these routes are treated as directly affected. */
  declaredAffectedRouteIds: string[];
  preparationBuffer?: PreparationBuffer;
  description: string;
  source: string;
  provenance: Provenance;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventImpactFactors {
  crowdIntensity: number | null;
  routeProximity: number | null;
  timeOverlap: number | null;
  routeImportance: number | null;
  eventDuration: number | null;
}

export interface EventRouteImpact {
  eventId: string;
  routeId: string;
  score: number;
  risk: RiskLevel;
  factors: EventImpactFactors;
  weightsUsed: Partial<Record<keyof EventImpactFactors, number>>;
  missingFactors: Array<keyof EventImpactFactors>;
  /** Illustrative min; documented conversion, not a measured delay. */
  estimatedDelayMinutes: number;
  proximityBasis: string;
  timeOverlapMinutes: number;
  explanation: string;
  suggestedAction: string;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ */
/* Disruption reports and incidents                                    */
/* ------------------------------------------------------------------ */

export interface DisruptionReport {
  id: string;
  reference: string;
  routeId: string;
  expectedBusId?: string;
  stopId?: string;
  /** ISO date-time */
  expectedArrivalAt?: string;
  reportType: ReportType;
  description?: string;
  submittedAt: string;
  status: ReportStatus;
  reviewReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  relatedIncidentId?: string;
  provenance: "USER_ENTERED" | "SIMULATED";
}

export interface Incident {
  id: string;
  type: IncidentType;
  status: IncidentStatus;
  routeId?: string;
  busId?: string;
  affectedStopId?: string;
  /** ISO date-time */
  occurredAt: string;
  severity: Severity;
  expectedResolution?: string;
  description?: string;
  relatedReportIds: string[];
  confirmedBy: string;
  confirmedAt: string;
  closedAt?: string;
  resolutionNote?: string;
  replacementBusId?: string;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ */
/* Replacement recommendations                                         */
/* ------------------------------------------------------------------ */

export type CandidateCoverage = "FULL" | "PARTIAL";

export interface ReplacementCandidateScore {
  busId: string;
  registration: string;
  eligible: boolean;
  ineligibleReasons: string[];
  remainingSeats: number;
  requiredSeats: number;
  coverage: CandidateCoverage;
  capacityScore: number;
  compatibilityScore: number;
  responseTimeScore: number;
  availabilityScore: number;
  finalScore: number;
  explanation: string;
  componentDetails: {
    capacity: string;
    compatibility: string;
    responseTime: string;
    availability: string;
  };
}

export type RecommendationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "NO_FEASIBLE_CANDIDATE";

export interface ReplacementRecommendation {
  id: string;
  incidentId: string;
  routeId: string;
  requiredSeats: number;
  candidateBusIds: string[];
  rankedCandidates: ReplacementCandidateScore[];
  recommendedBusId?: string;
  combinedBusIds?: string[];
  combinedCoveredSeats?: number;
  coveredSeats: number;
  remainingShortage: number;
  status: RecommendationStatus;
  decisionReason?: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ */
/* Journeys                                                            */
/* ------------------------------------------------------------------ */

export interface JourneySearchRequest {
  originVillageId: string;
  destinationId: string;
  /** "YYYY-MM-DD" */
  travelDate: string;
  /** "HH:MM" */
  requiredArrivalTime: string;
  passengers?: number;
}

export type JourneySegmentKind = "WALK" | "BUS" | "WAIT" | "TRANSFER";

export interface JourneySegment {
  id: string;
  kind: JourneySegmentKind;
  fromLabel: string;
  toLabel: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  stopId?: string;
  routeId?: string;
  serviceId?: string;
  busId?: string;
  busRegistration?: string;
  /** True when the duration is an illustrative walking estimate, not routed distance. */
  illustrativeWalkingEstimate?: boolean;
  note?: string;
  provenance: Provenance;
}

export interface JourneyLeg {
  routeId: string;
  serviceId: string;
  serviceNumber: string;
  busId: string;
  busRegistration: string;
  boardingStopId: string;
  alightingStopId: string;
  intermediateStopIds: string[];
  departureAt: string;
  arrivalAt: string;
  delayMinutes: number;
  /** Non-event delay (active incidents), used by the reliability model. */
  incidentDelayMinutes: number;
  /** Event-related illustrative delay, kept separate to avoid double counting. */
  eventDelayMinutes: number;
}

export interface JourneyOption {
  id: string;
  request: JourneySearchRequest;
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  segments: JourneySegment[];
  legs: JourneyLeg[];
  routeIds: string[];
  serviceIds: string[];
  busIds: string[];
  busRegistrations: string[];
  boardingStopId: string;
  alightingStopId: string;
  departureAt: string;
  expectedArrivalAt: string;
  requiredArrivalAt: string;
  totalDurationMinutes: number;
  walkingMinutes: number;
  waitingMinutes: number;
  transferCount: number;
  estimatedDelayMinutes: number;
  delaySources: string[];
  arrivalStatus: ArrivalStatus;
  meetsRequiredArrival: boolean;
  reliabilityScore: number;
  reliabilityLabel: ReliabilityLabel;
  reliabilityDisclaimer: string;
  reliabilityFactors: ReliabilityFactor[];
  warnings: string[];
  provenance: Provenance;
  rankingCategories: JourneyCategory[];
}

export type ReliabilityLabel = "HIGH" | "MODERATE" | "LOW" | "VERY_LOW";

export interface ReliabilityFactor {
  key:
    | "EXPECTED_DELAY"
    | "EVENT_IMPACT"
    | "TRANSFER_WAITING"
    | "CONNECTION_BUFFER"
    | "BUS_AVAILABILITY"
    | "TRANSFER_COUNT"
    | "ACTIVE_DISRUPTION";
  label: string;
  penalty: number;
  maxPenalty: number;
  detail: string;
}

export interface JourneySearchResult {
  request: JourneySearchRequest;
  options: JourneyOption[];
  fastest: JourneyOption | null;
  mostReliable: JourneyOption | null;
  fewestTransfers: JourneyOption | null;
  noRouteReason?: string;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ */
/* Alerts, audit, scenario                                             */
/* ------------------------------------------------------------------ */

export interface Alert {
  id: string;
  audience: AlertAudience;
  severity: AlertSeverity;
  category:
    | "REPORT_STATUS"
    | "INCIDENT"
    | "REPLACEMENT"
    | "EVENT"
    | "DEMAND"
    | "JOURNEY"
    | "SYSTEM";
  title: string;
  message: string;
  routeId?: string;
  incidentId?: string;
  eventId?: string;
  recommendationId?: string;
  createdAt: string;
  provenance: Provenance;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: DemoActor;
  action: string;
  entityType: string;
  entityIds: string[];
  reason?: string;
  details?: Record<string, unknown>;
}

export type ScenarioMode = "NONE" | "CENTRAL" | "BREAKDOWN";

export interface ScenarioState {
  mode: ScenarioMode;
  /** "YYYY-MM-DD" — configurable scenario date, never a stale hardcoded calendar date. */
  scenarioDate: string;
  startedAt?: string;
  completedStepIds: string[];
  eventId?: string;
  failedBusId?: string;
  breakdownIncidentId?: string;
  recommendationId?: string;
  approvedReplacementBusId?: string;
  notes: string[];
}

export interface StateMeta {
  schemaVersion: number;
  seedVersion: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Canonical state                                                     */
/* ------------------------------------------------------------------ */

export interface SafarState {
  schemaVersion: number;
  villages: Village[];
  destinations: Destination[];
  stops: Stop[];
  routes: Route[];
  services: TimetableService[];
  stopWalkLinks: StopWalkLink[];
  buses: Bus[];
  demandSeed: RouteDemandSeed[];
  events: RegionalEvent[];
  eventImpacts: EventRouteImpact[];
  travelRequests: StudentTravelRequest[];
  reports: DisruptionReport[];
  incidents: Incident[];
  recommendations: ReplacementRecommendation[];
  alerts: Alert[];
  scenario: ScenarioState;
  auditEvents: AuditEvent[];
  meta: StateMeta;
}

/* ------------------------------------------------------------------ */
/* Service results                                                     */
/* ------------------------------------------------------------------ */

export interface ServiceSuccess<T> {
  ok: true;
  state: SafarState;
  data: T;
}

export interface ServiceFailure {
  ok: false;
  state: SafarState;
  code: string;
  error: string;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
