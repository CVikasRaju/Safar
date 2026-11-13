import type {
  AuditEvent,
  DisruptionReport,
  SafarState,
  StudentTravelRequest,
} from "../types";
import { REPORT_TYPE_LABELS } from "../constants";
import { isValidHhmm, isValidIsoDate } from "../calculations/time";

/**
 * Student-facing application services.
 *
 * Preconditions are validated here rather than only in disabled buttons
 * (docs/11, docs/13). A student action can never mark a bus unavailable or
 * create a confirmed incident — those transitions belong to the authority
 * workflow (Member 3).
 */

export type ActionResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export interface StudentReportInput {
  routeId: string;
  expectedBusId?: string;
  stopId?: string;
  expectedArrivalTime?: string;
  reportType: string;
  description?: string;
  sessionId: string;
}

export interface TravelRequestInput {
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  groupSize: number;
  sessionId: string;
}

export const MAX_REPORT_DESCRIPTION_LENGTH = 500;

function makeReferenceId(prefix: string, existingCount: number, nowIso: string): string {
  const day = nowIso.slice(0, 10).replace(/-/g, "");
  return `${prefix}-${day}-${String(existingCount + 1).padStart(3, "0")}`;
}

export function validateReportInput(state: SafarState, input: StudentReportInput): string[] {
  const errors: string[] = [];
  const route = state.routes.find((candidate) => candidate.id === input.routeId);
  if (!route) {
    errors.push("Select a route from the demo network.");
  }

  if (!input.reportType || !REPORT_TYPE_LABELS[input.reportType]) {
    errors.push("Select the type of disruption you are reporting.");
  }

  if (input.expectedBusId) {
    const bus = state.buses.find((candidate) => candidate.id === input.expectedBusId);
    if (!bus) {
      errors.push("The selected bus is not part of the demo fleet.");
    } else if (route && bus.assignedRouteId && bus.assignedRouteId !== route.id) {
      errors.push(`${bus.registration} is assigned to ${bus.assignedRouteId}, not ${route.id}.`);
    }
  }

  if (input.stopId) {
    if (!route) {
      errors.push("Select a route before choosing a stop.");
    } else if (!route.stops.includes(input.stopId)) {
      errors.push("Choose a stop that is served by the selected route.");
    }
  }

  if (input.expectedArrivalTime && !isValidHhmm(input.expectedArrivalTime)) {
    errors.push("Expected arrival time must be a valid time such as 08:15.");
  }

  if (input.description && input.description.length > MAX_REPORT_DESCRIPTION_LENGTH) {
    errors.push(`Description must be ${MAX_REPORT_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  return errors;
}

export function prepareDisruptionReport(
  state: SafarState,
  input: StudentReportInput,
  now: Date = new Date(),
): ActionResult<{ report: DisruptionReport; audit: AuditEvent }> {
  const errors = validateReportInput(state, input);
  if (errors.length > 0) return { ok: false, errors };

  const nowIso = now.toISOString();
  const report: DisruptionReport = {
    id: makeReferenceId("RPT", state.disruptionReports.length, nowIso),
    routeId: input.routeId,
    expectedBusId: input.expectedBusId || undefined,
    stopId: input.stopId || undefined,
    expectedArrivalAt: input.expectedArrivalTime || undefined,
    reportType: input.reportType,
    description: input.description?.trim() || undefined,
    submittedAt: nowIso,
    status: "UNVERIFIED",
    provenance: "USER_ENTERED",
    submittedBySessionId: input.sessionId,
  };

  const audit: AuditEvent = {
    id: `audit-${report.id}`,
    actor: "STUDENT_DEMO",
    action: "SUBMIT_DISRUPTION_REPORT",
    at: nowIso,
    recordIds: [report.id],
    reason: "Student submitted an unverified disruption report for authority review.",
  };

  return { ok: true, value: { report, audit } };
}

export function validateTravelRequestInput(state: SafarState, input: TravelRequestInput): string[] {
  const errors: string[] = [];
  if (!state.villages.some((village) => village.id === input.originVillageId)) {
    errors.push("Select your origin village.");
  }
  if (!state.destinations.some((destination) => destination.id === input.destinationId)) {
    errors.push("Select your destination.");
  }
  if (!isValidIsoDate(input.travelDate)) {
    errors.push("Select a valid travel date.");
  }
  if (!isValidHhmm(input.requiredArrivalTime)) {
    errors.push("Required arrival time must be a valid time such as 09:00.");
  }
  if (!Number.isInteger(input.groupSize) || input.groupSize < 1 || input.groupSize > 20) {
    errors.push("Group size must be a whole number between 1 and 20.");
  }
  return errors;
}

export function prepareTravelRequest(
  state: SafarState,
  input: TravelRequestInput,
  now: Date = new Date(),
): ActionResult<{ request: StudentTravelRequest; audit: AuditEvent }> {
  const errors = validateTravelRequestInput(state, input);
  if (errors.length > 0) return { ok: false, errors };

  const nowIso = now.toISOString();
  const request: StudentTravelRequest = {
    id: makeReferenceId("TRV", state.travelRequests.length, nowIso),
    originVillageId: input.originVillageId,
    destinationId: input.destinationId,
    travelDate: input.travelDate,
    requiredArrivalTime: input.requiredArrivalTime,
    groupSize: input.groupSize,
    submittedAt: nowIso,
    provenance: "USER_ENTERED",
    submittedBySessionId: input.sessionId,
  };

  const audit: AuditEvent = {
    id: `audit-${request.id}`,
    actor: "STUDENT_DEMO",
    action: "SUBMIT_TRAVEL_REQUEST",
    at: nowIso,
    recordIds: [request.id],
    reason: "Student submitted an intended journey for aggregated demand analysis.",
  };

  return { ok: true, value: { request, audit } };
}
