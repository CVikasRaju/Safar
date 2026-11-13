import type {
  Alert,
  AuditEvent,
  Bus,
  DisruptionReport,
  Incident,
  ReplacementRecommendation,
  SafarState,
  StudentTravelRequest,
  TimetableService,
} from "../domain/types";
import type { EmergencyPlan } from "../domain/types/emergency";
import { createSeedState } from "../data/seed";

/**
 * Shared canonical reducer (docs/11, docs/13).
 *
 * This store is the single source of truth across all modules:
 * - Student Portal (Member 2)
 * - Emergency Intelligence Engine (Member 2)
 * - Intelligence & Incident Workflow (Member 3)
 * - Government Control Centre & Fleet Operations (Member 4)
 * - Shared Foundation & Services (Member 1)
 */
export type SafarAction =
  | { type: "HYDRATE"; state: SafarState }
  | { type: "SUBMIT_DISRUPTION_REPORT"; report: DisruptionReport; audit: AuditEvent }
  | { type: "SUBMIT_TRAVEL_REQUEST"; request: StudentTravelRequest; audit: AuditEvent }
  | { type: "RUN_EMERGENCY_SCENARIO"; plan: EmergencyPlan }
  | { type: "RESET_EMERGENCY_SCENARIO" }
  | {
      type: "SIMULATE_BREAKDOWN";
      incident: Incident;
      recommendation: ReplacementRecommendation;
      updatedBuses: Bus[];
      alerts: Alert[];
      audit: AuditEvent;
    }
  | {
      type: "APPROVE_REPLACEMENT";
      updatedBuses: Bus[];
      updatedRecommendation: ReplacementRecommendation;
      updatedTimetableServices: TimetableService[];
      alerts: Alert[];
      audit: AuditEvent;
    }
  | {
      type: "REJECT_REPLACEMENT";
      updatedRecommendation: ReplacementRecommendation;
      alerts: Alert[];
      audit: AuditEvent;
    }
  | {
      type: "APPLY_LIVE_SCENARIO";
      state: SafarState;
    }
  | {
      type: "VERIFY_DISRUPTION_REPORT";
      reportId: string;
      incident?: Incident;
      status: "VERIFIED" | "REJECTED";
      audit: AuditEvent;
    }
  | { type: "RESET_SCENARIO" };

export function reducer(state: SafarState, action: SafarAction): SafarState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "SUBMIT_DISRUPTION_REPORT":
      return {
        ...state,
        disruptionReports: [action.report, ...state.disruptionReports],
        auditEvents: [action.audit, ...state.auditEvents],
      };

    case "SUBMIT_TRAVEL_REQUEST":
      return {
        ...state,
        travelRequests: [action.request, ...state.travelRequests],
        auditEvents: [action.audit, ...state.auditEvents],
      };

    case "RUN_EMERGENCY_SCENARIO": {
      const alertIds = new Set(action.plan.alerts.map((alert) => alert.id));
      return {
        ...state,
        emergency: action.plan.emergency,
        buses: action.plan.buses,
        alerts: [
          ...action.plan.alerts,
          ...state.alerts.filter((alert) => !alertIds.has(alert.id)),
        ],
        auditEvents: [action.plan.audit, ...state.auditEvents],
      };
    }

    case "RESET_EMERGENCY_SCENARIO": {
      const seed = createSeedState();
      return {
        ...state,
        emergency: undefined,
        buses: seed.buses,
        alerts: state.alerts.filter((alert) => !alert.id.startsWith("alert-emergency-")),
        auditEvents: state.auditEvents.filter((event) => !event.action.startsWith("EMERGENCY_")),
      };
    }

    case "SIMULATE_BREAKDOWN":
      return {
        ...state,
        buses: action.updatedBuses,
        incidents: [action.incident, ...state.incidents],
        replacementRecommendations: [action.recommendation, ...state.replacementRecommendations],
        alerts: [...action.alerts, ...state.alerts],
        auditEvents: [action.audit, ...state.auditEvents],
      };

    case "APPROVE_REPLACEMENT":
      return {
        ...state,
        buses: action.updatedBuses,
        timetableServices: action.updatedTimetableServices,
        replacementRecommendations: [
          action.updatedRecommendation,
          ...state.replacementRecommendations.filter((r) => r.id !== action.updatedRecommendation.id),
        ],
        alerts: [...action.alerts, ...state.alerts],
        auditEvents: [action.audit, ...state.auditEvents],
      };

    case "REJECT_REPLACEMENT":
      return {
        ...state,
        replacementRecommendations: [
          action.updatedRecommendation,
          ...state.replacementRecommendations.filter((r) => r.id !== action.updatedRecommendation.id),
        ],
        alerts: [...action.alerts, ...state.alerts],
        auditEvents: [action.audit, ...state.auditEvents],
      };

    case "VERIFY_DISRUPTION_REPORT": {
      const updatedReports = state.disruptionReports.map((r) =>
        r.id === action.reportId ? { ...r, status: action.status } : r,
      );
      const incidents = action.incident ? [action.incident, ...state.incidents] : state.incidents;
      return {
        ...state,
        disruptionReports: updatedReports,
        incidents,
        auditEvents: [action.audit, ...state.auditEvents],
      };
    }

    case "APPLY_LIVE_SCENARIO":
      return action.state;

    case "RESET_SCENARIO":
      return createSeedState();

    default:
      return state;
  }
}
