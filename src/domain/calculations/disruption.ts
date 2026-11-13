// SAFAR — Disruption Reports, Incident Verification & Confirmation (Member 3)
//
// Workflow contract (docs/06_IMMEDIATE_DISRUPTION_RESPONSE.md):
//   UNVERIFIED student report  ≠  VERIFIED report  ≠  CONFIRMED incident
// A student report never changes fleet status. Only an explicit authority
// CONFIRM_INCIDENT action creates an operational incident.

import type {
  DisruptionReport,
  ReportStatus,
  ReportType,
  Incident,
  IncidentType,
  IncidentSeverity,
  Route,
  Stop,
  TimetableService,
  Bus,
  Alert,
  AppState,
} from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReportInput {
  routeId: string;
  expectedBusId?: string;
  stopId?: string;
  expectedArrivalAt?: string;
  reportType: ReportType;
  description?: string;
}

export interface IncidentInput {
  type: IncidentType;
  routeId?: string;
  busId?: string;
  affectedStopId?: string;
  severity: IncidentSeverity;
  expectedResolution?: string;
  description?: string;
  relatedReportIds: string[];
  estimatedAffectedPassengers?: number;
}

export const REPORT_TYPES: ReportType[] = [
  'BUS_NOT_ARRIVED',
  'BUS_BREAKDOWN',
  'MECHANICAL_FAILURE',
  'DRIVER_ISSUE',
  'CANCELLATION',
  'ROAD_BLOCKAGE',
  'ROUTE_DIVERSION',
  'CAPACITY_SHORTAGE',
  'CUSTOM',
];

export const INCIDENT_TYPES: IncidentType[] = [
  'BUS_BREAKDOWN',
  'MECHANICAL_FAILURE',
  'DRIVER_ISSUE',
  'ROAD_BLOCKAGE',
  'ROUTE_DIVERSION',
  'CANCELLATION',
  'CAPACITY_SHORTAGE',
  'CUSTOM',
];

export const INCIDENT_SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const BREAKDOWN_TYPES: IncidentType[] = ['BUS_BREAKDOWN', 'MECHANICAL_FAILURE'];

function isTime(value: string | undefined): boolean {
  if (!value) return false;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59;
}

/** A confirmed bus failure is the only incident type that marks a bus unavailable. */
export function incidentMarksBusUnavailable(type: IncidentType): boolean {
  return BREAKDOWN_TYPES.includes(type);
}

