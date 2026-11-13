import type { Alert, AuditEvent, Bus, SafarState } from "../types";
import type {
  BeforeAfterComparison,
  BeforeAfterMetric,
  EmergencyAnalysis,
  EmergencyPlan,
  EmergencyState,
  RoadCondition,
  RouteAlternative,
} from "../types/emergency";
import {
  EMERGENCY_CONFIG,
  EMERGENCY_RESERVE_BUSES,
  EMERGENCY_ROADS,
  emergencyRoadConditions,
  materialiseEmergencyStudents,
  scenarioClockFrom,
} from "../../data/seed/emergency";
import { minutesToIso } from "../calculations/time";
import { allocateStudents, type AllocationInput } from "./allocation";
import { buildRouteAlternatives } from "./roads";

/**
 * Four-condition emergency scenario.
 *
 * The scenario stores only its inputs (failed buses, blocked road, student
 * groups, scenario clock). Every allocation, alternative route and before/after
 * figure is recomputed from those inputs, which is what makes the run repeatable
 * and prevents duplicated student assignments.
 */

function destinationFor(state: SafarState) {
  return (
    state.destinations.find((destination) => destination.id === EMERGENCY_CONFIG.destinationId) ??
    state.destinations[0]
  );
}

export function buildEmergencyState(state: SafarState, now: Date = new Date()): EmergencyState {
  const clockMinutes = scenarioClockFrom(now);
  const { students, baselineStudents, surgeStudents } = materialiseEmergencyStudents(clockMinutes);
  const failedBuses = state.buses.filter((bus) => EMERGENCY_CONFIG.failedBusIds.includes(bus.id));
  const failedRouteIds = failedBuses
    .map((bus) => bus.assignedRouteId)
    .filter((routeId): routeId is string => Boolean(routeId));

  return {
    id: "emg-kuttar-emergency",
    status: "ACTIVE",
    startedAt: now.toISOString(),
    clockMinutes,
    scenarioDate: state.scenario.scenarioDate,
    demandIncreasePct: EMERGENCY_CONFIG.demandIncreasePct,
    examWindowMinutes: EMERGENCY_CONFIG.examWindowMinutes,
    baseDemandStudents: baselineStudents,
    surgeStudents,
    emergencyDemandStudents: baselineStudents + surgeStudents,
    failedBusIds: failedBuses.map((bus) => bus.id),
    failedRouteIds: [...new Set(failedRouteIds)],
    reserveBusIds: EMERGENCY_RESERVE_BUSES.map((bus) => bus.id),
    blockedRoadId: EMERGENCY_CONFIG.blockedRoadId,
    blockedRoadName: EMERGENCY_CONFIG.blockedRoadName,
    studentRecords: students,
    roads: EMERGENCY_ROADS.map((road) => ({ ...road })),
    roadConditions: emergencyRoadConditions(
      EMERGENCY_CONFIG.blockedRoadId,
      ["st-puttur-mangalore-road"],
      now.toISOString(),
    ),
    notes: [
      "Simulated emergency over the SAFAR demo network: two breakdowns, exactly +40% demand, one flooded road and examinations within two hours.",
      "The scenario clock is the time the scenario was run, so every deadline and examination time is relative and reproducible.",
      "Road distances and travel times are simulated approximations derived from the seed stop coordinates.",
    ],
  };
}

function busFleetForEmergency(state: SafarState): Bus[] {
  const failedBuses = new Set(EMERGENCY_CONFIG.failedBusIds);
  const withFailures = state.buses.map<Bus>((bus) =>
    failedBuses.has(bus.id)
      ? {
          ...bus,
          status: "UNAVAILABLE",
          commitments: [
            ...bus.commitments,
            "Breakdown reported during the simulated emergency — must not receive new students.",
          ],
          provenance: "SIMULATED",
        }
      : bus,
  );
  const existing = new Set(withFailures.map((bus) => bus.id));
  const reserves = EMERGENCY_RESERVE_BUSES.filter((bus) => !existing.has(bus.id)).map<Bus>((bus) => ({
    ...bus,
    provenance: "SIMULATED",
  }));
  return [...withFailures, ...reserves];
}

