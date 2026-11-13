import type {
  AccessPoint,
  Bus,
  Destination,
  NetworkData,
  Route,
  SafarState,
  Stop,
  TimetableService,
  Village,
} from "./types";

export function getNetworkFromState(state: SafarState): NetworkData {
  return {
    villages: state.villages,
    destinations: state.destinations,
    stops: state.stops,
    routes: state.routes,
    services: state.services,
    stopWalkLinks: state.stopWalkLinks,
  };
}

/** Read-only network lookups shared by calculations and services. */

export function findVillage(network: NetworkData, villageId: string): Village | undefined {
  return network.villages.find((village) => village.id === villageId);
}

export function findDestination(
  network: NetworkData,
  destinationId: string,
): Destination | undefined {
  return network.destinations.find((destination) => destination.id === destinationId);
}

export function findStop(network: NetworkData, stopId: string): Stop | undefined {
  return network.stops.find((stop) => stop.id === stopId);
}

export function findRoute(network: NetworkData, routeId: string): Route | undefined {
  return network.routes.find((route) => route.id === routeId);
}

export function findService(
  network: NetworkData,
  serviceId: string,
): TimetableService | undefined {
  return network.services.find((service) => service.id === serviceId);
}

export function findBus(buses: Bus[], busId: string): Bus | undefined {
  return buses.find((bus) => bus.id === busId);
}

export function getStopName(network: NetworkData, stopId: string): string {
  return findStop(network, stopId)?.name ?? stopId;
}

export function getVillageName(network: NetworkData, villageId: string): string {
  return findVillage(network, villageId)?.name ?? villageId;
}

export function getRouteStops(network: NetworkData, routeId: string): Stop[] {
  const route = findRoute(network, routeId);
  if (!route) return [];
  return route.stopIds
    .map((stopId) => findStop(network, stopId))
    .filter((stop): stop is Stop => Boolean(stop));
}

export function getServicesForRoute(
  network: NetworkData,
  routeId: string,
): TimetableService[] {
  return network.services.filter((service) => service.routeId === routeId);
}

export function getAccessPoints(
  holder: { accessStops: AccessPoint[] },
  network: NetworkData,
): AccessPoint[] {
  return holder.accessStops.filter((access) => Boolean(findStop(network, access.stopId)));
}

export function getStopWalkMinutes(
  network: NetworkData,
  fromStopId: string,
  toStopId: string,
): number | null {
  if (fromStopId === toStopId) return 0;
  const link = network.stopWalkLinks.find(
    (candidate) => candidate.fromStopId === fromStopId && candidate.toStopId === toStopId,
  );
  return link ? link.walkMinutes : null;
}

export function routeSharesStop(
  network: NetworkData,
  routeIdA: string,
  routeIdB: string,
): boolean {
  const routeA = findRoute(network, routeIdA);
  const routeB = findRoute(network, routeIdB);
  if (!routeA || !routeB) return false;
  return routeA.stopIds.some((stopId) => routeB.stopIds.includes(stopId));
}

/** Total timetable span for a route, in minutes since midnight. */
export function getRouteServiceSpan(
  network: NetworkData,
  routeId: string,
): { firstDeparture: number; lastArrival: number } | null {
  const services = getServicesForRoute(network, routeId);
  if (services.length === 0) return null;
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const service of services) {
    if (service.stopTimes.length === 0) continue;
    const departure = minutesOf(service.stopTimes[0].time);
    const arrival = minutesOf(service.stopTimes[service.stopTimes.length - 1].time);
    first = Math.min(first, departure);
    last = Math.max(last, arrival);
  }
  return Number.isFinite(first) && Number.isFinite(last) ? { firstDeparture: first, lastArrival: last } : null;
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Services whose vehicle cannot operate right now.
 * A student-visible state reason always accompanies exclusion.
 */
export function isServiceOperable(
  network: NetworkData,
  state: SafarState,
  service: TimetableService,
): boolean {
  const route = findRoute(network, service.routeId);
  if (!route) return false;
  const bus = findBus(state.buses, service.busId);
  if (!bus) return false;
  if (bus.status === "UNAVAILABLE" || bus.status === "MAINTENANCE") return false;
  if (bus.status === "REPLACEMENT_ASSIGNED" && bus.assignedRouteId !== service.routeId) {
    return false;
  }
  return true;
}

export function activeIncidentsForRoute(state: SafarState, routeId: string) {
  return state.incidents.filter(
    (incident) => incident.status === "ACTIVE" && incident.routeId === routeId,
  );
}
