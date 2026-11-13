import type {
  Bus,
  NetworkData,
  RegionalEvent,
  RouteDemandSeed,
  SafarState,
  ValidationResult,
} from "./types";
import { SCHEMA_VERSION } from "./constants";
import { isValidDate, isValidTime, timeToMinutes } from "./time";

interface SeedShape {
  network: NetworkData;
  buses: Bus[];
  demandSeed: RouteDemandSeed[];
  events: RegionalEvent[];
  scenarioDate?: string;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Referential and structural validation for the seed dataset. */
export function validateSeedData(seed: SeedShape): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { network, buses, demandSeed, events } = seed;

  const villageIds = new Set(network.villages.map((village) => village.id));
  const destinationIds = new Set(network.destinations.map((destination) => destination.id));
  const stopIds = new Set(network.stops.map((stop) => stop.id));
  const routeIds = new Set(network.routes.map((route) => route.id));
  const serviceIds = new Set(network.services.map((service) => service.id));
  const busIds = new Set(buses.map((bus) => bus.id));

  const assertUnique = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`Duplicate ${label} ID "${id}".`);
      seen.add(id);
    }
  };

  assertUnique("village", network.villages.map((village) => village.id));
  assertUnique("destination", network.destinations.map((destination) => destination.id));
  assertUnique("stop", network.stops.map((stop) => stop.id));
  assertUnique("route", network.routes.map((route) => route.id));
  assertUnique("service", network.services.map((service) => service.id));
  assertUnique("bus", buses.map((bus) => bus.id));
  assertUnique(
    "bus registration",
    buses.map((bus) => bus.registration),
  );
  assertUnique(
    "event",
    events.map((event) => event.id),
  );

  for (const village of network.villages) {
    for (const access of village.accessStops) {
      if (!stopIds.has(access.stopId)) {
        errors.push(`Village ${village.id} references unknown access stop ${access.stopId}.`);
      }
      if (!isNonNegativeInteger(access.walkMinutes) || access.walkMinutes > 120) {
        errors.push(`Village ${village.id} has an invalid walking time for ${access.stopId}.`);
      }
    }
  }

  for (const destination of network.destinations) {
    if (!villageIds.has(destination.villageId)) {
      errors.push(`Destination ${destination.id} references unknown village ${destination.villageId}.`);
    }
    if (destination.accessStops.length === 0) {
      errors.push(`Destination ${destination.id} has no access stop.`);
    }
    for (const access of destination.accessStops) {
      if (!stopIds.has(access.stopId)) {
        errors.push(`Destination ${destination.id} references unknown stop ${access.stopId}.`);
      }
    }
  }

  for (const stop of network.stops) {
    if (!villageIds.has(stop.villageId)) {
      errors.push(`Stop ${stop.id} references unknown village ${stop.villageId}.`);
    }
  }

  for (const route of network.routes) {
    if (!villageIds.has(route.originVillageId)) {
      errors.push(`Route ${route.id} references unknown origin village ${route.originVillageId}.`);
    }
    if (!villageIds.has(route.destinationVillageId)) {
      errors.push(
        `Route ${route.id} references unknown destination village ${route.destinationVillageId}.`,
      );
    }
    if (route.stopIds.length < 2) {
      errors.push(`Route ${route.id} must have at least two stops.`);
    }
    if (new Set(route.stopIds).size !== route.stopIds.length) {
      errors.push(`Route ${route.id} contains duplicate stops.`);
    }
    for (const stopId of route.stopIds) {
      if (!stopIds.has(stopId)) {
        errors.push(`Route ${route.id} references unknown stop ${stopId}.`);
      }
    }
  }

  for (const service of network.services) {
    const route = network.routes.find((candidate) => candidate.id === service.routeId);
    if (!route) {
      errors.push(`Service ${service.id} references unknown route ${service.routeId}.`);
      continue;
    }
    if (!busIds.has(service.busId)) {
      errors.push(`Service ${service.id} references unknown bus ${service.busId}.`);
    }
    if (service.stopTimes.length !== route.stopIds.length) {
      errors.push(
        `Service ${service.id} has ${service.stopTimes.length} stop times for ${route.stopIds.length} route stops.`,
      );
    }
    let previousMinute = -1;
    service.stopTimes.forEach((stopTime, index) => {
      if (!stopIds.has(stopTime.stopId)) {
        errors.push(`Service ${service.id} references unknown stop ${stopTime.stopId}.`);
      }
      if (!isValidTime(stopTime.time)) {
        errors.push(`Service ${service.id} has invalid time "${stopTime.time}".`);
        return;
      }
      if (route.stopIds[index] !== stopTime.stopId) {
        errors.push(
          `Service ${service.id} stop order differs from route ${route.id} at index ${index}.`,
        );
      }
      const minute = timeToMinutes(stopTime.time);
      if (minute <= previousMinute) {
        errors.push(`Service ${service.id} stop times are not strictly chronological.`);
      }
      previousMinute = minute;
    });
    const bus = buses.find((candidate) => candidate.id === service.busId);
    if (bus && bus.assignedRouteId !== service.routeId) {
      warnings.push(
        `Service ${service.id} uses ${bus.registration}, whose assigned route is ${bus.assignedRouteId ?? "none"}. This is permitted for demo data but must be an explicit operational decision.`,
      );
    }
  }

  for (const bus of buses) {
    if (bus.assignedRouteId && !routeIds.has(bus.assignedRouteId)) {
      errors.push(`Bus ${bus.id} references unknown route ${bus.assignedRouteId}.`);
    }
    if (!isNonNegativeInteger(bus.capacity) || bus.capacity <= 0) {
      errors.push(`Bus ${bus.id} has an invalid capacity.`);
    }
    if (!isNonNegativeInteger(bus.occupiedSeats)) {
      errors.push(`Bus ${bus.id} has invalid occupied seats.`);
    }
    if (bus.occupiedSeats > bus.capacity) {
      errors.push(`Bus ${bus.id} has occupied seats above capacity.`);
    }
    if (!Number.isFinite(bus.estimatedResponseMinutes) || bus.estimatedResponseMinutes < 0) {
      errors.push(`Bus ${bus.id} has an invalid response time.`);
    }
  }

  for (const seedRow of demandSeed) {
    if (!routeIds.has(seedRow.routeId)) {
      errors.push(`Demand seed references unknown route ${seedRow.routeId}.`);
    }
    if (!isNonNegativeInteger(seedRow.expectedStudents)) {
      errors.push(`Demand seed for ${seedRow.routeId} has invalid expected students.`);
    }
    if (!isNonNegativeInteger(seedRow.availableSeats)) {
      errors.push(`Demand seed for ${seedRow.routeId} has invalid available seats.`);
    }
  }

  for (const event of events) {
    if (!isValidDate(event.date)) {
      errors.push(`Event ${event.id} has an invalid date.`);
    }
    if (!isValidTime(event.startTime) || !isValidTime(event.endTime)) {
      errors.push(`Event ${event.id} has invalid start/end time.`);
    } else if (timeToMinutes(event.endTime) <= timeToMinutes(event.startTime)) {
      errors.push(`Event ${event.id} ends before it starts.`);
    }
    for (const villageId of event.nearbyVillageIds) {
      if (!villageIds.has(villageId)) {
        errors.push(`Event ${event.id} references unknown nearby village ${villageId}.`);
      }
    }
    for (const routeId of event.declaredAffectedRouteIds) {
      if (!routeIds.has(routeId)) {
        errors.push(`Event ${event.id} references unknown affected route ${routeId}.`);
      }
    }
    if (event.villageId && !villageIds.has(event.villageId)) {
      errors.push(`Event ${event.id} references unknown village ${event.villageId}.`);
    }
    if (event.preparationBuffer && event.preparationBuffer.minutes < 0) {
      errors.push(`Event ${event.id} has a negative preparation buffer.`);
    }
  }

  if (seed.scenarioDate && !isValidDate(seed.scenarioDate)) {
    errors.push("Scenario date is invalid.");
  }

  for (const link of network.stopWalkLinks) {
    if (!stopIds.has(link.fromStopId) || !stopIds.has(link.toStopId)) {
      errors.push(
        `Stop walk link ${link.fromStopId}→${link.toStopId} references an unknown stop.`,
      );
    }
  }

  const requiredNames = ["R101", "R102", "R103", "R104"];
  for (const routeId of requiredNames) {
    if (!routeIds.has(routeId)) warnings.push(`Required demo route ${routeId} is missing.`);
  }
  const breakdownBus = buses.find((bus) => bus.registration === "KA-21-AB-102");
  if (!breakdownBus) {
    warnings.push("Scenario bus KA-21-AB-102 is missing.");
  } else if (breakdownBus.assignedRouteId !== "R101") {
    warnings.push("Scenario bus KA-21-AB-102 is not initially assigned to R101.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function collectStateNetwork(state: SafarState): NetworkData {
  return {
    villages: state.villages ?? [],
    destinations: state.destinations ?? [],
    stops: state.stops ?? [],
    routes: state.routes ?? [],
    services: state.services ?? [],
    stopWalkLinks: state.stopWalkLinks ?? [],
  };
}

const REPORT_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED", "DUPLICATE", "CLOSED"];
const INCIDENT_STATUSES = ["ACTIVE", "RESOLVED", "CLOSED"];
const BUS_STATUSES = ["OPERATING", "AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "REPLACEMENT_ASSIGNED"];
const RECOMMENDATION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "NO_FEASIBLE_CANDIDATE"];
const SCENARIO_MODES = ["NONE", "CENTRAL", "BREAKDOWN"];
const REPORT_TYPES = [
  "BUS_NOT_ARRIVED",
  "BUS_BREAKDOWN",
  "MECHANICAL_FAILURE",
  "DRIVER_REPORTED_ISSUE",
  "UNEXPECTED_CANCELLATION",
  "ROAD_BLOCKAGE",
  "ROUTE_DIVERSION",
  "INSUFFICIENT_CAPACITY",
  "OTHER",
];

/** Validates a full application state loaded from persistence. */
export function validateState(state: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state || typeof state !== "object") {
    return { valid: false, errors: ["State is not an object."], warnings };
  }
  const candidate = state as Partial<SafarState>;
  if (candidate.schemaVersion !== SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [
        `Schema version ${String(candidate.schemaVersion)} is not supported (expected ${SCHEMA_VERSION}).`,
      ],
      warnings,
    };
  }

  const arrayFields: Array<keyof SafarState> = [
    "villages",
    "destinations",
    "stops",
    "routes",
    "services",
    "stopWalkLinks",
    "buses",
    "demandSeed",
    "events",
    "eventImpacts",
    "travelRequests",
    "reports",
    "incidents",
    "recommendations",
    "alerts",
    "auditEvents",
  ];
  for (const field of arrayFields) {
    if (!Array.isArray(candidate[field])) {
      return { valid: false, errors: [`State field "${field}" must be an array.`], warnings };
    }
  }

  const full = candidate as SafarState;
  const seedValidation = validateSeedData({
    network: collectStateNetwork(full),
    buses: full.buses,
    demandSeed: full.demandSeed,
    events: full.events,
    scenarioDate: full.scenario?.scenarioDate,
  });
  errors.push(...seedValidation.errors);
  warnings.push(...seedValidation.warnings);

  const routeIds = new Set(full.routes.map((route) => route.id));
  const busIds = new Set(full.buses.map((bus) => bus.id));
  const stopIds = new Set(full.stops.map((stop) => stop.id));
  const eventIds = new Set(full.events.map((event) => event.id));
  const reportIds = new Set(full.reports.map((report) => report.id));
  const incidentIds = new Set(full.incidents.map((incident) => incident.id));

  for (const bus of full.buses) {
    if (!BUS_STATUSES.includes(bus.status)) {
      errors.push(`Bus ${bus.id} has unknown status "${bus.status}".`);
    }
  }

  for (const report of full.reports) {
    if (!routeIds.has(report.routeId)) errors.push(`Report ${report.id} references unknown route.`);
    if (!REPORT_STATUSES.includes(report.status)) {
      errors.push(`Report ${report.id} has unknown status "${report.status}".`);
    }
    if (!REPORT_TYPES.includes(report.reportType)) {
      errors.push(`Report ${report.id} has unknown type "${report.reportType}".`);
    }
    if (report.expectedBusId && !busIds.has(report.expectedBusId)) {
      errors.push(`Report ${report.id} references unknown bus.`);
    }
    if (report.stopId && !stopIds.has(report.stopId)) {
      errors.push(`Report ${report.id} references unknown stop.`);
    }
  }

  for (const incident of full.incidents) {
    if (!INCIDENT_STATUSES.includes(incident.status)) {
      errors.push(`Incident ${incident.id} has unknown status "${incident.status}".`);
    }
    if (incident.routeId && !routeIds.has(incident.routeId)) {
      errors.push(`Incident ${incident.id} references unknown route.`);
    }
    if (incident.busId && !busIds.has(incident.busId)) {
      errors.push(`Incident ${incident.id} references unknown bus.`);
    }
    if (incident.affectedStopId && !stopIds.has(incident.affectedStopId)) {
      errors.push(`Incident ${incident.id} references unknown stop.`);
    }
    for (const reportId of incident.relatedReportIds) {
      if (!reportIds.has(reportId)) {
        errors.push(`Incident ${incident.id} references unknown report ${reportId}.`);
      }
    }
  }

  for (const recommendation of full.recommendations) {
    if (!incidentIds.has(recommendation.incidentId)) {
      errors.push(`Recommendation ${recommendation.id} references unknown incident.`);
    }
    if (!RECOMMENDATION_STATUSES.includes(recommendation.status)) {
      errors.push(`Recommendation ${recommendation.id} has unknown status.`);
    }
    for (const candidateId of recommendation.candidateBusIds) {
      if (!busIds.has(candidateId)) {
        errors.push(`Recommendation ${recommendation.id} references unknown bus ${candidateId}.`);
      }
    }
    if (recommendation.recommendedBusId && !busIds.has(recommendation.recommendedBusId)) {
      errors.push(`Recommendation ${recommendation.id} references unknown recommended bus.`);
    }
  }

  for (const impact of full.eventImpacts) {
    if (!eventIds.has(impact.eventId)) {
      errors.push(`Event impact references unknown event ${impact.eventId}.`);
    }
    if (!routeIds.has(impact.routeId)) {
      errors.push(`Event impact references unknown route ${impact.routeId}.`);
    }
  }

  if (!full.scenario || !SCENARIO_MODES.includes(full.scenario.mode)) {
    errors.push("Scenario state is missing or invalid.");
  } else {
    if (!isValidDate(full.scenario.scenarioDate)) {
      errors.push("Scenario date is invalid.");
    }
    if (!Array.isArray(full.scenario.completedStepIds)) {
      errors.push("Scenario completed steps must be an array.");
    }
  }

  if (!full.meta || typeof full.meta !== "object") {
    errors.push("State metadata is missing.");
  } else if (!isValidDate(full.meta.createdAt.slice(0, 10))) {
    errors.push("State metadata createdAt is invalid.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
