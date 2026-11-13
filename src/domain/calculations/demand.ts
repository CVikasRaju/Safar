import type {
  Incident,
  NetworkData,
  RouteDemandSeed,
  SafarState,
  StudentTravelRequest,
} from "../types";
import { DEMAND_REQUIRED_TOTALS, OVERCROWDING_THRESHOLDS } from "../constants";
import { clamp } from "../time";
import { findBus, findRoute, findVillage, findDestination } from "../network";
import { generateJourneyOptions } from "./journey";

export type OvercrowdingRisk = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface DemandAdjustment {
  routeId: string;
  students: number;
  reason: string;
}

export interface DemandRouteSummary {
  routeId: string;
  routeName: string;
  expectedStudents: number;
  baselineStudents: number;
  submittedStudents: number;
  adjustmentStudents: number;
  availableSeats: number;
  baselineAvailableSeats: number;
  operationalSeatAdjustment: number;
  occupiedSeats: number;
  remainingCapacity: number;
  shortage: number;
  surplus: number;
  loadFactor: number;
  overcrowdingRisk: OvercrowdingRisk;
  provenance: "CALCULATED" | "DEMO";
  note?: string;
}

export interface DemandBreakdown {
  id: string;
  name: string;
  submittedStudents: number;
}

export interface DemandSummary {
  routes: DemandRouteSummary[];
  totals: {
    expectedStudents: number;
    availableSeats: number;
    occupiedSeats: number;
    remainingCapacity: number;
    shortage: number;
    surplus: number;
    loadFactor: number;
    overcrowdingRisk: OvercrowdingRisk;
    /** Sum of individual route shortages; surplus elsewhere is not auto-reallocated. */
    routeLevelShortage: number;
  };
  villageDemand: DemandBreakdown[];
  destinationDemand: DemandBreakdown[];
  submittedGroups: number;
  unallocatedSubmissions: number;
  adjustments: DemandAdjustment[];
  notes: string[];
  provenance: "CALCULATED";
  reliabilityDisclaimer: string;
}

export interface DemandContext {
  network: NetworkData;
  state?: SafarState;
  adjustments?: DemandAdjustment[];
}

export function overcrowdingRiskFor(loadFactor: number): OvercrowdingRisk {
  if (loadFactor >= OVERCROWDING_THRESHOLDS.CRITICAL) return "CRITICAL";
  if (loadFactor >= OVERCROWDING_THRESHOLDS.HIGH) return "HIGH";
  if (loadFactor >= OVERCROWDING_THRESHOLDS.MODERATE) return "MODERATE";
  return "LOW";
}

/**
 * Illustrative route importance (0–100) derived from baseline demand.
 * Used only by the event-impact model; no invented traffic data is used.
 */
export function routeImportanceScore(
  routeId: string,
  demandSeed: RouteDemandSeed[],
): number {
  const maximum = demandSeed.reduce(
    (max, seed) => Math.max(max, seed.expectedStudents),
    0,
  );
  if (maximum <= 0) return 0;
  const route = demandSeed.find((seed) => seed.routeId === routeId);
  return clamp(Math.round(((route?.expectedStudents ?? 0) / maximum) * 100), 0, 100);
}

/**
 * Allocates a travel submission to exactly one route so the same student is
 * never counted on multiple candidate routes. The allocation uses the
 * timetable-feasible journey that meets the required arrival with the shortest
 * duration; if no journey exists, it falls back to a route serving an origin
 * access stop. Otherwise the submission is reported as unallocated.
 */
