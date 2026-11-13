# 13 — Canonical Data Models and Service Boundaries

Use TypeScript interfaces or equivalent typed schemas. Names can vary, but concepts and state transitions must remain consistent.

## Core types (illustrative)

```ts
type Provenance =
  | "DEMO" | "SIMULATED" | "USER_ENTERED"
  | "CALCULATED" | "AI_GENERATED" | "VERIFIED";

type BusStatus =
  | "OPERATING" | "AVAILABLE" | "UNAVAILABLE"
  | "MAINTENANCE" | "REPLACEMENT_ASSIGNED";

type ReportStatus =
  | "UNVERIFIED" | "VERIFIED" | "REJECTED"
  | "DUPLICATE" | "CLOSED";

type IncidentStatus = "ACTIVE" | "RESOLVED" | "CLOSED";

interface DisruptionReport {
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
}

interface Incident {
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

interface Bus {
  id: string;
  registration: string;
  assignedRouteId?: string;
  capacity: number;
  occupiedSeats: number;
  status: BusStatus;
  lastKnownLocationLabel: string;
  estimatedResponseMinutes?: number;
  commitments: string[];
}

interface ReplacementRecommendation {
  id: string;
  incidentId: string;
  candidateBusIds: string[];
  rankedCandidates: Array<{
    busId: string;
    capacityScore: number;
    compatibilityScore: number;
    responseTimeScore: number;
    availabilityScore: number;
    finalScore: number;
    eligible: boolean;
    explanation: string;
  }>;
  recommendedBusId?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NO_FEASIBLE_CANDIDATE";
  decisionReason?: string;
}

interface StudentTravelRequest {
  id: string;
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  groupSize: number;
  submittedAt: string;
  provenance: "USER_ENTERED" | "SIMULATED";
}
```

## Additional entities
Village, Destination, Stop, Route, TimetableService, TimetableStopTime, Event, EventRouteImpact, JourneySearchRequest, JourneyOption, JourneySegment, Alert, ScenarioState, AuditEvent.

## Important relationships
- Route references ordered Stop IDs.
- Timetable references valid Route/Bus/Stop IDs.
- Bus assignedRouteId references a valid Route.
- Report may optionally reference a bus/route/stop.
- Incident may link one or more reports.
- Replacement recommendation references one active incident and candidate buses.
- Approved replacement references one bus and one incident.
- Journey segments reference valid service/stop IDs.

## Service boundaries
Expose typed functions/use cases for submit report, review report, confirm incident, calculate affected journeys, rank replacements, approve/reject replacement, create/update/delete event, calculate demand, and run/reset scenario.

## Validation
Validate dates, times, IDs, capacities, status transitions, and foreign-key references. Reject impossible or stale operations with a visible error.
