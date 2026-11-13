import type {
  Bus,
  Destination,
  NetworkData,
  RegionalEvent,
  Route,
  RouteDemandSeed,
  Stop,
  StopWalkLink,
  TimetableService,
  TimetableStopTime,
  Village,
} from "../domain/types";
import {
  SCENARIO_EVENT_ID,
  SCENARIO_EVENT_PREPARATION_BUFFER_MINUTES,
} from "../domain/constants";
import { addDaysISO, minutesToTime, nowISO, timeToMinutes, todayISO } from "../domain/time";

/**
 * SAFAR canonical demo dataset.
 *
 * Every value here is illustrative prototype data for the Puttur region.
 * It is not an official timetable, GPS feed, traffic measurement or
 * government record. All records are immutable at module level and cloned
 * into each new application state.
 */

const DEMO = "DEMO" as const;

export const VILLAGES: Village[] = [
  {
    id: "V_PUTTUR",
    name: "Puttur",
    kind: "TOWN",
    latitude: 12.7598,
    longitude: 75.2028,
    accessStops: [
      { stopId: "st-puttur-bus-stand", walkMinutes: 6, provenance: DEMO },
      { stopId: "st-puttur-market", walkMinutes: 4, provenance: DEMO },
    ],
    provenance: DEMO,
  },
  {
    id: "V_SULLIA",
    name: "Sullia",
    kind: "TOWN",
    latitude: 12.628,
    longitude: 75.39,
    accessStops: [
      { stopId: "st-sullia-bus-stand", walkMinutes: 5, provenance: DEMO },
      { stopId: "st-sullia-polytechnic-gate", walkMinutes: 3, provenance: DEMO },
    ],
    provenance: DEMO,
  },
  {
    id: "V_UPPINANGADY",
    name: "Uppinangady",
    kind: "TOWN",
    latitude: 12.8004,
    longitude: 75.2664,
    accessStops: [
      { stopId: "st-uppinangady-bus-stand", walkMinutes: 5, provenance: DEMO },
      { stopId: "st-uppinangady-cross", walkMinutes: 4, provenance: DEMO },
    ],
    provenance: DEMO,
  },
  {
    id: "V_KADABA",
    name: "Kadaba",
    kind: "VILLAGE",
    latitude: 12.7204,
    longitude: 75.3601,
    accessStops: [
      { stopId: "st-kadaba-bus-stand", walkMinutes: 5, provenance: DEMO },
      { stopId: "st-kadaba-temple", walkMinutes: 6, provenance: DEMO },
    ],
    provenance: DEMO,
  },
  {
    id: "V_VITTAL",
    name: "Vittal",
    kind: "VILLAGE",
    latitude: 12.7408,
    longitude: 75.1298,
    accessStops: [
      { stopId: "st-vittal-bus-stand", walkMinutes: 6, provenance: DEMO },
      { stopId: "st-vittal-junction", walkMinutes: 4, provenance: DEMO },
    ],
    provenance: DEMO,
  },
];

export const DESTINATIONS: Destination[] = [
  {
    id: "DST_PGC",
    name: "Puttur Government College",
    villageId: "V_PUTTUR",
    latitude: 12.7662,
    longitude: 75.2081,
    accessStops: [{ stopId: "st-puttur-college-gate", walkMinutes: 3, provenance: DEMO }],
    provenance: DEMO,
  },
  {
    id: "DST_PU_COLLEGE",
    name: "Puttur Government PU College",
    villageId: "V_PUTTUR",
    latitude: 12.7631,
    longitude: 75.2044,
    accessStops: [
      { stopId: "st-puttur-college-gate", walkMinutes: 8, provenance: DEMO },
      { stopId: "st-puttur-bus-stand", walkMinutes: 7, provenance: DEMO },
    ],
    provenance: DEMO,
  },
  {
    id: "DST_POLYTECHNIC",
    name: "Sullia Government Polytechnic",
    villageId: "V_SULLIA",
    latitude: 12.6335,
    longitude: 75.3938,
    accessStops: [
      { stopId: "st-sullia-polytechnic-gate", walkMinutes: 4, provenance: DEMO },
    ],
    provenance: DEMO,
  },
];

