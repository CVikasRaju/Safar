import type {
  JourneyOption,
  JourneySearchRequest,
  JourneySearchResult,
  ServiceResult,
  StudentTravelRequest,
} from "../domain/types";
import { RELIABILITY_DISCLAIMER } from "../domain/constants";
import { getNetworkFromState } from "../domain/network";
import {
  describeNoRouteReason,
  generateJourneyOptions,
  rankJourneyCategories,
} from "../domain/calculations/journey";
import { fail, ok } from "./shared";

export { generateJourneyOptions };

export function generateJourneyOptionsForState(
  request: JourneySearchRequest,
  state: Parameters<typeof getNetworkFromState>[0],
): JourneyOption[] {
  return generateJourneyOptions(request, getNetworkFromState(state), state);
}

export function searchJourneys(
  request: JourneySearchRequest,
  state: Parameters<typeof getNetworkFromState>[0],
): ServiceResult<JourneySearchResult> {
  try {
    const options = generateJourneyOptions(request, getNetworkFromState(state), state);
    const categories = rankJourneyCategories(options);
    const result: JourneySearchResult = {
      request,
      options,
      fastest: categories.fastest,
      mostReliable: categories.mostReliable,
      fewestTransfers: categories.fewestTransfers,
      provenance: "CALCULATED",
    };
    if (options.length === 0) {
      result.noRouteReason = describeNoRouteReason(
        request,
        getNetworkFromState(state),
        state,
      );
    }
    return ok(state, result);
  } catch (error) {
    return fail(
      state,
      "JOURNEY_SEARCH_INVALID",
      error instanceof Error ? error.message : "Journey search failed.",
    );
  }
}

export interface WaitForReplacementOption {
  incidentId: string;
  replacementBusId?: string;
  registration?: string;
  estimatedResponseMinutes: number;
  remainingSeats?: number;
  approvalStatus: "PENDING" | "APPROVED" | "NONE";
  note: string;
}

export interface AlternativeJourneyResponse {
  incidentId: string;
  routeId?: string;
  failedBusId?: string;
  request: JourneySearchRequest;
  options: JourneyOption[];
  recommendedAlternative: JourneyOption | null;
  waitForReplacement: WaitForReplacementOption | null;
  noFeasibleOption: boolean;
  explanation: string;
  reliabilityDisclaimer: string;
}

/**
 * Recalculates alternatives after a confirmed incident using the same
 * timetable/reliability functions as the journey planner.
 */
export function getAlternativeJourneys(
  incidentId: string,
  request: JourneySearchRequest,
  state: Parameters<typeof getNetworkFromState>[0],
): ServiceResult<AlternativeJourneyResponse> {
  const incident = state.incidents.find((candidate) => candidate.id === incidentId);
  if (!incident) {
    return fail(state, "INCIDENT_NOT_FOUND", `Unknown incident "${incidentId}".`);
  }
  if (incident.status !== "ACTIVE") {
    return fail(
      state,
      "INCIDENT_NOT_ACTIVE",
      `Incident "${incidentId}" is not active, so alternatives are not recalculated.`,
    );
  }

  const search = searchJourneys(request, state);
  if (!search.ok) return search;

  const options = search.data.options;
  const recommendedAlternative =
    options.find((option) => option.meetsRequiredArrival) ?? options[0] ?? null;

  const recommendation = state.recommendations.find(
    (candidate) =>
      candidate.incidentId === incidentId &&
      (candidate.status === "PENDING" || candidate.status === "APPROVED"),
  );
  const replacementBusId = incident.replacementBusId ?? recommendation?.recommendedBusId;
  const replacementBus = replacementBusId
    ? state.buses.find((bus) => bus.id === replacementBusId)
    : undefined;

  const waitForReplacement: WaitForReplacementOption | null =
    incident.busId || replacementBus
      ? {
          incidentId,
          replacementBusId,
          registration: replacementBus?.registration,
          estimatedResponseMinutes: replacementBus?.estimatedResponseMinutes ?? 45,
          remainingSeats: replacementBus
            ? Math.max(0, replacementBus.capacity - replacementBus.occupiedSeats)
            : undefined,
          approvalStatus: incident.replacementBusId
            ? "APPROVED"
            : recommendation
              ? "PENDING"
              : "NONE",
          note: incident.replacementBusId
            ? "Waiting for the approved replacement. Response time is an illustrative estimate, not live GPS."
            : "Waiting for a replacement recommendation to be approved. Response time is an illustrative planning assumption.",
        }
      : null;

  const noFeasibleOption = options.length === 0;
  const explanation = noFeasibleOption
    ? (search.data.noRouteReason ??
      "No feasible alternative journey exists in the seeded timetable. The authority should be alerted; no connection has been invented.")
    : recommendedAlternative
      ? `Best feasible alternative: ${recommendedAlternative.legs
          .map((leg) => leg.routeId)
          .join(" → ")} departing ${recommendedAlternative.departureAt.slice(11, 16)} and arriving ${recommendedAlternative.expectedArrivalAt.slice(11, 16)} (${recommendedAlternative.meetsRequiredArrival ? "meets" : "does not meet"} the required arrival time), with reliability ${recommendedAlternative.reliabilityScore}/100. ${RELIABILITY_DISCLAIMER}`
      : "A timetable-feasible option was found but it is late.";

  return ok(state, {
    incidentId,
    routeId: incident.routeId,
    failedBusId: incident.busId,
    request,
    options,
    recommendedAlternative,
    waitForReplacement,
    noFeasibleOption,
    explanation,
    reliabilityDisclaimer: RELIABILITY_DISCLAIMER,
  });
}

/** Recalculates affected journeys for a set of submitted travel requests. */
export function getAffectedJourneysForRoute(
  routeId: string,
  state: Parameters<typeof getNetworkFromState>[0],
  requests?: StudentTravelRequest[],
): Array<{ request: StudentTravelRequest; journey: JourneyOption }> {
  const network = getNetworkFromState(state);
  const affected: Array<{ request: StudentTravelRequest; journey: JourneyOption }> = [];
  for (const request of requests ?? state.travelRequests) {
    try {
      const options = generateJourneyOptions(
        {
          originVillageId: request.originVillageId,
          destinationId: request.destinationId,
          travelDate: request.travelDate,
          requiredArrivalTime: request.requiredArrivalTime,
          passengers: request.groupSize,
        },
        network,
        state,
      );
      for (const journey of options) {
        if (journey.routeIds.includes(routeId)) {
          affected.push({ request, journey });
          break;
        }
      }
    } catch {
      continue;
    }
  }
  return affected;
}

export const journeyService = {
  generateJourneyOptions,
  generateJourneyOptionsForState,
  searchJourneys,
  getAlternativeJourneys,
  getAffectedJourneysForRoute,
};
