import type { Alert, AuditEvent, Bus, Provenance, SafarState } from "./index";

/**
 * Emergency intelligence types.
 *
 * These extend the canonical SAFAR model additively: `SafarState.emergency`
 * is optional, so the existing Student Portal and its persisted demo state keep
 * working unchanged when no emergency is active.
 *
 * Every value produced by this module is a clearly labelled simulation over the
 * shared demo network. No real road geometry, official schedule or live traffic
 * data is implied.
 */

export type RoadStatus = "OPEN" | "FLOODED" | "BLOCKED";

export interface Road {
  id: string;
  name: string;
  fromStopId: string;
  toStopId: string;
  /** Illustrative road distance in km (straight-line × a documented road factor). */
  distanceKm: number;
  /** Illustrative bus travel time in minutes on this road. */
  travelMinutes: number;
  /** Detour road usable when this road is closed. */
  alternativeRoadId?: string;
  provenance: Provenance;
}

export interface RoadCondition {
  roadId: string;
  status: RoadStatus;
  reason?: string;
  /** Stops submerged/inaccessible because of this condition. */
  affectedStopIds?: string[];
  reportedAt?: string;
  provenance: Provenance;
}

export type EmergencyPriorityTier =
  | "EXAM_IMMINENT"
  | "DEADLINE_IMMINENT"
  | "BUS_BREAKDOWN"
  | "FLOOD_AFFECTED"
  | "STANDARD";

export const PRIORITY_TIER_LABELS: Record<EmergencyPriorityTier, string> = {
  EXAM_IMMINENT: "Examination within 2 hours",
  DEADLINE_IMMINENT: "Imminent arrival deadline",
  BUS_BREAKDOWN: "Original bus unavailable",
  FLOOD_AFFECTED: "Flood-affected pickup",
  STANDARD: "Standard demand",
};

export const PRIORITY_TIER_RANK: Record<EmergencyPriorityTier, number> = {
  EXAM_IMMINENT: 1,
  DEADLINE_IMMINENT: 2,
  BUS_BREAKDOWN: 3,
  FLOOD_AFFECTED: 4,
  STANDARD: 5,
};

/** A group of students travelling together (prototype granularity: group requests). */
export interface EmergencyStudentRecord {
  id: string;
  label: string;
  villageId: string;
  destinationId: string;
  pickupStopId: string;
  originalRouteId: string;
  groupSize: number;
  /** HH:MM — arrival deadline at the destination. */
  requiredArrivalTime: string;
  requiredArrivalMinutes: number;
  examStartTime?: string;
  examStartMinutes?: number;
  isSurge: boolean;
  provenance: Provenance;
}

export interface EmergencyState {
  id: string;
  status: "ACTIVE";
  startedAt: string;
  /** Scenario clock in minutes after local midnight; all priority maths uses it. */
  clockMinutes: number;
  scenarioDate: string;
  demandIncreasePct: number;
  examWindowMinutes: number;
  baseDemandStudents: number;
  surgeStudents: number;
  emergencyDemandStudents: number;
  failedBusIds: string[];
  failedRouteIds: string[];
  reserveBusIds: string[];
  blockedRoadId: string;
  blockedRoadName: string;
  studentRecords: EmergencyStudentRecord[];
  roads: Road[];
  roadConditions: RoadCondition[];
  notes: string[];
}

export type SeatBlockKind = "CURRENT_SERVICE" | "RELIEF";

export interface SeatBlock {
  id: string;
  routeId: string;
  busId: string;
  registration: string;
  capacity: number;
  used: number;
  kind: SeatBlockKind;
  /** Documented route seat supply vs physical relief bus capacity. */
  basis: "ROUTE_SEAT_SUPPLY" | "RELIEF_BUS_CAPACITY" | "PHYSICAL_BUS_CAPACITY";
}

export interface AllocationAssignment {
  studentId: string;
  label: string;
  villageId: string;
  pickupStopId: string;
  effectivePickupStopId: string;
  alternativePickup: boolean;
  walkingMetresApprox?: number;
  walkingMinutes?: number;
  /** True when the walk to the replacement pickup exceeds the 2.5 km limit. */
  walkingExceedsLimit?: boolean;
  busId: string;
  busRegistration: string;
  routeId: string;
  originalRouteId: string;
  isReassignment: boolean;
  isReliefBus: boolean;
  students: number;
  priorityTier: EmergencyPriorityTier;
  estimatedArrival: string;
  estimatedArrivalMinutes: number;
  meetsDeadline: boolean;
  meetsExam: boolean;
  explanation: string;
}

export interface UnservedStudentGroup {
  studentId: string;
  label: string;
  villageId: string;
  students: number;
  priorityTier: EmergencyPriorityTier;
  hasExam: boolean;
  examStartTime?: string;
  reason: string;
}

export interface AllocationResult {
  totalStudents: number;
  operationalBusCount: number;
  unavailableBusCount: number;
  availableSeats: number;
  totalSeats: number;
  seatBlocks: SeatBlock[];
  assignments: AllocationAssignment[];
  allocatedStudents: number;
  assignedToReplacementBus: number;
  usingAlternativePickup: number;
  examPriorityStudents: number;
  examPriorityServed: number;
  examPriorityUnserved: number;
  lateStudents: number;
  unserved: UnservedStudentGroup[];
  unservedStudents: number;
  decisions: string[];
  notes: string[];
}

export interface AlternativeRoadPath {
  roadIds: string[];
  distanceKm: number;
  minutes: number;
}

export interface RouteAlternative {
  routeId: string;
  routeName: string;
  blockedRoadId: string;
  blockedRoadName: string;
  alternativePath: AlternativeRoadPath;
  additionalDistanceKm: number;
  additionalMinutes: number;
  replacementBusIds: string[];
  replacementBusRegistrations: string[];
}

export interface EmergencyAnalysis {
  state: SafarState;
  allocation: AllocationResult;
  routeAlternatives: RouteAlternative[];
  affectedRoutes: string[];
  affectedVillages: string[];
  affectedStudentGroups: number;
  demand: {
    baselineStudents: number;
    surgeStudents: number;
    emergencyStudents: number;
    increasePct: number;
    dailySeatSupply: number;
    dailyShortage: number;
    additionalSeatsRequired: number;
  };
  unservedGroups: UnservedStudentGroup[];
  busSummary: {
    total: number;
    operating: number;
    available: number;
    unavailable: number;
    maintenance: number;
    replacementAssigned: number;
    totalSeats: number;
    remainingSeats: number;
  };
}

export interface BeforeAfterMetric {
  key: string;
  label: string;
  before: string;
  after: string;
  delta: string;
  direction: "up" | "down" | "flat";
  tone: "neutral" | "good" | "bad";
}

export interface BeforeAfterComparison {
  metrics: BeforeAfterMetric[];
  before: AllocationResult;
  after: AllocationResult;
  beforeDemand: number;
  afterDemand: number;
}

export interface EmergencyPlan {
  emergency: EmergencyState;
  buses: Bus[];
  audit: AuditEvent;
  alerts: Alert[];
}
