import type { SafarState, ServiceResult } from "../domain/types";
import type { CreateEventInput, UpdateEventInput } from "../services/eventService";
import type { SubmitTravelRequestInput } from "../services/demandService";
import type {
  ConfirmIncidentInput,
  ReviewDecision,
  SubmitDisruptionReportInput,
} from "../services/disruptionService";
import type { RunScenarioInput } from "../services/scenarioService";
import {
  closeIncident,
  confirmIncident,
  submitDisruptionReport,
  verifyDisruption,
} from "../services/disruptionService";
import { createEvent, deleteEvent, updateEvent } from "../services/eventService";
import { submitTravelRequest } from "../services/demandService";
import { markBusUnavailable, simulateBusBreakdown } from "../services/fleetService";
import {
  approveReplacement,
  generateReplacementRecommendation,
  rejectReplacement,
} from "../services/replacementService";
import {
  approveScenarioReplacement,
  resetScenario,
  runBreakdownScenario,
  runScenario,
} from "../services/scenarioService";

/**
 * Reducer actions shared by both workspaces.
 * Redux-style names are provided for clarity; the raw services remain the
 * canonical API for non-React callers.
 */
export type SafarAction =
  | { type: "SUBMIT_TRAVEL_REQUEST"; payload: SubmitTravelRequestInput }
  | { type: "SUBMIT_DISRUPTION_REPORT"; payload: SubmitDisruptionReportInput }
  | {
      type: "VERIFY_REPORT";
      payload: { reportId: string; decision: ReviewDecision; reason?: string; reviewer?: string };
    }
  | { type: "REJECT_REPORT"; payload: { reportId: string; reason: string; reviewer?: string } }
  | { type: "MARK_REPORT_DUPLICATE"; payload: { reportId: string; reason: string; reviewer?: string } }
  | { type: "CONFIRM_INCIDENT"; payload: ConfirmIncidentInput }
  | { type: "CLOSE_INCIDENT"; payload: { incidentId: string; resolution: string; restoreBus?: boolean } }
  | { type: "ADD_EVENT"; payload: CreateEventInput }
  | { type: "UPDATE_EVENT"; payload: { eventId: string; patch: UpdateEventInput } }
  | { type: "DELETE_EVENT"; payload: { eventId: string } }
  | { type: "MARK_BUS_UNAVAILABLE"; payload: { busId: string; reason: string } }
  | { type: "SIMULATE_BREAKDOWN"; payload: { busId: string; routeId?: string; affectedStopId?: string } }
  | { type: "GENERATE_REPLACEMENT_RECOMMENDATION"; payload: { incidentId: string } }
  | { type: "APPROVE_REPLACEMENT"; payload: { recommendationId: string; busId?: string; reason?: string } }
  | { type: "REJECT_REPLACEMENT"; payload: { recommendationId: string; reason: string } }
  | { type: "RUN_SCENARIO"; payload?: RunScenarioInput }
  | { type: "RUN_BREAKDOWN_SCENARIO"; payload?: { busId?: string; routeId?: string } }
  | { type: "APPROVE_SCENARIO_REPLACEMENT"; payload?: { busId?: string; reason?: string } }
  | { type: "RESET_SCENARIO"; payload?: { now?: Date; scenarioDate?: string } }
  | { type: "RESET_STATE"; payload?: { now?: Date; scenarioDate?: string } };

/**
 * Applies a shared-state action. Never throws for invalid operations: returns a
 * structured failure that the UI can surface without losing current state.
 */
export function applyAction(
  state: SafarState,
  action: SafarAction,
): ServiceResult<unknown> {
  switch (action.type) {
    case "SUBMIT_TRAVEL_REQUEST":
      return submitTravelRequest(action.payload, state);
    case "SUBMIT_DISRUPTION_REPORT":
      return submitDisruptionReport(action.payload, state);
    case "VERIFY_REPORT":
      return verifyDisruption(action.payload.reportId, action.payload.decision, state, {
        reason: action.payload.reason,
        reviewer: action.payload.reviewer,
      });
    case "REJECT_REPORT":
      return verifyDisruption(action.payload.reportId, "REJECT", state, {
        reason: action.payload.reason,
        reviewer: action.payload.reviewer,
      });
    case "MARK_REPORT_DUPLICATE":
      return verifyDisruption(action.payload.reportId, "MARK_DUPLICATE", state, {
        reason: action.payload.reason,
        reviewer: action.payload.reviewer,
      });
    case "CONFIRM_INCIDENT":
      return confirmIncident(action.payload, state);
    case "CLOSE_INCIDENT":
      return closeIncident(action.payload.incidentId, {
        resolution: action.payload.resolution,
        restoreBus: action.payload.restoreBus,
      }, state);
    case "ADD_EVENT":
      return createEvent(action.payload, state);
    case "UPDATE_EVENT":
      return updateEvent(action.payload.eventId, action.payload.patch, state);
    case "DELETE_EVENT":
      return deleteEvent(action.payload.eventId, state);
    case "MARK_BUS_UNAVAILABLE":
      return markBusUnavailable(action.payload.busId, action.payload.reason, state);
    case "SIMULATE_BREAKDOWN":
      return simulateBusBreakdown(action.payload, state);
    case "GENERATE_REPLACEMENT_RECOMMENDATION":
      return generateReplacementRecommendation(action.payload.incidentId, state);
    case "APPROVE_REPLACEMENT":
      return approveReplacement(action.payload.recommendationId, state, {
        busId: action.payload.busId,
        reason: action.payload.reason,
      });
    case "REJECT_REPLACEMENT":
      return rejectReplacement(
        action.payload.recommendationId,
        action.payload.reason,
        state,
      );
    case "RUN_SCENARIO":
      return runScenario(action.payload ?? {}, state);
    case "RUN_BREAKDOWN_SCENARIO":
      return runBreakdownScenario(action.payload ?? {}, state);
    case "APPROVE_SCENARIO_REPLACEMENT":
      return approveScenarioReplacement(state, action.payload ?? {});
    case "RESET_SCENARIO":
    case "RESET_STATE": {
      const reset = resetScenario(action.payload ?? {});
      return { ok: true, state: reset, data: { reset: true } };
    }
    default: {
      const exhaustive: never = action;
      return {
        ok: false,
        state,
        code: "UNKNOWN_ACTION",
        error: `Unknown SAFAR action: ${JSON.stringify(exhaustive)}`,
      };
    }
  }
}

/** React Context reducer signature: state in, state out. */
export function safarReducer(state: SafarState, action: SafarAction): SafarState {
  return applyAction(state, action).state;
}

export const appReducer = safarReducer;
