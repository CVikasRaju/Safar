import type { Provenance, Coordinates } from "./index";

export type JourneySegmentType = "WALK" | "WAIT" | "BUS" | "TRANSFER";

export type JourneySegmentKind =
  | "ACCESS_WALK"
  | "BOARD_WAIT"
  | "BUS_RIDE"
  | "TRANSFER_WALK"
  | "TRANSFER_WAIT"
  | "EGRESS_WALK";

export interface WalkingEstimate {
  straightLineMeters: number;
  approxMeters: number;
  minutes: number;
  method: string;
  provenance: Provenance;
  isApproximate: true;
}

export interface JourneyLocation {
  label: string;
  stopId?: string;
  villageId?: string;
  coordinates?: Coordinates;
}

export type JourneyWarningSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface JourneyWarning {
  code: string;
  severity: JourneyWarningSeverity;
  message: string;
  provenance: Provenance;
}

export interface JourneySegment {
  id: string;
  type: JourneySegmentType;
  kind: JourneySegmentKind;
  title: string;
  detail?: string;
  startLocation: JourneyLocation;
  endLocation: JourneyLocation;
  /** ISO timestamp. */
  startTime: string;
  /** ISO timestamp. */
  endTime: string;
  durationMinutes: number;
  serviceId?: string;
  routeId?: string;
  routeLabel?: string;
  busId?: string;
  busRegistration?: string;
  intermediateStopIds?: string[];
  walking?: WalkingEstimate;
  note?: string;
}

export interface JourneyLeg {
  serviceId: string;
  routeId: string;
  routeLabel: string;
  busId: string;
  busRegistration: string;
  direction: "OUTBOUND" | "INBOUND";
  boardStopId: string;
  boardStopName: string;
  alightStopId: string;
  alightStopName: string;
  intermediateStopIds: string[];
  scheduledDeparture: string;
  scheduledArrival: string;
  expectedDeparture: string;
  expectedArrival: string;
  delayMinutes: number;
  waitBeforeMinutes: number;
  transferWalk?: WalkingEstimate;
}

export type ReliabilityLabel = "High" | "Moderate" | "Low" | "Very Low";

export interface ReliabilityPenalty {
  key: string;
  label: string;
  maxPenalty: number;
  value: number;
  reason: string;
}

export interface ReliabilityResult {
  score: number;
  label: ReliabilityLabel;
  penalties: ReliabilityPenalty[];
  disclaimer: string;
}

export type JourneyRecommendationCategory = "FASTEST" | "MOST_RELIABLE" | "FEWEST_TRANSFERS";

export interface JourneySearchRequest {
  originVillageId: string;
  destinationId: string;
  /** YYYY-MM-DD */
  travelDate: string;
  /** HH:MM, local time. */
  requiredArrivalTime: string;
}

export interface JourneyOption {
  id: string;
  kind: "BUS" | "WALK_ONLY";
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  departureTime: string;
  arrivalTime: string;
  scheduledArrivalTime: string;
  totalDurationMinutes: number;
  transferCount: number;
  waitingMinutes: number;
  walkingMinutes: number;
  walkingMetersApprox: number;
  legs: JourneyLeg[];
  segments: JourneySegment[];
  estimatedDelayMinutes: number;
  reliability: ReliabilityResult;
  warnings: JourneyWarning[];
  meetsRequiredArrival: boolean;
  /** arrival − required arrival, in minutes. Negative means early. */
  minutesRelativeToRequiredArrival: number;
  usedRouteIds: string[];
  walkingEstimates: WalkingEstimate[];
  rankings: Partial<Record<JourneyRecommendationCategory, number>>;
  provenance: Provenance;
}

export interface JourneyOptionSet {
  category: JourneyRecommendationCategory;
  title: string;
  journey: JourneyOption;
  /** Why this journey won this category. */
  reason: string;
  /** Other categories this same journey also ranks first in. */
  alsoWins: JourneyRecommendationCategory[];
}

export interface JourneyPlanResult {
  request: JourneySearchRequest;
  generatedAt: string;
  options: JourneyOption[];
  meetingRequiredArrival: JourneyOption[];
  lateAlternatives: JourneyOption[];
  recommendations: JourneyOptionSet[];
  noRouteReason?: string;
  notes: string[];
  assumptions: string[];
}

export interface JourneyWatch {
  key: string;
  request: JourneySearchRequest;
  topJourneySignature: string;
  topJourneyLabel: string;
  savedAt: string;
}
