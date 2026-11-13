// SAFAR — Student Demand & Capacity Analytics (Member 3)
// Deterministic aggregation per docs/08_DEMAND_AND_CAPACITY.md
//
// Documented illustrative baseline (seed):
//   R101 145 expected / 100 seats, R102 90 / 110, R103 185 / 140
//   Total 420 expected / 350 seats → 70 seat potential shortage.
//
// Student travel-intent submissions are allocated ONCE to a seeded route that
// serves the origin village and the requested destination (fewest stops wins,
// then lowest route id). A student is never counted on every candidate route.
// If no seeded route serves the request it is reported as unallocated rather
// than silently added somewhere.
//
// This is illustrative demand arithmetic. It is NOT a trained ML forecast and
// the seed values are not measured passenger counts.

import type {
  DemandSeed,
  StudentTravelRequest,
  RouteDemand,
  Route,
  Stop,
  Village,
  Provenance,
} from '../types';

export const DEMAND_METHOD_NOTE =
  'Illustrative demand and seat arithmetic. Travel intent is allocated once per submission to a seeded route; base values are demo seed data, not measured passenger counts. No trained machine-learning model is used.';

export const DEMAND_PRIVACY_NOTE =
  'Analytics show aggregates only. No student names, contact details or individual journey records are exposed in authority views.';

export interface RouteDemandBreakdown extends RouteDemand {
  routeName: string;
  baselineExpectedStudents: number;
  submittedStudents: number;
  utilisationPct: number; // occupied seats as % of seats provided
  allocationBasis: string;
  provenance: Provenance;
}

export interface DemandTotals {
  totalExpected: number;
  totalSeats: number;
  totalOccupied: number;
  totalRemaining: number;
  totalShortage: number;
  totalSurplus: number;
  overcrowdedRoutes: number;
}

export interface VillageDemandRow {
  villageId: string;
  villageName: string;
  submittedStudents: number;
  allocatedStudents: number;
  requests: number;
  servedByRouteIds: string[];
}

export interface TimeWindowDemandRow {
  window: string;
  submittedStudents: number;
  requests: number;
}

export interface DemandAllocationSummary {
  totalRequests: number;
  allocatedRequests: number;
  unallocatedRequests: number;
  allocatedStudents: number;
  unallocatedStudents: number;
  methodNote: string;
}

export interface DemandAnalysis {
  rows: RouteDemandBreakdown[];
  totals: DemandTotals;
  allocation: DemandAllocationSummary;
  villages: VillageDemandRow[];
  timeWindows: TimeWindowDemandRow[];
}

const TIME_WINDOWS = [
  'Before 07:00',
  '07:00–07:59',
  '08:00–08:59',
  '09:00 and later',
  'Not specified',
] as const;

function validGroupSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function timeWindowFor(arrival: string | undefined): (typeof TIME_WINDOWS)[number] {
  if (!arrival) return 'Not specified';
  const match = /^(\d{1,2}):(\d{2})$/.exec(arrival.trim());
  if (!match) return 'Not specified';
  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour > 23) return 'Not specified';
  if (hour < 7) return 'Before 07:00';
  if (hour < 8) return '07:00–07:59';
  if (hour < 9) return '08:00–08:59';
  return '09:00 and later';
}

/**
 * Deterministic single-route allocation for a travel-intent submission.
 * Returns null when no permitted seeded route serves both ends of the trip.
 */
export function allocateTravelRequestToRoute(
  request: StudentTravelRequest,
  routes: Route[],
  stops: Stop[],
  allowedRouteIds?: string[],
): string | null {
  if (validGroupSize(request.groupSize) === 0) return null;

  const originStopIds = new Set(
    stops.filter(stop => stop.villageId === request.originVillageId).map(stop => stop.id),
  );
  if (originStopIds.size === 0) return null;

  const candidates = routes.filter(route => {
    if (allowedRouteIds && !allowedRouteIds.includes(route.id)) return false;
    if (route.destinationId && route.destinationId !== request.destinationId) return false;
    const stopsList = route.stopIds ?? route.stops ?? [];
    return stopsList.some(stopId => originStopIds.has(stopId));
  });

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const aLen = (a.stopIds ?? a.stops ?? []).length;
    const bLen = (b.stopIds ?? b.stops ?? []).length;
    if (aLen !== bLen) return aLen - bLen;
    return a.id.localeCompare(b.id);
  });
  return sorted[0].id;
}