export const STOPS: Stop[] = [
  {
    id: "st-puttur-bus-stand",
    name: "Puttur Bus Stand",
    villageId: "V_PUTTUR",
    latitude: 12.7602,
    longitude: 75.2021,
    provenance: DEMO,
  },
  {
    id: "st-puttur-market",
    name: "Puttur Market",
    villageId: "V_PUTTUR",
    latitude: 12.7624,
    longitude: 75.2051,
    provenance: DEMO,
  },
  {
    id: "st-puttur-college-gate",
    name: "Puttur College Gate",
    villageId: "V_PUTTUR",
    latitude: 12.7664,
    longitude: 75.2079,
    provenance: DEMO,
  },
  {
    id: "st-uppinangady-bus-stand",
    name: "Uppinangady Bus Stand",
    villageId: "V_UPPINANGADY",
    latitude: 12.8001,
    longitude: 75.2671,
    provenance: DEMO,
  },
  {
    id: "st-uppinangady-cross",
    name: "Uppinangady Cross",
    villageId: "V_UPPINANGADY",
    latitude: 12.7978,
    longitude: 75.2645,
    provenance: DEMO,
  },
  {
    id: "st-kadaba-bus-stand",
    name: "Kadaba Bus Stand",
    villageId: "V_KADABA",
    latitude: 12.7207,
    longitude: 75.3607,
    provenance: DEMO,
  },
  {
    id: "st-kadaba-temple",
    name: "Kadaba Temple Stop",
    villageId: "V_KADABA",
    latitude: 12.7225,
    longitude: 75.3629,
    provenance: DEMO,
  },
  {
    id: "st-sullia-bus-stand",
    name: "Sullia Bus Stand",
    villageId: "V_SULLIA",
    latitude: 12.6286,
    longitude: 75.3904,
    provenance: DEMO,
  },
  {
    id: "st-sullia-polytechnic-gate",
    name: "Sullia Polytechnic Gate",
    villageId: "V_SULLIA",
    latitude: 12.6333,
    longitude: 75.3934,
    provenance: DEMO,
  },
  {
    id: "st-vittal-bus-stand",
    name: "Vittal Bus Stand",
    villageId: "V_VITTAL",
    latitude: 12.7411,
    longitude: 75.1292,
    provenance: DEMO,
  },
  {
    id: "st-vittal-junction",
    name: "Vittal Junction",
    villageId: "V_VITTAL",
    latitude: 12.7452,
    longitude: 75.1338,
    provenance: DEMO,
  },
  {
    id: "st-panemangalore-cross",
    name: "Panemangalore Cross",
    villageId: "V_UPPINANGADY",
    latitude: 12.7852,
    longitude: 75.2512,
    provenance: DEMO,
  },
];

const R101_STOPS = [
  "st-vittal-bus-stand",
  "st-vittal-junction",
  "st-panemangalore-cross",
  "st-uppinangady-cross",
  "st-uppinangady-bus-stand",
  "st-puttur-market",
  "st-puttur-bus-stand",
  "st-puttur-college-gate",
];

const R102_STOPS = [
  "st-sullia-bus-stand",
  "st-sullia-polytechnic-gate",
  "st-kadaba-bus-stand",
  "st-kadaba-temple",
  "st-puttur-market",
  "st-puttur-bus-stand",
  "st-puttur-college-gate",
];

const R103_STOPS = [
  "st-kadaba-bus-stand",
  "st-kadaba-temple",
  "st-panemangalore-cross",
  "st-puttur-market",
  "st-puttur-bus-stand",
  "st-puttur-college-gate",
];

const R104_STOPS = [
  "st-vittal-bus-stand",
  "st-uppinangady-bus-stand",
  "st-puttur-bus-stand",
  "st-puttur-college-gate",
];

export const ROUTES: Route[] = [
  {
    id: "R101",
    name: "Vittal – Uppinangady – Puttur College (local)",
    originVillageId: "V_VITTAL",
    destinationVillageId: "V_PUTTUR",
    stopIds: R101_STOPS,
    demoLengthKm: 34,
    provenance: DEMO,
  },
  {
    id: "R102",
    name: "Sullia – Kadaba – Puttur College",
    originVillageId: "V_SULLIA",
    destinationVillageId: "V_PUTTUR",
    stopIds: R102_STOPS,
    demoLengthKm: 41,
    provenance: DEMO,
  },
  {
    id: "R103",
    name: "Kadaba – Panemangalore – Puttur College",
    originVillageId: "V_KADABA",
    destinationVillageId: "V_PUTTUR",
    stopIds: R103_STOPS,
    demoLengthKm: 29,
    provenance: DEMO,
  },
  {
    id: "R104",
    name: "Vittal – Uppinangady – Puttur College (express)",
    originVillageId: "V_VITTAL",
    destinationVillageId: "V_PUTTUR",
    stopIds: R104_STOPS,
    demoLengthKm: 33,
    provenance: DEMO,
  },
];

