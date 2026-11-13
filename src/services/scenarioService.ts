import type {
  EventRouteImpact,
  Incident,
  JourneyOption,
  RegionalEvent,
  ReplacementRecommendation,
  SafarState,
  ServiceResult,
  StudentTravelRequest,
} from "../domain/types";
import {
  REPLACEMENT_RECOMMENDED_LABEL,
  SCENARIO_BUS_REGISTRATION,
  SCENARIO_DEMO_DESTINATION_ID,
  SCENARIO_DEMO_ORIGIN_VILLAGE_ID,
  SCENARIO_EVENT_ID,
  SCENARIO_REQUIRED_ARRIVAL_TIME,
  SCENARIO_STEP_IDS,
  SIMULATED_DATA_LABEL,
} from "../domain/constants";
import { isValidDate, isValidTime } from "../domain/time";
import { createSeedEvent } from "../data/seed";
import { getInitialState, type InitialStateOptions } from "../state/initialState";
import {
  createEvent,
  recalculateEventImpacts,
  updateEvent,
} from "./eventService";
import { submitTravelRequest } from "./demandService";
import { searchJourneys } from "./journeyService";
import { simulateBusBreakdown } from "./fleetService";
import {
  approveReplacement,
  generateReplacementRecommendation,
} from "./replacementService";
import { getDemandSummary } from "./demandService";
import {
  appendAlert,
  appendAudit,
  fail,
  finalize,
  ok,
  timestamp,
  type ServiceOptions,
} from "./shared";

const STEP_LABELS: Record<string, string> = {
  [SCENARIO_STEP_IDS.EVENT_CREATED]: "Simulated festival event affects R101 and R104",
  [SCENARIO_STEP_IDS.EVENT_IMPACT_PREDICTED]: "Predicted event impact calculated before the event",
  [SCENARIO_STEP_IDS.STUDENT_REQUEST_ADDED]: "Student travel requirement recorded",
  [SCENARIO_STEP_IDS.BREAKDOWN_CONFIRMED]: "Bus KA-21-AB-102 breakdown confirmed",
  [SCENARIO_STEP_IDS.AFFECTED_JOURNEYS_IDENTIFIED]: "Affected journeys and alternatives recalculated",
  [SCENARIO_STEP_IDS.REPLACEMENT_RECOMMENDED]: "Eligible replacement evaluated and recommended",
  [SCENARIO_STEP_IDS.REPLACEMENT_APPROVED]: "Authority approved the replacement allocation",
};

const ORDERED_STEPS = Object.values(SCENARIO_STEP_IDS);

export interface ScenarioStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface ApprovedReplacementSummary {
  busId: string;
  registration: string;
  capacity: number;
  remainingSeats: number;
  illustrativeResponseMinutes: number;
  routeId?: string;
}

export interface ScenarioSummary {
  mode: SafarState["scenario"]["mode"];
  scenarioDate: string;
  startedAt?: string;
  steps: ScenarioStep[];
  event: RegionalEvent | null;
  affectedRoutes: EventRouteImpact[];
  affectedStudentEstimate: number;
  failedBus: { id: string; registration: string; status: string } | null;
  incident: Incident | null;
  recommendation: ReplacementRecommendation | null;
  approvedReplacement: ApprovedReplacementSummary | null;
  alternatives: JourneyOption[];
  recommendedAlternative: JourneyOption | null;
  noAlternativeReason?: string;
  alternativeDurationMinutes: number | null;
  updatedReliability: number | null;
  awaitingApproval: boolean;
  noFeasibleReplacement: boolean;
  isComplete: boolean;
  notes: string[];
  provenance: "CALCULATED";
}

export interface RunScenarioInput extends ServiceOptions {
  scenarioDate?: string;
  eventId?: string;
  busId?: string;
  originVillageId?: string;
  destinationId?: string;
  requiredArrivalTime?: string;
}

function demoRequestFor(state: SafarState): StudentTravelRequest | undefined {
  return state.travelRequests.find(
    (request) => request.anonymousRef === "SCENARIO-CENTRAL",
  );
}

function findScenarioBus(state: SafarState, busId?: string) {
  return busId
    ? state.buses.find((bus) => bus.id === busId)
    : state.buses.find((bus) => bus.registration === SCENARIO_BUS_REGISTRATION);
}

