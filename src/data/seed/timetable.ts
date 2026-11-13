import type { Route, ServiceDirection, TimetableService, TimetableStopTime } from "../../domain/types";
import { hhmmToMinutes, isValidHhmm, minutesToHhmm } from "../../domain/calculations/time";
import { ROUTES } from "./routes";

/**
 * Timetable expansion for the demo network.
 *
 * The specification requires explicit, chronological timetable records. This
 * module deterministically expands the documented departure pattern and
 * per-route stop offsets into explicit `TimetableService` records, so the
 * planner and the validator work with concrete data rather than magic numbers.
 *
 * All times are illustrative demo values, not official KSRTC schedules.
 */

function expandDepartures(first: string, last: string, stepMinutes: number): string[] {
  const start = hhmmToMinutes(first);
  const end = hhmmToMinutes(last);
  const departures: string[] = [];
  for (let minute = start; minute <= end; minute += stepMinutes) {
    departures.push(minutesToHhmm(minute));
  }
  return departures;
}

function routeById(routeId: string): Route {
  const route = ROUTES.find((candidate) => candidate.id === routeId);
  if (!route) throw new Error(`Timetable references unknown route ${routeId}`);
  return route;
}

interface ServicePattern {
  routeId: string;
  busId: string;
  direction: ServiceDirection;
  departures: string[];
  /** Minutes after departure for each stop, in travel order for this direction. */
  offsets: number[];
}

function buildServices(patterns: ServicePattern[]): TimetableService[] {
  const services: TimetableService[] = [];
  for (const pattern of patterns) {
    const route = routeById(pattern.routeId);
    const orderedStops =
      pattern.direction === "OUTBOUND" ? route.stops : [...route.stops].reverse();
    if (orderedStops.length !== pattern.offsets.length) {
      throw new Error(
        `Timetable offsets for ${pattern.routeId} ${pattern.direction} do not match its stops`,
      );
    }
    for (const departure of pattern.departures) {
      if (!isValidHhmm(departure)) throw new Error(`Invalid departure ${departure}`);
      const start = hhmmToMinutes(departure);
      const stopTimes: TimetableStopTime[] = orderedStops.map((stopId, index) => {
        const minute = start + pattern.offsets[index];
        return { stopId, arrivalMinute: minute, departureMinute: minute };
      });
      services.push({
        id: `svc-${pattern.routeId.toLowerCase()}-${pattern.direction === "OUTBOUND" ? "out" : "in"}-${departure.replace(":", "")}`,
        routeId: pattern.routeId,
        busId: pattern.busId,
        direction: pattern.direction,
        operatingDays: [0, 1, 2, 3, 4, 5, 6],
        stopTimes,
        provenance: "DEMO",
      });
    }
  }
  return services;
}

export const R101_OFFSETS_OUT = [0, 30, 58, 88, 127];
export const R101_OFFSETS_IN = [0, 39, 69, 97, 127];
export const R102_OFFSETS_OUT = [0, 6, 23, 31];
export const R102_OFFSETS_IN = [0, 8, 25, 31];
export const R103_OFFSETS_OUT = [0, 30, 42];
export const R103_OFFSETS_IN = [0, 12, 42];
export const R104_OFFSETS_OUT = [0, 8, 16];
export const R104_OFFSETS_IN = [0, 8, 16];

export function buildTimetableServices(): TimetableService[] {
  return buildServices([
    {
      routeId: "R101",
      busId: "bus-ka21ab102",
      direction: "OUTBOUND",
      departures: expandDepartures("05:40", "19:40", 60),
      offsets: R101_OFFSETS_OUT,
    },
    {
      routeId: "R101",
      busId: "bus-ka21ab102",
      direction: "INBOUND",
      departures: [
        "05:00",
        "05:35",
        ...expandDepartures("06:10", "18:10", 60),
      ],
      offsets: R101_OFFSETS_IN,
    },
    {
      routeId: "R102",
      busId: "bus-ka21ab118",
      direction: "OUTBOUND",
      departures: [
        "05:50",
        "06:20",
        "06:50",
        "07:30",
        "08:20",
        ...expandDepartures("09:20", "18:20", 60),
      ],
      offsets: R102_OFFSETS_OUT,
    },
    {
      routeId: "R102",
      busId: "bus-ka21ab118",
      direction: "INBOUND",
      departures: [
        "06:40",
        "07:20",
        "08:00",
        "08:40",
        ...expandDepartures("09:40", "18:40", 60),
      ],
      offsets: R102_OFFSETS_IN,
    },
    {
      routeId: "R103",
      busId: "bus-ka21cd204",
      direction: "OUTBOUND",
      departures: expandDepartures("05:40", "18:40", 60),
      offsets: R103_OFFSETS_OUT,
    },
    {
      routeId: "R103",
      busId: "bus-ka21cd204",
      direction: "INBOUND",
      departures: expandDepartures("06:20", "19:20", 60),
      offsets: R103_OFFSETS_IN,
    },
    {
      routeId: "R104",
      busId: "bus-ka21ef311",
      direction: "OUTBOUND",
      departures: expandDepartures("05:50", "20:10", 20),
      offsets: R104_OFFSETS_OUT,
    },
    {
      routeId: "R104",
      busId: "bus-ka21ef311",
      direction: "INBOUND",
      departures: expandDepartures("06:00", "20:20", 20),
      offsets: R104_OFFSETS_IN,
    },
  ]);
}