export const STOP_WALK_LINKS: StopWalkLink[] = [
  { fromStopId: "st-puttur-market", toStopId: "st-puttur-bus-stand", walkMinutes: 6, provenance: DEMO },
  { fromStopId: "st-puttur-bus-stand", toStopId: "st-puttur-market", walkMinutes: 6, provenance: DEMO },
  { fromStopId: "st-uppinangady-cross", toStopId: "st-uppinangady-bus-stand", walkMinutes: 5, provenance: DEMO },
  { fromStopId: "st-uppinangady-bus-stand", toStopId: "st-uppinangady-cross", walkMinutes: 5, provenance: DEMO },
  { fromStopId: "st-vittal-bus-stand", toStopId: "st-vittal-junction", walkMinutes: 4, provenance: DEMO },
  { fromStopId: "st-vittal-junction", toStopId: "st-vittal-bus-stand", walkMinutes: 4, provenance: DEMO },
  { fromStopId: "st-sullia-bus-stand", toStopId: "st-sullia-polytechnic-gate", walkMinutes: 6, provenance: DEMO },
  { fromStopId: "st-sullia-polytechnic-gate", toStopId: "st-sullia-bus-stand", walkMinutes: 6, provenance: DEMO },
  { fromStopId: "st-kadaba-bus-stand", toStopId: "st-kadaba-temple", walkMinutes: 4, provenance: DEMO },
  { fromStopId: "st-kadaba-temple", toStopId: "st-kadaba-bus-stand", walkMinutes: 4, provenance: DEMO },
];

interface ServiceSeed {
  id: string;
  routeId: string;
  busId: string;
  serviceNumber: string;
  departure: string;
}

const SERVICE_SEEDS: ServiceSeed[] = [
  // R101 — local service via Uppinangady.
  { id: "svc-r101-0615", routeId: "R101", busId: "bus-101", serviceNumber: "R101 / 06:15", departure: "06:15" },
  { id: "svc-r101-0700", routeId: "R101", busId: "bus-101", serviceNumber: "R101 / 07:00", departure: "07:00" },
  { id: "svc-r101-0745", routeId: "R101", busId: "bus-101", serviceNumber: "R101 / 07:45", departure: "07:45" },
  { id: "svc-r101-0830", routeId: "R101", busId: "bus-101", serviceNumber: "R101 / 08:30", departure: "08:30" },
  { id: "svc-r101-1630", routeId: "R101", busId: "bus-101", serviceNumber: "R101 / 16:30", departure: "16:30" },

  // R102 — Sullia and Kadaba.
  { id: "svc-r102-0640", routeId: "R102", busId: "bus-102", serviceNumber: "R102 / 06:40", departure: "06:40" },
  { id: "svc-r102-0715", routeId: "R102", busId: "bus-102", serviceNumber: "R102 / 07:15", departure: "07:15" },
  { id: "svc-r102-0755", routeId: "R102", busId: "bus-102", serviceNumber: "R102 / 07:55", departure: "07:55" },
  { id: "svc-r102-0835", routeId: "R102", busId: "bus-102", serviceNumber: "R102 / 08:35", departure: "08:35" },
  { id: "svc-r102-1620", routeId: "R102", busId: "bus-102", serviceNumber: "R102 / 16:20", departure: "16:20" },

  // R103 — Kadaba via Panemangalore.
  { id: "svc-r103-0635", routeId: "R103", busId: "bus-103", serviceNumber: "R103 / 06:35", departure: "06:35" },
  { id: "svc-r103-0710", routeId: "R103", busId: "bus-103", serviceNumber: "R103 / 07:10", departure: "07:10" },
  { id: "svc-r103-0750", routeId: "R103", busId: "bus-103", serviceNumber: "R103 / 07:50", departure: "07:50" },
  { id: "svc-r103-0830", routeId: "R103", busId: "bus-103", serviceNumber: "R103 / 08:30", departure: "08:30" },
  { id: "svc-r103-1625", routeId: "R103", busId: "bus-103", serviceNumber: "R103 / 16:25", departure: "16:25" },

  // R104 — Vittal express, the alternative when R101 fails.
  { id: "svc-r104-0620", routeId: "R104", busId: "bus-107", serviceNumber: "R104 / 06:20", departure: "06:20" },
  { id: "svc-r104-0655", routeId: "R104", busId: "bus-107", serviceNumber: "R104 / 06:55", departure: "06:55" },
  { id: "svc-r104-0730", routeId: "R104", busId: "bus-107", serviceNumber: "R104 / 07:30", departure: "07:30" },
  { id: "svc-r104-0810", routeId: "R104", busId: "bus-107", serviceNumber: "R104 / 08:10", departure: "08:10" },
  { id: "svc-r104-0845", routeId: "R104", busId: "bus-107", serviceNumber: "R104 / 08:45", departure: "08:45" },
  { id: "svc-r104-1640", routeId: "R104", busId: "bus-107", serviceNumber: "R104 / 16:40", departure: "16:40" },
];

