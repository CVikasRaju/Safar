import type {
  Bus,
  DemandSeedRecord,
  Destination,
  Route,
  Stop,
  TimetableService,
  TimetableStopTime,
  Village,
} from "../types";
import type {
  AllocationAssignment,
  AllocationResult,
  EmergencyPriorityTier,
  EmergencyStudentRecord,
  Road,
  RoadCondition,
  SeatBlock,
  UnservedStudentGroup,
} from "../types/emergency";
import { PRIORITY_TIER_RANK } from "../types/emergency";
import { estimateWalking } from "../calculations/walking";
import { minutesToHhmm } from "../calculations/time";
import {
  MAX_ACCESS_WALK_METERS,
  closedRoadIds,
  closedStopIds,
  findAlternativePickup,
  routeDetour,
  type AlternativePickup,
} from "./roads";

/**
 * Student-to-bus allocation engine.
 *
 * This is the core of the emergency intelligence work: it performs a real,
 * deterministic allocation over the demo network instead of displaying fixed
 * recommendations.
 *
 * Rules enforced here:
 *  1. A bus marked UNAVAILABLE never receives an assignment (its route has no
 *     seat block, and relief capacity is only created from AVAILABLE buses).
 *  2. No seat block can be allocated beyond its capacity.
 *  3. Each student group appears in at most one assignment, so repeated runs
 *     cannot duplicate students.
 *  4. Groups that cannot be placed are reported with an explicit reason; they
 *     are never silently dropped from the totals.
 *  5. Priority order is examination-within-window, imminent deadline, original
 *     bus unavailable, flood-affected pickup, then standard demand. Within a
 *     tier, earlier exam/deadline times and larger groups are served first,
 *     which maximises the number of students transported.
 *
 * Every figure is an illustrative calculation over demo data.
 */

export interface AllocationInput {
  students: EmergencyStudentRecord[];
  routes: Route[];
  stops: Stop[];
  villages: Village[];
  buses: Bus[];
  services: TimetableService[];
  demandSeed: DemandSeedRecord[];
  destination: Destination;
  roads: Road[];
  roadConditions: RoadCondition[];
  clockMinutes: number;
  examWindowMinutes: number;
}

/** Puttur Bus Stand is the transfer anchor for routes that stop there. */
const TRANSFER_ANCHOR_STOP_ID = "st-puttur-busstand";
const DEFAULT_PLATFORM_WAIT_MINUTES = 10;
const DEADLINE_IMMINENT_MINUTES = 90;

interface TravelIndexEntry {
  minutes: number;
  anchorStopId: string;
}

type TravelIndex = Map<string, Map<string, TravelIndexEntry>>;

function isOperational(bus: Bus): boolean {
  return bus.status === "OPERATING" || bus.status === "AVAILABLE" || bus.status === "REPLACEMENT_ASSIGNED";
}

/**
 * Minutes from each boarding stop to the college, per route and direction,
 * derived from the existing timetable services. No value is hardcoded.
 */
function buildTravelIndex(services: TimetableService[], destinationStopId: string): TravelIndex {
  const index: TravelIndex = new Map();
  for (const service of services) {
    for (let boardIndex = 0; boardIndex < service.stopTimes.length - 1; boardIndex += 1) {
      const board: TimetableStopTime = service.stopTimes[boardIndex];
      let anchor: TimetableStopTime | undefined;
      for (let alightIndex = boardIndex + 1; alightIndex < service.stopTimes.length; alightIndex += 1) {
        const candidate = service.stopTimes[alightIndex];
        if (candidate.stopId === destinationStopId) {
          anchor = candidate;
          break;
        }
        if (candidate.stopId === TRANSFER_ANCHOR_STOP_ID && !anchor) anchor = candidate;
      }
      if (!anchor) continue;
      const minutes = anchor.arrivalMinute - board.departureMinute;
      const routeIndex = index.get(service.routeId) ?? new Map<string, TravelIndexEntry>();
      const existing = routeIndex.get(board.stopId);
      if (!existing || minutes < existing.minutes) {
        routeIndex.set(board.stopId, { minutes, anchorStopId: anchor.stopId });
      }
      index.set(service.routeId, routeIndex);
    }
  }
  return index;
}

