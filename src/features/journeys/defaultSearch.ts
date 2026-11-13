import type { SafarState } from "../../domain/types";
import type { JourneySearchRequest } from "../../domain/types/journey";
import { DEMO_SESSION } from "../student/session";

/**
 * The documented demo search (docs/15): a student from a seeded village
 * travelling to Puttur Government College, required to arrive before 09:00.
 * The date comes from the configurable demo scenario date.
 */
export function defaultJourneyRequest(state: SafarState): JourneySearchRequest {
  const homeVillage = state.villages.some((village) => village.id === DEMO_SESSION.homeVillageId)
    ? DEMO_SESSION.homeVillageId
    : (state.villages[0]?.id ?? "");
  const college =
    state.destinations.find((destination) => destination.id === "d-pgc") ??
    state.destinations[0];

  return {
    originVillageId: homeVillage,
    destinationId: college?.id ?? "",
    travelDate: state.scenario.scenarioDate,
    requiredArrivalTime: "09:00",
  };
}

export function plannerHref(request: JourneySearchRequest): string {
  const params = new URLSearchParams({
    origin: request.originVillageId,
    destination: request.destinationId,
    date: request.travelDate,
    arrival: request.requiredArrivalTime,
  });
  return `/student/planner?${params.toString()}`;
}