/** Minutes from the route origin to each stop, per route. */
const ROUTE_OFFSETS: Record<string, number[]> = {
  R101: [0, 5, 18, 30, 36, 52, 58, 65],
  R102: [0, 6, 22, 27, 43, 47, 53],
  R103: [0, 5, 18, 33, 39, 47],
  R104: [0, 25, 42, 50],
};

function buildStopTimes(routeId: string, departure: string): TimetableStopTime[] {
  const route = ROUTES.find((item) => item.id === routeId);
  const offsets = ROUTE_OFFSETS[routeId];
  if (!route || !offsets) throw new Error(`Seed route ${routeId} has no offsets.`);
  const start = timeToMinutes(departure);
  return route.stopIds.map((stopId, index) => ({
    stopId,
    time: minutesToTime(start + offsets[index]),
  }));
}

export const SERVICES: TimetableService[] = SERVICE_SEEDS.map((seed) => ({
  id: seed.id,
  routeId: seed.routeId,
  busId: seed.busId,
  serviceNumber: seed.serviceNumber,
  direction: "OUTBOUND",
  stopTimes: buildStopTimes(seed.routeId, seed.departure),
  operatesOn: "WEEKDAYS",
  provenance: DEMO,
}));

export const BUSES: Bus[] = [
  {
    id: "bus-101",
    registration: "KA-21-AB-102",
    assignedRouteId: "R101",
    capacity: 60,
    occupiedSeats: 40,
    status: "OPERATING",
    lastKnownLocationLabel: "Puttur Bus Stand",
    estimatedResponseMinutes: 15,
    commitments: ["route:R101"],
    provenance: DEMO,
  },
  {
    id: "bus-102",
    registration: "KA-21-AB-104",
    assignedRouteId: "R102",
    capacity: 55,
    occupiedSeats: 30,
    status: "OPERATING",
    lastKnownLocationLabel: "Sullia Bus Stand",
    estimatedResponseMinutes: 18,
    commitments: ["route:R102"],
    provenance: DEMO,
  },
  {
    id: "bus-103",
    registration: "KA-21-AB-108",
    assignedRouteId: "R103",
    capacity: 60,
    occupiedSeats: 55,
    status: "OPERATING",
    lastKnownLocationLabel: "Kadaba Bus Stand",
    estimatedResponseMinutes: 20,
    commitments: ["route:R103"],
    provenance: DEMO,
  },
  {
    id: "bus-104",
    registration: "KA-21-CD-201",
    assignedRouteId: null,
    capacity: 65,
    occupiedSeats: 0,
    status: "AVAILABLE",
    lastKnownLocationLabel: "Puttur Depot",
    estimatedResponseMinutes: 12,
    commitments: [],
    provenance: DEMO,
  },
  {
    id: "bus-105",
    registration: "KA-21-CD-207",
    assignedRouteId: null,
    capacity: 45,
    occupiedSeats: 0,
    status: "AVAILABLE",
    lastKnownLocationLabel: "Puttur Depot",
    estimatedResponseMinutes: 18,
    commitments: [],
    provenance: DEMO,
  },
  {
    id: "bus-106",
    registration: "KA-21-EF-311",
    assignedRouteId: null,
    capacity: 55,
    occupiedSeats: 0,
    status: "MAINTENANCE",
    lastKnownLocationLabel: "Puttur Workshop",
    estimatedResponseMinutes: 60,
    commitments: ["maintenance:scheduled"],
    provenance: DEMO,
  },
  {
    id: "bus-107",
    registration: "KA-21-EF-318",
    assignedRouteId: "R104",
    capacity: 50,
    occupiedSeats: 20,
    status: "OPERATING",
    lastKnownLocationLabel: "Uppinangady Bus Stand",
    estimatedResponseMinutes: 16,
    commitments: ["route:R104"],
    provenance: DEMO,
  },
  {
    id: "bus-108",
    registration: "KA-21-GH-405",
    assignedRouteId: null,
    capacity: 40,
    occupiedSeats: 0,
    status: "AVAILABLE",
    lastKnownLocationLabel: "Sullia Depot",
    estimatedResponseMinutes: 25,
    commitments: [],
    provenance: DEMO,
  },
];