function groupTotal(students: EmergencyStudentRecord[]): number {
  return students.reduce((sum, student) => sum + student.groupSize, 0);
}

function tierFor(
  student: EmergencyStudentRecord,
  breakdownRouteIds: Set<string>,
  submergedStopIds: Set<string>,
  blockedRouteIds: Set<string>,
  clockMinutes: number,
  examWindowMinutes: number,
): EmergencyPriorityTier {
  const examInWindow =
    student.examStartMinutes !== undefined &&
    student.examStartMinutes - clockMinutes <= examWindowMinutes &&
    student.examStartMinutes > clockMinutes;
  if (examInWindow) return "EXAM_IMMINENT";
  if (student.requiredArrivalMinutes - clockMinutes <= DEADLINE_IMMINENT_MINUTES) {
    return "DEADLINE_IMMINENT";
  }
  if (breakdownRouteIds.has(student.originalRouteId)) return "BUS_BREAKDOWN";
  if (submergedStopIds.has(student.pickupStopId) || blockedRouteIds.has(student.originalRouteId)) {
    return "FLOOD_AFFECTED";
  }
  return "STANDARD";
}

interface Candidate {
  block: SeatBlock;
  travel: TravelIndexEntry;
  sameRoute: boolean;
}

export function allocateStudents(input: AllocationInput): AllocationResult {
  const {
    students,
    routes,
    stops,
    villages,
    buses,
    services,
    demandSeed,
    destination,
    roads,
    roadConditions,
    clockMinutes,
    examWindowMinutes,
  } = input;

  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const villageById = new Map(villages.map((village) => [village.id, village]));
  const blockedRoadIds = closedRoadIds(roadConditions);
  const submergedStopIds = new Set(closedStopIds(roadConditions));
  const travelIndex = buildTravelIndex(services, destination.stopId);

  const failedBuses = buses.filter((bus) => bus.status === "UNAVAILABLE");
  const breakdownRouteIds = new Set(
    failedBuses
      .map((bus) => bus.assignedRouteId)
      .filter((routeId): routeId is string => Boolean(routeId)),
  );

  /** Routes whose path contains a closed road (they need the detour). */
  const detourMinutesByRoute = new Map<string, number>();
  const blockedRouteIds = new Set<string>();
  for (const route of routes) {
    if (blockedRoadIds.length === 0) break;
    const detour = routeDetour(roads, route, blockedRoadIds);
    if (detour.blockedRoadIds.length === 0) continue;
    blockedRouteIds.add(route.id);
    detourMinutesByRoute.set(route.id, detour.additionalMinutes);
  }

  // --- Seat blocks -------------------------------------------------------
  const blocks: SeatBlock[] = [];
  for (const route of routes) {
    if (breakdownRouteIds.has(route.id)) continue;
    if (!travelIndex.has(route.id)) continue;
    const bus = buses.find((candidate) => candidate.assignedRouteId === route.id && isOperational(candidate));
    if (!bus) continue;
    const documented = demandSeed.find((record) => record.routeId === route.id);
    const capacity = documented
      ? documented.availableSeats
      : Math.max(0, bus.capacity - bus.occupiedSeats);
    if (capacity <= 0) continue;
    blocks.push({
      id: `block-${route.id}`,
      routeId: route.id,
      busId: bus.id,
      registration: bus.registration,
      capacity,
      used: 0,
      kind: "CURRENT_SERVICE",
      basis: documented ? "ROUTE_SEAT_SUPPLY" : "PHYSICAL_BUS_CAPACITY",
    });
  }

  /**
   * Relief buses: only buses currently marked AVAILABLE and not tied to a route.
   * This is how "find other operational buses" is answered with real fleet data.
   * One bus is offered to each failed route first, so neither breakdown is
   * ignored, then remaining buses go to the largest outstanding demand.
   */
  const reliefBuses = buses
    .filter((bus) => bus.status === "AVAILABLE" && !bus.assignedRouteId)
    .sort((a, b) => b.capacity - a.capacity || a.id.localeCompare(b.id));

  const unmetByRoute = new Map<string, number>();
  for (const routeId of breakdownRouteIds) {
    unmetByRoute.set(
      routeId,
      students
        .filter((student) => student.originalRouteId === routeId)
        .reduce((sum, student) => sum + student.groupSize, 0),
    );
  }

  const firstPassRoutes = [...unmetByRoute.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([routeId]) => routeId);

  const reliefAssignments: Array<{ bus: Bus; routeId: string }> = [];
  const remainingRelief = [...reliefBuses];
  for (const routeId of firstPassRoutes) {
    if (remainingRelief.length === 0) break;
    const bus = remainingRelief.shift();
    if (!bus) break;
    reliefAssignments.push({ bus, routeId });
    unmetByRoute.set(routeId, (unmetByRoute.get(routeId) ?? 0) - bus.capacity);
  }
  while (remainingRelief.length > 0) {
    const target = [...unmetByRoute.entries()]
      .filter(([, unmet]) => unmet > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!target) break;
    const bus = remainingRelief.shift();
    if (!bus) break;
    reliefAssignments.push({ bus, routeId: target[0] });
    unmetByRoute.set(target[0], target[1] - bus.capacity);
  }

  for (const { bus, routeId } of reliefAssignments) {
    blocks.push({
      id: `block-relief-${bus.id}`,
      routeId,
      busId: bus.id,
      registration: bus.registration,
      capacity: bus.capacity,
      used: 0,
      kind: "RELIEF",
      basis: "RELIEF_BUS_CAPACITY",
    });
  }

  const operationalRouteIds = [...new Set(blocks.map((block) => block.routeId))];

  // --- Priority ordering -------------------------------------------------
  const ranked = students
    .map((student) => ({
      student,
      tier: tierFor(
        student,
        breakdownRouteIds,
        submergedStopIds,
        blockedRouteIds,
        clockMinutes,
        examWindowMinutes,
      ),
      /**
       * Groups whose pickup is submerged have the fewest options, so within the
       * same tier, deadline and examination time they are served first. This is
       * the "route compatibility" tie-break required by the allocation rules.
       */
      constrained: submergedStopIds.has(student.pickupStopId) ? 1 : 0,
    }))
    .sort((a, b) => {
      const rank = PRIORITY_TIER_RANK[a.tier] - PRIORITY_TIER_RANK[b.tier];
      if (rank !== 0) return rank;
      if (a.student.requiredArrivalMinutes !== b.student.requiredArrivalMinutes) {
        return a.student.requiredArrivalMinutes - b.student.requiredArrivalMinutes;
      }
      const examA = a.student.examStartMinutes ?? Number.POSITIVE_INFINITY;
      const examB = b.student.examStartMinutes ?? Number.POSITIVE_INFINITY;
      if (examA !== examB) return examA - examB;
      if (a.constrained !== b.constrained) return b.constrained - a.constrained;
      if (a.student.groupSize !== b.student.groupSize) return b.student.groupSize - a.student.groupSize;
      return a.student.id.localeCompare(b.student.id);
    });

  const alternativePickupByStop = new Map<string, AlternativePickup | null>();
  const assignments: AllocationAssignment[] = [];
  const unserved: UnservedStudentGroup[] = [];

  for (const { student, tier } of ranked) {
    const villageName = villageById.get(student.villageId)?.name ?? student.villageId;
    const originalStop = stopById.get(student.pickupStopId);
    const originalStopName = originalStop?.name ?? student.pickupStopId;

    let effectivePickupStopId = student.pickupStopId;
    let alternativePickup: AlternativePickup | null = null;

    if (submergedStopIds.has(student.pickupStopId)) {
      if (!alternativePickupByStop.has(student.pickupStopId)) {
        alternativePickupByStop.set(
          student.pickupStopId,
          findAlternativePickup(
            stops,
            routes,
            operationalRouteIds,
            [...submergedStopIds],
            student.pickupStopId,
          ),
        );
      }
      alternativePickup = alternativePickupByStop.get(student.pickupStopId) ?? null;
      if (!alternativePickup) {
        unserved.push({
          studentId: student.id,
          label: student.label,
          villageId: student.villageId,
          students: student.groupSize,
          priorityTier: tier,
          hasExam: student.examStartMinutes !== undefined,
          examStartTime: student.examStartTime,
          reason: `${originalStopName} is flooded and no replacement pickup exists within 5 km. These ${student.groupSize} students need a feeder shuttle.`,
        });
        continue;
      }
      effectivePickupStopId = alternativePickup.stopId;
    }

    const effectiveStopName =
      stopById.get(effectivePickupStopId)?.name ?? effectivePickupStopId;

    const candidates: Candidate[] = [];
    for (const block of blocks) {
      const free = block.capacity - block.used;
      if (free <= 0) continue;
      const travel = travelIndex.get(block.routeId)?.get(effectivePickupStopId);
      if (!travel) continue;
      candidates.push({ block, travel, sameRoute: block.routeId === student.originalRouteId });
    }
    candidates.sort(
      (a, b) =>
        Number(b.sameRoute) - Number(a.sameRoute) ||
        b.block.capacity - b.block.used - (a.block.capacity - a.block.used) ||
        a.block.id.localeCompare(b.block.id),
    );

    if (candidates.length === 0) {
      unserved.push({
        studentId: student.id,
        label: student.label,
        villageId: student.villageId,
        students: student.groupSize,
        priorityTier: tier,
        hasExam: student.examStartMinutes !== undefined,
        examStartTime: student.examStartTime,
        reason: `No operational route serves ${effectiveStopName} towards ${destination.name} after the emergency changes.`,
      });
      continue;
    }

    const travelRoute = routeById.get(candidates[0].block.routeId);
    const travelMinutes = candidates[0].travel.minutes;
    const waitMinutes =
      candidates[0].block.kind === "RELIEF"
        ? (buses.find((bus) => bus.id === candidates[0].block.busId)?.estimatedResponseMinutes ??
          DEFAULT_PLATFORM_WAIT_MINUTES)
        : DEFAULT_PLATFORM_WAIT_MINUTES;
    const detourMinutes = detourMinutesByRoute.get(candidates[0].block.routeId) ?? 0;
    const anchorStop = stopById.get(candidates[0].travel.anchorStopId);
    const egressWalk = anchorStop
      ? estimateWalking(anchorStop.coordinates, destination.coordinates)
      : { minutes: 0, approxMeters: 0 };
    const walkToPickupMinutes = alternativePickup?.minutes ?? 0;
    const totalTravel =
      walkToPickupMinutes + waitMinutes + travelMinutes + detourMinutes + egressWalk.minutes;

    let placed = 0;
    let placedBlock: SeatBlock | undefined;
    let placedCandidate: Candidate | undefined;

    for (const candidate of candidates) {
      const free = candidate.block.capacity - candidate.block.used;
      if (free >= student.groupSize) {
        placed = student.groupSize;
        placedBlock = candidate.block;
        placedCandidate = candidate;
        break;
      }
    }

    let partialNote = "";
    if (!placedBlock) {
      // Maximise served students: fill the best compatible bus with what fits.
      const best = candidates[0];
      const free = best.block.capacity - best.block.used;
      if (free > 0) {
        placed = free;
        placedBlock = best.block;
        placedCandidate = best;
        partialNote = ` Only ${free} of ${student.groupSize} seats could be provided on one bus.`;
      }
    }

    if (!placedBlock || !placedCandidate || placed === 0) {
      const largestFree = Math.max(...candidates.map((entry) => entry.block.capacity - entry.block.used));
      unserved.push({
        studentId: student.id,
        label: student.label,
        villageId: student.villageId,
        students: student.groupSize,
        priorityTier: tier,
        hasExam: student.examStartMinutes !== undefined,
        examStartTime: student.examStartTime,
        reason: `All ${candidates.length} compatible bus${candidates.length === 1 ? "" : "es"} reached capacity (largest remaining ${largestFree} seats, group needs ${student.groupSize}).`,
      });
      continue;
    }

    placedBlock.used += placed;
    const arrivalMinutes = clockMinutes + totalTravel;
    const meetsDeadline = arrivalMinutes <= student.requiredArrivalMinutes;
    const meetsExam =
      student.examStartMinutes === undefined ? true : arrivalMinutes <= student.examStartMinutes;

    const explanationParts: string[] = [];
    explanationParts.push(
      `${placed} student${placed === 1 ? "" : "s"} from ${villageName} boarding at ${effectiveStopName}`,
    );
    if (placedBlock.kind === "RELIEF") {
      explanationParts.push(
        `assigned to relief bus ${placedBlock.registration} covering ${placedBlock.routeId}`,
      );
    } else {
      explanationParts.push(`assigned to ${placedBlock.routeId} (${placedBlock.registration})`);
    }
    if (student.originalRouteId !== placedBlock.routeId) {
      explanationParts.push(
        breakdownRouteIds.has(student.originalRouteId)
          ? `because their original bus on ${student.originalRouteId} became unavailable`
          : `to use a route that still serves their pickup`,
      );
    } else {
      explanationParts.push(`because ${student.originalRouteId} is still operating`);
    }
    explanationParts.push(
      `with ${placedBlock.capacity - placedBlock.used + placed} seats available on this bus`,
    );
    if (alternativePickup) {
      explanationParts.push(
        `using replacement pickup ${alternativePickup.stopName}, about ${alternativePickup.approxMetres} m / ${alternativePickup.minutes} min walk from the flooded ${originalStopName}`,
      );
    }
    if (detourMinutes > 0) {
      explanationParts.push(
        `on the ring-road detour that avoids the flooded road (about +${detourMinutes} min)`,
      );
    }
    explanationParts.push(
      `estimated arrival ${minutesToHhmm(arrivalMinutes)} against a required ${student.requiredArrivalTime}`,
    );
    if (student.examStartTime) {
      explanationParts.push(
        meetsExam
          ? `which is before the ${student.examStartTime} examination`
          : `which is AFTER the ${student.examStartTime} examination`,
      );
    }
    if (alternativePickup?.exceedsAccessWalkLimit) {
      explanationParts.push(
        `note: the replacement pickup is beyond the ${MAX_ACCESS_WALK_METERS / 1000} km access-walk limit, so a feeder shuttle is required`,
      );
    }

    const dtLabel = minutesToHhmm(arrivalMinutes);
    void travelRoute;

    assignments.push({
      studentId: student.id,
      label: student.label,
      villageId: student.villageId,
      pickupStopId: student.pickupStopId,
      effectivePickupStopId,
      alternativePickup: Boolean(alternativePickup),
      walkingMetresApprox: alternativePickup?.approxMetres,
      walkingMinutes: alternativePickup?.minutes,
      walkingExceedsLimit: alternativePickup?.exceedsAccessWalkLimit,
      busId: placedBlock.busId,
      busRegistration: placedBlock.registration,
      routeId: placedBlock.routeId,
      originalRouteId: student.originalRouteId,
      isReassignment: student.originalRouteId !== placedBlock.routeId,
      isReliefBus: placedBlock.kind === "RELIEF",
      students: placed,
      priorityTier: tier,
      estimatedArrival: dtLabel,
      estimatedArrivalMinutes: arrivalMinutes,
      meetsDeadline,
      meetsExam,
      explanation: `${explanationParts.join(" ")}.${partialNote}`,
    });

    if (placed < student.groupSize) {
      unserved.push({
        studentId: student.id,
        label: student.label,
        villageId: student.villageId,
        students: student.groupSize - placed,
        priorityTier: tier,
        hasExam: student.examStartMinutes !== undefined,
        examStartTime: student.examStartTime,
        reason: `Only ${placed} of ${student.groupSize} seats were available; ${student.groupSize - placed} students remain without a seat.`,
      });
    }
  }

  const allocatedStudents = assignments.reduce((sum, entry) => sum + entry.students, 0);
  const unservedStudents = unserved.reduce((sum, entry) => sum + entry.students, 0);
  const examStudents = students
    .filter(
      (student) =>
        student.examStartMinutes !== undefined &&
        student.examStartMinutes - clockMinutes <= examWindowMinutes &&
        student.examStartMinutes > clockMinutes,
    )
    .reduce((sum, student) => sum + student.groupSize, 0);
  const examServed = assignments
    .filter((entry) => entry.priorityTier === "EXAM_IMMINENT")
    .reduce((sum, entry) => sum + entry.students, 0);
  const lateStudents = assignments
    .filter((entry) => !entry.meetsDeadline)
    .reduce((sum, entry) => sum + entry.students, 0);

  const operationalBuses = buses.filter(isOperational);
  const availableSeats = blocks.reduce((sum, block) => sum + block.capacity, 0);

  const decisions: string[] = [];
  if (failedBuses.length > 0) {
    decisions.push(
      `${failedBuses.length} buses became unavailable (${failedBuses
        .map((bus) => bus.registration)
        .join(", ")}), removing route${breakdownRouteIds.size === 1 ? "" : "s"} ${[
        ...breakdownRouteIds,
      ].join(", ")} from current service and requiring ${groupTotal(
        students.filter((student) => breakdownRouteIds.has(student.originalRouteId)),
      )} students to be reassigned where capacity allows.`,
    );
  }
  if (reliefAssignments.length > 0) {
    decisions.push(
      `Relief capacity was drawn only from buses marked AVAILABLE: ${reliefAssignments
        .map((entry) => `${entry.bus.registration} (${entry.bus.capacity} seats) to ${entry.routeId}`)
        .join("; ")}.`,
    );
  }
  if (blockedRoadIds.length > 0) {
    decisions.push(
      `Road ${blockedRoadIds.join(", ")} is closed, so ${blockedRouteIds.size} route${
        blockedRouteIds.size === 1 ? "" : "s"
      } (${[...blockedRouteIds].join(", ")}) are re-routed and the flooded pickup stop${
        submergedStopIds.size === 1 ? "" : "s"
      } ${[...submergedStopIds].join(", ")} cannot be used.`,
    );
  }
  if (examStudents > 0) {
    decisions.push(
      `${examStudents} students have an examination within ${examWindowMinutes} minutes of the scenario clock and were ordered first; ${examServed} of them received a seat.`,
    );
  }
  decisions.push(
    `${allocatedStudents} of ${groupTotal(students)} students were allocated across ${blocks.length} seat block${
      blocks.length === 1 ? "" : "s"
    } providing ${availableSeats} seats; ${unservedStudents} students remain unserved.`,
  );
  if (lateStudents > 0) {
    decisions.push(
      `${lateStudents} allocated students are projected to arrive after their required arrival time, mostly because of the detour, walking legs and relief-bus response time.`,
    );
  }

  return {
    totalStudents: groupTotal(students),
    operationalBusCount: operationalBuses.length,
    unavailableBusCount: buses.filter((bus) => bus.status === "UNAVAILABLE").length,
    availableSeats,
    totalSeats: operationalBuses.reduce((sum, bus) => sum + bus.capacity, 0),
    seatBlocks: blocks,
    assignments,
    allocatedStudents,
    assignedToReplacementBus: assignments
      .filter((entry) => entry.isReliefBus)
      .reduce((sum, entry) => sum + entry.students, 0),
    usingAlternativePickup: assignments
      .filter((entry) => entry.alternativePickup)
      .reduce((sum, entry) => sum + entry.students, 0),
    examPriorityStudents: examStudents,
    examPriorityServed: examServed,
    examPriorityUnserved: examStudents - examServed,
    lateStudents,
    unserved,
    unservedStudents,
    decisions,
    notes: [
      "Seat supply for an operating route uses the documented planning figure from the shared demand seed; a relief bus offers its physical seating capacity.",
      "Walking values are approximations (straight-line × 1.35 at 4.8 km/h), not road-routed pedestrian distances.",
      "Allocation is a deterministic greedy pass over the priority tiers, not a formal optimum; it is recomputed from scenario inputs on every render so repeat runs cannot duplicate students.",
      "All figures are simulated demo calculations over the seed network, not official transport data.",
    ],
  };
}
