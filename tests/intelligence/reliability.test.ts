import { describe, expect, it } from 'vitest';
import { buildSeedState } from '../../src/data/seed';
import {
  RELIABILITY_DISCLAIMER,
  buildReliabilityContext,
  calculateJourneyReliability,
  calculateRouteReliability,
} from '../../src/domain/calculations/reliability';
import type { Bus, EventRouteImpact, JourneyOption } from '../../src/domain/types';
import type { ReliabilityContext } from '../../src/domain/calculations/reliability';

function eventImpact(overrides: Partial<EventRouteImpact> = {}): EventRouteImpact {
  return {
    eventId: 'EVT-TEST',
    routeId: 'R101',
    impactScore: 100,
    riskLevel: 'CRITICAL',
    crowdScore: 100,
    proximityScore: 100,
    overlapScore: 100,
    routeImportanceScore: 100,
    durationScore: 100,
    explanation: 'test impact',
    estimatedDelayMinutes: 45,
    calculatedAt: '2099-01-01T00:00:00.000Z',
    provenance: 'CALCULATED',
    ...overrides,
  };
}

function bus(overrides: Partial<Bus> = {}): Bus {
  return {
    id: 'B001',
    registration: 'KA-21-AB-102',
    assignedRouteId: 'R101',
    capacity: 52,
    occupiedSeats: 38,
    status: 'OPERATING',
    lastKnownLocationLabel: 'Test',
    estimatedResponseMinutes: 0,
    commitments: [],
    provenance: 'DEMO',
    ...overrides,
  };
}

function journey(overrides: Partial<JourneyOption> = {}): JourneyOption {
  return {
    id: 'J-TEST',
    originVillageId: 'V002',
    destinationId: 'D001',
    travelDate: '2099-01-01',
    requiredArrivalTime: '09:00',
    segments: [
      {
        id: 'SEG-1',
        type: 'BUS',
        fromLabel: 'Sullia',
        toLabel: 'Puttur',
        serviceId: 'T101A',
        busId: 'B001',
        departureTime: '07:00',
        arrivalTime: '08:00',
        durationMinutes: 60,
      },
    ],
    totalDurationMinutes: 60,
    transferCount: 0,
    walkingSegments: 0,
    departureTime: '07:00',
    expectedArrivalTime: '08:00',
    estimatedDelayMinutes: 0,
    reliabilityScore: 0,
    meetsArrivalDeadline: true,
    warnings: [],
    category: 'FASTEST',
    provenance: 'CALCULATED',
    ...overrides,
  };
}

function context(overrides: Partial<ReliabilityContext> = {}): ReliabilityContext {
  return {
    eventImpacts: [],
    buses: [bus()],
    activeIncidentRouteIds: [],
    routeIdByServiceId: { T101A: 'R101' },
    ...overrides,
  };
}

