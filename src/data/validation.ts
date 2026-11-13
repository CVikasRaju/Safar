import type { SafarState } from "../domain/types";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

/**
 * Referential validation for seed and restored state (docs/10, docs/13).
 * Errors mean the data model is broken; warnings are demo-data gaps that the
 * UI must state honestly.
 */
export function validateState(state: SafarState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (level: ValidationIssue["level"], message: string) => issues.push({ level, message });

  const villageIds = new Set(state.villages.map((village) => village.id));
  const stopIds = new Set(state.stops.map((stop) => stop.id));
  const routeIds = new Set(state.routes.map((route) => route.id));
  const busIds = new Set(state.buses.map((bus) => bus.id));
  const destinationIds = new Set(state.destinations.map((destination) => destination.id));
  const serviceIds = new Set(state.timetableServices.map((service) => service.id));
  const eventIds = new Set(state.events.map((event) => event.id));
  const incidentIds = new Set(state.incidents.map((incident) => incident.id));
  const reportIds = new Set(state.disruptionReports.map((report) => report.id));

  for (const [label, ids] of [
    ["village", state.villages.map((village) => village.id)],
    ["stop", state.stops.map((stop) => stop.id)],
    ["route", state.routes.map((route) => route.id)],
    ["bus", state.buses.map((bus) => bus.id)],
    ["destination", state.destinations.map((destination) => destination.id)],
    ["service", state.timetableServices.map((service) => service.id)],
    ["event", state.events.map((event) => event.id)],
  ] as const) {
    const dupes = duplicates([...ids]);
    if (dupes.length > 0) push("error", `Duplicate ${label} IDs: ${dupes.join(", ")}`);
  }

  for (const stop of state.stops) {
    if (!villageIds.has(stop.villageId)) {
      push("error", `Stop ${stop.id} references unknown village ${stop.villageId}`);
    }
  }

  for (const destination of state.destinations) {
    if (!villageIds.has(destination.villageId)) {
      push("error", `Destination ${destination.id} references unknown village`);
    }
    if (!stopIds.has(destination.stopId)) {
      push("error", `Destination ${destination.id} references unknown stop ${destination.stopId}`);
    }
  }

  for (const route of state.routes) {
    if (route.stops.length < 2) push("error", `Route ${route.id} has fewer than two stops`);
    const seen = new Set<string>();
    for (const stopId of route.stops) {
      if (!stopIds.has(stopId)) push("error", `Route ${route.id} references unknown stop ${stopId}`);
      if (seen.has(stopId)) push("error", `Route ${route.id} repeats stop ${stopId}`);
      seen.add(stopId);
    }
  }

  for (const bus of state.buses) {
    if (bus.assignedRouteId && !routeIds.has(bus.assignedRouteId)) {
      push("error", `Bus ${bus.registration} references unknown route ${bus.assignedRouteId}`);
    }
    if (bus.occupiedSeats > bus.capacity) {
      push("error", `Bus ${bus.registration} has more occupied seats than capacity`);
    }
  }

  for (const service of state.timetableServices) {
    if (!routeIds.has(service.routeId)) {
      push("error", `Service ${service.id} references unknown route ${service.routeId}`);
    }
    if (!busIds.has(service.busId)) {
      push("error", `Service ${service.id} references unknown bus ${service.busId}`);
    }
    const route = state.routes.find((candidate) => candidate.id === service.routeId);
    if (!route) continue;

    const expectedStops = service.direction === "OUTBOUND" ? route.stops : [...route.stops].reverse();
    if (service.stopTimes.length !== expectedStops.length) {
      push(
        "error",
        `Service ${service.id} stop count does not match route ${route.id} in direction ${service.direction}`,
      );
    }
    service.stopTimes.forEach((stopTime, index) => {
      if (!stopIds.has(stopTime.stopId)) {
        push("error", `Service ${service.id} references unknown stop ${stopTime.stopId}`);
      }
      if (expectedStops[index] && expectedStops[index] !== stopTime.stopId) {
        push("error", `Service ${service.id} stop order does not match route ${route.id}`);
      }
      if (index > 0) {
        const previous = service.stopTimes[index - 1];
        if (stopTime.arrivalMinute <= previous.arrivalMinute) {
          push("error", `Service ${service.id} stop times are not chronological`);
        }
      }
    });
    if (service.operatingDays.length === 0) {
      push("warning", `Service ${service.id} has no operating days`);
    }
  }

  for (const event of state.events) {
    for (const routeId of event.affectedRouteIds) {
      if (!routeIds.has(routeId)) {
        push("error", `Event ${event.id} references unknown route ${routeId}`);
      }
    }
    for (const villageId of event.nearbyVillageIds) {
      if (!villageIds.has(villageId)) {
        push("error", `Event ${event.id} references unknown village ${villageId}`);
      }
    }
  }

  for (const impact of state.eventRouteImpacts) {
    if (!eventIds.has(impact.eventId)) {
      push("error", `Event impact ${impact.id} references unknown event ${impact.eventId}`);
    }
    if (!routeIds.has(impact.routeId)) {
      push("error", `Event impact ${impact.id} references unknown route ${impact.routeId}`);
    }
    if (impact.impactScore < 0 || impact.impactScore > 100) {
      push("error", `Event impact ${impact.id} score is outside 0–100`);
    }
  }

  for (const demand of state.demandSeed) {
    if (!routeIds.has(demand.routeId)) {
      push("error", `Demand seed references unknown route ${demand.routeId}`);
    }
  }

  for (const request of state.travelRequests) {
    if (!villageIds.has(request.originVillageId)) {
      push("error", `Travel request ${request.id} references unknown origin village`);
    }
    if (!destinationIds.has(request.destinationId)) {
      push("error", `Travel request ${request.id} references unknown destination`);
    }
    if (request.groupSize < 1 || request.groupSize > 20) {
      push("error", `Travel request ${request.id} has an invalid group size`);
    }
  }

  for (const report of state.disruptionReports) {
    if (!routeIds.has(report.routeId)) {
      push("error", `Report ${report.id} references unknown route ${report.routeId}`);
    }
    if (report.expectedBusId && !busIds.has(report.expectedBusId)) {
      push("error", `Report ${report.id} references unknown bus`);
    }
    if (report.stopId && !stopIds.has(report.stopId)) {
      push("error", `Report ${report.id} references unknown stop`);
    }
    if (report.relatedIncidentId && !incidentIds.has(report.relatedIncidentId)) {
      push("warning", `Report ${report.id} references an incident not in state yet`);
    }
  }

  for (const incident of state.incidents) {
    if (incident.routeId && !routeIds.has(incident.routeId)) {
      push("error", `Incident ${incident.id} references unknown route`);
    }
    for (const reportId of incident.relatedReportIds) {
      if (!reportIds.has(reportId)) {
        push("warning", `Incident ${incident.id} references unknown report ${reportId}`);
      }
    }
  }

  for (const serviceId of serviceIds) {
    if (!serviceId.startsWith("svc-")) push("warning", `Unexpected service ID ${serviceId}`);
  }

  return issues;
}
