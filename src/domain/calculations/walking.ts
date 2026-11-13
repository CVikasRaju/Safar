import type { Coordinates } from "../types";
import type { WalkingEstimate } from "../types/journey";

/**
 * Walking truthfulness (docs/04):
 * No pedestrian routing provider is configured for this prototype, so walking
 * values are clearly labelled approximations derived from straight-line
 * distance. They are never presented as measured road walking distances.
 */
export const WALK_SPEED_KMH = 4.8;
export const STRAIGHT_LINE_DETOUR_FACTOR = 1.35;
export const WALKING_METHOD =
  "Approximate: straight-line distance × 1.35 detour factor at 4.8 km/h. Not a road-routed pedestrian distance.";

/**
 * Origin village -> boarding stop / alighting stop -> destination access walk.
 * 2.5 km is the documented prototype limit for a walk-based access leg.
 */
export const MAX_ACCESS_WALK_METERS = 2500;
/** Maximum walk between two stops during a transfer. */
export const MAX_TRANSFER_WALK_METERS = 500;
/** Minimum scheduled buffer beyond the transfer walk. */
export const MIN_TRANSFER_BUFFER_MINUTES = 4;
/** Student platform buffer before the first departure. */
export const BOARD_BUFFER_MINUTES = 2;

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateWalking(from: Coordinates, to: Coordinates): WalkingEstimate {
  const straightLineMeters = Math.round(haversineMeters(from, to));
  const approxMeters = Math.round((straightLineMeters * STRAIGHT_LINE_DETOUR_FACTOR) / 10) * 10;
  // Under ~25 m the stop is effectively at the origin/destination.
  const minutes =
    approxMeters < 25 ? 0 : Math.max(1, Math.ceil(((approxMeters / 1000) / WALK_SPEED_KMH) * 60));
  return {
    straightLineMeters,
    approxMeters,
    minutes,
    method: WALKING_METHOD,
    provenance: "CALCULATED",
    isApproximate: true,
  };
}

export function formatWalkingDistance(estimate: WalkingEstimate): string {
  if (estimate.approxMeters < 25) return "At the stop";
  if (estimate.approxMeters < 1000) return `~${estimate.approxMeters} m`;
  return `~${(estimate.approxMeters / 1000).toFixed(1)} km`;
}
