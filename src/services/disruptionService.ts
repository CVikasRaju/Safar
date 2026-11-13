import type {
  DisruptionReport,
  Incident,
  IncidentType,
  ReplacementRecommendation,
  ReportType,
  SafarState,
  ServiceResult,
  Severity,
} from "../domain/types";
import {
  CONFIRMED_INCIDENT_LABEL,
  NO_FEASIBLE_REPLACEMENT_LABEL,
  REPORT_TYPE_LABELS,
  UNVERIFIED_REPORT_LABEL,
  VERIFIED_REPORT_NOT_CONFIRMED_LABEL,
} from "../domain/constants";
import { isValidTime, nextId } from "../domain/time";
import { findBus, findRoute, findStop, getNetworkFromState } from "../domain/network";
import { getDemandSummary } from "./demandService";
import { generateReplacementRecommendation } from "./replacementService";
import { getAffectedJourneysForRoute } from "./journeyService";
import {
  appendAlert,
  appendAudit,
  fail,
  finalize,
  isNonEmptyString,
  ok,
  timestamp,
  type ServiceOptions,
} from "./shared";

const REPORT_TYPES: ReportType[] = [
  "BUS_NOT_ARRIVED",
  "BUS_BREAKDOWN",
  "MECHANICAL_FAILURE",
  "DRIVER_REPORTED_ISSUE",
  "UNEXPECTED_CANCELLATION",
  "ROAD_BLOCKAGE",
  "ROUTE_DIVERSION",
  "INSUFFICIENT_CAPACITY",
  "OTHER",
];

const SEVERITIES: Severity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

/** Confirmed vehicle failure that takes the bus out of service. */
const BUS_FAILURE_TYPES: IncidentType[] = [
  "BUS_BREAKDOWN",
  "MECHANICAL_FAILURE",
  "DRIVER_REPORTED_ISSUE",
  "UNEXPECTED_CANCELLATION",
];

export interface SubmitDisruptionReportInput {
  routeId: string;
  expectedBusId?: string;
  stopId?: string;
  /** "HH:MM" — combined with the submission date. */
  expectedArrivalTime?: string;
  /** ISO date-time, preferred over expectedArrivalTime when provided. */
  expectedArrivalAt?: string;
  reportType: ReportType;
  description?: string;
  provenance?: "USER_ENTERED" | "SIMULATED";
}

