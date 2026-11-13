import type {
  SafarState,
  ServiceResult,
  StudentTravelRequest,
} from "../domain/types";
import { isValidDate, isValidTime, nextId } from "../domain/time";
import { findDestination, findVillage, getNetworkFromState } from "../domain/network";
import {
  calculateStudentDemand,
  type DemandAdjustment,
  type DemandSummary,
} from "../domain/calculations/demand";
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

export interface SubmitTravelRequestInput {
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string;
  groupSize: number;
  provenance?: "USER_ENTERED" | "SIMULATED";
  anonymousRef?: string;
}

export interface SubmitTravelRequestResult {
  request: StudentTravelRequest;
  demand: DemandSummary;
}

export function getDemandSummary(
  state: SafarState,
  adjustments?: DemandAdjustment[],
): DemandSummary {
  return calculateStudentDemand(state.travelRequests, state.demandSeed, {
    network: getNetworkFromState(state),
    state,
    adjustments,
  });
}

export function getDemandForRoute(
  routeId: string,
  state: SafarState,
  adjustments?: DemandAdjustment[],
): DemandSummary["routes"][number] | undefined {
  return getDemandSummary(state, adjustments).routes.find(
    (route) => route.routeId === routeId,
  );
}

/**
 * Records an intended travel requirement for aggregate demand.
 * Only the minimum anonymous information is stored.
 */
export function submitTravelRequest(
  input: SubmitTravelRequestInput,
  state: SafarState,
  options?: ServiceOptions,
): ServiceResult<SubmitTravelRequestResult> {
  const network = getNetworkFromState(state);
  if (!findVillage(network, input.originVillageId)) {
    return fail(state, "TRAVEL_REQUEST_INVALID", `Unknown origin village "${input.originVillageId}".`);
  }
  if (!findDestination(network, input.destinationId)) {
    return fail(state, "TRAVEL_REQUEST_INVALID", `Unknown destination "${input.destinationId}".`);
  }
  if (!isValidDate(input.travelDate)) {
    return fail(state, "TRAVEL_REQUEST_INVALID", "Travel date must be a valid YYYY-MM-DD date.");
  }
  if (!isValidTime(input.requiredArrivalTime)) {
    return fail(state, "TRAVEL_REQUEST_INVALID", "Required arrival time must be a valid HH:MM time.");
  }
  if (
    !Number.isInteger(input.groupSize) ||
    input.groupSize < 1 ||
    input.groupSize > 60
  ) {
    return fail(
      state,
      "TRAVEL_REQUEST_INVALID",
      "Group size must be a whole number between 1 and 60.",
    );
  }
  if (
    input.anonymousRef &&
    (!isNonEmptyString(input.anonymousRef) || input.anonymousRef.length > 40)
  ) {
    return fail(state, "TRAVEL_REQUEST_INVALID", "Anonymous reference is invalid.");
  }

  const now = timestamp(options);
  const request: StudentTravelRequest = {
    id: nextId(
      "req",
      state.travelRequests.map((candidate) => candidate.id),
    ),
    originVillageId: input.originVillageId,
    destinationId: input.destinationId,
    travelDate: input.travelDate,
    requiredArrivalTime: input.requiredArrivalTime,
    groupSize: input.groupSize,
    submittedAt: now,
    anonymousRef: input.anonymousRef ?? "DEMO-STUDENT",
    provenance: input.provenance ?? "USER_ENTERED",
  };

  let nextState: SafarState = {
    ...state,
    travelRequests: [...state.travelRequests, request],
  };
  nextState = appendAlert(nextState, {
    audience: "STUDENT",
    severity: "SUCCESS",
    category: "DEMAND",
    title: "Travel requirement recorded",
    message: `${request.groupSize} student(s) from ${findVillage(network, request.originVillageId)?.name} to ${findDestination(network, request.destinationId)?.name} on ${request.travelDate}. Used only for aggregate demand analytics; individual details are not shown to authorities.`,
    provenance: "USER_ENTERED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: input.provenance === "SIMULATED" ? "SYSTEM" : "STUDENT_DEMO",
    action: "SUBMIT_TRAVEL_REQUEST",
    entityType: "StudentTravelRequest",
    entityIds: [request.id],
    at: now,
    details: {
      originVillageId: request.originVillageId,
      destinationId: request.destinationId,
      groupSize: request.groupSize,
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    request,
    demand: getDemandSummary(nextState),
  });
}

export const demandService = {
  calculateStudentDemand,
  getDemandSummary,
  getDemandForRoute,
  submitTravelRequest,
};