function summaryState(
  state: SafarState,
  options: { originVillageId?: string; destinationId?: string; requiredArrivalTime?: string },
): ScenarioSummary {
  const scenario = state.scenario;
  const event = state.events.find((candidate) => candidate.id === scenario.eventId) ?? null;
  const incident = state.incidents.find(
    (candidate) => candidate.id === scenario.breakdownIncidentId,
  ) ?? null;
  const recommendation = state.recommendations.find(
    (candidate) => candidate.id === scenario.recommendationId,
  ) ?? (incident
    ? state.recommendations.find((candidate) => candidate.incidentId === incident.id) ?? null
    : null);
  const failedBus = scenario.failedBusId
    ? state.buses.find((bus) => bus.id === scenario.failedBusId) ?? null
    : incident?.busId
      ? state.buses.find((bus) => bus.id === incident.busId) ?? null
      : null;
  const approvedBusId = incident?.replacementBusId ?? scenario.approvedReplacementBusId;
  const approvedBus = approvedBusId
    ? state.buses.find((bus) => bus.id === approvedBusId) ?? null
    : null;

  const declaredRoutes = new Set(event?.declaredAffectedRouteIds ?? []);
  const affectedRoutes = event
    ? state.eventImpacts
        .filter(
          (impact) =>
            impact.eventId === event.id &&
            (declaredRoutes.size === 0 || declaredRoutes.has(impact.routeId)) &&
            impact.score >= 25,
        )
        .sort((a, b) => b.score - a.score)
    : [];
  const demand = getDemandSummary(state);
  const affectedStudentEstimate = affectedRoutes.reduce((sum, impact) => {
    const routeDemand = demand.routes.find((route) => route.routeId === impact.routeId);
    return sum + (routeDemand?.expectedStudents ?? 0);
  }, 0);

  const request: StudentTravelRequest =
    demoRequestFor(state) ?? {
      id: "scenario-request",
      originVillageId: options.originVillageId ?? SCENARIO_DEMO_ORIGIN_VILLAGE_ID,
      destinationId: options.destinationId ?? SCENARIO_DEMO_DESTINATION_ID,
      travelDate: scenario.scenarioDate,
      requiredArrivalTime: options.requiredArrivalTime ?? SCENARIO_REQUIRED_ARRIVAL_TIME,
      groupSize: 1,
      submittedAt: state.meta.createdAt,
      anonymousRef: "SCENARIO-CENTRAL",
      provenance: "SIMULATED",
    };

  const search = searchJourneys(
    {
      originVillageId: request.originVillageId,
      destinationId: request.destinationId,
      travelDate: request.travelDate,
      requiredArrivalTime: request.requiredArrivalTime,
      passengers: request.groupSize,
    },
    state,
  );
  const alternatives = search.ok ? search.data.options : [];
  const recommendedAlternative = search.ok ? search.data.fastest : null;
  const noAlternativeReason = search.ok ? search.data.noRouteReason : search.error;

  const steps: ScenarioStep[] = ORDERED_STEPS.map((id) => ({
    id,
    label: STEP_LABELS[id] ?? id,
    completed: scenario.completedStepIds.includes(id),
  }));

  return {
    mode: scenario.mode,
    scenarioDate: scenario.scenarioDate,
    startedAt: scenario.startedAt,
    steps,
    event,
    affectedRoutes,
    affectedStudentEstimate,
    failedBus: failedBus
      ? { id: failedBus.id, registration: failedBus.registration, status: failedBus.status }
      : null,
    incident: incident ?? null,
    recommendation,
    approvedReplacement: approvedBus
      ? {
          busId: approvedBus.id,
          registration: approvedBus.registration,
          capacity: approvedBus.capacity,
          remainingSeats: Math.max(0, approvedBus.capacity - approvedBus.occupiedSeats),
          illustrativeResponseMinutes: approvedBus.estimatedResponseMinutes,
          routeId: approvedBus.assignedRouteId ?? undefined,
        }
      : null,
    alternatives,
    recommendedAlternative,
    noAlternativeReason,
    alternativeDurationMinutes: recommendedAlternative?.totalDurationMinutes ?? null,
    updatedReliability: recommendedAlternative?.reliabilityScore ?? null,
    awaitingApproval: recommendation?.status === "PENDING",
    noFeasibleReplacement: recommendation?.status === "NO_FEASIBLE_CANDIDATE",
    isComplete:
      Boolean(approvedBus) &&
      Boolean(event) &&
      Boolean(incident) &&
      ORDERED_STEPS.every((id) => scenario.completedStepIds.includes(id)),
    notes: [
      `${SIMULATED_DATA_LABEL}: scenario values, response times and reliability scores are illustrative.`,
      "Predicted event congestion is not a verified road closure or live traffic measurement.",
      ...scenario.notes,
    ],
    provenance: "CALCULATED",
  };
}