export function allocateTravelRequestToRoute(
  request: StudentTravelRequest,
  context: DemandContext,
): string | null {
  const { network, state } = context;
  const origin = findVillage(network, request.originVillageId);
  const destination = findDestination(network, request.destinationId);

  if (state && origin && destination) {
    try {
      const options = generateJourneyOptions(
        {
          originVillageId: request.originVillageId,
          destinationId: request.destinationId,
          travelDate: request.travelDate,
          requiredArrivalTime: request.requiredArrivalTime,
          passengers: request.groupSize,
        },
        network,
        state,
      );
      if (options.length > 0) {
        const ranked = [...options].sort((a, b) => {
          if (a.meetsRequiredArrival !== b.meetsRequiredArrival) {
            return a.meetsRequiredArrival ? -1 : 1;
          }
          if (a.totalDurationMinutes !== b.totalDurationMinutes) {
            return a.totalDurationMinutes - b.totalDurationMinutes;
          }
          return b.reliabilityScore - a.reliabilityScore;
        });
        const boardingRoute = ranked[0].legs[0]?.routeId;
        if (boardingRoute) return boardingRoute;
      }
    } catch {
      // Fall through to the static origin-stop fallback below.
    }
  }

  if (!origin) return null;
  const accessStopIds = origin.accessStops.map((access) => access.stopId);
  const candidates = network.routes
    .filter((route) => route.stopIds.some((stopId) => accessStopIds.includes(stopId)))
    .map((route) => route.id)
    .sort();
  return candidates[0] ?? null;
}

interface OperationalCapacity {
  seats: number;
  notes: string[];
}

function operationalSeatAdjustment(
  routeId: string,
  incidents: Incident[],
  state: SafarState | undefined,
): OperationalCapacity {
  if (!state) return { seats: 0, notes: [] };
  let seats = 0;
  const notes: string[] = [];
  for (const incident of incidents) {
    if (
      incident.status !== "ACTIVE" ||
      incident.routeId !== routeId ||
      !incident.replacementBusId
    ) {
      continue;
    }
    const bus = findBus(state.buses, incident.replacementBusId);
    if (!bus) continue;
    const remaining = Math.max(0, bus.capacity - bus.occupiedSeats);
    seats += remaining;
    notes.push(
      `Approved replacement ${bus.registration} adds ${remaining} illustrative seat(s) of operational capacity on ${routeId}.`,
    );
  }
  return { seats, notes };
}

/**
 * Demand and capacity calculation.
 *
 * `availableSeats` comes from the canonical demand seed (required illustrative
 * values), optionally increased by an approved replacement bus. It is not a
 * second copy of fleet capacity, so bus capacity is never double counted.
 */
