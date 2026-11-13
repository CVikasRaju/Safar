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
import { createSeedState } from "../data/seed";

/**
 * Shared canonical reducer (docs/11, docs/13).
 *
 * This store is the single source of truth for both the Student Portal (Member 2)
 * and the Government Control Centre & Fleet Operations (Member 4).
 * Actions update shared canonical state, and both workspaces react immediately.
 */
export type SafarAction =
  | { type: "HYDRATE"; state: SafarState }
  | { type: "SUBMIT_DISRUPTION_REPORT"; report: DisruptionReport; audit: AuditEvent }
  | { type: "SUBMIT_TRAVEL_REQUEST"; request: StudentTravelRequest; audit: AuditEvent }
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

    case "APPLY_LIVE_SCENARIO":
      return action.state;

    case "RESET_SCENARIO":
      return createSeedState();

    default:
      return state;
  }
}
