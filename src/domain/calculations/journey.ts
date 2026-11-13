// SAFAR — Journey Generation
// Generates feasible journey candidates from timetable data.
// Ranks into Fastest, Most Reliable, Fewest Transfers per docs/04_JOURNEY_PLANNER.md

import type {
  JourneyOption,
  JourneySegment,
  TimetableService,
  Route,
  Stop,
  Bus,
  AppState,
} from '../types';
import { calculateJourneyReliability, buildReliabilityContext } from './reliability';

interface JourneyRequest {
  originVillageId: string;
  destinationId: string;
  travelDate: string;
  requiredArrivalTime: string; // "HH:MM"
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDayOfWeek(dateStr: string): TimetableService['operatingDays'][number] {
  const days: TimetableService['operatingDays'][number][] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[new Date(dateStr).getDay()];
}

function buildDirectJourney(
  service: TimetableService,
  route: Route,
  stops: Stop[],
  buses: Bus[],
  request: JourneyRequest,
  state: AppState,
): JourneyOption | null {
  const stopTimes = service.stopTimes;
  if (stopTimes.length < 2) return null;

  const bus = buses.find(b => b.id === service.busId);
  if (!bus) return null;

  // Find first stop in origin village
  const originStop = stops.find(s =>
    s.villageId === request.originVillageId &&
    service.stopTimes.some(st => st.stopId === s.id)
  );
  if (!originStop) return null;

  const originStopTime = stopTimes.find(st => st.stopId === originStop.id);
  const finalStopTime  = stopTimes[stopTimes.length - 1];
  if (!originStopTime) return null;

  const departureMin = originStopTime.departureMinute ?? toMinutes(originStopTime.scheduledDeparture ?? "08:00");
  const arrivalMin   = finalStopTime.arrivalMinute ?? toMinutes(finalStopTime.scheduledArrival ?? "09:00");
  const requiredMin  = toMinutes(request.requiredArrivalTime);

  // Calculate disruption delay from active incidents
  const activeIncident = state.incidents.find(
    i => i.status === 'ACTIVE' && i.routeId === route.id
  );
  const delayMinutes = activeIncident ? 20 : 0; // 20 min illustrative delay if incident

  // Also factor event impact
  const currentImpacts = state.eventImpacts ?? state.eventRouteImpacts ?? [];
  const eventImpact = currentImpacts.find(ei => ei.routeId === route.id);
  const eventDelay  = eventImpact ? (eventImpact.estimatedDelayMinutes ?? 0) : 0;
  const totalDelay  = delayMinutes + Math.round(eventDelay * 0.5); // cap event at 50%

  const expectedArrivalMin = arrivalMin + totalDelay;
  const meetsDeadline = expectedArrivalMin <= requiredMin;

  const id = `J-${route.id}-${service.id}-${Date.now()}`;
  const originArrivalStr = originStopTime.scheduledArrival ?? toHHMM(originStopTime.arrivalMinute);
  const originDepartureStr = originStopTime.scheduledDeparture ?? toHHMM(originStopTime.departureMinute);

  // Build segments
  const segments: JourneySegment[] = [];
  // Walk to first stop (illustrative)
  segments.push({
    id: `${id}-W0`,
    type: 'WALK',
    fromLabel: request.originVillageId,
    toLabel: originStop.name,
    departureTime: toHHMM(departureMin - 10),
    arrivalTime: originArrivalStr,
    durationMinutes: 10,
    distanceLabel: 'approx. 400m (illustrative estimate, not road distance)',
  });

  // Bus segment
  segments.push({
    id: `${id}-B1`,
    type: 'BUS',
    fromLabel: originStop.name,
    toLabel: stops.find(s => s.id === finalStopTime.stopId)?.name ?? 'Destination Stop',
    fromStopId: originStop.id,
    toStopId: finalStopTime.stopId,
    serviceId: service.id,
    busId: bus.id,
    departureTime: originDepartureStr,
    arrivalTime: toHHMM(expectedArrivalMin),
    durationMinutes: expectedArrivalMin - departureMin + totalDelay,
    notes: totalDelay > 0 ? `~${totalDelay} min illustrative delay` : undefined,
  });

  // Walk from final stop to destination (illustrative)
  segments.push({
    id: `${id}-W2`,
    type: 'WALK',
    fromLabel: stops.find(s => s.id === finalStopTime.stopId)?.name ?? 'Final Stop',
    toLabel: 'Destination',
    departureTime: toHHMM(expectedArrivalMin),
    arrivalTime: toHHMM(expectedArrivalMin + 5),
    durationMinutes: 5,
    distanceLabel: 'approx. 200m (illustrative estimate, not road distance)',
  });

  const totalDuration = expectedArrivalMin + 5 - (departureMin - 10);

  const warnings: string[] = [];
  if (activeIncident) warnings.push(`CONFIRMED INCIDENT on ${route.id}: ~${delayMinutes} min illustrative delay.`);
  if (eventImpact && eventImpact.riskLevel !== 'LOW') {
    warnings.push(`${eventImpact.riskLevel} event impact on ${route.id}: ~${eventDelay} min possible delay (illustrative).`);
  }
  if (!meetsDeadline) warnings.push(`Expected arrival ${toHHMM(expectedArrivalMin + 5)} is after required ${request.requiredArrivalTime}.`);

  const journey: JourneyOption = {
    id,
    originVillageId: request.originVillageId,
    destinationId: request.destinationId,
    travelDate: request.travelDate,
    requiredArrivalTime: request.requiredArrivalTime,
    submittedAt: new Date().toISOString(),
    segments,
    totalDurationMinutes: totalDuration,
    transferCount: 0,
    walkingSegments: 2,
    departureTime: toHHMM(departureMin - 10),
    expectedArrivalTime: toHHMM(expectedArrivalMin + 5),
    estimatedDelayMinutes: totalDelay,
    reliabilityScore: 0, // calculated below
    meetsArrivalDeadline: meetsDeadline,
    warnings,
    category: 'FASTEST', // assigned in ranking below
    provenance: 'CALCULATED',
  };

  // Calculate reliability
  const reliabilityCtx = buildReliabilityContext(state);
  const rel = calculateJourneyReliability(journey, reliabilityCtx);
  journey.reliabilityScore = rel.score;

  return journey;
}

export function generateJourneyOptions(
  request: JourneyRequest,
  state: AppState,
): {
  fastest?: JourneyOption;
  mostReliable?: JourneyOption;
  fewestTransfers?: JourneyOption;
  all: JourneyOption[];
} {
  const dayOfWeek = getDayOfWeek(request.travelDate);
  const candidates: JourneyOption[] = [];

  for (const service of state.timetables) {
    if (!service.operatingDays.includes(dayOfWeek)) continue;

    // Check if bus is available
    const bus = state.buses.find(b => b.id === service.busId);
    if (!bus || bus.status === 'UNAVAILABLE' || bus.status === 'MAINTENANCE') continue;

    const route = state.routes.find(r => r.id === service.routeId);
    if (!route) continue;

    // Check if route serves origin village
    const servesOrigin = state.stops.some(
      s => s.villageId === request.originVillageId &&
           service.stopTimes.some(st => st.stopId === s.id)
    );
    if (!servesOrigin) continue;

    const journey = buildDirectJourney(service, route, state.stops, state.buses, request, state);
    if (journey) candidates.push(journey);
  }

  if (candidates.length === 0) {
    return { all: [] };
  }

  // Rank independently
  const fastest = [...candidates].sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes)[0];
  const mostReliable = [...candidates].sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0];
  const fewestTransfers = [...candidates].sort((a, b) => {
    if (a.transferCount !== b.transferCount) return a.transferCount - b.transferCount;
    return b.reliabilityScore - a.reliabilityScore; // tie-break by reliability
  })[0];

  // Label
  const label = (j: JourneyOption, cat: JourneyOption['category']): JourneyOption => ({ ...j, category: cat });

  return {
    fastest: label(fastest, 'FASTEST'),
    mostReliable: label(mostReliable, 'MOST_RELIABLE'),
    fewestTransfers: label(fewestTransfers, 'FEWEST_TRANSFERS'),
    all: candidates,
  };
}