export function buildEmergencyPlan(state: SafarState, now: Date = new Date()): EmergencyPlan {
  const emergency = buildEmergencyState(state, now);
  const buses = busFleetForEmergency(state);
  const destination = destinationFor(state);
  const failedBuses = buses.filter((bus) => emergency.failedBusIds.includes(bus.id));
  const createdAt = now.toISOString();
  const examStudents = emergency.studentRecords
    .filter(
      (student) =>
        student.examStartMinutes !== undefined &&
        student.examStartMinutes - emergency.clockMinutes <= emergency.examWindowMinutes,
    )
    .reduce((sum, student) => sum + student.groupSize, 0);

  const alerts: Alert[] = [
    {
      id: "alert-emergency-breakdowns",
      audience: "AUTHORITY",
      severity: "CRITICAL",
      title: `${failedBuses.length} buses unavailable — emergency response active`,
      body: `${failedBuses
        .map((bus) => `${bus.registration} on ${bus.assignedRouteId ?? "unassigned"}`)
        .join(" and ")} broke down simultaneously. Routes ${emergency.failedRouteIds.join(
        ", ",
      )} cannot take new students; allocation is running across the remaining fleet.`,
      createdAt,
      relatedRouteIds: emergency.failedRouteIds,
      provenance: "SIMULATED",
    },
    {
      id: "alert-emergency-demand",
      audience: "AUTHORITY",
      severity: "WARNING",
      title: `Demand increased by exactly ${emergency.demandIncreasePct}%`,
      body: `Student demand rose from ${emergency.baseDemandStudents} to ${emergency.emergencyDemandStudents} (+${emergency.surgeStudents}). The allocation engine uses the increased demand, not just the dashboard figures.`,
      createdAt,
      relatedRouteIds: [],
      provenance: "CALCULATED",
    },
    {
      id: "alert-emergency-flood",
      audience: "AUTHORITY",
      severity: "CRITICAL",
      title: `Road blocked: ${emergency.blockedRoadName}`,
      body: `The flooded road is closed to buses and the adjacent pickup stop is submerged. Alternative ring-road routes have been calculated and no replacement route uses the closed road.`,
      createdAt,
      relatedRouteIds: [],
      provenance: "SIMULATED",
    },
    {
      id: "alert-emergency-exams",
      audience: "AUTHORITY",
      severity: "WARNING",
      title: `${examStudents} students have examinations within ${emergency.examWindowMinutes} minutes`,
      body: `Examination students were ordered ahead of every other group in the allocation, and their estimated arrival is compared with the examination start time.`,
      createdAt,
      relatedRouteIds: [],
      provenance: "SIMULATED",
    },
  ];

  const audit: AuditEvent = {
    id: `audit-emergency-${now.getTime()}`,
    actor: "AUTHORITY_DEMO",
    action: "EMERGENCY_SCENARIO_RUN",
    at: createdAt,
    recordIds: [
      emergency.id,
      ...emergency.failedBusIds,
      ...emergency.reserveBusIds,
      emergency.blockedRoadId,
    ],
    reason: `Two breakdowns, +${emergency.demandIncreasePct}% demand, flooded ${emergency.blockedRoadName} and examination priority applied to ${destination.name}.`,
  };

  return { emergency, buses, audit, alerts };
}

function allocationInputFor(
  state: SafarState,
  emergency: EmergencyState,
  overrides: Partial<AllocationInput> = {},
): AllocationInput {
  return {
    students: emergency.studentRecords,
    routes: state.routes,
    stops: state.stops,
    villages: state.villages,
    buses: state.buses,
    services: state.timetableServices,
    demandSeed: state.demandSeed,
    destination: destinationFor(state),
    roads: emergency.roads,
    roadConditions: emergency.roadConditions,
    clockMinutes: emergency.clockMinutes,
    examWindowMinutes: emergency.examWindowMinutes,
    ...overrides,
  };
}