// ─── Validation ───────────────────────────────────────────────────────────────
export function validateReportInput(
  input: ReportInput,
  state: AppState,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const route = state.routes.find(item => item.id === input.routeId);
  if (!route) errors.push('Select a valid seeded route.');

  if (!REPORT_TYPES.includes(input.reportType)) {
    errors.push('Select a supported report type.');
  }

  const stop = input.stopId
    ? state.stops.find(item => item.id === input.stopId)
    : undefined;
  if (input.stopId && !stop) errors.push('The selected stop does not exist.');
  if (stop && route && !(route.stopIds ?? route.stops ?? []).includes(stop.id)) {
    errors.push(`Stop "${stop.name}" is not on route ${route.id}.`);
  }

  const bus = input.expectedBusId
    ? state.buses.find(item => item.id === input.expectedBusId)
    : undefined;
  if (input.expectedBusId && !bus) errors.push('The selected bus does not exist.');
  if (bus && route && bus.assignedRouteId && bus.assignedRouteId !== route.id) {
    warnings.push(
      `Bus ${bus.registration} is currently assigned to ${bus.assignedRouteId}, not ${route.id}. The report is still accepted as an unverified student observation.`,
    );
  }

  if (input.expectedArrivalAt && !isTime(input.expectedArrivalAt)) {
    errors.push('Expected arrival time must be a valid HH:MM time.');
  }

  if (input.description && input.description.length > 500) {
    errors.push('Description must be 500 characters or fewer.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateIncidentConfirmation(
  input: IncidentInput,
  state: AppState,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!INCIDENT_TYPES.includes(input.type)) {
    errors.push('Select a supported incident type.');
  }
  if (!INCIDENT_SEVERITIES.includes(input.severity)) {
    errors.push('Select a valid severity.');
  }
  if (!input.routeId && !input.busId) {
    errors.push('An incident must reference at least a route or a bus.');
  }

  const route = input.routeId
    ? state.routes.find(item => item.id === input.routeId)
    : undefined;
  if (input.routeId && !route) errors.push('The selected route does not exist.');

  const bus = input.busId ? state.buses.find(item => item.id === input.busId) : undefined;
  if (input.busId && !bus) errors.push('The selected bus does not exist.');
  if (bus && route && bus.assignedRouteId && bus.assignedRouteId !== route.id) {
    warnings.push(
      `Bus ${bus.registration} is assigned to ${bus.assignedRouteId}; confirm that dispatching it to ${route.id} is intended.`,
    );
  }

  if (input.affectedStopId) {
    const stop: Stop | undefined = state.stops.find(item => item.id === input.affectedStopId);
    if (!stop) errors.push('The affected stop does not exist.');
    else if (route && !(route.stopIds ?? route.stops ?? []).includes(stop.id)) {
      errors.push(`Stop "${stop.name}" is not on route ${route.id}.`);
    }
  }

  if (BREAKDOWN_TYPES.includes(input.type) && !input.busId) {
    errors.push('A confirmed bus breakdown must reference the affected bus.');
  }

  if (input.description && input.description.length > 500) {
    errors.push('Description must be 500 characters or fewer.');
  }
  if (input.expectedResolution && input.expectedResolution.length > 200) {
    errors.push('Expected resolution must be 200 characters or fewer.');
  }

  for (const reportId of input.relatedReportIds) {
    const report = state.disruptionReports.find(item => item.id === reportId);
    if (!report) {
      errors.push(`Report ${reportId} does not exist.`);
      continue;
    }
    if (report.status !== 'VERIFIED') {
      errors.push(
        `Report ${reportId} is ${report.status}. Only VERIFIED reports can be linked to a confirmed incident.`,
      );
    }
    if (report.relatedIncidentId) {
      warnings.push(`Report ${reportId} is already linked to incident ${report.relatedIncidentId}.`);
    }
  }

  if (bus && bus.status === 'UNAVAILABLE' && incidentMarksBusUnavailable(input.type)) {
    warnings.push(`Bus ${bus.registration} is already marked unavailable.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Report processing ────────────────────────────────────────────────────────
function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Creates an UNVERIFIED student report only. Callers must not change fleet or
 * incident state from this function.
 */
export function processDisruptionReport(input: ReportInput): DisruptionReport {
  return {
    id: makeId('RPT'),
    routeId: input.routeId,
    expectedBusId: input.expectedBusId,
    stopId: input.stopId,
    expectedArrivalAt: input.expectedArrivalAt,
    reportType: input.reportType,
    description: input.description?.trim() || undefined,
    submittedAt: new Date().toISOString(),
    status: 'UNVERIFIED',
    provenance: 'USER_ENTERED',
  };
}

export function canReviewReport(report: DisruptionReport): {
  allowed: boolean;
  reason?: string;
} {
  if (report.status === 'UNVERIFIED') return { allowed: true };
  return {
    allowed: false,
    reason: `Report ${report.id} is already ${report.status}; review outcomes cannot be applied twice.`,
  };
}

/**
 * Applies an authority review outcome. A VERIFIED report is a credible report,
 * NOT a confirmed incident. Rejections/duplicates require a reason in the UI.
 */
export function verifyDisruption(
  report: DisruptionReport,
  decision: { action: 'VERIFY' | 'REJECT' | 'DUPLICATE'; reason?: string; reviewerRole?: string },
): DisruptionReport {
  if (!canReviewReport(report).allowed) return report;

  const statusMap: Record<'VERIFY' | 'REJECT' | 'DUPLICATE', ReportStatus> = {
    VERIFY: 'VERIFIED',
    REJECT: 'REJECTED',
    DUPLICATE: 'DUPLICATE',
  };

  return {
    ...report,
    status: statusMap[decision.action],
    reviewReason: decision.reason?.trim() || undefined,
    reviewedAt: new Date().toISOString(),
    reviewedByRole: decision.reviewerRole ?? 'AUTHORITY',
  };
}

// ─── Route / impact identification ────────────────────────────────────────────
export function identifyAffectedRoutes(
  busId: string | undefined,
  buses: Bus[],
  routes: Route[],
  _timetables: TimetableService[] = [],
): Route[] {
  if (!busId) return [];
  const bus = buses.find(item => item.id === busId);
  if (!bus?.assignedRouteId) return [];
  const route = routes.find(item => item.id === bus.assignedRouteId);
  return route ? [route] : [];
}

/**
 * Illustrative passenger impact for a confirmed route incident: occupied seats
 * on buses currently assigned to the route. Awaiting students are unknown and
 * are not invented.
 */
export function estimateAffectedPassengers(routeId: string, buses: Bus[]): number {
  if (!routeId) return 0;
  return buses
    .filter(bus => bus.assignedRouteId === routeId)
    .reduce((sum, bus) => sum + Math.max(0, bus.occupiedSeats), 0);
}

/** Count of timetabled services on a route (optionally filtered to a date's weekday). */
export function estimateAffectedJourneyCount(
  routeId: string,
  timetables: TimetableService[],
  travelDate?: string,
): number {
  const services = timetables.filter(service => service.routeId === routeId);
  if (!travelDate) return services.length;
  const parsed = new Date(travelDate);
  if (Number.isNaN(parsed.getTime())) return services.length;
  const dayIndex = parsed.getDay();
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayName = dayNames[dayIndex];
  return services.filter(service =>
    (service.operatingDays as (number | string)[]).includes(dayIndex) ||
    (service.operatingDays as (number | string)[]).includes(dayName)
  ).length;
}

// ─── Incident construction ────────────────────────────────────────────────────
export function buildIncident(input: IncidentInput): Incident {
  return {
    id: makeId('INC'),
    type: input.type,
    status: 'ACTIVE',
    routeId: input.routeId,
    busId: input.busId,
    affectedStopId: input.affectedStopId,
    occurredAt: new Date().toISOString(),
    severity: input.severity,
    expectedResolution: input.expectedResolution?.trim() || undefined,
    description: input.description?.trim() || undefined,
    relatedReportIds: [...new Set(input.relatedReportIds)],
    affectedJourneyIds: [],
    estimatedAffectedPassengers: Math.max(0, input.estimatedAffectedPassengers ?? 0),
    provenance: 'SIMULATED',
  };
}

export function buildIncidentAlert(incident: Incident, routeName?: string): Alert {
  const severityLabel = incident.severity === 'CRITICAL' || incident.severity === 'HIGH'
    ? 'CRITICAL'
    : 'WARNING';

  return {
    id: makeId('ALT'),
    audience: 'ALL',
    type: 'ROUTE_DISRUPTION',
    severity: severityLabel,
    title: `CONFIRMED INCIDENT — ${incident.type.replace(/_/g, ' ')}`,
    body:
      `Incident confirmed on ${routeName ?? incident.routeId ?? 'the network'}. ` +
      `${incident.description ?? ''} ` +
      `Illustrative estimate: ${incident.estimatedAffectedPassengers ?? 0} passenger(s) affected. ` +
      `This is a confirmed authority record, not an unverified student report.`,
    createdAt: new Date().toISOString(),
    relatedRouteIds: incident.routeId ? [incident.routeId] : [],
    relatedIncidentId: incident.id,
    provenance: 'SIMULATED',
  };
}