/**
 * Required illustrative baseline demand. R101/R102/R103 total 420 students and
 * 350 seats (70-seat potential shortage). R104 is the express overlay used by
 * the event/breakdown scenario and carries no separate baseline sample, so the
 * mandated totals stay exact.
 */
export const DEMAND_SEED: RouteDemandSeed[] = [
  { routeId: "R101", expectedStudents: 145, availableSeats: 100, provenance: DEMO },
  { routeId: "R102", expectedStudents: 90, availableSeats: 110, provenance: DEMO },
  { routeId: "R103", expectedStudents: 185, availableSeats: 140, provenance: DEMO },
  {
    routeId: "R104",
    expectedStudents: 0,
    availableSeats: 0,
    provenance: DEMO,
    note: "Express overlay route seeded for the event/breakdown scenario. No separate baseline demand sample is added because the required totals are fixed at 420 students / 350 seats for R101–R103.",
  },
];

export function createSeedEvent(scenarioDate: string, timestamp = nowISO()): RegionalEvent {
  return {
    id: SCENARIO_EVENT_ID,
    name: "Uppinangady Temple Festival (Town B)",
    category: "TEMPLE_FESTIVAL",
    locationLabel: "Town B — Uppinangady town centre",
    villageId: "V_UPPINANGADY",
    latitude: 12.8004,
    longitude: 75.2664,
    date: scenarioDate,
    startTime: "16:00",
    endTime: "22:00",
    crowdLevel: "VERY_HIGH",
    nearbyVillageIds: ["V_UPPINANGADY", "V_KADABA", "V_VITTAL"],
    affectedRoadLabels: ["Uppinangady–Puttur main road (illustrative)"],
    declaredAffectedRouteIds: ["R101", "R104"],
    preparationBuffer: {
      minutes: SCENARIO_EVENT_PREPARATION_BUFFER_MINUTES,
      source: "Scenario-configured 90-minute pre-event preparation buffer",
    },
    description:
      "Simulated major temple festival near Town B. Crowd and congestion estimates are predicted, not verified road closures.",
    source: "SAFAR scenario seed (simulated)",
    provenance: "SIMULATED",
    verificationStatus: "SIMULATED",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export interface SeedData {
  network: NetworkData;
  buses: Bus[];
  demandSeed: RouteDemandSeed[];
  events: RegionalEvent[];
  scenarioDate: string;
}

export interface SeedOptions {
  /** Clock used for generated timestamps and the default scenario date. */
  now?: Date;
  /** "YYYY-MM-DD". Defaults to tomorrow relative to `now`. */
  scenarioDate?: string;
}

export function defaultScenarioDate(now: Date = new Date()): string {
  return addDaysISO(todayISO(now), 1);
}

/** Returns a fresh, deep-cloned copy of the seed data. */
export function createSeedData(options: SeedOptions = {}): SeedData {
  const now = options.now ?? new Date();
  const timestamp = nowISO(now);
  const scenarioDate = options.scenarioDate ?? defaultScenarioDate(now);

  const network: NetworkData = structuredClone({
    villages: VILLAGES,
    destinations: DESTINATIONS,
    stops: STOPS,
    routes: ROUTES,
    services: SERVICES,
    stopWalkLinks: STOP_WALK_LINKS,
  });

  return {
    network,
    buses: structuredClone(BUSES),
    demandSeed: structuredClone(DEMAND_SEED),
    events: [createSeedEvent(scenarioDate, timestamp)],
    scenarioDate,
  };
}
