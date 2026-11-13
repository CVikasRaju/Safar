import { describe, expect, it } from 'vitest';
import { appReducer } from '../../src/state/store';
import { buildSeedState } from '../../src/data/seed';
import {
  canReviewReport,
  processDisruptionReport,
  validateIncidentConfirmation,
  validateReportInput,
  verifyDisruption,
} from '../../src/domain/calculations/disruption';
import type { AppState, ReportType, SafarEvent } from '../../src/domain/types';

const REPORT_INPUT = {
  routeId: 'R101',
  expectedBusId: 'B001',
  stopId: 'S004',
  expectedArrivalAt: '07:00',
  reportType: 'BUS_NOT_ARRIVED' as ReportType,
  description: 'Bus did not arrive at the stand by 07:00.',
};

function submitReport(state: AppState): AppState {
  return appReducer(state, {
    type: 'SUBMIT_DISRUPTION_REPORT',
    payload: REPORT_INPUT,
  });
}

function newEvent(): Omit<SafarEvent, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Test Village Fair',
    category: 'VILLAGE_FAIR',
    location: 'Test Ground, Puttur',
    date: '2099-01-01',
    startTime: '07:00',
    endTime: '11:00',
    crowdIntensity: 'MODERATE',
    nearbyVillageIds: ['V001'],
    affectedRoadLabels: ['Test Road'],
    affectedRouteIds: ['R101'],
    impactWindowMinutes: 30,
    description: 'Test event',
    source: 'Test',
    provenance: 'USER_ENTERED',
    verificationStatus: 'UNVERIFIED',
  };
}

describe('student report workflow', () => {
  it('creates only an UNVERIFIED report and does not change fleet status', () => {
    const seed = buildSeedState();
    const after = submitReport(seed);
    const report = after.disruptionReports[0];

    expect(report.status).toBe('UNVERIFIED');
    expect(report.provenance).toBe('USER_ENTERED');
    expect(after.incidents).toHaveLength(0);
    expect(after.buses.map(bus => bus.status)).toEqual(seed.buses.map(bus => bus.status));
  });

  it('verification records credibility but does not confirm an incident', () => {
    const submitted = submitReport(buildSeedState());
    const report = submitted.disruptionReports[0];

    const verified = appReducer(submitted, {
      type: 'VERIFY_REPORT',
      payload: { reportId: report.id },
    });

    expect(verified.disruptionReports[0].status).toBe('VERIFIED');
    expect(verified.incidents).toHaveLength(0);
    expect(verified.buses.map(bus => bus.status)).toEqual(
      submitted.buses.map(bus => bus.status),
    );
    expect(verified.auditEvents.some(event => event.action === 'VERIFY_REPORT')).toBe(true);
  });

  it('rejects a report with a recorded reason and no operational effect', () => {
    const submitted = submitReport(buildSeedState());
    const report = submitted.disruptionReports[0];

    const rejected = appReducer(submitted, {
      type: 'REJECT_REPORT',
      payload: { reportId: report.id, reason: 'Bus arrived on time per depot log' },
    });

    expect(rejected.disruptionReports[0].status).toBe('REJECTED');
    expect(rejected.disruptionReports[0].reviewReason).toBe('Bus arrived on time per depot log');
    expect(rejected.incidents).toHaveLength(0);
    expect(rejected.buses.map(bus => bus.status)).toEqual(
      submitted.buses.map(bus => bus.status),
    );
  });

  it('does not allow a report to be reviewed twice', () => {
    const submitted = submitReport(buildSeedState());
    const report = submitted.disruptionReports[0];
    const verified = verifyDisruption(report, { action: 'VERIFY' });

    expect(canReviewReport(verified).allowed).toBe(false);
    expect(verifyDisruption(verified, { action: 'REJECT', reason: 'test' }).status).toBe(
      'VERIFIED',
    );
  });

  it('validates route, stop and time references', () => {
    const state = buildSeedState();
    const valid = validateReportInput(REPORT_INPUT, state);
    expect(valid.valid).toBe(true);

    const badRoute = validateReportInput({ ...REPORT_INPUT, routeId: 'R999' }, state);
    expect(badRoute.valid).toBe(false);

    const badStop = validateReportInput({ ...REPORT_INPUT, stopId: 'S006' }, state);
    expect(badStop.valid).toBe(false);
    expect(badStop.errors.join(' ')).toContain('not on route');

    const badTime = validateReportInput({ ...REPORT_INPUT, expectedArrivalAt: '25:99' }, state);
    expect(badTime.valid).toBe(false);
  });

  it('keeps report creation pure and deterministic in status', () => {
    const report = processDisruptionReport(REPORT_INPUT);
    expect(report.status).toBe('UNVERIFIED');
    expect(report.id.startsWith('RPT-')).toBe(true);
  });
});

