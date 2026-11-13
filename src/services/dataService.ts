import type {
  Alert,
  AlertAudience,
  Bus,
  BusStatus,
  Destination,
  EventRouteImpact,
  NetworkData,
  Route,
  SafarState,
  Stop,
  TimetableService,
  ValidationResult,
  Village,
} from "../domain/types";
import {
  DEMAND_REQUIRED_TOTALS,
  DEMO_DATA_LABEL,
  EVENT_AFFECTED_ROUTE_THRESHOLD,
  SIMULATED_DATA_LABEL,
} from "../domain/constants";
import {
  findBus,
  findDestination,
  findRoute,
  findService,
  findStop,
  findVillage,
  getNetworkFromState,
  getRouteStops,
  getServicesForRoute,
} from "../domain/network";
import { calculateStudentDemand, type DemandSummary } from "../domain/calculations/demand";
import { validateSeedData, validateState } from "../domain/validation";

export interface RouteStatusSummary {
  routeId: string;
  routeName: string;
  operatingBuses: number;
  activeIncidents: number;
  eventImpactScore: number;
  eventRisk: string | null;
  expectedStudents: number;
  availableSeats: number;
  shortage: number;
  overcrowdingRisk: string;
  attentionReasons: string[];
  statusLabel: string;
}

export interface DashboardMetrics {
  totalBuses: number;
  operatingBuses: number;
  availableBuses: number;
  unavailableBuses: number;
  maintenanceBuses: number;
  replacementAssignedBuses: number;
  expectedStudents: number;
  availableSeats: number;
  occupiedSeats: number;
  potentialShortage: number;
  overcrowdingRisk: string;
  activeIncidents: number;
  unverifiedReports: number;
  verifiedReportsAwaitingConfirmation: number;
  pendingRecommendations: number;
  approvedReplacements: number;
  routesRequiringAttention: number;
  highRiskEventRoutes: number;
  labels: {
    data: string;
    simulated: string;
  };
  demand: DemandSummary;
  routes: RouteStatusSummary[];
  provenance: "CALCULATED";
}

function countBuses(buses: Bus[], status: BusStatus): number {
  return buses.filter((bus) => bus.status === status).length;
}

export function getNetwork(state: SafarState): NetworkData {
  return getNetworkFromState(state);
}

export function getVillages(state: SafarState): Village[] {
  return state.villages;
}

export function getDestinations(state: SafarState): Destination[] {
  return state.destinations;
}

export function getStops(state: SafarState): Stop[] {
  return state.stops;
}

export function getRoutes(state: SafarState): Route[] {
  return state.routes;
}

export function getServices(state: SafarState): TimetableService[] {
  return state.services;
}

export function getBuses(state: SafarState): Bus[] {
  return state.buses;
}

export function getBusByRegistration(state: SafarState, registration: string): Bus | undefined {
  return state.buses.find(
    (bus) => bus.registration.toLowerCase() === registration.trim().toLowerCase(),
  );
}

export function getRouteById(state: SafarState, routeId: string): Route | undefined {
  return findRoute(getNetworkFromState(state), routeId);
}

export function getStopById(state: SafarState, stopId: string): Stop | undefined {
  return findStop(getNetworkFromState(state), stopId);
}

export function getVillageById(state: SafarState, villageId: string): Village | undefined {
  return findVillage(getNetworkFromState(state), villageId);
}

export function getDestinationById(
  state: SafarState,
  destinationId: string,
): Destination | undefined {
  return findDestination(getNetworkFromState(state), destinationId);
}

export function getServiceById(
  state: SafarState,
  serviceId: string,
): TimetableService | undefined {
  return findService(getNetworkFromState(state), serviceId);
}

export function getBusById(state: SafarState, busId: string): Bus | undefined {
  return findBus(state.buses, busId);
}

export function getRouteStopsFor(state: SafarState, routeId: string): Stop[] {
  return getRouteStops(getNetworkFromState(state), routeId);
}

export function getRouteServices(state: SafarState, routeId: string): TimetableService[] {
  return getServicesForRoute(getNetworkFromState(state), routeId);
}

export function getEventImpacts(state: SafarState): EventRouteImpact[] {
  return state.eventImpacts;
}

