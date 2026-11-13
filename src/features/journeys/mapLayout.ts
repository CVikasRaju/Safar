import type { Coordinates, SafarEvent, Stop } from "../../domain/types";
import type { JourneyOption } from "../../domain/types/journey";

/**
 * Map visualisation plan for a journey.
 *
 * Bus lines connect stop points; they are NOT road geometry. Walking lines are
 * straight-line approximations. Both are labelled as schematic in the UI.
 */

export type JourneyMapMarkerKind = "ORIGIN" | "DESTINATION" | "STOP" | "TRANSFER" | "EVENT";

export interface JourneyMapMarker {
  id: string;
  label: string;
  kind: JourneyMapMarkerKind;
  coordinates: Coordinates;
  note?: string;
}

export interface JourneyMapPath {
  id: string;
  kind: "BUS" | "WALK";
  label: string;
  routeId?: string;
  points: Coordinates[];
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface JourneyMapPlan {
  markers: JourneyMapMarker[];
  paths: JourneyMapPath[];
  bounds: MapBounds;
  center: Coordinates;
}

export interface SchematicPoint {
  x: number;
  y: number;
}

export interface SchematicMarker extends SchematicPoint {
  id: string;
  label: string;
  kind: JourneyMapMarkerKind;
  note?: string;
}

export interface SchematicPath {
  id: string;
  kind: "BUS" | "WALK";
  label: string;
  routeId?: string;
  points: SchematicPoint[];
}

export interface SchematicLayout {
  width: number;
  height: number;
  markers: SchematicMarker[];
  paths: SchematicPath[];
}

function emptyBounds(): MapBounds {
  return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
}

export function computeBounds(points: Coordinates[]): MapBounds {
  if (points.length === 0) return emptyBounds();
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

export function buildJourneyMapPlan(
  journey: JourneyOption,
  stopsById: Map<string, Stop>,
  eventsOnDate: SafarEvent[] = [],
): JourneyMapPlan {
  const markers: JourneyMapMarker[] = [];
  const paths: JourneyMapPath[] = [];
  const seenMarkers = new Set<string>();

  const addMarker = (marker: JourneyMapMarker) => {
    const key = `${marker.kind}:${marker.label}:${marker.coordinates.lat.toFixed(4)}:${marker.coordinates.lon.toFixed(4)}`;
    if (seenMarkers.has(key)) return;
    seenMarkers.add(key);
    markers.push(marker);
  };

  const firstSegment = journey.segments[0];
  const lastSegment = journey.segments[journey.segments.length - 1];

  if (firstSegment?.startLocation.coordinates) {
    addMarker({
      id: "origin",
      label: firstSegment.startLocation.label,
      kind: "ORIGIN",
      coordinates: firstSegment.startLocation.coordinates,
      note: "Journey start",
    });
  }

  if (lastSegment?.endLocation.coordinates) {
    addMarker({
      id: "destination",
      label: lastSegment.endLocation.label,
      kind: "DESTINATION",
      coordinates: lastSegment.endLocation.coordinates,
      note: "Journey destination",
    });
  }

  journey.legs.forEach((leg, index) => {
    const boardStop = stopsById.get(leg.boardStopId);
    const alightStop = stopsById.get(leg.alightStopId);
    const points: Coordinates[] = [];

    if (boardStop) {
      points.push(boardStop.coordinates);
      addMarker({
        id: `board-${index}`,
        label: `${leg.routeId} · ${boardStop.name}`,
        kind: index === 0 ? "STOP" : "TRANSFER",
        coordinates: boardStop.coordinates,
        note: `Board ${leg.busRegistration} at ${leg.expectedDeparture.slice(11, 16)}`,
      });
    }

    for (const stopId of leg.intermediateStopIds) {
      const stop = stopsById.get(stopId);
      if (!stop) continue;
      points.push(stop.coordinates);
      addMarker({
        id: `mid-${index}-${stopId}`,
        label: stop.name,
        kind: "STOP",
        coordinates: stop.coordinates,
        note: "Intermediate stop — stay on the bus",
      });
    }

    if (alightStop) {
      points.push(alightStop.coordinates);
      addMarker({
        id: `alight-${index}`,
        label: alightStop.name,
        kind: index === journey.legs.length - 1 ? "STOP" : "TRANSFER",
        coordinates: alightStop.coordinates,
        note:
          index === journey.legs.length - 1
            ? `Get off here at ${leg.expectedArrival.slice(11, 16)}`
            : `Change buses here at ${leg.expectedArrival.slice(11, 16)}`,
      });
    }

    if (points.length >= 2) {
      paths.push({
        id: `bus-${index}`,
        kind: "BUS",
        label: `${leg.routeId} · ${leg.busRegistration}`,
        routeId: leg.routeId,
        points,
      });
    }
  });

  for (const segment of journey.segments) {
    if (segment.type !== "WALK") continue;
    const start = segment.startLocation.coordinates;
    const end = segment.endLocation.coordinates;
    if (!start || !end) continue;
    paths.push({
      id: `walk-${segment.id}`,
      kind: "WALK",
      label: segment.title,
      points: [start, end],
    });
  }

  for (const event of eventsOnDate) {
    if (!event.coordinates) continue;
    const affectsJourney = event.affectedRouteIds.some((routeId) =>
      journey.usedRouteIds.includes(routeId),
    );
    if (!affectsJourney) continue;
    addMarker({
      id: `event-${event.id}`,
      label: event.name,
      kind: "EVENT",
      coordinates: event.coordinates,
      note: `Predicted event impact · ${event.date} (demo data)`,
    });
  }

  const allPoints = [...paths.flatMap((path) => path.points), ...markers.map((marker) => marker.coordinates)];
  const bounds = computeBounds(allPoints);

  return {
    markers,
    paths,
    bounds,
    center: {
      lat: (bounds.minLat + bounds.maxLat) / 2,
      lon: (bounds.minLon + bounds.maxLon) / 2,
    },
  };
}

/** Projects the plan into SVG coordinates for the offline/schematic fallback. */
export function buildSchematicLayout(
  plan: JourneyMapPlan,
  width = 720,
  height = 360,
  padding = 40,
): SchematicLayout {
  const { minLat, maxLat, minLon, maxLon } = plan.bounds;
  const midLat = (minLat + maxLat) / 2;
  const lonScale = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const spanX = Math.max((maxLon - minLon) * lonScale, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const degenerate = spanX < 1e-4 && spanY < 1e-4;
  const scale = degenerate ? 1 : Math.min(usableWidth / spanX, usableHeight / spanY);

  const project = (coordinates: Coordinates): SchematicPoint => ({
    x:
      padding +
      (coordinates.lon - minLon) * lonScale * scale +
      (usableWidth - spanX * scale) / 2,
    y:
      padding +
      (maxLat - coordinates.lat) * scale +
      (usableHeight - spanY * scale) / 2,
  });

  return {
    width,
    height,
    markers: plan.markers.map((marker) => ({
      id: marker.id,
      label: marker.label,
      kind: marker.kind,
      note: marker.note,
      ...project(marker.coordinates),
    })),
    paths: plan.paths.map((path) => ({
      id: path.id,
      kind: path.kind,
      label: path.label,
      routeId: path.routeId,
      points: path.points.map(project),
    })),
  };
}