describe('authority incident confirmation', () => {
  it('confirms a breakdown, marks the bus unavailable and publishes state changes', () => {
    const submitted = submitReport(buildSeedState());
    const report = submitted.disruptionReports[0];
    const verified = appReducer(submitted, {
      type: 'VERIFY_REPORT',
      payload: { reportId: report.id },
    });

    const confirmed = appReducer(verified, {
      type: 'CONFIRM_INCIDENT',
      payload: {
        type: 'BUS_BREAKDOWN',
        routeId: 'R101',
        busId: 'B001',
        severity: 'HIGH',
        description: 'Confirmed breakdown of KA-21-AB-102.',
        relatedReportIds: [report.id],
        estimatedAffectedPassengers: 38,
      },
    });

    const incident = confirmed.incidents[0];
    expect(incident.status).toBe('ACTIVE');
    expect(incident.provenance).toBe('SIMULATED');
    expect(confirmed.buses.find(bus => bus.id === 'B001')?.status).toBe('UNAVAILABLE');
    expect(confirmed.alerts.length).toBeGreaterThan(0);
    expect(confirmed.replacementRecommendations).toHaveLength(1);
    expect(confirmed.disruptionReports[0].relatedIncidentId).toBe(incident.id);
    expect(confirmed.auditEvents.some(event => event.action === 'CONFIRM_INCIDENT')).toBe(true);
    expect(
      confirmed.auditEvents.some(event => event.action === 'LINK_REPORT_TO_INCIDENT'),
    ).toBe(true);
  });

  it('does not mark a bus unavailable for a road-blockage incident', () => {
    const state = buildSeedState();
    const confirmed = appReducer(state, {
      type: 'CONFIRM_INCIDENT',
      payload: {
        type: 'ROAD_BLOCKAGE',
        routeId: 'R101',
        busId: 'B001',
        severity: 'MEDIUM',
        relatedReportIds: [],
        estimatedAffectedPassengers: 12,
      },
    });

    expect(confirmed.incidents[0].status).toBe('ACTIVE');
    expect(confirmed.buses.find(bus => bus.id === 'B001')?.status).toBe('OPERATING');
  });

  it('rejects incident confirmation that links an unverified report', () => {
    const submitted = submitReport(buildSeedState());
    const report = submitted.disruptionReports[0];

    const validation = validateIncidentConfirmation(
      {
        type: 'BUS_BREAKDOWN',
        routeId: 'R101',
        busId: 'B001',
        severity: 'HIGH',
        relatedReportIds: [report.id],
      },
      submitted,
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('Only VERIFIED reports');
  });

  it('requires a bus for a confirmed breakdown and a valid stop', () => {
    const state = buildSeedState();
    const noBus = validateIncidentConfirmation(
      {
        type: 'MECHANICAL_FAILURE',
        routeId: 'R101',
        severity: 'HIGH',
        relatedReportIds: [],
      },
      state,
    );
    expect(noBus.valid).toBe(false);
    expect(noBus.errors.join(' ')).toContain('must reference the affected bus');

    const wrongStop = validateIncidentConfirmation(
      {
        type: 'ROAD_BLOCKAGE',
        routeId: 'R101',
        busId: 'B001',
        affectedStopId: 'S006',
        severity: 'MEDIUM',
        relatedReportIds: [],
      },
      state,
    );
    expect(wrongStop.valid).toBe(false);
    expect(wrongStop.errors.join(' ')).toContain('not on route');
  });

  it('closes an active incident with a reason recorded in the audit trail', () => {
    const state = buildSeedState();
    const confirmed = appReducer(state, {
      type: 'CONFIRM_INCIDENT',
      payload: {
        type: 'ROAD_BLOCKAGE',
        routeId: 'R102',
        severity: 'MEDIUM',
        relatedReportIds: [],
      },
    });
    const incidentId = confirmed.incidents[0].id;

    const closed = appReducer(confirmed, {
      type: 'CLOSE_INCIDENT',
      payload: { incidentId, reason: 'Road cleared by authority' },
    });

    expect(closed.incidents[0].status).toBe('CLOSED');
    expect(
      closed.auditEvents.some(
        event =>
          event.action === 'CLOSE_INCIDENT' && event.reason === 'Road cleared by authority',
      ),
    ).toBe(true);
  });
});

describe('event CRUD through shared state', () => {
  it('adds, edits and deletes an event while recalculating impacts', () => {
    const seed = buildSeedState();

    const added = appReducer(seed, { type: 'ADD_EVENT', payload: newEvent() });
    const addedEvent = added.events[added.events.length - 1];
    const addedImpacts = added.eventImpacts.filter(
      impact => impact.eventId === addedEvent.id,
    );
    expect(addedImpacts).toHaveLength(1);
    const originalScore = addedImpacts[0].impactScore;

    const edited = appReducer(added, {
      type: 'UPDATE_EVENT',
      payload: { id: addedEvent.id, crowdIntensity: 'LOW' },
    });
    const editedImpact = edited.eventImpacts.find(
      impact => impact.eventId === addedEvent.id,
    )!;
    expect(editedImpact.impactScore).toBeLessThan(originalScore);

    const deleted = appReducer(edited, {
      type: 'DELETE_EVENT',
      payload: { eventId: addedEvent.id },
    });
    expect(deleted.events.find(event => event.id === addedEvent.id)).toBeUndefined();
    expect(
      deleted.eventImpacts.filter(impact => impact.eventId === addedEvent.id),
    ).toHaveLength(0);
    expect(deleted.events).toHaveLength(seed.events.length);
  });

  it('reset restores exact seed fleet, demand, events and empty workflow records', () => {
    let state = buildSeedState();
    state = submitReport(state);
    state = appReducer(state, {
      type: 'CONFIRM_INCIDENT',
      payload: {
        type: 'BUS_BREAKDOWN',
        routeId: 'R101',
        busId: 'B001',
        severity: 'HIGH',
        relatedReportIds: [],
        estimatedAffectedPassengers: 38,
      },
    });
    state = appReducer(state, { type: 'ADD_EVENT', payload: newEvent() });

    const reset = appReducer(state, { type: 'RESET_SCENARIO' });
    const seed = buildSeedState();

    expect(reset.incidents).toHaveLength(0);
    expect(reset.disruptionReports).toHaveLength(0);
    expect(reset.replacementRecommendations).toHaveLength(0);
    expect(reset.alerts).toHaveLength(0);
    expect(reset.events).toHaveLength(seed.events.length);
    expect(reset.buses.map(bus => bus.status)).toEqual(seed.buses.map(bus => bus.status));
    expect(reset.demandSeed.reduce((sum, row) => sum + row.expectedStudents, 0)).toBe(420);
    expect(reset.demandSeed.reduce((sum, row) => sum + row.availableSeats, 0)).toBe(350);
  });
});
