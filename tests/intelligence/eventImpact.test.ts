import { describe, expect, it } from 'vitest';
import { buildSeedState } from '../../src/data/seed';
import {
  calculateAllEventImpacts,
  calculateEventImpact,
  estimatedDelayFromScore,
  eventImpactWindow,
  explainEventImpact,
  getRelevantEventImpacts,
  identifyAffectedRoutes,
  riskFromScore,
} from '../../src/domain/calculations/eventImpact';
import type { SafarEvent } from '../../src/domain/types';

function contextFromSeed() {
  const seed = buildSeedState();
  return { timetables: seed.timetables, stops: seed.stops };
}

describe('event impact calculation', () => {
  it('calculates only explicitly associated routes', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;

    const impacts = calculateAllEventImpacts(festival, state.routes, contextFromSeed());

    expect(impacts.map(impact => impact.routeId).sort()).toEqual(['R101', 'R104']);
    for (const impact of impacts) {
      expect(impact.impactScore).toBeGreaterThanOrEqual(0);
      expect(impact.impactScore).toBeLessThanOrEqual(100);
      expect(['HIGH', 'CRITICAL']).toContain(impact.riskLevel);
      expect(impact.provenance).toBe('CALCULATED');
    }
  });

  it('uses timetable overlap rather than a hardcoded morning window', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;
    const r101 = state.routes.find(route => route.id === 'R101')!;
    const r103 = state.routes.find(route => route.id === 'R103')!;

    const withTimetables = explainEventImpact(festival, r101, contextFromSeed());
    const withoutTimetables = explainEventImpact(festival, r101);

    const overlapWith = withTimetables.factors.find(factor => factor.key === 'overlap')!;
    const overlapWithout = withoutTimetables.factors.find(factor => factor.key === 'overlap')!;

    expect(overlapWith.available).toBe(true);
    expect(overlapWith.rawScore).toBe(100);
    expect(overlapWithout.available).toBe(false);
    expect(withoutTimetables.missingInputs).toContain('Time overlap');
    expect(withoutTimetables.explanation).toContain('renormalised');

    // R103 runs inside the festival window too, so its overlap is also full.
    const r103Overlap = explainEventImpact(festival, r103, contextFromSeed()).factors.find(
      factor => factor.key === 'overlap',
    )!;
    expect(r103Overlap.rawScore).toBe(100);
  });

  it('renormalises available weights and discloses missing inputs', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;
    const r101 = state.routes.find(route => route.id === 'R101')!;

    const breakdown = explainEventImpact(festival, r101);

    expect(breakdown.missingInputs.length).toBeGreaterThan(0);
    expect(breakdown.weightsUsed.crowd).toBeGreaterThan(25);
    expect(breakdown.explanation).toContain('no value was invented');
  });

  it('recalculates a lower score when an event is edited to a lower crowd intensity', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;
    const r101 = state.routes.find(route => route.id === 'R101')!;
    const context = contextFromSeed();

    const before = calculateEventImpact(festival, r101, context);
    const edited: SafarEvent = { ...festival, crowdIntensity: 'LOW' };
    const after = calculateEventImpact(edited, r101, context);

    expect(after.impactScore).toBeLessThan(before.impactScore);
    expect(after.crowdScore).toBe(20);
  });

  it('does not create impact for routes without an association', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;
    const impacts = calculateAllEventImpacts(festival, state.routes, contextFromSeed());

    expect(impacts.some(impact => impact.routeId === 'R102')).toBe(false);
    expect(impacts.some(impact => impact.routeId === 'R103')).toBe(false);
  });

  it('maps scores to documented prototype risk bands', () => {
    expect(riskFromScore(0)).toBe('LOW');
    expect(riskFromScore(24)).toBe('LOW');
    expect(riskFromScore(25)).toBe('MODERATE');
    expect(riskFromScore(49)).toBe('MODERATE');
    expect(riskFromScore(50)).toBe('HIGH');
    expect(riskFromScore(74)).toBe('HIGH');
    expect(riskFromScore(75)).toBe('CRITICAL');
    expect(riskFromScore(100)).toBe('CRITICAL');
  });

  it('converts impact scores to illustrative delay within the documented range', () => {
    expect(estimatedDelayFromScore(0)).toBe(0);
    expect(estimatedDelayFromScore(100)).toBe(45);
    expect(estimatedDelayFromScore(50)).toBe(23);
  });

  it('calculates an impact window only from an explicit preparation buffer', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;

    const window = eventImpactWindow(festival);
    expect(window.startTime).toBe('06:30');
    expect(window.endTime).toBe('20:00');
    expect(window.bufferMinutes).toBe(90);
    expect(window.bufferSource).toContain('90-minute preparation buffer');

    const noBuffer = eventImpactWindow({ ...festival, impactWindowMinutes: 0 });
    expect(noBuffer.startTime).toBe('08:00');
    expect(noBuffer.bufferSource).toContain('No preparation buffer');
  });

  it('handles invalid event times without inventing a window', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;
    const r101 = state.routes.find(route => route.id === 'R101')!;
    const invalid: SafarEvent = { ...festival, startTime: '18:00', endTime: '08:00' };

    const window = eventImpactWindow(invalid);
    expect(window.valid).toBe(false);

    const breakdown = explainEventImpact(invalid, r101, contextFromSeed());
    expect(breakdown.missingInputs).toContain('Time overlap');
    expect(breakdown.missingInputs).toContain('Event duration');
    expect(Number.isFinite(breakdown.impactScore)).toBe(true);
  });

  it('labels approximate proximity as estimated and never as an on-road claim', () => {
    const state = buildSeedState();
    const festival = state.events.find(event => event.id === 'EVT001')!;
    const vittalEvent: SafarEvent = {
      ...festival,
      affectedRouteIds: [],
      lat: 12.77,
      lng: 75.11,
    };

    const suggestions = identifyAffectedRoutes(vittalEvent, state.routes, state.stops);
    const r103 = suggestions.find(suggestion => suggestion.routeId === 'R103');

    expect(r103?.basis).toBe('ESTIMATED_PROXIMITY');
    expect(r103?.detail).toContain('straight-line');
    expect(r103?.detail).toContain('not proof');
  });

  it('filters rejected and past event records out of operational calculations', () => {
    const state = buildSeedState();
    expect(getRelevantEventImpacts(state).length).toBeGreaterThan(0);

    const rejectedState = {
      ...state,
      events: state.events.map(event =>
        event.id === 'EVT001' ? { ...event, verificationStatus: 'REJECTED' as const } : event,
      ),
    };
    const afterRejection = getRelevantEventImpacts(rejectedState);
    expect(afterRejection.some(impact => impact.eventId === 'EVT001')).toBe(false);

    const pastState = {
      ...state,
      events: state.events.map(event => ({ ...event, date: '2000-01-01' })),
    };
    expect(getRelevantEventImpacts(pastState)).toHaveLength(0);
  });

  it('seeds derived event impacts so dashboards are consistent at start-up', () => {
    const state = buildSeedState();
    expect(state.eventImpacts.length).toBeGreaterThan(0);
    expect(state.eventImpacts.every(impact => impact.provenance === 'CALCULATED')).toBe(true);
  });
});
