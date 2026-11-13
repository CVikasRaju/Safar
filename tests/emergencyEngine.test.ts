import { describe, expect, it } from "vitest";
import { createSeedState } from "../src/data/seed";
import { reducer, type SafarAction } from "../src/state/reducer";
import {
  analyseEmergency,
  buildBeforeAfterComparison,
  buildEmergencyPlan,
} from "../src/domain/emergency/scenario";
import { buildRouteAlternatives, closedRoadIds } from "../src/domain/emergency/roads";
import { predictUpcomingEvents } from "../src/domain/emergency/eventPrediction";
import {
  buildRouteContexts,
  generateJourneyOptions,
} from "../src/domain/calculations/journeyPlanner";
import { estimateWalking } from "../src/domain/calculations/walking";
import { buildStudentAlerts } from "../src/features/student/alerts";
import type { SafarState } from "../src/domain/types";

/**
 * Tests for the four-condition emergency intelligence engine.
 *
 * Each test asserts a property that the acceptance criteria require: real
 * capacity limits, no assignment to unavailable buses, no duplicate students,
 * alternatives free of the blocked road, exact +40% demand, exam priority,
 * before/after consistency, reset and repeatability.
 */

const NOW = new Date("2026-11-14T08:00:00");
const FAILED_BUS_IDS = ["bus-ka21ab102", "bus-ka21cd204"];
const FLOODED_ROAD_ID = "rd-puttur-mangalore";

function seedState(): SafarState {
  return createSeedState({ now: NOW });
}

function runScenario(state: SafarState = seedState()) {
  const plan = buildEmergencyPlan(state, NOW);
  const action: SafarAction = { type: "RUN_EMERGENCY_SCENARIO", plan };
  return { before: state, state: reducer(state, action), plan };
}

function withEmergency() {
  const { state } = runScenario();
  const analysis = analyseEmergency(state);
  if (!analysis) throw new Error("Emergency analysis was not produced");
  return { state, analysis };
}