interface AllocationEntry {
  request: StudentTravelRequest;
  routeId: string | null;
  students: number;
}

function allocateAll(
  submissions: StudentTravelRequest[],
  demandSeed: DemandSeed[],
  routes: Route[],
  stops: Stop[],
): AllocationEntry[] {
  const allowedRouteIds = demandSeed.map(seed => seed.routeId);
  return submissions.map(request => ({
    request,
    routeId: allocateTravelRequestToRoute(request, routes, stops, allowedRouteIds),
    students: validGroupSize(request.groupSize),
  }));
}

// ─── Route-level analysis ─────────────────────────────────────────────────────
export function calculateRouteDemandBreakdown(
  submissions: StudentTravelRequest[],
  demandSeed: DemandSeed[],
  routes: Route[] = [],
  stops: Stop[] = [],
): RouteDemandBreakdown[] {
  const allocations = allocateAll(submissions, demandSeed, routes, stops);
  const submittedByRoute = new Map<string, number>();
  for (const entry of allocations) {
    if (!entry.routeId || entry.students === 0) continue;
    submittedByRoute.set(
      entry.routeId,
      (submittedByRoute.get(entry.routeId) ?? 0) + entry.students,
    );
  }

  return demandSeed.map(seed => {
    const baselineExpectedStudents = Math.max(0, seed.expectedStudents);
    const availableSeats = Math.max(0, seed.availableSeats);
    const submittedStudents = submittedByRoute.get(seed.routeId) ?? 0;
    const expectedStudents = baselineExpectedStudents + submittedStudents;

    // Route capacity fills in expected order: occupied seats cannot exceed the
    // seats provided, and any demand above capacity is an explicit shortage.
    const occupiedSeats = Math.min(expectedStudents, availableSeats);
    const remainingSeats = Math.max(0, availableSeats - occupiedSeats);
    const shortage = Math.max(0, expectedStudents - availableSeats);
    const surplus = Math.max(0, availableSeats - expectedStudents);

    const route = routes.find(item => item.id === seed.routeId);

    return {
      routeId: seed.routeId,
      routeName: route?.name ?? seed.routeId,
      expectedStudents,
      availableSeats,
      occupiedSeats,
      remainingSeats,
      shortage,
      surplus,
      overcrowdingRisk: shortage > 0,
      baselineExpectedStudents,
      submittedStudents,
      utilisationPct:
        availableSeats > 0 ? Math.round((occupiedSeats / availableSeats) * 100) : 0,
      allocationBasis:
        submittedStudents > 0
          ? `${submittedStudents} student(s) from travel-intent submissions allocated to this route`
          : 'Illustrative seed demand only',
      provenance: 'CALCULATED' as Provenance,
    };
  });
}

/** Backwards-compatible shared signature. */
export function calculateStudentDemand(
  submissions: StudentTravelRequest[],
  demandSeed: DemandSeed[],
  routes: Route[] = [],
  stops: Stop[] = [],
): RouteDemand[] {
  return calculateRouteDemandBreakdown(submissions, demandSeed, routes, stops);
}

