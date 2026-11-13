// SAFAR — Canonical Domain Types
// Source of truth for all shared interfaces across all four members' modules.
// Do not modify without coordinating with Member 1.

// ─── Provenance ──────────────────────────────────────────────────────────────
export type Provenance =
  | 'DEMO'
  | 'SIMULATED'
  | 'USER_ENTERED'
  | 'CALCULATED'
  | 'AI_GENERATED'
  | 'VERIFIED';

// ─── Bus ──────────────────────────────────────────────────────────────────────
export type BusStatus =
  | 'OPERATING'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'MAINTENANCE'
  | 'REPLACEMENT_ASSIGNED';

export interface Bus {
  id: string;
  registration: string;
  assignedRouteId?: string;
  capacity: number;
  occupiedSeats: number;
  status: BusStatus;
  lastKnownLocationLabel: string;
  estimatedResponseMinutes?: number;
  commitments: string[]; // incident or route IDs
  provenance: Provenance;
}

// ─── Network ──────────────────────────────────────────────────────────────────
export interface Village {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Destination {
  id: string;
  name: string;
  type: 'COLLEGE' | 'HOSPITAL' | 'MARKET' | 'GOVERNMENT_OFFICE' | 'OTHER';
  lat: number;
  lng: number;
  villageId: string;
}

export interface Stop {
  id: string;
  name: string;
  villageId: string;
  lat: number;
  lng: number;
  sequence?: number;
}

export interface Route {
  id: string;
  name: string;
  stopIds: string[]; // ordered
  originVillageId: string;
  destinationId: string;
  description?: string;
  provenance: Provenance;
}

export interface TimetableStopTime {
  stopId: string;
  scheduledArrival: string;   // "HH:MM"
  scheduledDeparture: string; // "HH:MM"
}

export interface TimetableService {
  id: string;
  routeId: string;
  busId: string;
  operatingDays: Array<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'>;
  stopTimes: TimetableStopTime[];
  provenance: Provenance;
}

// ─── Events ───────────────────────────────────────────────────────────────────
export type EventCategory =
  | 'TEMPLE_FESTIVAL'
  | 'RELIGIOUS_PROCESSION'
  | 'VILLAGE_FAIR'
  | 'WEEKLY_MARKET'
  | 'EXAMINATION'
  | 'SPORTS_EVENT'
  | 'PUBLIC_GATHERING'
  | 'POLITICAL_RALLY'
  | 'CELEBRATION'
  | 'CONSTRUCTION'
  | 'ROAD_CLOSURE'
  | 'CUSTOM';

export type CrowdIntensity = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface SafarEvent {
  id: string;
  name: string;
  category: EventCategory;
  location: string;
  lat?: number;
  lng?: number;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  crowdIntensity: CrowdIntensity;
  nearbyVillageIds: string[];
  affectedRoadLabels: string[];
  affectedRouteIds: string[];
  impactWindowMinutes: number; // minutes before event start
  description?: string;
  source: string;
  provenance: Provenance;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface EventRouteImpact {
  eventId: string;
  routeId: string;
  impactScore: number; // 0–100
  riskLevel: RiskLevel;
  crowdScore: number;
  proximityScore: number;
  overlapScore: number;
  routeImportanceScore: number;
  durationScore: number;
  explanation: string;
  estimatedDelayMinutes?: number;
  calculatedAt: string;
  provenance: Provenance;
}

// ─── Disruption Reports ───────────────────────────────────────────────────────
export type ReportStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED' | 'DUPLICATE' | 'CLOSED';

export type ReportType =
  | 'BUS_NOT_ARRIVED'
  | 'BUS_BREAKDOWN'
  | 'MECHANICAL_FAILURE'
  | 'DRIVER_ISSUE'
  | 'CANCELLATION'
  | 'ROAD_BLOCKAGE'
  | 'ROUTE_DIVERSION'
  | 'CAPACITY_SHORTAGE'
  | 'CUSTOM';

export interface DisruptionReport {
  id: string;
  routeId: string;
  expectedBusId?: string;
  stopId?: string;
  expectedArrivalAt?: string; // "HH:MM"
  reportType: ReportType;
  description?: string;
  submittedAt: string; // ISO
  status: ReportStatus;
  reviewReason?: string;
  reviewedAt?: string;
  reviewedByRole?: string;
  relatedIncidentId?: string;
  provenance: 'USER_ENTERED' | 'SIMULATED';
}

// ─── Incidents ────────────────────────────────────────────────────────────────
export type IncidentStatus = 'ACTIVE' | 'RESOLVED' | 'CLOSED';

export type IncidentType =
  | 'BUS_BREAKDOWN'
  | 'MECHANICAL_FAILURE'
  | 'DRIVER_ISSUE'
  | 'ROAD_BLOCKAGE'
  | 'ROUTE_DIVERSION'
  | 'CANCELLATION'
  | 'CAPACITY_SHORTAGE'
  | 'CUSTOM';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Incident {
  id: string;
  type: IncidentType;
  status: IncidentStatus;
  routeId?: string;
  busId?: string;
  affectedStopId?: string;
  occurredAt: string; // ISO
  severity: IncidentSeverity;
  expectedResolution?: string;
  description?: string;
  relatedReportIds: string[];
  affectedJourneyIds: string[];
  estimatedAffectedPassengers: number;
  confirmedByRole: string;
  confirmedAt: string;
  provenance: Provenance;
}

// ─── Replacement ──────────────────────────────────────────────────────────────
export interface ReplacementCandidate {
  busId: string;
  capacityScore: number;      // 0–100
  compatibilityScore: number; // 0–100
  responseTimeScore: number;  // 0–100
  availabilityScore: number;  // 0–100
  finalScore: number;         // weighted 0–100
  eligible: boolean;
  ineligibilityReason?: string;
  explanation: string;
}

export interface ReplacementRecommendation {
  id: string;
  incidentId: string;
  candidateBusIds: string[];
  rankedCandidates: ReplacementCandidate[];
  recommendedBusId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NO_FEASIBLE_CANDIDATE';
  decisionReason?: string;
  decidedAt?: string;
  decidedByRole?: string;
  provenance: Provenance;
}

// ─── Journey Planning ─────────────────────────────────────────────────────────
export type SegmentType = 'WALK' | 'BUS' | 'WAIT' | 'TRANSFER';

export interface JourneySegment {
  id: string;
  type: SegmentType;
  fromLabel: string;
  toLabel: string;
  fromStopId?: string;
  toStopId?: string;
  serviceId?: string;
  busId?: string;
  departureTime: string; // "HH:MM"
  arrivalTime: string;   // "HH:MM"
  durationMinutes: number;
  distanceLabel?: string; // "approx. 400m (estimated)" or "unavailable"
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
  category: 'FASTEST' | 'MOST_RELIABLE' | 'FEWEST_TRANSFERS';
  provenance: Provenance;
}

// ─── Student Travel Request ───────────────────────────────────────────────────
export interface StudentTravelRequest {
  id: string;
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  groupSize: number;
  submittedAt: string;
  provenance: 'USER_ENTERED' | 'SIMULATED';
}

// ─── Demand & Capacity ────────────────────────────────────────────────────────
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

// ─── Alerts ───────────────────────────────────────────────────────────────────
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType =
  | 'EVENT_IMPACT'
  | 'ROUTE_DISRUPTION'
  | 'REPORT_STATUS'
  | 'INCIDENT_CONFIRMED'
  | 'REPLACEMENT_APPROVED'
  | 'CAPACITY_SHORTAGE'
  | 'RELIABILITY_LOW';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  routeId?: string;
  busId?: string;
  eventId?: string;
  incidentId?: string;
  reportId?: string;
  createdAt: string;
  read: boolean;
  provenance: Provenance;
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditEvent {
  id: string;
  action: string;
  performedByRole: string;
  timestamp: string;
  affectedRecordType: string;
  affectedRecordId: string;
  reason?: string;
  details?: Record<string, unknown>;
}

// ─── Scenario State ───────────────────────────────────────────────────────────
export type ScenarioStatus = 'IDLE' | 'RUNNING' | 'COMPLETE' | 'RESET';

export interface ScenarioState {
  status: ScenarioStatus;
  scenarioDate: string; // configurable, not hardcoded
  festivalEventId?: string;
  breakdownBusId?: string;
  breakdownIncidentId?: string;
  replacementRecommendationId?: string;
  approvedReplacementBusId?: string;
  steps: string[]; // completed step labels
}

// ─── App State ────────────────────────────────────────────────────────────────
export interface DemandSeed {
  routeId: string;
  expectedStudents: number;
  availableSeats: number;
}

export interface AppState {
  // Network
  villages: Village[];
  destinations: Destination[];
  stops: Stop[];
  routes: Route[];
  timetables: TimetableService[];
  buses: Bus[];
  // Events
  events: SafarEvent[];
  eventImpacts: EventRouteImpact[];
  // Disruptions
  disruptionReports: DisruptionReport[];
  incidents: Incident[];
  replacementRecommendations: ReplacementRecommendation[];
  // Demand
  demandSeed: DemandSeed[];
  travelRequests: StudentTravelRequest[];
  // Alerts
  alerts: Alert[];
  // Audit
  auditEvents: AuditEvent[];
  // Scenario
  scenario: ScenarioState;
  // Meta
  lastSavedAt?: string;
  schemaVersion: number;
}