export function getAlerts(
  state: SafarState,
  audience?: AlertAudience,
): Alert[] {
  if (!audience) return [...state.alerts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return state.alerts
    .filter((alert) => alert.audience === audience || alert.audience === "BOTH")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getDemandSummary(state: SafarState): DemandSummary {
  return calculateStudentDemand(state.travelRequests, state.demandSeed, {
    network: getNetworkFromState(state),
    state,
  });
}

/** Route monitoring view derived entirely from canonical state. */
export function getRouteStatuses(state: SafarState): RouteStatusSummary[] {
  const demand = getDemandSummary(state);
  return state.routes.map((route) => {
    const busCount = state.buses.filter(
      (bus) => bus.status === "OPERATING" && bus.assignedRouteId === route.id,
    ).length;
    const incidents = state.incidents.filter(
      (incident) => incident.status === "ACTIVE" && incident.routeId === route.id,
    );
    const impact = state.eventImpacts
      .filter((candidate) => candidate.routeId === route.id)
      .sort((a, b) => b.score - a.score)[0];
    const routeDemand = demand.routes.find((candidate) => candidate.routeId === route.id);
    const attentionReasons: string[] = [];

    if (incidents.length > 0) attentionReasons.push(`${incidents.length} active confirmed incident(s)`);
    if (impact && impact.score >= EVENT_AFFECTED_ROUTE_THRESHOLD) {
      attentionReasons.push(`Predicted event impact ${impact.score}/100 (${impact.risk})`);
    }
    if ((routeDemand?.shortage ?? 0) > 0) {
      attentionReasons.push(`${routeDemand?.shortage} expected seat shortage`);
    }
    if (busCount === 0) attentionReasons.push("No operating bus assigned");

    const statusLabel =
      incidents.length > 0
        ? "DISRUPTED"
        : impact && impact.risk === "CRITICAL"
          ? "EVENT RISK — CRITICAL"
          : impact && impact.risk === "HIGH"
            ? "EVENT RISK — HIGH"
            : "MONITORED";

    return {
      routeId: route.id,
      routeName: route.name,
      operatingBuses: busCount,
      activeIncidents: incidents.length,
      eventImpactScore: impact?.score ?? 0,
      eventRisk: impact?.risk ?? null,
      expectedStudents: routeDemand?.expectedStudents ?? 0,
      availableSeats: routeDemand?.availableSeats ?? 0,
      shortage: routeDemand?.shortage ?? 0,
      overcrowdingRisk: routeDemand?.overcrowdingRisk ?? "LOW",
      attentionReasons,
      statusLabel,
    };
  });
}

export function getDashboardMetrics(state: SafarState): DashboardMetrics {
  const demand = getDemandSummary(state);
  const routes = getRouteStatuses(state);
  return {
    totalBuses: state.buses.length,
    operatingBuses: countBuses(state.buses, "OPERATING"),
    availableBuses: countBuses(state.buses, "AVAILABLE"),
    unavailableBuses: countBuses(state.buses, "UNAVAILABLE"),
    maintenanceBuses: countBuses(state.buses, "MAINTENANCE"),
    replacementAssignedBuses: countBuses(state.buses, "REPLACEMENT_ASSIGNED"),
    expectedStudents: demand.totals.expectedStudents,
    availableSeats: demand.totals.availableSeats,
    occupiedSeats: demand.totals.occupiedSeats,
    potentialShortage: demand.totals.shortage,
    overcrowdingRisk: demand.totals.overcrowdingRisk,
    activeIncidents: state.incidents.filter((incident) => incident.status === "ACTIVE").length,
    unverifiedReports: state.reports.filter((report) => report.status === "UNVERIFIED").length,
    verifiedReportsAwaitingConfirmation: state.reports.filter(
      (report) => report.status === "VERIFIED",
    ).length,
    pendingRecommendations: state.recommendations.filter(
      (recommendation) => recommendation.status === "PENDING",
    ).length,
    approvedReplacements: state.recommendations.filter(
      (recommendation) => recommendation.status === "APPROVED",
    ).length,
    routesRequiringAttention: routes.filter((route) => route.attentionReasons.length > 0).length,
    highRiskEventRoutes: state.eventImpacts.filter(
      (impact) => impact.risk === "HIGH" || impact.risk === "CRITICAL",
    ).length,
    labels: {
      data: DEMO_DATA_LABEL,
      simulated: SIMULATED_DATA_LABEL,
    },
    demand,
    routes,
    provenance: "CALCULATED",
  };
}

export function validateSeed(state: SafarState): ValidationResult {
  return validateSeedData({
    network: getNetworkFromState(state),
    buses: state.buses,
    demandSeed: state.demandSeed,
    events: state.events,
    scenarioDate: state.scenario.scenarioDate,
  });
}

export { validateState };

export const BASELINE_DEMAND_TOTALS = DEMAND_REQUIRED_TOTALS;

export const dataService = {
  getNetwork,
  getVillages,
  getDestinations,
  getStops,
  getRoutes,
  getServices,
  getBuses,
  getBusByRegistration,
  getRouteById,
  getStopById,
  getVillageById,
  getDestinationById,
  getServiceById,
  getBusById,
  getRouteStopsFor,
  getRouteServices,
  getEventImpacts,
  getAlerts,
  getDemandSummary,
  getRouteStatuses,
  getDashboardMetrics,
  validateSeed,
  validateState,
};
