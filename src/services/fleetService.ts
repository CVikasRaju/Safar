import type {
  Bus,
  BusStatus,
  Incident,
  ReplacementRecommendation,
  SafarState,
  ServiceResult,
} from "../domain/types";
import { findBus, getNetworkFromState } from "../domain/network";
import { applyReplacementAllocation } from "../domain/calculations/allocation";
import { confirmIncident } from "./disruptionService";
import { appendAlert, appendAudit, fail, finalize, isNonEmptyString, ok, timestamp, type ServiceOptions } from "./shared";

export interface FleetBusSummary {
  bus: Bus;
  remainingSeats: number;
  assignedRouteLabel: string;
  assignableForReplacement: boolean;
  statusLabel: string;
}

export interface FleetSummary {
  buses: FleetBusSummary[];
  counts: Record<BusStatus, number>;
  totalCapacity: number;
  totalOccupied: number;
  totalRemainingSeats: number;
  provenance: "CALCULATED";
}

const STATUS_LABELS: Record<BusStatus, string> = {
  OPERATING: "Operating",
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
  MAINTENANCE: "Maintenance",
  REPLACEMENT_ASSIGNED: "Replacement assigned",
};

export function getFleetSummary(state: SafarState): FleetSummary {
  const counts: Record<BusStatus, number> = {
    OPERATING: 0,
    AVAILABLE: 0,
    UNAVAILABLE: 0,
    MAINTENANCE: 0,
    REPLACEMENT_ASSIGNED: 0,
  };
  for (const bus of state.buses) counts[bus.status] += 1;

  const network = getNetworkFromState(state);
  const buses: FleetBusSummary[] = state.buses.map((bus) => {
    const route = bus.assignedRouteId
      ? network.routes.find((candidate) => candidate.id === bus.assignedRouteId)
      : undefined;
    const remainingSeats = Math.max(0, bus.capacity - bus.occupiedSeats);
    return {
      bus,
      remainingSeats,
      assignedRouteLabel: bus.assignedRouteId
        ? `${bus.assignedRouteId}${route ? ` — ${route.name}` : ""}`
        : "Unassigned (depot pool)",
      assignableForReplacement: bus.status === "AVAILABLE" && bus.commitments.length === 0,
      statusLabel: STATUS_LABELS[bus.status],
    };
  });

  return {
    buses,
    counts,
    totalCapacity: state.buses.reduce((sum, bus) => sum + bus.capacity, 0),
    totalOccupied: state.buses.reduce((sum, bus) => sum + bus.occupiedSeats, 0),
    totalRemainingSeats: buses.reduce((sum, summary) => sum + summary.remainingSeats, 0),
    provenance: "CALCULATED",
  };
}

export interface SimulateBreakdownInput extends ServiceOptions {
  busId: string;
  routeId?: string;
  affectedStopId?: string;
  occurredAt?: string;
  description?: string;
  actor?: string;
}

export interface SimulateBreakdownResult {
  incident: Incident;
  bus: Bus;
  routeId?: string;
  affectedPassengers: number;
  affectedJourneyCount: number;
  recommendation?: ReplacementRecommendation;
  warning?: string;
}

/**
 * Breakdown simulation. Only an operating bus may be selected. The result is
 * recorded as a SIMULATED confirmed incident, which applies the same fleet and
 * replacement workflow as an authority-confirmed incident.
 */
export function simulateBusBreakdown(
  input: SimulateBreakdownInput,
  state: SafarState,
): ServiceResult<SimulateBreakdownResult> {
  const bus = findBus(state.buses, input.busId);
  if (!bus) return fail(state, "BUS_NOT_FOUND", `Unknown bus "${input.busId}".`);
  if (bus.status !== "OPERATING") {
    return fail(
      state,
      "BUS_NOT_OPERATING",
      `Only an operating bus can be simulated as broken down. ${bus.registration} is ${bus.status.toLowerCase()}.`,
    );
  }

  const confirmed = confirmIncident(
    {
      type: "BUS_BREAKDOWN",
      busId: bus.id,
      routeId: input.routeId ?? bus.assignedRouteId ?? undefined,
      affectedStopId: input.affectedStopId,
      occurredAt: input.occurredAt,
      severity: "HIGH",
      description:
        input.description ??
        `Simulated breakdown of ${bus.registration} during the SAFAR demo.`,
      expectedResolution: "Awaiting authority replacement decision.",
      confirmedBy: input.actor ?? "AUTHORITY_SIMULATION",
      simulated: true,
    },
    state,
    { now: input.now },
  );
  if (!confirmed.ok) return confirmed;

  const now = timestamp(input);
  let nextState = appendAudit(confirmed.state, {
    actor: "AUTHORITY",
    action: "SIMULATE_BUS_BREAKDOWN",
    entityType: "Bus",
    entityIds: [bus.id, confirmed.data.incident.id],
    at: now,
    reason: "Scripted breakdown simulation using the confirmed-incident workflow.",
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    incident: confirmed.data.incident,
    bus: nextState.buses.find((candidate) => candidate.id === bus.id) ?? bus,
    routeId: confirmed.data.affectedRouteId,
    affectedPassengers: confirmed.data.affectedPassengers,
    affectedJourneyCount: confirmed.data.affectedJourneyCount,
    recommendation: confirmed.data.recommendation,
    warning: confirmed.data.warning,
  });
}