function scenarioEventInput(event: RegionalEvent) {
  return {
    id: event.id,
    name: event.name,
    category: event.category,
    locationLabel: event.locationLabel,
    villageId: event.villageId,
    latitude: event.latitude,
    longitude: event.longitude,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    crowdLevel: event.crowdLevel,
    nearbyVillageIds: event.nearbyVillageIds,
    affectedRoadLabels: event.affectedRoadLabels,
    declaredAffectedRouteIds: event.declaredAffectedRouteIds,
    preparationBufferMinutes: event.preparationBuffer?.minutes,
    preparationBufferSource: event.preparationBuffer?.source,
    description: event.description,
    source: event.source,
    provenance: "SIMULATED" as const,
    verificationStatus: event.verificationStatus,
  };
}

/**
 * Runs the central repeatable SAFAR scenario:
 * event → predicted impact → student request → confirmed breakdown →
 * recalculated journeys → replacement recommendation (approval remains a
 * separate explicit authority action).
 */
export function runScenario(
  input: RunScenarioInput,
  state: SafarState,
): ServiceResult<ScenarioSummary> {
  if (input.scenarioDate && !isValidDate(input.scenarioDate)) {
    return fail(state, "SCENARIO_INVALID", "Scenario date must be a valid YYYY-MM-DD date.");
  }
  if (input.requiredArrivalTime && !isValidTime(input.requiredArrivalTime)) {
    return fail(state, "SCENARIO_INVALID", "Required arrival time must be a valid HH:MM time.");
  }

  const now = timestamp(input);
  const scenarioDate = input.scenarioDate ?? state.scenario.scenarioDate;
  const completed = new Set(state.scenario.completedStepIds);
  let nextState = state;

  // 1. Ensure the simulated festival event exists for the configured date.
  let event = nextState.events.find(
    (candidate) => candidate.id === (input.eventId ?? SCENARIO_EVENT_ID),
  );
  if (!event) {
    const seeded = createSeedEvent(scenarioDate, now);
    const created = createEvent(
      { ...scenarioEventInput(seeded), id: input.eventId ?? SCENARIO_EVENT_ID },
      nextState,
      { now: input.now },
    );
    if (!created.ok) return fail(created.state, created.code, created.error);
    nextState = created.state;
    event = created.data.event;
  } else if (event.date !== scenarioDate) {
    const updated = updateEvent(
      event.id,
      { date: scenarioDate },
      nextState,
      { now: input.now },
    );
    if (!updated.ok) return fail(updated.state, updated.code, updated.error);
    nextState = updated.state;
    event = updated.data.event;
  } else {
    nextState = recalculateEventImpacts(nextState, event.id);
  }
  completed.add(SCENARIO_STEP_IDS.EVENT_CREATED);
  if (nextState.eventImpacts.some((impact) => impact.eventId === event?.id)) {
    completed.add(SCENARIO_STEP_IDS.EVENT_IMPACT_PREDICTED);
  }

  // 2. Ensure the demo student travel requirement exists for the scenario date.
  let demoRequest = demoRequestFor(nextState);
  if (!demoRequest) {
    const submitted = submitTravelRequest(
      {
        originVillageId: input.originVillageId ?? SCENARIO_DEMO_ORIGIN_VILLAGE_ID,
        destinationId: input.destinationId ?? SCENARIO_DEMO_DESTINATION_ID,
        travelDate: scenarioDate,
        requiredArrivalTime: input.requiredArrivalTime ?? SCENARIO_REQUIRED_ARRIVAL_TIME,
        groupSize: 1,
        provenance: "SIMULATED",
        anonymousRef: "SCENARIO-CENTRAL",
      },
      nextState,
      { now: input.now },
    );
    if (!submitted.ok) return fail(submitted.state, submitted.code, submitted.error);
    nextState = submitted.state;
    demoRequest = submitted.data.request;
  } else if (demoRequest.travelDate !== scenarioDate) {
    nextState = {
      ...nextState,
      travelRequests: nextState.travelRequests.map((request) =>
        request.id === demoRequest?.id ? { ...request, travelDate: scenarioDate } : request,
      ),
    };
  }
  completed.add(SCENARIO_STEP_IDS.STUDENT_REQUEST_ADDED);

  // 3. Confirm (or reuse) the simulated breakdown.
  const bus = findScenarioBus(nextState, input.busId);
  if (!bus) {
    return fail(
      nextState,
      "SCENARIO_BUS_MISSING",
      `Scenario bus ${SCENARIO_BUS_REGISTRATION} was not found in the fleet.`,
    );
  }

  let incident = nextState.incidents.find(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      candidate.busId === bus.id &&
      candidate.type === "BUS_BREAKDOWN",
  );
  if (!incident) {
    const simulated = simulateBusBreakdown(
      {
        busId: bus.id,
        routeId: bus.assignedRouteId ?? "R101",
        description: "Central SAFAR scenario: simulated mechanical failure during the morning peak.",
        actor: "SCENARIO_CONTROLLER",
        now: input.now,
      },
      nextState,
    );
    if (!simulated.ok) return fail(simulated.state, simulated.code, simulated.error);
    nextState = simulated.state;
    incident = simulated.data.incident;
  }
  completed.add(SCENARIO_STEP_IDS.BREAKDOWN_CONFIRMED);

  // 4. Ensure a replacement proposal exists (still awaiting approval).
  let recommendation = nextState.recommendations.find(
    (candidate) => candidate.incidentId === incident?.id && candidate.status !== "REJECTED",
  );
  if (!recommendation) {
    const generated = generateReplacementRecommendation(incident.id, nextState);
    if (!generated.ok) {
      return fail(generated.state, generated.code, generated.error);
    }
    nextState = generated.state;
    recommendation = generated.data.recommendation;
  }
  if (recommendation) completed.add(SCENARIO_STEP_IDS.REPLACEMENT_RECOMMENDED);

  // 5. Recalculate the student's journeys against the changed fleet.
  completed.add(SCENARIO_STEP_IDS.AFFECTED_JOURNEYS_IDENTIFIED);
  if (recommendation.status === "APPROVED") {
    completed.add(SCENARIO_STEP_IDS.REPLACEMENT_APPROVED);
  }

  nextState = {
    ...nextState,
    scenario: {
      ...nextState.scenario,
      mode: "CENTRAL",
      scenarioDate,
      startedAt: nextState.scenario.startedAt ?? now,
      completedStepIds: ORDERED_STEPS.filter((id) => completed.has(id)),
      eventId: event.id,
      failedBusId: bus.id,
      breakdownIncidentId: incident.id,
      recommendationId: recommendation.id,
      approvedReplacementBusId:
        recommendation.status === "APPROVED"
          ? recommendation.recommendedBusId
          : nextState.scenario.approvedReplacementBusId,
      notes: [
        `Central scenario run at ${now}. Event-route impact is calculated from the seeded association; it is not a verified closure.`,
      ],
    },
  };
  nextState = appendAlert(nextState, {
    audience: "AUTHORITY",
    severity:
      recommendation.status === "PENDING"
        ? "WARNING"
        : recommendation.status === "NO_FEASIBLE_CANDIDATE"
          ? "CRITICAL"
          : "SUCCESS",
    category: "SYSTEM",
    title:
      recommendation.status === "PENDING"
        ? REPLACEMENT_RECOMMENDED_LABEL
        : "SAFAR live scenario prepared",
    message:
      "SAFAR live scenario prepared. Approve or reject the replacement recommendation to complete the operational response.",
    routeId: incident.routeId,
    incidentId: incident.id,
    recommendationId: recommendation.id,
    createdAt: now,
    provenance: "CALCULATED",
  });
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "RUN_SCENARIO",
    entityType: "ScenarioState",
    entityIds: [event.id, incident.id, recommendation.id],
    at: now,
    details: {
      scenarioDate,
      failedBusId: bus.id,
      recommendationStatus: recommendation.status,
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, summaryState(nextState, input));
}