function replacementBusesByRoute(analysisBlocks: EmergencyAnalysis["allocation"]["seatBlocks"]) {
  const map = new Map<string, Array<{ id: string; registration: string }>>();
  for (const block of analysisBlocks) {
    if (block.kind !== "RELIEF") continue;
    const list = map.get(block.routeId) ?? [];
    list.push({ id: block.busId, registration: block.registration });
    map.set(block.routeId, list);
  }
  return map;
}

export function analyseEmergency(state: SafarState): EmergencyAnalysis | null {
  const emergency = state.emergency;
  if (!emergency) return null;

  const allocation = allocateStudents(allocationInputFor(state, emergency, { buses: state.buses }));

  const routeAlternatives: RouteAlternative[] = buildRouteAlternatives(
    state.routes,
    emergency.roads,
    emergency.roadConditions,
    replacementBusesByRoute(allocation.seatBlocks),
  );

  const affectedRouteIds = new Set<string>(emergency.failedRouteIds);
  for (const alternative of routeAlternatives) affectedRouteIds.add(alternative.routeId);

  const affectedVillageIds = new Set<string>();
  let affectedStudentGroups = 0;
  for (const student of emergency.studentRecords) {
    const floodAffected =
      emergency.failedRouteIds.includes(student.originalRouteId) ||
      emergency.roadConditions.some(
        (condition) =>
          condition.status !== "OPEN" && (condition.affectedStopIds ?? []).includes(student.pickupStopId),
      );
    if (!floodAffected) continue;
    affectedVillageIds.add(student.villageId);
    affectedStudentGroups += 1;
  }

  const operationalBuses = state.buses.filter(
    (bus) =>
      bus.status === "OPERATING" ||
      bus.status === "AVAILABLE" ||
      bus.status === "REPLACEMENT_ASSIGNED",
  );

  const documentedSeats = state.demandSeed.reduce((sum, record) => sum + record.availableSeats, 0);
  const documentedDemand = state.demandSeed.reduce((sum, record) => sum + record.expectedStudents, 0);

  return {
    state,
    allocation,
    routeAlternatives,
    affectedRoutes: [...affectedRouteIds].sort(),
    affectedVillages: [...affectedVillageIds],
    affectedStudentGroups,
    demand: {
      baselineStudents: emergency.baseDemandStudents,
      surgeStudents: emergency.surgeStudents,
      emergencyStudents: emergency.emergencyDemandStudents,
      increasePct: emergency.demandIncreasePct,
      dailySeatSupply: documentedSeats,
      dailyShortage: Math.max(0, documentedDemand - documentedSeats),
      additionalSeatsRequired: Math.max(0, emergency.emergencyDemandStudents - documentedSeats),
    },
    unservedGroups: allocation.unserved,
    busSummary: {
      total: state.buses.length,
      operating: state.buses.filter((bus) => bus.status === "OPERATING").length,
      available: state.buses.filter((bus) => bus.status === "AVAILABLE").length,
      unavailable: state.buses.filter((bus) => bus.status === "UNAVAILABLE").length,
      maintenance: state.buses.filter((bus) => bus.status === "MAINTENANCE").length,
      replacementAssigned: state.buses.filter((bus) => bus.status === "REPLACEMENT_ASSIGNED").length,
      totalSeats: operationalBuses.reduce((sum, bus) => sum + bus.capacity, 0),
      remainingSeats: allocation.seatBlocks.reduce(
        (sum, block) => sum + (block.capacity - block.used),
        0,
      ),
    },
  };
}

function formatMetricValue(
  key: string,
  value: number,
): string {
  if (key === "affectedRoutes") return String(value);
  return value.toLocaleString();
}

