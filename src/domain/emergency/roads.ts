import type { Route, Stop } from "../types";
import type {
  AlternativeRoadPath,
  Road,
  RoadCondition,
  RouteAlternative,
} from "../types/emergency";
import { estimateWalking } from "../calculations/walking";

/**
 * Road intelligence over the simulated demo network.
 *
 * A route uses a road when two consecutive stops in its (either-direction)
 * stop sequence are the road's endpoints. Alternatives are found by a
 * shortest-path search over the road graph that never traverses a closed road,
 * so an alternative route can never contain the blocked segment.
 */

export function roadsConnecting(
  roads: Road[],
  stopA: string,
  stopB: string,
): Road | undefined {
  return roads.find(
    (road) =>
      (road.fromStopId === stopA && road.toStopId === stopB) ||
      (road.fromStopId === stopB && road.toStopId === stopA),
  );
}

export function roadsForRoute(roads: Road[], route: Route): Road[] {
  const used: Road[] = [];
  for (let index = 0; index < route.stops.length - 1; index += 1) {
    const road = roadsConnecting(roads, route.stops[index], route.stops[index + 1]);
    if (road && !used.some((entry) => entry.id === road.id)) used.push(road);
  }
  return used;
}

export function routeUsesRoad(roads: Road[], route: Route, roadId: string): boolean {
  return roadsForRoute(roads, route).some((road) => road.id === roadId);
}

export function routesUsingRoad(routes: Route[], roads: Road[], roadId: string): Route[] {
  return routes.filter((route) => routeUsesRoad(roads, route, roadId));
}

export function closedRoadIds(conditions: RoadCondition[]): string[] {
  return conditions.filter((condition) => condition.status !== "OPEN").map((condition) => condition.roadId);
}

export function closedStopIds(conditions: RoadCondition[]): string[] {
  return conditions.flatMap((condition) =>
    condition.status === "OPEN" ? [] : (condition.affectedStopIds ?? []),
  );
}

interface GraphEdge {
  road: Road;
  to: string;
}

function buildGraph(roads: Road[], excludedRoadIds: string[]): Map<string, GraphEdge[]> {
  const graph = new Map<string, GraphEdge[]>();
  for (const road of roads) {
    if (excludedRoadIds.includes(road.id)) continue;
    const forward = graph.get(road.fromStopId) ?? [];
    forward.push({ road, to: road.toStopId });
    graph.set(road.fromStopId, forward);

    const backward = graph.get(road.toStopId) ?? [];
    backward.push({ road, to: road.fromStopId });
    graph.set(road.toStopId, backward);
  }
  return graph;
}

/**
 * Shortest path by distance that avoids every excluded road. Returns null when
 * no path exists, which the caller must present honestly.
 */
export function findAlternativePath(
  roads: Road[],
  fromStopId: string,
  toStopId: string,
  excludedRoadIds: string[],
): AlternativeRoadPath | null {
  if (fromStopId === toStopId) {
    return { roadIds: [], distanceKm: 0, minutes: 0 };
  }
  const graph = buildGraph(roads, excludedRoadIds);
  const distances = new Map<string, number>();
  const previous = new Map<string, { stopId: string; road: Road }>();
  const visited = new Set<string>();
  distances.set(fromStopId, 0);
  const queue = new Set<string>([fromStopId]);

  while (queue.size > 0) {
    let current: string | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of queue) {
      const distance = distances.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (distance < best) {
        best = distance;
        current = candidate;
      }
    }
    if (!current) break;
    queue.delete(current);
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toStopId) break;

    for (const edge of graph.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      const next = (distances.get(current) ?? Number.POSITIVE_INFINITY) + edge.road.distanceKm;
      if (next < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, next);
        previous.set(edge.to, { stopId: current, road: edge.road });
        queue.add(edge.to);
      }
    }
  }

  if (!distances.has(toStopId)) return null;

  const roadIds: string[] = [];
  let minutes = 0;
  let cursor = toStopId;
  while (cursor !== fromStopId) {
    const step = previous.get(cursor);
    if (!step) return null;
    roadIds.unshift(step.road.id);
    minutes += step.road.travelMinutes;
    cursor = step.stopId;
  }

  return { roadIds, distanceKm: Math.round((distances.get(toStopId) ?? 0) * 10) / 10, minutes };
}

export interface RouteDetour {
  routeId: string;
  blockedRoadIds: string[];
  alternative: AlternativeRoadPath;
  additionalDistanceKm: number;
  additionalMinutes: number;
  /** True when the chosen alternative path never uses a blocked road. */
  avoidsBlockedRoads: boolean;
}

/**
 * Re-routes a route's connection between its own stop pairs while avoiding every
 * closed road, and reports the extra distance/time of the detour.
 */