export interface ApproveScenarioResult {
  recommendation: ReplacementRecommendation;
  summary: ScenarioSummary;
}

export function approveScenarioReplacement(
  state: SafarState,
  options: { now?: Date; actor?: string; busId?: string; reason?: string } = {},
): ServiceResult<ApproveScenarioResult> {
  const incidentId = state.scenario.breakdownIncidentId;
  if (!incidentId) {
    return fail(
      state,
      "SCENARIO_NOT_RUNNING",
      "No scenario breakdown has been confirmed. Run the scenario or confirm a breakdown first.",
    );
  }
  const recommendation =
    state.recommendations.find(
      (candidate) => candidate.id === state.scenario.recommendationId,
    ) ??
    state.recommendations.find(
      (candidate) => candidate.incidentId === incidentId && candidate.status === "PENDING",
    );
  if (!recommendation) {
    return fail(state, "RECOMMENDATION_NOT_FOUND", "No replacement recommendation is available to approve.");
  }

  const approved = approveReplacement(recommendation.id, state, {
    now: options.now,
    actor: options.actor,
    busId: options.busId,
    reason: options.reason,
  });
  if (!approved.ok) return approved as ServiceResult<ApproveScenarioResult>;

  const now = timestamp({ now: options.now });
  const completed = new Set(approved.state.scenario.completedStepIds);
  completed.add(SCENARIO_STEP_IDS.REPLACEMENT_APPROVED);
  let nextState: SafarState = {
    ...approved.state,
    scenario: {
      ...approved.state.scenario,
      completedStepIds: ORDERED_STEPS.filter((id) => completed.has(id)),
      recommendationId: recommendation.id,
      approvedReplacementBusId: approved.data.bus.id,
    },
  };
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "APPROVE_SCENARIO_REPLACEMENT",
    entityType: "ScenarioState",
    entityIds: [recommendation.id, approved.data.bus.id],
    at: now,
    reason: options.reason ?? "Authority approved the scenario replacement.",
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    recommendation: approved.data.recommendation,
    summary: summaryState(nextState, {}),
  });
}

