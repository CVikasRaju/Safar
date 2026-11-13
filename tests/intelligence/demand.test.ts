import { describe, expect, it } from 'vitest';
import { buildSeedState } from '../../src/data/seed';
import {
  DEMAND_TOTAL_EXPECTED,
  DEMAND_TOTAL_SEATS,
  DEMAND_TOTAL_SHORTAGE,
} from '../../src/data/seed/demand';
import {
  allocateTravelRequestToRoute,
  analyseStudentDemand,
  calculateDemandTotals,
  calculateRouteDemandBreakdown,
  calculateTimeWindowDemand,
} from '../../src/domain/calculations/demand';
import type { StudentTravelRequest } from '../../src/domain/types';

function request(overrides: Partial<StudentTravelRequest> = {}): StudentTravelRequest {
  return {
    id: `STR-${Math.random().toString(36).slice(2, 8)}`,
    originVillageId: 'V002',
    destinationId: 'D001',
    travelDate: '2099-01-01',
    requiredArrivalTime: '09:00',
    groupSize: 5,
    submittedAt: '2099-01-01T06:00:00.000Z',
    provenance: 'USER_ENTERED',
    ...overrides,
  };
}

describe('demand and capacity analytics', () => {
  it('preserves the documented illustrative seed totals', () => {
    const state = buildSeedState();
    const rows = calculateRouteDemandBreakdown([], state.demandSeed, state.routes, state.stops);
    const totals = calculateDemandTotals(rows);

    expect(totals.totalExpected).toBe(DEMAND_TOTAL_EXPECTED);
    expect(totals.totalSeats).toBe(DEMAND_TOTAL_SEATS);
    expect(totals.totalShortage).toBe(DEMAND_TOTAL_SHORTAGE);
    expect(totals.totalShortage).toBe(70); // network arithmetic, not the sum of route shortages
    expect(totals.totalOccupied).toBe(330);
    expect(totals.totalRemaining).toBe(20);

    const r101 = rows.find(row => row.routeId === 'R101')!;
    const r102 = rows.find(row => row.routeId === 'R102')!;
    const r103 = rows.find(row => row.routeId === 'R103')!;

    expect([r101.expectedStudents, r101.availableSeats]).toEqual([145, 100]);
    expect([r102.expectedStudents, r102.availableSeats]).toEqual([90, 110]);
    expect([r103.expectedStudents, r103.availableSeats]).toEqual([185, 140]);
    expect(r101.shortage).toBe(45);
    expect(r102.shortage).toBe(0);
    expect(r102.surplus).toBe(20);
    expect(r103.shortage).toBe(45);
  });

  it('allocates a submission once to a seeded route that serves both ends', () => {
    const state = buildSeedState();
    const rows = calculateRouteDemandBreakdown(
      [request({ originVillageId: 'V002', groupSize: 5 })],
      state.demandSeed,
      state.routes,
      state.stops,
    );
    const r101 = rows.find(row => row.routeId === 'R101')!;

    expect(r101.submittedStudents).toBe(5);
    expect(r101.expectedStudents).toBe(150);

    const totalSubmitted = rows.reduce((sum, row) => sum + row.submittedStudents, 0);
    expect(totalSubmitted).toBe(5); // never double-counted across R101 and R104
  });

  it('selects deterministically by fewest stops, then route id', () => {
    const state = buildSeedState();
    const routeId = allocateTravelRequestToRoute(
      request({ originVillageId: 'V004' }),
      state.routes,
      state.stops,
      ['R101', 'R103'],
    );

    expect(routeId).toBe('R103');
  });

  it('reports unallocated intent instead of inventing a route', () => {
    const state = buildSeedState();
    const analysis = analyseStudentDemand(
      [request({ originVillageId: 'V005', destinationId: 'D004', groupSize: 7 })],
      state.demandSeed,
      state.routes,
      state.stops,
      state.villages,
    );

    expect(analysis.allocation.unallocatedRequests).toBe(1);
    expect(analysis.allocation.unallocatedStudents).toBe(7);
    expect(analysis.totals.totalExpected).toBe(DEMAND_TOTAL_EXPECTED);
  });

  it('ignores invalid group sizes without inflating demand', () => {
    const state = buildSeedState();
    const analysis = analyseStudentDemand(
      [request({ groupSize: 0 }), request({ groupSize: Number.NaN })],
      state.demandSeed,
      state.routes,
      state.stops,
      state.villages,
    );

    expect(analysis.totals.totalExpected).toBe(DEMAND_TOTAL_EXPECTED);
    expect(analysis.allocation.allocatedStudents).toBe(0);
    expect(analysis.allocation.unallocatedRequests).toBe(2);
  });

  it('aggregates village demand without exposing individual records', () => {
    const state = buildSeedState();
    const analysis = analyseStudentDemand(
      [
        request({ originVillageId: 'V002', groupSize: 4 }),
        request({ originVillageId: 'V002', groupSize: 6 }),
        request({ originVillageId: 'V003', groupSize: 3 }),
      ],
      state.demandSeed,
      state.routes,
      state.stops,
      state.villages,
    );

    const sullia = analysis.villages.find(row => row.villageId === 'V002')!;
    expect(sullia.submittedStudents).toBe(10);
    expect(sullia.requests).toBe(2);
    expect(sullia.servedByRouteIds).toEqual(['R101']);
    expect(analysis.villages.find(row => row.villageId === 'V003')?.submittedStudents).toBe(3);
  });

  it('buckets time-based demand by required arrival window', () => {
    const rows = calculateTimeWindowDemand([
      request({ requiredArrivalTime: '06:30', groupSize: 2 }),
      request({ requiredArrivalTime: '08:15', groupSize: 3 }),
      request({ requiredArrivalTime: '09:30', groupSize: 4 }),
      request({ requiredArrivalTime: 'not-a-time', groupSize: 1 }),
    ]);

    expect(rows.find(row => row.window === 'Before 07:00')?.submittedStudents).toBe(2);
    expect(rows.find(row => row.window === '08:00–08:59')?.submittedStudents).toBe(3);
    expect(rows.find(row => row.window === '09:00 and later')?.submittedStudents).toBe(4);
    expect(rows.find(row => row.window === 'Not specified')?.submittedStudents).toBe(1);
  });

  it('handles an empty network and empty demand seed', () => {
    const analysis = analyseStudentDemand([request()], [], [], [], []);
    expect(analysis.rows).toHaveLength(0);
    expect(analysis.totals.totalExpected).toBe(0);
    expect(analysis.allocation.unallocatedStudents).toBe(5);
  });
});