function metric(
  key: string,
  label: string,
  before: number,
  after: number,
  options: { lowerIsBetter?: boolean; unitLabel?: string } = {},
): BeforeAfterMetric {
  const delta = after - before;
  const direction: BeforeAfterMetric["direction"] = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const lowerIsBetter = options.lowerIsBetter ?? false;
  const tone: BeforeAfterMetric["tone"] =
    delta === 0
      ? "neutral"
      : (delta > 0 && !lowerIsBetter) || (delta < 0 && lowerIsBetter)
        ? "good"
        : "bad";
  const sign = delta > 0 ? "+" : "";
  return {
    key,
    label,
    before: formatMetricValue(key, before),
    after: formatMetricValue(key, after),
    delta: `${sign}${delta.toLocaleString()}${options.unitLabel ? ` ${options.unitLabel}` : ""}`,
    direction,
    tone,
  };
}

/**
 * Before/after comparison. "Before" is the same allocation engine run over the
 * restored fleet, open roads and baseline-only demand, so every displayed value
 * comes from a calculation rather than a stored constant.
 */
export function buildBeforeAfterComparison(state: SafarState): BeforeAfterComparison | null {
  const emergency = state.emergency;
  if (!emergency) return null;

  const failedBusIds = new Set(emergency.failedBusIds);
  const reserveBusIds = new Set(emergency.reserveBusIds);
  const beforeBuses: Bus[] = state.buses
    .filter((bus) => !reserveBusIds.has(bus.id))
    .map<Bus>((bus) =>
      failedBusIds.has(bus.id)
        ? { ...bus, status: "OPERATING", commitments: [], provenance: "DEMO" }
        : bus,
    );

  const openRoads: RoadCondition[] = emergency.roads.map((road) => ({
    roadId: road.id,
    status: "OPEN",
    provenance: "SIMULATED",
  }));

  const beforeStudents = emergency.studentRecords.filter((student) => !student.isSurge);

  const before = allocateStudents(
    allocationInputFor(state, emergency, {
      buses: beforeBuses,
      roadConditions: openRoads,
      students: beforeStudents,
    }),
  );
  const after = allocateStudents(allocationInputFor(state, emergency, { buses: state.buses }));

  const affectedRoutesAfter = analyseEmergency(state)?.affectedRoutes.length ?? 0;

  const metrics: BeforeAfterMetric[] = [
    metric("demand", "Student demand", before.totalStudents, after.totalStudents, {
      lowerIsBetter: true,
    }),
    metric("unavailableBuses", "Buses unavailable", before.unavailableBusCount, after.unavailableBusCount, {
      lowerIsBetter: true,
    }),
    metric("seats", "Seats offered", before.availableSeats, after.availableSeats),
    metric("allocated", "Students allocated", before.allocatedStudents, after.allocatedStudents),
    metric("unserved", "Students unserved", before.unservedStudents, after.unservedStudents, {
      lowerIsBetter: true,
    }),
    metric("examStudents", "Examination-priority students", 0, after.examPriorityStudents),
    metric("lateStudents", "Students arriving late", before.lateStudents, after.lateStudents, {
      lowerIsBetter: true,
    }),
    metric("relief", "Students on replacement buses", 0, after.assignedToReplacementBus),
    metric("altPickup", "Students using alternative pickups", 0, after.usingAlternativePickup),
    metric("affectedRoutes", "Disrupted routes", 0, affectedRoutesAfter),
    metric("walking", "Additional walking (approx. metres)", 0, walkMetres(after)),
  ];

  return {
    metrics,
    before,
    after,
    beforeDemand: before.totalStudents,
    afterDemand: after.totalStudents,
  };
}

function walkMetres(allocation: EmergencyAnalysis["allocation"]): number {
  return allocation.assignments.reduce(
    (sum, assignment) => sum + (assignment.walkingMetresApprox ?? 0),
    0,
  );
}

/** Convenience helper for the UI: ISO timestamp for a scenario-relative minute. */
export function emergencyIso(state: SafarState, minutes: number): string {
  const emergency = state.emergency;
  const date = emergency?.scenarioDate ?? state.scenario.scenarioDate;
  return minutesToIso(date, minutes);
}