export function calculateDemandTotals(demands: RouteDemand[]): DemandTotals {
  const totalExpected = demands.reduce((sum, row) => sum + row.expectedStudents, 0);
  const totalSeats = demands.reduce((sum, row) => sum + row.availableSeats, 0);

  return {
    totalExpected,
    totalSeats,
    totalOccupied: demands.reduce((sum, row) => sum + row.occupiedSeats, 0),
    totalRemaining: demands.reduce((sum, row) => sum + row.remainingSeats, 0),
    // Network totals follow the documented arithmetic: 420 − 350 = 70.
    // Route shortages are shown per route (45 / 0 / 45) and are not summed here,
    // because R102's surplus is not transferable in this illustrative model.
    totalShortage: Math.max(0, totalExpected - totalSeats),
    totalSurplus: Math.max(0, totalSeats - totalExpected),
    overcrowdedRoutes: demands.filter(row => row.overcrowdingRisk).length,
  };
}

// ─── Village and time breakdowns ──────────────────────────────────────────────
export function calculateVillageDemand(
  submissions: StudentTravelRequest[],
  demandSeed: DemandSeed[],
  villages: Village[],
  routes: Route[] = [],
  stops: Stop[] = [],
): VillageDemandRow[] {
  const allocations = allocateAll(submissions, demandSeed, routes, stops);
  const byVillage = new Map<string, VillageDemandRow>();

  for (const entry of allocations) {
    if (entry.students === 0) continue;
    const villageId = entry.request.originVillageId;
    const village = villages.find(item => item.id === villageId);
    const existing = byVillage.get(villageId) ?? {
      villageId,
      villageName: village?.name ?? villageId,
      submittedStudents: 0,
      allocatedStudents: 0,
      requests: 0,
      servedByRouteIds: [],
    };
    existing.requests += 1;
    existing.submittedStudents += entry.students;
    if (entry.routeId) {
      existing.allocatedStudents += entry.students;
      if (!existing.servedByRouteIds.includes(entry.routeId)) {
        existing.servedByRouteIds.push(entry.routeId);
      }
    }
    byVillage.set(villageId, existing);
  }

  return [...byVillage.values()].sort(
    (a, b) => b.submittedStudents - a.submittedStudents || a.villageName.localeCompare(b.villageName),
  );
}

export function calculateTimeWindowDemand(
  submissions: StudentTravelRequest[],
): TimeWindowDemandRow[] {
  const rows = new Map<string, TimeWindowDemandRow>(
    TIME_WINDOWS.map(window => [window, { window, submittedStudents: 0, requests: 0 }]),
  );

  for (const request of submissions) {
    const students = validGroupSize(request.groupSize);
    if (students === 0) continue;
    const window = timeWindowFor(request.requiredArrivalTime);
    const row = rows.get(window)!;
    row.requests += 1;
    row.submittedStudents += students;
  }

  return TIME_WINDOWS.map(window => rows.get(window)!);
}

// ─── Combined analysis for the dashboard ──────────────────────────────────────
export function analyseStudentDemand(
  submissions: StudentTravelRequest[],
  demandSeed: DemandSeed[],
  routes: Route[],
  stops: Stop[],
  villages: Village[],
): DemandAnalysis {
  const rows = calculateRouteDemandBreakdown(submissions, demandSeed, routes, stops);
  const allocations = allocateAll(submissions, demandSeed, routes, stops);

  const allocation: DemandAllocationSummary = {
    totalRequests: allocations.length,
    allocatedRequests: allocations.filter(entry => entry.routeId !== null && entry.students > 0)
      .length,
    unallocatedRequests: allocations.filter(entry => entry.routeId === null || entry.students === 0)
      .length,
    allocatedStudents: allocations
      .filter(entry => entry.routeId !== null)
      .reduce((sum, entry) => sum + entry.students, 0),
    unallocatedStudents: allocations
      .filter(entry => entry.routeId === null)
      .reduce((sum, entry) => sum + entry.students, 0),
    methodNote: DEMAND_METHOD_NOTE,
  };

  return {
    rows,
    totals: calculateDemandTotals(rows),
    allocation,
    villages: calculateVillageDemand(submissions, demandSeed, villages, routes, stops),
    timeWindows: calculateTimeWindowDemand(submissions),
  };
}