export interface RunBreakdownScenarioInput extends ServiceOptions {
  busId?: string;
  routeId?: string;
  description?: string;
}

/** Scenario B — immediate breakdown only, without the festival scenario. */
export function runBreakdownScenario(
  input: RunBreakdownScenarioInput,
  state: SafarState,
): ServiceResult<ScenarioSummary> {
  const bus =
    findScenarioBus(state, input.busId) ??
    state.buses.find((candidate) => candidate.status === "OPERATING");
  if (!bus) {
    return fail(state, "SCENARIO_BUS_MISSING", "No operating bus is available to simulate.");
  }

  const simulated = simulateBusBreakdown(
    {
      busId: bus.id,
      routeId: input.routeId ?? bus.assignedRouteId ?? undefined,
      description:
        input.description ??
        "Isolated immediate-breakdown demo: simulated breakdown without the festival scenario.",
      actor: "SCENARIO_CONTROLLER",
      now: input.now,
    },
    state,
  );
  if (!simulated.ok) return fail(simulated.state, simulated.code, simulated.error);

  const now = timestamp(input);
  const incident = simulated.data.incident;
  let recommendation = simulated.data.recommendation;
  let nextState = simulated.state;
  if (!recommendation) {
    const generated = generateReplacementRecommendation(incident.id, nextState);
    if (generated.ok) {
      nextState = generated.state;
      recommendation = generated.data.recommendation;
    }
  }

  const completed = new Set<string>([
    SCENARIO_STEP_IDS.BREAKDOWN_CONFIRMED,
    SCENARIO_STEP_IDS.AFFECTED_JOURNEYS_IDENTIFIED,
  ]);
  if (recommendation) completed.add(SCENARIO_STEP_IDS.REPLACEMENT_RECOMMENDED);

  nextState = {
    ...nextState,
    scenario: {
      ...nextState.scenario,
      mode: "BREAKDOWN",
      startedAt: nextState.scenario.startedAt ?? now,
      completedStepIds: ORDERED_STEPS.filter((id) => completed.has(id)),
      failedBusId: bus.id,
      breakdownIncidentId: incident.id,
      recommendationId: recommendation?.id,
      notes: [
        `Isolated breakdown demo at ${now}. The festival event was not required or modified.`,
      ],
    },
  };
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "RUN_BREAKDOWN_SCENARIO",
    entityType: "ScenarioState",
    entityIds: [bus.id, incident.id],
    at: now,
  });
  nextState = finalize(nextState, now);

  return ok(nextState, summaryState(nextState, {}));
}

/** Derived summary for dashboards; does not mutate state. */
export function getScenarioSummary(
  state: SafarState,
  options: { originVillageId?: string; destinationId?: string; requiredArrivalTime?: string } = {},
): ScenarioSummary {
  return summaryState(state, options);
}

export function resetScenario(
  options: InitialStateOptions = {},
): SafarState {
  return getInitialState(options);
}

export function resetState(options: InitialStateOptions = {}): SafarState {
  return getInitialState(options);
}

export const scenarioService = {
  runScenario,
  runBreakdownScenario,
  approveScenarioReplacement,
  getScenarioSummary,
  resetScenario,
  resetState,
  getInitialState,
};