/** Marks a bus unavailable through an explicit authority action (no incident implied). */
export function markBusUnavailable(
  busId: string,
  reason: string,
  state: SafarState,
  options: ServiceOptions = {},
): ServiceResult<{ bus: Bus }> {
  const bus = findBus(state.buses, busId);
  if (!bus) return fail(state, "BUS_NOT_FOUND", `Unknown bus "${busId}".`);
  if (!isNonEmptyString(reason) || reason.trim().length < 3) {
    return fail(state, "REASON_REQUIRED", "A reason of at least 3 characters is required.");
  }
  if (bus.status === "UNAVAILABLE") {
    return fail(state, "BUS_ALREADY_UNAVAILABLE", `${bus.registration} is already unavailable.`);
  }
  if (bus.status === "MAINTENANCE") {
    return fail(state, "BUS_IN_MAINTENANCE", `${bus.registration} is already in maintenance.`);
  }

  const now = timestamp(options);
  const updated: Bus = {
    ...bus,
    status: "UNAVAILABLE",
    commitments: [],
  };
  let nextState: SafarState = {
    ...state,
    buses: state.buses.map((candidate) => (candidate.id === bus.id ? updated : candidate)),
  };
  nextState = appendAlert(nextState, {
    audience: "AUTHORITY",
    severity: "WARNING",
    category: "SYSTEM",
    title: "Bus marked unavailable",
    message: `${bus.registration} was marked unavailable by the authority. Reason: ${reason.trim()}. This is not a confirmed incident unless a separate incident record exists.`,
    routeId: bus.assignedRouteId ?? undefined,
    provenance: "VERIFIED",
    createdAt: now,
  });
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "MARK_BUS_UNAVAILABLE",
    entityType: "Bus",
    entityIds: [bus.id],
    at: now,
    reason: reason.trim(),
  });
  nextState = finalize(nextState, now);

  return ok(nextState, { bus: updated });
}

export interface FleetAllocationDecision {
  incidentId: string;
  busId: string;
  actor?: string;
  reason?: string;
  at?: string;
}

/**
 * Low-level allocation of an already-approved replacement decision.
 * Prefer `replacementService.approveReplacement`, which also revalidates the
 * recommendation and records the decision.
 */
export function updateFleetAllocation(
  decision: FleetAllocationDecision,
  state: SafarState,
): ServiceResult<{ bus: Bus; routeId: string }> {
  const incident = state.incidents.find((candidate) => candidate.id === decision.incidentId);
  if (!incident) {
    return fail(state, "INCIDENT_NOT_FOUND", `Unknown incident "${decision.incidentId}".`);
  }
  if (incident.status !== "ACTIVE") {
    return fail(state, "INCIDENT_NOT_ACTIVE", "The incident is not active.");
  }
  if (!incident.routeId) {
    return fail(state, "INCIDENT_NO_ROUTE", "The incident has no affected route.");
  }
  const bus = findBus(state.buses, decision.busId);
  if (!bus) return fail(state, "BUS_NOT_FOUND", `Unknown bus "${decision.busId}".`);
  if (bus.status !== "AVAILABLE" || bus.commitments.length > 0) {
    return fail(
      state,
      "BUS_NOT_ASSIGNABLE",
      `${bus.registration} is not in the available pool (status ${bus.status}).`,
    );
  }
  if (incident.replacementBusId) {
    return fail(
      state,
      "INCIDENT_ALREADY_COVERED",
      "A replacement is already allocated to this incident.",
    );
  }

  const now = decision.at ?? timestamp();
  try {
    const allocation = applyReplacementAllocation(
      state.buses,
      state.incidents,
      incident.id,
      bus.id,
      now,
    );
    let nextState: SafarState = {
      ...state,
      buses: allocation.buses,
      incidents: allocation.incidents,
    };
    nextState = appendAudit(nextState, {
      actor: "AUTHORITY",
      action: "UPDATE_FLEET_ALLOCATION",
      entityType: "Bus",
      entityIds: [bus.id, incident.id],
      at: now,
      reason: decision.reason,
      details: { routeId: allocation.routeId, actor: decision.actor ?? "AUTHORITY" },
    });
    nextState = finalize(nextState, now);
    return ok(nextState, { bus: allocation.bus, routeId: allocation.routeId });
  } catch (error) {
    return fail(
      state,
      "ALLOCATION_FAILED",
      error instanceof Error ? error.message : "Fleet allocation failed.",
    );
  }
}

export function getOperatingBuses(state: SafarState): Bus[] {
  return state.buses.filter((bus) => bus.status === "OPERATING");
}

export function getAssignableBuses(state: SafarState): Bus[] {
  return state.buses.filter(
    (bus) => bus.status === "AVAILABLE" && bus.commitments.length === 0,
  );
}

export const fleetService = {
  getFleetSummary,
  simulateBusBreakdown,
  markBusUnavailable,
  updateFleetAllocation,
  getOperatingBuses,
  getAssignableBuses,
};
