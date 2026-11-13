import type { SafarState } from "../types";
import {
  CROWD_LEVEL_LABELS,
  EVENT_CATEGORY_LABELS,
} from "../constants";
import { minutesToIso } from "../calculations/time";

/**
 * Advance event prediction.
 *
 * Predictions are built from the shared demo event records, the scenario's own
 * examination schedule, a documented seasonal-flood pattern and any unreviewed
 * student reports. Each item carries its provenance and lead time, and none of
 * them is presented as confirmed unless the underlying record is confirmed.
 */

export type PredictionStatus =
  | "VERIFIED"
  | "USER_REPORTED"
  | "HISTORICAL"
  | "AI_GENERATED"
  | "SIMULATED";

export const PREDICTION_STATUS_LABELS: Record<PredictionStatus, string> = {
  VERIFIED: "Verified",
  USER_REPORTED: "Student reported (unverified)",
  HISTORICAL: "Historical pattern",
  AI_GENERATED: "AI-generated prediction",
  SIMULATED: "Simulated scenario",
};

export interface EventPrediction {
  id: string;
  title: string;
  categoryLabel: string;
  status: PredictionStatus;
  statusLabel: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** Hours between "now" and the predicted start. */
  leadTimeHours: number;
  startsAt: string;
  endsAt?: string;
  locationLabel: string;
  affectedVillageIds: string[];
  affectedRouteIds: string[];
  expectedTrafficIncreasePct: number;
  estimatedExtraMinutes: number;
  studentsAffected: number;
  recommendedAlternative: string;
  warning: string;
  disclaimer: string;
}

const CROWD_TRAFFIC_INCREASE: Record<string, number> = {
  LOW: 15,
  MODERATE: 30,
  HIGH: 50,
  VERY_HIGH: 65,
};

const PREDICTION_DISCLAIMER =
  "This is an advance prediction from demo data. It is not a confirmed road closure or official advisory.";

function studentsOnRoutes(state: SafarState, routeIds: string[]): number {
  const documented = state.demandSeed
    .filter((record) => routeIds.includes(record.routeId))
    .reduce((sum, record) => sum + record.expectedStudents, 0);
  if (documented > 0) return documented;
  return state.buses
    .filter((bus) => bus.assignedRouteId && routeIds.includes(bus.assignedRouteId))
    .reduce((sum, bus) => sum + bus.occupiedSeats, 0);
}

function alternativeFor(state: SafarState, affectedRouteIds: string[], eventRouteIds: string[]): string {
  const affected = new Set([...affectedRouteIds, ...eventRouteIds]);
  const affectedStops = new Set(
    state.routes
      .filter((route) => affected.has(route.id))
      .flatMap((route) => route.stops),
  );

  const candidates = state.routes.filter(
    (route) => !affected.has(route.id) && route.stops.some((stopId) => affectedStops.has(stopId)),
  );
  if (candidates.length > 0) {
    return `Use ${candidates
      .map((route) => route.id)
      .join(" or ")}: they share a stop with the affected routes but avoid the event area.`;
  }
  const operational = state.routes.filter((route) => !affected.has(route.id));
  if (operational.length > 0) {
    return `No unaffected route shares a stop with the affected corridor; shift departures outside the event window, or use ${operational
      .map((route) => route.id)
      .join(" / ")} where the corridor allows.`;
  }
  return "Every demo route is affected; stagger departures outside the event window.";
}

function leadTimeHours(now: Date, startIso: string): number {
  const difference = new Date(startIso).getTime() - now.getTime();
  return Math.max(0, Math.round((difference / 3_600_000) * 10) / 10);
}