export function routeDetour(
  roads: Road[],
  route: Route,
  blockedRoadIds: string[],
): RouteDetour {
  let alternative: AlternativeRoadPath = { roadIds: [], distanceKm: 0, minutes: 0 };
  let originalDistance = 0;
  let originalMinutes = 0;
  const hitRoadIds: string[] = [];

  for (let index = 0; index < route.stops.length - 1; index += 1) {
    const from = route.stops[index];
    const to = route.stops[index + 1];
    const road = roadsConnecting(roads, from, to);
    if (!road) continue;

    if (!blockedRoadIds.includes(road.id)) {
      originalDistance += road.distanceKm;
      originalMinutes += road.travelMinutes;
      alternative = {
        roadIds: [...alternative.roadIds, road.id],
        distanceKm: Math.round((alternative.distanceKm + road.distanceKm) * 10) / 10,
        minutes: alternative.minutes + road.travelMinutes,
      };
      continue;
    }

    hitRoadIds.push(road.id);
    const bypass = findAlternativePath(roads, from, to, blockedRoadIds);
    if (!bypass) continue;
    originalDistance += road.distanceKm;
    originalMinutes += road.travelMinutes;
    alternative = {
      roadIds: [...alternative.roadIds, ...bypass.roadIds],
      distanceKm: Math.round((alternative.distanceKm + bypass.distanceKm) * 10) / 10,
      minutes: alternative.minutes + bypass.minutes,
    };
  }

  return {
    routeId: route.id,
    blockedRoadIds: hitRoadIds,
    alternative,
    additionalDistanceKm: Math.max(0, Math.round((alternative.distanceKm - originalDistance) * 10) / 10),
    additionalMinutes: Math.max(0, alternative.minutes - originalMinutes),
    avoidsBlockedRoads: alternative.roadIds.every((roadId) => !blockedRoadIds.includes(roadId)),
  };
}

export function buildRouteAlternatives(
  routes: Route[],
  roads: Road[],
  conditions: RoadCondition[],
  replacementBusesByRoute: Map<string, Array<{ id: string; registration: string }>>,
): RouteAlternative[] {
  const blockedRoadIds = closedRoadIds(conditions);
  if (blockedRoadIds.length === 0) return [];

  const alternatives: RouteAlternative[] = [];
  for (const route of routes) {
    const detour = routeDetour(roads, route, blockedRoadIds);
    if (detour.blockedRoadIds.length === 0) continue;
    const blockedRoad = roads.find((road) => road.id === detour.blockedRoadIds[0]);
    const buses = replacementBusesByRoute.get(route.id) ?? [];
    alternatives.push({
      routeId: route.id,
      routeName: route.name,
      blockedRoadId: detour.blockedRoadIds[0],
      blockedRoadName: blockedRoad?.name ?? detour.blockedRoadIds[0],
      alternativePath: detour.alternative,
      additionalDistanceKm: detour.additionalDistanceKm,
      additionalMinutes: detour.additionalMinutes,
      replacementBusIds: buses.map((bus) => bus.id),
      replacementBusRegistrations: buses.map((bus) => bus.registration),
    });
  }
  return alternatives;
}

export interface AlternativePickup {
  stopId: string;
  stopName: string;
  approxMetres: number;
  minutes: number;
  method: string;
  /**
   * True when the walk exceeds the documented access-walk limit (docs/04,
   * 2.5 km). Such a group needs a feeder shuttle and must not be presented as
   * a walkable replacement by the allocation engine.
   */
  exceedsAccessWalkLimit: boolean;
}

/** Documented prototype limit for a walk-based access leg (see walking.ts). */
export const MAX_ACCESS_WALK_METERS = 2500;

/**
 * Nearest usable pickup stop for a student whose original stop is submerged.
 * Walking is an approximation (reuses the shared walking estimate), never a
 * road-routed pedestrian distance.
 */
export function findAlternativePickup(
  stops: Stop[],
  routes: Route[],
  operationalRouteIds: string[],
  blockedStopIds: string[],
  originalStopId: string,
  maxMetres = 5000,
): AlternativePickup | null {
  const original = stops.find((stop) => stop.id === originalStopId);
  if (!original) return null;

  let best: AlternativePickup | null = null;
  for (const stop of stops) {
    if (stop.id === originalStopId) continue;
    if (blockedStopIds.includes(stop.id)) continue;
    const served = routes.some(
      (route) => operationalRouteIds.includes(route.id) && route.stops.includes(stop.id),
    );
    if (!served) continue;
    const walk = estimateWalking(original.coordinates, stop.coordinates);
    if (walk.approxMeters > maxMetres) continue;
    if (!best || walk.approxMeters < best.approxMetres) {
      best = {
        stopId: stop.id,
        stopName: stop.name,
        approxMetres: walk.approxMeters,
        minutes: walk.minutes,
        method: walk.method,
        exceedsAccessWalkLimit: walk.approxMeters > MAX_ACCESS_WALK_METERS,
      };
    }
  }
  return best;
}
