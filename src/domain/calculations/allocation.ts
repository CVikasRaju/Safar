import type { Bus, Incident } from "../types";

export interface FleetAllocationOutcome {
  buses: Bus[];
  incidents: Incident[];
  bus: Bus;
  routeId: string;
}

/**
 * Applies an already-validated authority replacement allocation.
 * Callers must revalidate the incident and candidate immediately before use.
 */
export function applyReplacementAllocation(
  fleet: Bus[],
  incidents: Incident[],
  incidentId: string,
  busId: string,
  at: string,
): FleetAllocationOutcome {
  const incident = incidents.find((candidate) => candidate.id === incidentId);
  if (!incident) throw new Error(`Unknown incident ${incidentId}.`);
  if (!incident.routeId) throw new Error(`Incident ${incidentId} has no affected route.`);
  const bus = fleet.find((candidate) => candidate.id === busId);
  if (!bus) throw new Error(`Unknown bus ${busId}.`);

  const commitments = [
    ...bus.commitments.filter(
      (commitment) => !commitment.startsWith("route:") && !commitment.startsWith("incident:"),
    ),
    `route:${incident.routeId}`,
    `incident:${incident.id}`,
  ];

  const updatedBus: Bus = {
    ...bus,
    assignedRouteId: incident.routeId,
    status: "REPLACEMENT_ASSIGNED",
    commitments: [...new Set(commitments)],
  };
  const updatedIncident: Incident = {
    ...incident,
    replacementBusId: bus.id,
  };

  return {
    buses: fleet.map((candidate) => (candidate.id === bus.id ? updatedBus : candidate)),
    incidents: incidents.map((candidate) =>
      candidate.id === incident.id ? updatedIncident : candidate,
    ),
    bus: updatedBus,
    routeId: incident.routeId,
  };
}

export interface BusReleaseOutcome {
  buses: Bus[];
  releasedBus: Bus | null;
}

/**
 * Releases a replacement bus back to the pool when its incident closes.
 * The failed bus remains unavailable until separately resolved.
 */
export function releaseReplacementBus(
  fleet: Bus[],
  busId: string | undefined,
  incidentId: string,
  at: string,
): BusReleaseOutcome {
  if (!busId) return { buses: fleet, releasedBus: null };
  const bus = fleet.find((candidate) => candidate.id === busId);
  if (!bus || bus.status !== "REPLACEMENT_ASSIGNED") {
    return { buses: fleet, releasedBus: null };
  }
  const released: Bus = {
    ...bus,
    assignedRouteId: null,
    status: "AVAILABLE",
    commitments: bus.commitments.filter(
      (commitment) =>
        commitment !== `incident:${incidentId}` && !commitment.startsWith("route:"),
    ),
  };
  return {
    buses: fleet.map((candidate) => (candidate.id === bus.id ? released : candidate)),
    releasedBus: released,
  };
}

/** Restores a failed bus to service only when no other active incident remains. */
export function restoreFailedBus(
  fleet: Bus[],
  incidents: Incident[],
  busId: string | undefined,
  incidentId: string,
): Bus[] {
  if (!busId) return fleet;
  const hasOtherActiveIncident = incidents.some(
    (incident) =>
      incident.id !== incidentId && incident.status === "ACTIVE" && incident.busId === busId,
  );
  if (hasOtherActiveIncident) return fleet;
  const bus = fleet.find((candidate) => candidate.id === busId);
  if (!bus || bus.status !== "UNAVAILABLE") return fleet;
  const restored: Bus = {
    ...bus,
    status: bus.assignedRouteId ? "OPERATING" : "AVAILABLE",
    commitments: bus.assignedRouteId
      ? [`route:${bus.assignedRouteId}`]
      : [],
  };
  return fleet.map((candidate) => (candidate.id === bus.id ? restored : candidate));
}