export interface ReportActionResult {
  report: DisruptionReport;
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Student report submission.
 *
 * This creates an UNVERIFIED report only. It never marks a bus unavailable,
 * creates a confirmed incident or allocates a replacement.
 */
export function submitDisruptionReport(
  input: SubmitDisruptionReportInput,
  state: SafarState,
  options?: ServiceOptions,
): ServiceResult<ReportActionResult> {
  const network = getNetworkFromState(state);
  const route = findRoute(network, input.routeId);
  if (!route) {
    return fail(state, "REPORT_INVALID", `Unknown route "${input.routeId}".`);
  }
  if (!REPORT_TYPES.includes(input.reportType)) {
    return fail(state, "REPORT_INVALID", `Unknown report type "${input.reportType}".`);
  }
  if (input.expectedBusId && !findBus(state.buses, input.expectedBusId)) {
    return fail(state, "REPORT_INVALID", `Unknown bus "${input.expectedBusId}".`);
  }
  if (input.stopId) {
    if (!findStop(network, input.stopId)) {
      return fail(state, "REPORT_INVALID", `Unknown stop "${input.stopId}".`);
    }
    if (!route.stopIds.includes(input.stopId)) {
      return fail(
        state,
        "REPORT_INVALID",
        `Stop "${input.stopId}" is not served by route ${route.id}.`,
      );
    }
  }
  if (input.description && input.description.length > 500) {
    return fail(state, "REPORT_INVALID", "Description must be at most 500 characters.");
  }

  let expectedArrivalAt = input.expectedArrivalAt;
  if (!expectedArrivalAt && input.expectedArrivalTime) {
    if (!isValidTime(input.expectedArrivalTime)) {
      return fail(state, "REPORT_INVALID", "Expected arrival time must be a valid HH:MM time.");
    }
    const now = timestamp(options);
    expectedArrivalAt = `${now.slice(0, 10)}T${input.expectedArrivalTime}:00`;
  }
  if (expectedArrivalAt && !ISO_DATE_TIME.test(expectedArrivalAt)) {
    return fail(
      state,
      "REPORT_INVALID",
      "Expected arrival must be an ISO date-time (YYYY-MM-DDTHH:MM:00) or an HH:MM time.",
    );
  }

  const now = timestamp(options);
  const id = nextId(
    "rpt",
    state.reports.map((candidate) => candidate.id),
  );
  const sequence = id.split("-")[1]?.padStart(4, "0") ?? "0001";
  const report: DisruptionReport = {
    id,
    reference: `SAFAR-RPT-${sequence}`,
    routeId: route.id,
    expectedBusId: input.expectedBusId,
    stopId: input.stopId,
    expectedArrivalAt,
    reportType: input.reportType,
    description: input.description?.trim(),
    submittedAt: now,
    status: "UNVERIFIED",
    provenance: input.provenance ?? "USER_ENTERED",
  };

  let nextState: SafarState = { ...state, reports: [...state.reports, report] };
  nextState = appendAlert(nextState, {
    audience: "AUTHORITY",
    severity: "WARNING",
    category: "REPORT_STATUS",
    title: UNVERIFIED_REPORT_LABEL,
    message: `${report.reference}: ${REPORT_TYPE_LABELS[report.reportType]} reported on ${route.id}${input.stopId ? ` at ${findStop(network, input.stopId)?.name}` : ""}. Awaiting authority review. No fleet status has changed.`,
    routeId: route.id,
    provenance: "USER_ENTERED",
    createdAt: now,
  });
  nextState = appendAlert(nextState, {
    audience: "STUDENT",
    severity: "INFO",
    category: "REPORT_STATUS",
    title: "Report received — unverified",
    message: `Reference ${report.reference}. The report is UNVERIFIED. An authority must review it, and a separate action is required to confirm an incident. Bus status has not changed.`,
    routeId: route.id,
    provenance: "USER_ENTERED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: "STUDENT_DEMO",
    action: "SUBMIT_DISRUPTION_REPORT",
    entityType: "DisruptionReport",
    entityIds: [report.id],
    at: now,
    details: {
      routeId: route.id,
      reportType: report.reportType,
      status: report.status,
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, { report });
}

export type ReviewDecision = "VERIFY" | "REJECT" | "MARK_DUPLICATE";

export interface ReviewOptions extends ServiceOptions {
  reason?: string;
  reviewer?: string;
}

/**
 * Authority review of a report. Status changes to VERIFIED / REJECTED /
 * DUPLICATE. Verification does not confirm an incident.
 */
export function verifyDisruption(
  reportId: string,
  decision: ReviewDecision,
  state: SafarState,
  options: ReviewOptions = {},
): ServiceResult<ReportActionResult> {
  const report = state.reports.find((candidate) => candidate.id === reportId);
  if (!report) return fail(state, "REPORT_NOT_FOUND", `Unknown report "${reportId}".`);
  if (report.status !== "UNVERIFIED") {
    return fail(
      state,
      "REPORT_NOT_REVIEWABLE",
      `Report ${report.reference} is already ${report.status.toLowerCase()} and cannot be reviewed again.`,
    );
  }
  if ((decision === "REJECT" || decision === "MARK_DUPLICATE") && !isNonEmptyString(options.reason)) {
    return fail(state, "REVIEW_REASON_REQUIRED", "A reason is required to reject or mark a report as duplicate.");
  }
  if (options.reason && options.reason.length > 400) {
    return fail(state, "REVIEW_REASON_INVALID", "Review reason must be at most 400 characters.");
  }

  const status =
    decision === "VERIFY" ? "VERIFIED" : decision === "REJECT" ? "REJECTED" : "DUPLICATE";
  const now = timestamp(options);
  const reviewed: DisruptionReport = {
    ...report,
    status,
    reviewReason: options.reason?.trim(),
    reviewedAt: now,
    reviewedBy: options.reviewer ?? "AUTHORITY",
  };

  let nextState: SafarState = {
    ...state,
    reports: state.reports.map((candidate) =>
      candidate.id === reportId ? reviewed : candidate,
    ),
  };
  nextState = appendAlert(nextState, {
    audience: "STUDENT",
    severity: decision === "VERIFY" ? "SUCCESS" : "INFO",
    category: "REPORT_STATUS",
    title:
      decision === "VERIFY"
        ? VERIFIED_REPORT_NOT_CONFIRMED_LABEL
        : decision === "REJECT"
          ? "Report rejected by authority"
          : "Report marked as duplicate",
    message:
      decision === "VERIFY"
        ? `${report.reference} was reviewed and marked as a credible report. This does NOT confirm an incident; a separate authority confirmation is required.`
        : `${report.reference} was ${decision === "REJECT" ? "rejected" : "marked as a duplicate"}. Reason: ${options.reason}`,
    routeId: report.routeId,
    provenance: "VERIFIED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: decision === "VERIFY" ? "VERIFY_REPORT" : decision === "REJECT" ? "REJECT_REPORT" : "MARK_REPORT_DUPLICATE",
    entityType: "DisruptionReport",
    entityIds: [report.id],
    at: now,
    reason: options.reason,
    details: { from: "UNVERIFIED", to: status },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, { report: reviewed });
}

export interface ConfirmIncidentInput {
  type: IncidentType;
  busId?: string;
  routeId?: string;
  affectedStopId?: string;
  occurredAt?: string;
  severity?: Severity;
  expectedResolution?: string;
  description?: string;
  relatedReportIds?: string[];
  confirmedBy?: string;
  /** Marks provenance SIMULATED for the scripted breakdown demo. */
  simulated?: boolean;
}

export interface ConfirmIncidentResult {
  incident: Incident;
  affectedRouteId?: string;
  affectedPassengers: number;
  affectedJourneyCount: number;
  recommendation?: ReplacementRecommendation;
  warning?: string;
}

/**
 * Authority incident confirmation. This is the only path that applies
 * operational fleet effects (a confirmed bus failure marks the bus unavailable).
 */
export function confirmIncident(
  input: ConfirmIncidentInput,
  state: SafarState,
  options?: ServiceOptions,
): ServiceResult<ConfirmIncidentResult> {
  if (!REPORT_TYPES.includes(input.type)) {
    return fail(state, "INCIDENT_INVALID", `Unknown incident type "${input.type}".`);
  }
  if (input.severity && !SEVERITIES.includes(input.severity)) {
    return fail(state, "INCIDENT_INVALID", `Unknown severity "${input.severity}".`);
  }
  if (input.description && input.description.length > 500) {
    return fail(state, "INCIDENT_INVALID", "Description must be at most 500 characters.");
  }

  const network = getNetworkFromState(state);
  const now = timestamp(options);

  let busId = input.busId;
  let bus = busId ? findBus(state.buses, busId) : undefined;
  if (busId && !bus) {
    return fail(state, "INCIDENT_INVALID", `Unknown bus "${busId}".`);
  }

  let routeId = input.routeId ?? bus?.assignedRouteId ?? undefined;
  if (routeId && !findRoute(network, routeId)) {
    return fail(state, "INCIDENT_INVALID", `Unknown route "${routeId}".`);
  }
  if (bus && bus.assignedRouteId && routeId && bus.assignedRouteId !== routeId) {
    return fail(
      state,
      "INCIDENT_INVALID",
      `${bus.registration} is assigned to ${bus.assignedRouteId}, not ${routeId}.`,
    );
  }
  if (!routeId && !bus) {
    return fail(
      state,
      "INCIDENT_INVALID",
      "Provide a bus, a route, or both so affected services can be identified.",
    );
  }

  if (input.affectedStopId) {
    const stop = findStop(network, input.affectedStopId);
    if (!stop) {
      return fail(state, "INCIDENT_INVALID", `Unknown stop "${input.affectedStopId}".`);
    }
    const route = routeId ? findRoute(network, routeId) : undefined;
    if (route && !route.stopIds.includes(stop.id)) {
      return fail(
        state,
        "INCIDENT_INVALID",
        `Stop "${stop.name}" is not served by route ${route.id}.`,
      );
    }
  }

  const occurredAt = input.occurredAt ?? now;
  if (!ISO_DATE_TIME.test(occurredAt)) {
    return fail(state, "INCIDENT_INVALID", "Incident time must be an ISO date-time.");
  }

  const relatedReportIds = input.relatedReportIds ?? [];
  for (const reportId of relatedReportIds) {
    const report = state.reports.find((candidate) => candidate.id === reportId);
    if (!report) {
      return fail(state, "INCIDENT_INVALID", `Unknown related report "${reportId}".`);
    }
    if (report.status === "REJECTED" || report.status === "DUPLICATE") {
      return fail(
        state,
        "INCIDENT_INVALID",
        `Report ${report.reference} was ${report.status.toLowerCase()} and cannot be linked to a confirmed incident.`,
      );
    }
  }

  const isBusFailure = BUS_FAILURE_TYPES.includes(input.type);
  if (isBusFailure && !bus) {
    return fail(
      state,
      "INCIDENT_INVALID",
      "A confirmed bus failure requires the affected bus registration.",
    );
  }
  if (bus && isBusFailure) {
    if (bus.status === "UNAVAILABLE") {
      return fail(
        state,
        "BUS_ALREADY_UNAVAILABLE",
        `${bus.registration} is already unavailable. Resolve the existing incident before confirming another failure.`,
      );
    }
    if (bus.status === "MAINTENANCE") {
      return fail(
        state,
        "BUS_IN_MAINTENANCE",
        `${bus.registration} is in maintenance and cannot be confirmed as an operational failure.`,
      );
    }
    const duplicate = state.incidents.find(
      (incident) =>
        incident.status === "ACTIVE" &&
        incident.busId === bus?.id &&
        BUS_FAILURE_TYPES.includes(incident.type),
    );
    if (duplicate) {
      return fail(
        state,
        "DUPLICATE_ACTIVE_INCIDENT",
        `${bus.registration} already has an active confirmed incident (${duplicate.id}).`,
      );
    }
  }

  // Affected journeys are measured against the timetable before the fleet changes.
  const affectedJourneyCount = routeId
    ? getAffectedJourneysForRoute(routeId, state).length
    : 0;

  const incidentId = nextId(
    "inc",
    state.incidents.map((candidate) => candidate.id),
  );
  const incident: Incident = {
    id: incidentId,
    type: input.type,
    status: "ACTIVE",
    routeId: routeId ?? undefined,
    busId: bus?.id,
    affectedStopId: input.affectedStopId,
    occurredAt,
    severity:
      input.severity ?? (isBusFailure ? "HIGH" : "MODERATE"),
    expectedResolution: input.expectedResolution?.trim(),
    description: input.description?.trim(),
    relatedReportIds,
    confirmedBy: input.confirmedBy ?? "AUTHORITY",
    confirmedAt: now,
    provenance: input.simulated ? "SIMULATED" : "VERIFIED",
  };

  let nextState: SafarState = {
    ...state,
    incidents: [...state.incidents, incident],
  };

  if (bus && isBusFailure) {
    nextState = {
      ...nextState,
      buses: nextState.buses.map((candidate) =>
        candidate.id === bus?.id
          ? {
              ...candidate,
              status: "UNAVAILABLE",
              commitments: [`incident:${incidentId}`],
            }
          : candidate,
      ),
    };
  }

  if (relatedReportIds.length > 0) {
    nextState = {
      ...nextState,
      reports: nextState.reports.map((report) =>
        relatedReportIds.includes(report.id)
          ? { ...report, relatedIncidentId: incidentId }
          : report,
      ),
    };
  }

  let recommendation: ReplacementRecommendation | undefined;
  let warning: string | undefined;
  if (isBusFailure && routeId) {
    const generated = generateReplacementRecommendation(incidentId, nextState);
    if (generated.ok) {
      recommendation = generated.data.recommendation;
      nextState = generated.state;
    } else {
      warning = generated.error;
    }
  }

  const demand = getDemandSummary(nextState);
  const routeDemand = demand.routes.find((route) => route.routeId === routeId);
  const affectedPassengers = bus
    ? Math.min(routeDemand?.expectedStudents ?? bus.capacity, bus.capacity)
    : (routeDemand?.expectedStudents ?? 0);

  const replacementMessage = recommendation
    ? recommendation.status === "PENDING"
      ? " A replacement is recommended and awaiting authority approval."
      : recommendation.status === "NO_FEASIBLE_CANDIDATE"
        ? ` ${NO_FEASIBLE_REPLACEMENT_LABEL}.`
        : ""
    : "";

  nextState = appendAlert(nextState, {
    audience: "BOTH",
    severity: incident.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
    category: "INCIDENT",
    title: CONFIRMED_INCIDENT_LABEL,
    message: `${input.type.replaceAll("_", " ").toLowerCase()} confirmed${bus ? ` for ${bus.registration}` : ""}${routeId ? ` on ${routeId}` : ""}. About ${affectedPassengers} student journey(s) may be affected.${replacementMessage}`,
    routeId,
    incidentId,
    recommendationId: recommendation?.id,
    provenance: input.simulated ? "SIMULATED" : "VERIFIED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: input.simulated ? "SYSTEM" : "AUTHORITY",
    action: "CONFIRM_INCIDENT",
    entityType: "Incident",
    entityIds: [incidentId],
    at: now,
    details: {
      type: incident.type,
      busId: incident.busId ?? null,
      routeId: incident.routeId ?? null,
      affectedPassengers,
      simulated: Boolean(input.simulated),
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    incident,
    affectedRouteId: routeId,
    affectedPassengers,
    affectedJourneyCount,
    recommendation,
    warning,
  });
}

export interface CloseIncidentInput extends ServiceOptions {
  resolution: string;
  /** Explicitly return the failed bus to service; defaults to leaving it unavailable. */
  restoreBus?: boolean;
  closedBy?: string;
}

export interface CloseIncidentResult {
  incident: Incident;
  restoredBusId?: string;
  releasedReplacementBusId?: string;
}

/** Closes an incident with a recorded resolution. Never silently restores the failed bus. */
export function closeIncident(
  incidentId: string,
  input: CloseIncidentInput,
  state: SafarState,
): ServiceResult<CloseIncidentResult> {
  const incident = state.incidents.find((candidate) => candidate.id === incidentId);
  if (!incident) return fail(state, "INCIDENT_NOT_FOUND", `Unknown incident "${incidentId}".`);
  if (incident.status !== "ACTIVE") {
    return fail(
      state,
      "INCIDENT_NOT_ACTIVE",
      `Incident "${incidentId}" is already ${incident.status.toLowerCase()}.`,
    );
  }
  if (!isNonEmptyString(input.resolution) || input.resolution.length < 3) {
    return fail(state, "RESOLUTION_REQUIRED", "A resolution note of at least 3 characters is required.");
  }

  const now = timestamp(input);
  const closed: Incident = {
    ...incident,
    status: "CLOSED",
    closedAt: now,
    resolutionNote: input.resolution.trim(),
  };

  let buses = state.buses;
  let releasedReplacementBusId: string | undefined;
  if (incident.replacementBusId) {
    const replacement = buses.find((bus) => bus.id === incident.replacementBusId);
    if (replacement && replacement.status === "REPLACEMENT_ASSIGNED") {
      buses = buses.map((bus) =>
        bus.id === replacement.id
          ? {
              ...bus,
              status: "AVAILABLE" as const,
              assignedRouteId: null,
              commitments: bus.commitments.filter(
                (commitment) =>
                  commitment !== `incident:${incident.id}` &&
                  !commitment.startsWith("route:"),
              ),
            }
          : bus,
      );
      releasedReplacementBusId = replacement.id;
    }
  }
  if (input.restoreBus && incident.busId) {
    const bus = buses.find((candidate) => candidate.id === incident.busId);
    const otherActive = state.incidents.some(
      (candidate) =>
        candidate.id !== incident.id &&
        candidate.status === "ACTIVE" &&
        candidate.busId === incident.busId,
    );
    if (bus && bus.status === "UNAVAILABLE" && !otherActive) {
      buses = buses.map((candidate) =>
        candidate.id === bus.id
          ? {
              ...candidate,
              status: candidate.assignedRouteId ? "OPERATING" : "AVAILABLE",
              commitments: candidate.assignedRouteId
                ? [`route:${candidate.assignedRouteId}`]
                : [],
            }
          : candidate,
      );
    }
  }

  let nextState: SafarState = {
    ...state,
    buses,
    incidents: state.incidents.map((candidate) =>
      candidate.id === incidentId ? closed : candidate,
    ),
  };
  nextState = appendAlert(nextState, {
    audience: "BOTH",
    severity: "INFO",
    category: "INCIDENT",
    title: "Incident closed",
    message: `Incident ${incident.id} was closed. ${closed.resolutionNote}${input.restoreBus ? " The failed bus was explicitly returned to service." : " The failed bus remains unavailable until separately resolved."}`,
    routeId: incident.routeId,
    incidentId,
    provenance: "VERIFIED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "CLOSE_INCIDENT",
    entityType: "Incident",
    entityIds: [incidentId],
    at: now,
    reason: closed.resolutionNote,
    details: {
      restoreBus: Boolean(input.restoreBus),
      closedBy: input.closedBy ?? "AUTHORITY",
      releasedReplacementBusId: releasedReplacementBusId ?? null,
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    incident: closed,
    restoredBusId: input.restoreBus ? incident.busId : undefined,
    releasedReplacementBusId,
  });
}

export function getUnverifiedReports(state: SafarState): DisruptionReport[] {
  return state.reports.filter((report) => report.status === "UNVERIFIED");
}

export function getReportById(state: SafarState, reportId: string): DisruptionReport | undefined {
  return state.reports.find(
    (report) => report.id === reportId || report.reference === reportId,
  );
}

/** Alias aligned with the master prompt's required domain function name. */
export const processDisruptionReport = submitDisruptionReport;

export function getIncidentById(state: SafarState, incidentId: string): Incident | undefined {
  return state.incidents.find((incident) => incident.id === incidentId);
}

export function getActiveIncidents(state: SafarState): Incident[] {
  return state.incidents.filter((incident) => incident.status === "ACTIVE");
}

export { REPORT_TYPES, BUS_FAILURE_TYPES };

export const disruptionService = {
  submitDisruptionReport,
  processDisruptionReport,
  verifyDisruption,
  confirmIncident,
  closeIncident,
  getUnverifiedReports,
  getReportById,
  getIncidentById,
  getActiveIncidents,
};
