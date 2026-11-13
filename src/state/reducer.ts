import type { AuditEvent, DisruptionReport, SafarState, StudentTravelRequest } from "../domain/types";
import type { EmergencyPlan } from "../domain/types/emergency";
import { createSeedState } from "../data/seed";

/**
 * Shared reducer (docs/11).
 *
 * This module currently implements the student actions plus reset. Authority
 * actions (VERIFY_REPORT, CONFIRM_INCIDENT, APPROVE_REPLACEMENT, event CRUD,
 * scenario runner) belong to Members 1/3/4 and extend this same union — do not
 * create a second store.
 */
export type SafarAction =
  | { type: "HYDRATE"; state: SafarState }
  | { type: "SUBMIT_DISRUPTION_REPORT"; report: DisruptionReport; audit: AuditEvent }
  | { type: "SUBMIT_TRAVEL_REQUEST"; request: StudentTravelRequest; audit: AuditEvent }
  | { type: "RUN_EMERGENCY_SCENARIO"; plan: EmergencyPlan }
  | { type: "RESET_EMERGENCY_SCENARIO" }
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

    /**
     * Emergency run. Only scenario *inputs* plus the derived fleet changes are
     * stored; allocations are recomputed from those inputs, so running the
     * scenario again replaces the previous run instead of appending students.
     * Alert IDs are stable, so a repeat run cannot duplicate authority alerts.
     */
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

    /**
     * Reset restores the original fleet (availability and composition), the
     * original road conditions and the original allocations, while preserving
     * unrelated student data such as reports and travel requests.
     */
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

    case "RESET_SCENARIO":
      return createSeedState();

    default:
      return state;
  }
}
