import type { AuditEvent, DisruptionReport, SafarState, StudentTravelRequest } from "../domain/types";
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

    case "RESET_SCENARIO":
      return createSeedState();

    default:
      return state;
  }
}