export function calculateStudentDemand(
  submissions: StudentTravelRequest[],
  demandSeed: RouteDemandSeed[],
  context: DemandContext,
): DemandSummary {
  const { network, state } = context;
  const adjustments = context.adjustments ?? [];
  const notes: string[] = [
    "Illustrative demand values from the demo seed. Not measured passenger counts.",
  ];

  const submittedByRoute = new Map<string, number>();
  const villageDemand = new Map<string, number>();
  const destinationDemand = new Map<string, number>();
  let unallocatedSubmissions = 0;

  for (const submission of submissions) {
    const routeId = allocateTravelRequestToRoute(submission, context);
    if (routeId) {
      submittedByRoute.set(routeId, (submittedByRoute.get(routeId) ?? 0) + submission.groupSize);
    } else {
      unallocatedSubmissions += 1;
    }
    villageDemand.set(
      submission.originVillageId,
      (villageDemand.get(submission.originVillageId) ?? 0) + submission.groupSize,
    );
    destinationDemand.set(
      submission.destinationId,
      (destinationDemand.get(submission.destinationId) ?? 0) + submission.groupSize,
    );
  }

  if (unallocatedSubmissions > 0) {
    notes.push(
      `${unallocatedSubmissions} submitted group(s) could not be allocated to a route and are excluded from route demand (but included in overall submitted totals).`,
    );
  }

  const incidents = state?.incidents ?? [];
  const operationalNotes = new Set<string>();
  const routes: DemandRouteSummary[] = demandSeed.map((seed) => {
    const route = findRoute(network, seed.routeId);
    const submittedStudents = submittedByRoute.get(seed.routeId) ?? 0;
    const routeAdjustments = adjustments.filter(
      (adjustment) => adjustment.routeId === seed.routeId,
    );
    const adjustmentStudents = routeAdjustments.reduce(
      (sum, adjustment) => sum + Math.max(0, adjustment.students),
      0,
    );
    const expectedStudents = seed.expectedStudents + submittedStudents + adjustmentStudents;
    const operational = operationalSeatAdjustment(seed.routeId, incidents, state);
    const availableSeats = Math.max(0, seed.availableSeats + operational.seats);
    const shortage = Math.max(0, expectedStudents - availableSeats);
    const surplus = Math.max(0, availableSeats - expectedStudents);
    const occupiedSeats = Math.min(expectedStudents, availableSeats);
    const remainingCapacity = Math.max(0, availableSeats - expectedStudents);
    const loadFactor = availableSeats > 0 ? expectedStudents / availableSeats : expectedStudents > 0 ? 2 : 0;
    for (const note of operational.notes) operationalNotes.add(note);

    return {
      routeId: seed.routeId,
      routeName: route?.name ?? seed.routeId,
      expectedStudents,
      baselineStudents: seed.expectedStudents,
      submittedStudents,
      adjustmentStudents,
      availableSeats,
      baselineAvailableSeats: seed.availableSeats,
      operationalSeatAdjustment: operational.seats,
      occupiedSeats,
      remainingCapacity,
      shortage,
      surplus,
      loadFactor: Math.round(loadFactor * 100) / 100,
      overcrowdingRisk: overcrowdingRiskFor(loadFactor),
      provenance: "CALCULATED",
      note: seed.note,
    };
  });

  const totals = routes.reduce(
    (accumulator, route) => {
      accumulator.expectedStudents += route.expectedStudents;
      accumulator.availableSeats += route.availableSeats;
      accumulator.occupiedSeats += route.occupiedSeats;
      accumulator.remainingCapacity += route.remainingCapacity;
      accumulator.routeLevelShortage += route.shortage;
      return accumulator;
    },
    {
      expectedStudents: 0,
      availableSeats: 0,
      occupiedSeats: 0,
      remainingCapacity: 0,
      shortage: 0,
      surplus: 0,
      loadFactor: 0,
      overcrowdingRisk: "LOW" as OvercrowdingRisk,
      routeLevelShortage: 0,
    },
  );

  notes.push(...operationalNotes);

  // Aggregate shortage is defined on the totals, not by summing route shortages.
  totals.shortage = Math.max(0, totals.expectedStudents - totals.availableSeats);
  totals.surplus = Math.max(0, totals.availableSeats - totals.expectedStudents);
  totals.loadFactor =
    totals.availableSeats > 0
      ? Math.round((totals.expectedStudents / totals.availableSeats) * 100) / 100
      : totals.expectedStudents > 0
        ? 2
        : 0;
  totals.overcrowdingRisk = overcrowdingRiskFor(totals.loadFactor);

  if (
    totals.expectedStudents === DEMAND_REQUIRED_TOTALS.expectedStudents &&
    totals.availableSeats === DEMAND_REQUIRED_TOTALS.availableSeats
  ) {
    notes.push(
      `Baseline seed totals match the required illustrative values: ${DEMAND_REQUIRED_TOTALS.expectedStudents} students, ${DEMAND_REQUIRED_TOTALS.availableSeats} seats, ${DEMAND_REQUIRED_TOTALS.shortage}-seat potential shortage before submissions and replacements.`,
    );
  }

  return {
    routes,
    totals,
    villageDemand: [...villageDemand.entries()]
      .map(([villageId, submittedStudents]) => ({
        id: villageId,
        name: findVillage(network, villageId)?.name ?? villageId,
        submittedStudents,
      }))
      .sort((a, b) => b.submittedStudents - a.submittedStudents),
    destinationDemand: [...destinationDemand.entries()]
      .map(([destinationId, submittedStudents]) => ({
        id: destinationId,
        name: findDestination(network, destinationId)?.name ?? destinationId,
        submittedStudents,
      }))
      .sort((a, b) => b.submittedStudents - a.submittedStudents),
    submittedGroups: submissions.length,
    unallocatedSubmissions,
    adjustments,
    notes,
    provenance: "CALCULATED",
    reliabilityDisclaimer:
      "Illustrative prototype demand estimates. Not a statistically validated forecast.",
  };
}