describe("emergency intelligence engine", () => {
  it("TEST 1: two buses break down simultaneously and affect real routes", () => {
    const { state, plan } = runScenario();
    const failed = state.buses.filter((bus) => bus.status === "UNAVAILABLE");

    expect(plan.emergency.failedBusIds).toHaveLength(2);
    expect(failed.map((bus) => bus.registration).sort()).toEqual(["KA-21-AB-102", "KA-21-CD-204"]);
    expect(plan.emergency.failedRouteIds.sort()).toEqual(["R101", "R103"]);

    const analysis = analyseEmergency(state);
    expect(analysis).not.toBeNull();
    expect(analysis!.affectedStudentGroups).toBeGreaterThan(0);
    expect(analysis!.affectedVillages.length).toBeGreaterThan(0);
    expect(analysis!.allocation.operationalBusCount).toBeLessThan(state.buses.length);
  });

  it("TEST 2: demand increases by exactly 40% and drives the allocation", () => {
    const { state, analysis } = withEmergency();
    const emergency = state.emergency!;

    expect(emergency.baseDemandStudents).toBe(420);
    expect(emergency.surgeStudents).toBe(168);
    expect(emergency.emergencyDemandStudents).toBe(588);
    expect((emergency.surgeStudents / emergency.baseDemandStudents) * 100).toBeCloseTo(40, 10);
    expect(analysis.demand.increasePct).toBe(40);
    expect(analysis.allocation.totalStudents).toBe(588);

    // The surge is a real allocation input, not a dashboard-only number.
    const surgeAssigned = analysis.allocation.assignments.length > 0;
    expect(surgeAssigned).toBe(true);
    expect(analysis.demand.additionalSeatsRequired).toBeGreaterThan(0);
  });

  it("TEST 3: the flooded road produces valid alternative routes", () => {
    const { state, analysis } = withEmergency();
    const blocked = closedRoadIds(state.emergency!.roadConditions);

    expect(blocked).toEqual([FLOODED_ROAD_ID]);
    expect(analysis.routeAlternatives.length).toBeGreaterThanOrEqual(3);

    for (const alternative of analysis.routeAlternatives) {
      expect(alternative.alternativePath.roadIds.length).toBeGreaterThan(0);
      expect(alternative.additionalDistanceKm).toBeGreaterThan(0);
      expect(alternative.additionalMinutes).toBeGreaterThan(0);
      expect(alternative.replacementBusRegistrations.length).toBeGreaterThanOrEqual(0);
    }

    const routeIds = analysis.routeAlternatives.map((entry) => entry.routeId).sort();
    expect(routeIds).toEqual(["R102", "R103", "R104"]);
  });

  it("TEST 4: no alternative route contains the blocked road", () => {
    const { state } = withEmergency();
    const emergency = state.emergency!;
    expect(emergency.blockedRoadId).toBe(FLOODED_ROAD_ID);
    const blocked = closedRoadIds(emergency.roadConditions);

    const alternatives = buildRouteAlternatives(
      state.routes,
      emergency.roads,
      emergency.roadConditions,
      new Map(),
    );

    for (const alternative of alternatives) {
      expect(alternative.alternativePath.roadIds).not.toContain(FLOODED_ROAD_ID);
      for (const roadId of alternative.alternativePath.roadIds) {
        expect(blocked).not.toContain(roadId);
        expect(emergency.roads.some((road) => road.id === roadId)).toBe(true);
      }
    }
  });

  it("TEST 5: examination students receive the highest priority", () => {
    const { analysis } = withEmergency();
    const allocation = analysis.allocation;

    expect(allocation.examPriorityStudents).toBeGreaterThan(0);
    expect(allocation.examPriorityServed).toBe(allocation.examPriorityStudents);
    expect(allocation.examPriorityUnserved).toBe(0);

    // The first assignments must be exam-tier, and no standard-tier group may
    // be served before an exam-tier group.
    expect(allocation.assignments[0].priorityTier).toBe("EXAM_IMMINENT");
    const firstStandardIndex = allocation.assignments.findIndex(
      (assignment) => assignment.priorityTier === "STANDARD",
    );
    const lastExamIndex = allocation.assignments.reduce(
      (last, assignment, index) => (assignment.priorityTier === "EXAM_IMMINENT" ? index : last),
      -1,
    );
    if (firstStandardIndex !== -1 && lastExamIndex !== -1) {
      expect(lastExamIndex).toBeLessThan(firstStandardIndex);
    }

    // Exam students are prioritised even when the corridor is short of seats.
    const unservedExam = allocation.unserved.filter((group) => group.hasExam);
    expect(unservedExam.length).toBe(0);
  });

  it("TEST 6: no bus or seat block is allocated beyond its capacity", () => {
    const { state, analysis } = withEmergency();
    const allocation = analysis.allocation;

    for (const block of allocation.seatBlocks) {
      expect(block.used).toBeLessThanOrEqual(block.capacity);
      const allocatedToBlock = allocation.assignments
        .filter((assignment) => assignment.routeId === block.routeId && assignment.busId === block.busId)
        .reduce((sum, assignment) => sum + assignment.students, 0);
      expect(allocatedToBlock).toBe(block.used);
    }

    for (const block of allocation.seatBlocks.filter((entry) => entry.kind === "RELIEF")) {
      const bus = state.buses.find((candidate) => candidate.id === block.busId);
      expect(bus).toBeDefined();
      expect(block.capacity).toBeLessThanOrEqual(bus!.capacity);
      expect(block.used).toBeLessThanOrEqual(bus!.capacity);
    }
  });

  it("TEST 7: no student is assigned to an unavailable bus", () => {
    const { state, analysis } = withEmergency();
    const unusable = new Set(
      state.buses
        .filter((bus) => bus.status === "UNAVAILABLE" || bus.status === "MAINTENANCE")
        .map((bus) => bus.id),
    );

    for (const assignment of analysis.allocation.assignments) {
      expect(unusable.has(assignment.busId)).toBe(false);
      expect(FAILED_BUS_IDS).not.toContain(assignment.busId);
      expect(assignment.routeId).not.toBe(undefined);
    }

    // Routes of unavailable buses get capacity only from relief buses.
    for (const assignment of analysis.allocation.assignments) {
      if (state.emergency!.failedRouteIds.includes(assignment.routeId)) {
        expect(assignment.isReliefBus).toBe(true);
      }
    }
  });

  it("TEST 8: no student group receives duplicate assignments", () => {
    const { analysis } = withEmergency();
    const allocation = analysis.allocation;
    const ids = allocation.assignments.map((assignment) => assignment.studentId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(allocation.allocatedStudents + allocation.unservedStudents).toBe(
      allocation.totalStudents,
    );
    expect(allocation.assignments.reduce((sum, entry) => sum + entry.students, 0)).toBe(
      allocation.allocatedStudents,
    );
  });

  it("TEST 9: walking distances are calculated from the available stop data", () => {
    const { state, analysis } = withEmergency();
    const withPickup = analysis.allocation.assignments.filter(
      (assignment) => assignment.alternativePickup,
    );

    expect(withPickup.length).toBeGreaterThan(0);

    for (const assignment of withPickup) {
      const originalStop = state.stops.find((stop) => stop.id === assignment.pickupStopId);
      const replacementStop = state.stops.find(
        (stop) => stop.id === assignment.effectivePickupStopId,
      );
      expect(originalStop).toBeDefined();
      expect(replacementStop).toBeDefined();

      const expected = estimateWalking(originalStop!.coordinates, replacementStop!.coordinates);
      expect(assignment.walkingMetresApprox).toBe(expected.approxMeters);
      expect(assignment.walkingMinutes).toBe(expected.minutes);
      expect(assignment.walkingMetresApprox).toBeGreaterThan(0);
    }
  });

  it("TEST 10: unserved students are identified with reasons", () => {
    const { analysis } = withEmergency();
    const allocation = analysis.allocation;

    expect(allocation.unservedStudents).toBeGreaterThan(0);
    expect(allocation.unserved.length).toBeGreaterThan(0);

    for (const group of allocation.unserved) {
      expect(group.students).toBeGreaterThan(0);
      expect(group.reason.length).toBeGreaterThan(20);
    }

    expect(allocation.unserved.reduce((sum, group) => sum + group.students, 0)).toBe(
      allocation.unservedStudents,
    );
  });

  it("TEST 11: before-and-after values come from the same calculation", () => {
    const { state } = withEmergency();
    const comparison = buildBeforeAfterComparison(state);

    expect(comparison).not.toBeNull();
    expect(comparison!.before.totalStudents).toBe(420);
    expect(comparison!.after.totalStudents).toBe(588);
    expect(comparison!.before.unavailableBusCount).toBe(0);
    expect(comparison!.after.unavailableBusCount).toBe(2);
    expect(comparison!.before.unservedStudents).toBe(
      comparison!.before.totalStudents - comparison!.before.allocatedStudents,
    );

    const demandRow = comparison!.metrics.find((metric) => metric.key === "demand");
    expect(demandRow?.before).toBe("420");
    expect(demandRow?.after).toBe("588");
    expect(demandRow?.delta).toBe("+168");

    const examRow = comparison!.metrics.find((metric) => metric.key === "examStudents");
    expect(examRow?.before).toBe("0");
    expect(examRow?.after).not.toBe("0");
  });

  it("TEST 12: reset restores the original state", () => {
    const original = seedState();
    const { state } = runScenario(original);
    expect(state.emergency).toBeDefined();

    const reset = reducer(state, { type: "RESET_EMERGENCY_SCENARIO" });

    expect(reset.emergency).toBeUndefined();
    expect(reset.buses.map((bus) => bus.id)).toEqual(original.buses.map((bus) => bus.id));
    expect(reset.buses.map((bus) => bus.status)).toEqual(original.buses.map((bus) => bus.status));
    expect(reset.alerts.filter((alert) => alert.id.startsWith("alert-emergency-"))).toHaveLength(0);
    expect(analyseEmergency(reset)).toBeNull();

    // The student portal still works after a reset.
    const plan = generateJourneyOptions(reset, {
      originVillageId: "v-puttur",
      destinationId: "d-pgc",
      travelDate: reset.scenario.scenarioDate,
      requiredArrivalTime: "12:00",
    });
    expect(plan).toBeDefined();
  });

  it("TEST 13: the emergency scenario can be executed repeatedly", () => {
    const first = runScenario();
    const second = runScenario(first.state);

    const firstAnalysis = analyseEmergency(first.state)!;
    const secondAnalysis = analyseEmergency(second.state)!;

    expect(secondAnalysis.allocation.allocatedStudents).toBe(
      firstAnalysis.allocation.allocatedStudents,
    );
    expect(secondAnalysis.allocation.unservedStudents).toBe(
      firstAnalysis.allocation.unservedStudents,
    );
    expect(secondAnalysis.allocation.assignments.length).toBe(
      firstAnalysis.allocation.assignments.length,
    );

    const ids = secondAnalysis.allocation.assignments.map((assignment) => assignment.studentId);
    expect(new Set(ids).size).toBe(ids.length);

    // Stable alert ids: the second run must not duplicate authority alerts.
    const emergencyAlerts = second.state.alerts.filter((alert) =>
      alert.id.startsWith("alert-emergency-"),
    );
    expect(emergencyAlerts).toHaveLength(4);
    expect(second.state.emergency!.studentRecords).toHaveLength(
      first.state.emergency!.studentRecords.length,
    );
  });

  it("TEST 14: existing SAFAR features keep working during the emergency", () => {
    const { state } = withEmergency();

    // Journey planning still runs, and the flood adds its detour to affected routes.
    const contexts = buildRouteContexts(state);
    expect(contexts.get("R102")?.baseDelayMinutes).toBeGreaterThanOrEqual(7);
    expect(contexts.get("R101")?.baseDelayMinutes).toBe(0);

    const journey = generateJourneyOptions(state, {
      originVillageId: "v-puttur",
      destinationId: "d-pgc",
      travelDate: state.scenario.scenarioDate,
      requiredArrivalTime: "12:00",
    });
    expect(journey).toBeDefined();
    expect(journey.recommendations.length).toBeGreaterThan(0);

    // Student alerts and the documented baseline are unaffected.
    const alerts = buildStudentAlerts({
      state,
      sessionId: "session-demo-1",
      now: NOW,
    });
    expect(Array.isArray(alerts)).toBe(true);
    expect(state.demandSeed.reduce((sum, record) => sum + record.expectedStudents, 0)).toBe(420);
    expect(state.demandSeed.reduce((sum, record) => sum + record.availableSeats, 0)).toBe(350);

    // Student actions still reduce through the same store.
    const withRequest = reducer(state, {
      type: "SUBMIT_TRAVEL_REQUEST",
      request: {
        id: "req-emergency-test",
        originVillageId: "v-vittal",
        destinationId: "d-pgc",
        travelDate: state.scenario.scenarioDate,
        requiredArrivalTime: "09:30",
        groupSize: 2,
        submittedAt: NOW.toISOString(),
        provenance: "SIMULATED",
      },
      audit: {
        id: "audit-emergency-test",
        actor: "STUDENT_DEMO",
        action: "SUBMIT_TRAVEL_REQUEST",
        at: NOW.toISOString(),
        recordIds: ["req-emergency-test"],
      },
    });
    expect(withRequest.travelRequests.some((request) => request.id === "req-emergency-test")).toBe(
      true,
    );
    expect(withRequest.emergency).toBeDefined();

    // Advance prediction still works and keeps provenance honest.
    const predictions = predictUpcomingEvents(state, NOW);
    expect(predictions.length).toBeGreaterThan(0);
    const statuses = new Set(predictions.map((prediction) => prediction.status));
    expect(statuses.has("AI_GENERATED") || statuses.has("VERIFIED")).toBe(true);
    expect(predictions.every((prediction) => prediction.disclaimer.length > 0)).toBe(true);
  });
});