export function predictUpcomingEvents(state: SafarState, now: Date = new Date()): EventPrediction[] {
  const predictions: EventPrediction[] = [];

  // 1. Shared event records (AI-generated prediction or verified event).
  for (const event of state.events) {
    const impacts = state.eventRouteImpacts.filter((impact) => impact.eventId === event.id);
    const affectedRouteIds = [
      ...new Set([
        ...event.affectedRouteIds,
        ...impacts.map((impact) => impact.routeId),
      ]),
    ];
    const extraMinutes =
      impacts.reduce((max, impact) => Math.max(max, impact.estimatedDelayMinutes ?? 0), 0) || 10;
    const status: PredictionStatus =
      event.verificationStatus === "CONFIRMED"
        ? "VERIFIED"
        : event.verificationStatus === "UNVERIFIED"
          ? "USER_REPORTED"
          : "AI_GENERATED";
    const windowStart = event.impactWindow?.start ?? `${event.date}T${event.startTime}:00`;
    const windowEnd = event.impactWindow?.end ?? `${event.date}T${event.endTime}:00`;
    const crowd = event.expectedCrowdLevel ?? "MODERATE";
    const loc = event.locationLabel ?? event.location ?? "Puttur region";
    predictions.push({
      id: `prediction-${event.id}`,
      title: event.name,
      categoryLabel: EVENT_CATEGORY_LABELS[event.category] ?? event.category,
      status,
      statusLabel: PREDICTION_STATUS_LABELS[status],
      confidence: status === "VERIFIED" ? "HIGH" : "MEDIUM",
      leadTimeHours: leadTimeHours(now, windowStart),
      startsAt: windowStart,
      endsAt: windowEnd,
      locationLabel: loc,
      affectedVillageIds: event.nearbyVillageIds,
      affectedRouteIds,
      expectedTrafficIncreasePct: CROWD_TRAFFIC_INCREASE[crowd] ?? 25,
      estimatedExtraMinutes: extraMinutes,
      studentsAffected: studentsOnRoutes(state, affectedRouteIds),
      recommendedAlternative: alternativeFor(state, affectedRouteIds, event.affectedRouteIds),
      warning: `${EVENT_CATEGORY_LABELS[event.category] ?? event.category} with ${
        CROWD_LEVEL_LABELS[crowd] ?? crowd
      } crowd intensity: expect roughly ${CROWD_TRAFFIC_INCREASE[crowd] ?? 25}% more traffic and about ${extraMinutes} min extra journey time on ${affectedRouteIds.join(", ") || "nearby routes"}.`,
      disclaimer: `${PREDICTION_DISCLAIMER} Source: ${event.source}.`,
    });
  }

  // 2. Confirmed road closure from the active scenario (verified for this run).
  const emergency = state.emergency;
  if (emergency) {
    const floodStartedAt = emergency.startedAt;
    predictions.push({
      id: "prediction-flood-closure",
      title: `${emergency.blockedRoadName} closed by flooding`,
      categoryLabel: "Road closure",
      status: "VERIFIED",
      statusLabel: PREDICTION_STATUS_LABELS.VERIFIED,
      confidence: "HIGH",
      leadTimeHours: 0,
      startsAt: floodStartedAt,
      locationLabel: emergency.blockedRoadName,
      affectedVillageIds: ["v-puttur"],
      affectedRouteIds: ["R102", "R103", "R104"],
      expectedTrafficIncreasePct: 0,
      estimatedExtraMinutes: 7,
      studentsAffected: studentsOnRoutes(state, ["R102", "R103", "R104"]),
      recommendedAlternative:
        "Puttur ring-road detour: it adds about 3.2 km and 7 minutes and never uses the flooded road.",
      warning:
        "The road is closed and the adjacent pickup stop is submerged. Students at that stop must use the replacement pickup at Puttur Bus Stand.",
      disclaimer:
        "Confirmed within this simulated scenario only. It is not a real road-closure notice.",
    });

    // 3. Examination pressure, predicted ahead of the exam window.
    const examStudents = emergency.studentRecords.filter(
      (student) => student.examStartMinutes !== undefined,
    );
    if (examStudents.length > 0) {
      const earliest = Math.min(...examStudents.map((student) => student.examStartMinutes ?? Infinity));
      const total = examStudents.reduce((sum, student) => sum + student.groupSize, 0);
      const routes = [...new Set(examStudents.map((student) => student.originalRouteId))];
      predictions.push({
        id: "prediction-exam-pressure",
        title: `Examination peak on ${routes.join(", ")}`,
        categoryLabel: "Examination",
        status: "SIMULATED",
        statusLabel: PREDICTION_STATUS_LABELS.SIMULATED,
        confidence: "HIGH",
        leadTimeHours: Math.max(0, Math.round(((earliest - emergency.clockMinutes) / 60) * 10) / 10),
        startsAt: minutesToIso(emergency.scenarioDate, earliest),
        locationLabel: "Puttur Government College examination centre",
        affectedVillageIds: [...new Set(examStudents.map((student) => student.villageId))],
        affectedRouteIds: routes,
        expectedTrafficIncreasePct: 20,
        estimatedExtraMinutes: 10,
        studentsAffected: total,
        recommendedAlternative:
          "Keep exam groups on the earliest relief departures and hold seats for them; do not move them to later services.",
        warning: `${total} students have examinations from ${minutesToIso(
          emergency.scenarioDate,
          earliest,
        ).slice(11, 16)}. Late arrival would mean a missed examination, so these groups are prioritised first in the allocation engine.`,
        disclaimer:
          "Examination times are simulated scenario inputs, not an official examination timetable.",
      });
    }
  }

  // 4. Documented seasonal pattern (historical, clearly not a forecast).
  const monsoonWindowStart = minutesToIso(state.scenario.scenarioDate, 6 * 60);
  predictions.push({
    id: "prediction-seasonal-flooding",
    title: "Seasonal flooding risk on the low-lying bridge approach",
    categoryLabel: "Seasonal flooding",
    status: "HISTORICAL",
    statusLabel: PREDICTION_STATUS_LABELS.HISTORICAL,
    confidence: "MEDIUM",
    leadTimeHours: leadTimeHours(now, monsoonWindowStart),
    startsAt: monsoonWindowStart,
    locationLabel: "Nettaravathi bridge approach, Puttur – Mangalore Road",
    affectedVillageIds: ["v-puttur", "v-vittal"],
    affectedRouteIds: ["R102", "R103", "R104"],
    expectedTrafficIncreasePct: 10,
    estimatedExtraMinutes: 20,
    studentsAffected: studentsOnRoutes(state, ["R102", "R103", "R104"]),
    recommendedAlternative:
      "Pre-plan the ring-road detour and confirm replacement pickup capacity at Puttur Bus Stand before the morning peak.",
    warning:
      "Low-lying bridge approaches in this corridor have historically flooded during heavy monsoon rain. This is a historical pattern, not a forecast for a specific day.",
    disclaimer:
      "Historical pattern over demo data. It is not a weather forecast and not a confirmed closure.",
  });

  // 5. Unreviewed student reports: genuine user-reported signals.
  for (const report of state.disruptionReports) {
    if (report.status !== "UNVERIFIED") continue;
    predictions.push({
      id: `prediction-report-${report.id}`,
      title: `Student report about ${report.routeId}: ${report.reportType.replace(/_/g, " ").toLowerCase()}`,
      categoryLabel: "User-reported disruption",
      status: "USER_REPORTED",
      statusLabel: PREDICTION_STATUS_LABELS.USER_REPORTED,
      confidence: "LOW",
      leadTimeHours: 0,
      startsAt: report.submittedAt,
      locationLabel: report.stopId ?? `${report.routeId} corridor`,
      affectedVillageIds: [],
      affectedRouteIds: [report.routeId],
      expectedTrafficIncreasePct: 0,
      estimatedExtraMinutes: 10,
      studentsAffected: studentsOnRoutes(state, [report.routeId]),
      recommendedAlternative:
        "Await authority verification; a replacement bus can only be approved after an incident is confirmed.",
      warning:
        "Reported by a student and still unverified. It has not changed any bus status or route.",
      disclaimer:
        "User-reported information. Never treat it as confirmed until an authority verifies it.",
    });
  }

  return predictions.sort((a, b) => {
    const weight: Record<PredictionStatus, number> = {
      VERIFIED: 0,
      USER_REPORTED: 1,
      AI_GENERATED: 2,
      SIMULATED: 3,
      HISTORICAL: 4,
    };
    return weight[a.status] - weight[b.status] || b.leadTimeHours - a.leadTimeHours;
  });
}