describe('journey reliability', () => {
  it('scores a clean journey at 100 with no penalties', () => {
    const result = calculateJourneyReliability(journey(), context());
    expect(result.score).toBe(100);
    expect(result.totalPenalty).toBe(0);
    expect(result.routeIds).toEqual(['R101']);
    expect(result.disclaimer).toBe(RELIABILITY_DISCLAIMER);
  });

  it('maps timetable service ids to real route ids', () => {
    const withMapping = calculateJourneyReliability(
      journey(),
      context({ eventImpacts: [eventImpact()] }),
    );
    const withoutMapping = calculateJourneyReliability(
      journey(),
      context({ eventImpacts: [eventImpact()], routeIdByServiceId: undefined }),
    );

    expect(withMapping.penalties.eventImpact).toBe(20);
    expect(withMapping.score).toBe(80);
    expect(withoutMapping.penalties.eventImpact).toBe(0);
    expect(withoutMapping.notes.join(' ')).toContain('no timetable route mapping');
  });

  it('converts raw delay into a capped penalty', () => {
    const result = calculateJourneyReliability(journey({ estimatedDelayMinutes: 30 }), context());
    expect(result.penalties.delay).toBe(25);
    expect(result.score).toBe(75);
  });

  it('does not count event delay twice in delay and event penalties', () => {
    const result = calculateJourneyReliability(
      journey({ estimatedDelayMinutes: 20 }),
      context({ eventImpacts: [eventImpact({ estimatedDelayMinutes: 20 })] }),
    );

    expect(result.eventDelayExcludedMinutes).toBe(20);
    expect(result.penalties.delay).toBe(0);
    expect(result.penalties.eventImpact).toBe(20);
    expect(result.score).toBe(80);
  });

  it('penalises active incidents and unavailable fleet on the corridor', () => {
    const incident = calculateJourneyReliability(
      journey(),
      context({ activeIncidentRouteIds: ['R101'] }),
    );
    const fleet = calculateJourneyReliability(
      journey(),
      context({ buses: [bus({ status: 'UNAVAILABLE' })] }),
    );

    expect(incident.penalties.busAvailability).toBe(15);
    expect(incident.score).toBe(85);
    expect(fleet.penalties.busAvailability).toBe(15);
    expect(fleet.score).toBe(85);
  });

  it('penalises long transfer waits and transfers, and clamps to 0', () => {
    const result = calculateJourneyReliability(
      journey({
        transferCount: 3,
        segments: [
          {
            id: 'W1',
            type: 'WAIT',
            fromLabel: 'Stop',
            toLabel: 'Stop',
            departureTime: '08:00',
            arrivalTime: '08:20',
            durationMinutes: 20,
          },
        ],
      }),
      context(),
    );

    expect(result.penalties.transferWaiting).toBe(9);
    expect(result.penalties.transferCount).toBe(10);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(100);
  });

  it('keeps the score within 0–100 even with every penalty applied', () => {
    const result = calculateJourneyReliability(
      journey({
        estimatedDelayMinutes: 120,
        transferCount: 4,
        segments: [
          {
            id: 'W1',
            type: 'WAIT',
            fromLabel: 'Stop',
            toLabel: 'Stop',
            departureTime: '08:00',
            arrivalTime: '08:02',
            durationMinutes: 2,
          },
        ],
      }),
      context({
        buses: [bus({ status: 'UNAVAILABLE' })],
        eventImpacts: [eventImpact()],
        activeIncidentRouteIds: ['R101'],
      }),
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('route reliability', () => {
  it('uses seeded event impacts and stays within bounds', () => {
    const state = buildSeedState();
    const result = calculateRouteReliability('R101', state);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.disclaimer).toBe(RELIABILITY_DISCLAIMER);
    expect(result.eventIds).toContain('EVT001');
  });

  it('reduces the score when a bus becomes unavailable', () => {
    const state = buildSeedState();
    const base = calculateRouteReliability('R101', state).score;

    const modified = structuredClone(state);
    const busToDisable = modified.buses.find(item => item.assignedRouteId === 'R101')!;
    busToDisable.status = 'UNAVAILABLE';

    const after = calculateRouteReliability('R101', modified);
    expect(after.score).toBeLessThan(base);
    expect(after.penalties.busAvailability).toBe(15);
  });

  it('updates when a confirmed incident is added', () => {
    const state = buildSeedState();
    const base = calculateRouteReliability('R101', state).score;

    const modified = structuredClone(state);
    modified.incidents.push({
      id: 'INC-TEST',
      type: 'BUS_BREAKDOWN',
      status: 'ACTIVE',
      routeId: 'R101',
      busId: 'B001',
      occurredAt: '2099-01-01T07:00:00.000Z',
      severity: 'HIGH',
      relatedReportIds: [],
      affectedJourneyIds: [],
      estimatedAffectedPassengers: 38,
      confirmedByRole: 'AUTHORITY',
      confirmedAt: '2099-01-01T07:00:00.000Z',
      provenance: 'SIMULATED',
    });

    const after = calculateRouteReliability('R101', modified);
    expect(after.score).toBeLessThan(base);
    expect(after.activeIncidentIds).toContain('INC-TEST');
    expect(after.penalties.delay).toBeGreaterThan(0);
  });

  it('builds a context with service-to-route mapping and active incidents', () => {
    const state = buildSeedState();
    const ctx = buildReliabilityContext(state);
    expect(ctx.routeIdByServiceId?.T101A).toBe('R101');
    expect(ctx.activeIncidentRouteIds).toHaveLength(0);
  });
});
