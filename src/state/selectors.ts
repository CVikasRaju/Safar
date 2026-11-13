import type { Bus, Destination, Route, SafarState, Stop, Village } from "../domain/types";

/** Read-only helpers shared by every student screen. No business logic here. */

export function routeById(state: SafarState, routeId: string): Route | undefined {
  return state.routes.find((route) => route.id === routeId);
}

export function stopById(state: SafarState, stopId: string): Stop | undefined {
  return state.stops.find((stop) => stop.id === stopId);
}

export function busById(state: SafarState, busId: string): Bus | undefined {
  return state.buses.find((bus) => bus.id === busId);
}

export function villageById(state: SafarState, villageId: string): Village | undefined {
  return state.villages.find((village) => village.id === villageId);
}

export function destinationById(state: SafarState, destinationId: string): Destination | undefined {
  return state.destinations.find((destination) => destination.id === destinationId);
}

export function stopName(state: SafarState, stopId: string | undefined): string {
  if (!stopId) return "Unknown stop";
  return stopById(state, stopId)?.name ?? "Unknown stop";
}

export function busRegistration(state: SafarState, busId: string | undefined): string {
  if (!busId) return "No bus selected";
  return busById(state, busId)?.registration ?? "Unknown bus";
}

export function destinationLabel(state: SafarState, destinationId: string): string {
  return destinationById(state, destinationId)?.name ?? "Unknown destination";
}

export function villageLabel(state: SafarState, villageId: string): string {
  return villageById(state, villageId)?.name ?? "Unknown village";
}

export function stopsForRoute(state: SafarState, routeId: string): Stop[] {
  const route = routeById(state, routeId);
  if (!route) return [];
  return route.stops
    .map((stopId) => stopById(state, stopId))
    .filter((stop): stop is Stop => stop !== undefined);
}

export function busesForRoute(state: SafarState, routeId: string): Bus[] {
  return state.buses.filter((bus) => bus.assignedRouteId === routeId);
}

export function nextDeparturesForRoute(
  state: SafarState,
  routeId: string,
  fromStopId: string,
  limit = 3,
): Array<{ serviceId: string; departureMinute: number; direction: "OUTBOUND" | "INBOUND" }> {
  const departures: Array<{
    serviceId: string;
    departureMinute: number;
    direction: "OUTBOUND" | "INBOUND";
  }> = [];
  for (const service of state.timetableServices) {
    if (service.routeId !== routeId) continue;
    const stopTime = service.stopTimes.find((entry) => entry.stopId === fromStopId);
    if (!stopTime) continue;
    departures.push({
      serviceId: service.id,
      departureMinute: stopTime.departureMinute,
      direction: service.direction,
    });
  }
  return departures.sort((a, b) => a.departureMinute - b.departureMinute).slice(0, limit);
}
