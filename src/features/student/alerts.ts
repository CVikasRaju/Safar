import { useMemo } from "react";
import type { SafarState } from "../../domain/types";
import type { JourneyWatch } from "../../domain/types/journey";
import { generateJourneyOptions, journeySignature } from "../../domain/calculations/journeyPlanner";
import { todayIso } from "../../domain/calculations/time";
import { EVENT_CATEGORY_LABELS, INCIDENT_TYPE_LABELS } from "../../domain/constants";
import { useSafarState } from "../../state/SafarStateContext";
import { useStudentSession } from "./session";
import { useJourneyWatches } from "./useStudentHooks";

export type StudentAlertCategory =
  | "REPORT"
  | "INCIDENT"
  | "REPLACEMENT"
  | "EVENT"
  | "JOURNEY_CHANGE"
  | "SERVICE";

export interface StudentAlert {
  id: string;
  category: StudentAlertCategory;
  severity: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  title: string;
  body: string;
  createdAt: string;
  routeIds: string[];
  provenance: "DEMO" | "SIMULATED" | "USER_ENTERED" | "CALCULATED" | "AI_GENERATED" | "VERIFIED";
  actionHref?: string;
  actionLabel?: string;
}

export interface BuildStudentAlertsInput {
  state: SafarState;
  sessionId: string;
  watches?: JourneyWatch[];
  now?: Date;
}

function routeNames(routeIds: string[]): string {
  return routeIds.filter(Boolean).join(", ");
}

/**
 * Student alerts are derived from canonical shared state (docs/11, docs/03):
 * the student's own reports, confirmed incidents, approved replacements,
 * predicted event impacts and saved journey searches. No hardcoded feed.
 */
export function buildStudentAlerts({
  state,
  sessionId,
  watches = [],
  now = new Date(),
}: BuildStudentAlertsInput): StudentAlert[] {
  const alerts: StudentAlert[] = [];
  const today = todayIso(now);

  const myReports = state.disruptionReports.filter(
    (report) => report.submittedBySessionId === sessionId,
  );

  for (const report of myReports) {
    const route = state.routes.find((candidate) => candidate.id === report.routeId);
    const routeLabel = route ? `${route.id} ${route.name}` : report.routeId;
    const base = {
      id: `report-${report.id}-${report.status}`,
      category: "REPORT" as const,
      routeIds: [report.routeId],
      createdAt: report.reviewedAt ?? report.submittedAt,
      actionHref: "/student/report",
      actionLabel: "View report status",
    };

    if (report.status === "UNVERIFIED") {
      alerts.push({
        ...base,
        severity: "INFO",
        title: `Report ${report.id} submitted — UNVERIFIED STUDENT REPORT`,
        body: `Your report about ${routeLabel} is waiting for authority review. It has not confirmed an incident and has not changed any bus status.`,
        provenance: "USER_ENTERED",
      });
    } else if (report.status === "VERIFIED") {
      alerts.push({
        ...base,
        severity: "WARNING",
        title: `Report ${report.id} VERIFIED — incident not yet confirmed`,
        body: `An authority reviewed your ${routeLabel} report and found it credible. Operational disruption only starts if an authority separately confirms an incident.`,
        provenance: "VERIFIED",
      });
    } else if (report.status === "REJECTED") {
      alerts.push({
        ...base,
        severity: "INFO",
        title: `Report ${report.id} was rejected`,
        body: `${report.reviewReason ? `Reason: ${report.reviewReason}. ` : ""}No operational change was made. You can submit a new report if the situation continues.`,
        provenance: "VERIFIED",
      });
    } else if (report.status === "DUPLICATE") {
      alerts.push({
        ...base,
        severity: "INFO",
        title: `Report ${report.id} marked as duplicate`,
        body: `${report.reviewReason ? `Reason: ${report.reviewReason}. ` : ""}It has been linked to an existing report instead of being reviewed separately.`,
        provenance: "VERIFIED",
      });
    } else {
      alerts.push({
        ...base,
        severity: "SUCCESS",
        title: `Report ${report.id} closed`,
        body: `${report.reviewReason ? `Resolution: ${report.reviewReason}. ` : ""}The disruption report is no longer open.`,
        provenance: "VERIFIED",
      });
    }
  }

  for (const incident of state.incidents) {
    if (incident.status !== "ACTIVE") continue;
    const routeIds = incident.routeId ? [incident.routeId] : [];
    alerts.push({
      id: `incident-${incident.id}`,
      category: "INCIDENT",
      severity: "CRITICAL",
      title: `CONFIRMED INCIDENT on ${routeNames(routeIds) || "the network"}`,
      body: `${INCIDENT_TYPE_LABELS[incident.type] ?? incident.type} (${incident.severity}). ${
        incident.description ?? "An authority confirmed this disruption."
      } Journey estimates for affected routes have been recalculated.`,
      createdAt: incident.occurredAt,
      routeIds,
      provenance: "VERIFIED",
      actionHref: "/student/planner",
      actionLabel: "Re-plan your journey",
    });
  }

  for (const recommendation of state.replacementRecommendations) {
    const incident = state.incidents.find((entry) => entry.id === recommendation.incidentId);
    const routeIds = incident?.routeId ? [incident.routeId] : [];
    if (recommendation.status === "APPROVED") {
      const bus = state.buses.find((entry) => entry.id === recommendation.recommendedBusId);
      alerts.push({
        id: `replacement-approved-${recommendation.id}`,
        category: "REPLACEMENT",
        severity: "SUCCESS",
        title: "REPLACEMENT APPROVED",
        body: `${bus ? `${bus.registration} has` : "A replacement bus has"} been approved for ${
          routeNames(routeIds) || "the affected route"
        }. Operational allocation changed only after authority approval.`,
        createdAt: incident?.occurredAt ?? now.toISOString(),
        routeIds,
        provenance: "VERIFIED",
        actionHref: "/student/planner",
        actionLabel: "Check updated journey",
      });
    } else if (recommendation.status === "NO_FEASIBLE_CANDIDATE") {
      alerts.push({
        id: `replacement-none-${recommendation.id}`,
        category: "REPLACEMENT",
        severity: "WARNING",
        title: "NO FEASIBLE REPLACEMENT",
        body: `No eligible replacement bus was found for ${routeNames(routeIds) || "the affected route"}. Consider an alternative journey while authorities coordinate further action.`,
        createdAt: incident?.occurredAt ?? now.toISOString(),
        routeIds,
        provenance: "CALCULATED",
        actionHref: "/student/planner",
        actionLabel: "Compare alternatives",
      });
    }
  }

  for (const event of state.events) {
    if (event.date < today) continue;
    const impacts = state.eventRouteImpacts.filter((impact) => impact.eventId === event.id);
    if (impacts.length === 0 && event.affectedRouteIds.length === 0) continue;
    const affected = impacts.length > 0 ? impacts.map((impact) => impact.routeId) : event.affectedRouteIds;
    const summary = impacts
      .map((impact) => `${impact.routeId}: ${impact.riskLevel.toLowerCase()} impact (${impact.impactScore}/100)`)
      .join(" · ");
    alerts.push({
      id: `event-${event.id}`,
      category: "EVENT",
      severity: "WARNING",
      title: `PREDICTED EVENT IMPACT — ${EVENT_CATEGORY_LABELS[event.category] ?? event.category}`,
      body: `${event.name} on ${event.date}, ${event.startTime}–${event.endTime} at ${event.locationLabel}. ${summary || "Route impact is under review."} This is a prediction, not a verified road closure.`,
      createdAt: event.impactWindow.start,
      routeIds: affected,
      provenance: "DEMO",
      actionHref: "/student/planner",
      actionLabel: "Plan around it",
    });
  }

  for (const watch of watches) {
    let currentSignature = "none";
    let currentLabel = "No feasible journey";
    try {
      const plan = generateJourneyOptions(state, watch.request, now);
      const top = plan.meetingRequiredArrival[0];
      if (top) {
        currentSignature = journeySignature(top);
        currentLabel = `${top.legs.map((leg) => leg.routeId).join(" → ") || "Walk"} · depart ${
          new Date(top.departureTime).toTimeString().slice(0, 5)
        }`;
      }
    } catch {
      continue;
    }
    if (currentSignature !== watch.topJourneySignature) {
      const destination = state.destinations.find(
        (entry) => entry.id === watch.request.destinationId,
      );
      alerts.push({
        id: `watch-${watch.key}-${currentSignature}`,
        category: "JOURNEY_CHANGE",
        severity: "WARNING",
        title: "Journey recommendation changed",
        body: `Your search to ${destination?.name ?? "your destination"} on ${watch.request.travelDate} now suggests a different best option. Was: ${watch.topJourneyLabel}. Now: ${currentLabel}.`,
        createdAt: now.toISOString(),
        routeIds: [],
        provenance: "CALCULATED",
        actionHref: "/student/planner",
        actionLabel: "Review the new plan",
      });
    }
  }

  for (const alert of state.alerts) {
    if (alert.audience !== "STUDENT" && alert.audience !== "ALL") continue;
    alerts.push({
      id: `shared-${alert.id}`,
      category: "SERVICE",
      severity: alert.severity,
      title: alert.title,
      body: alert.body,
      createdAt: alert.createdAt,
      routeIds: alert.relatedRouteIds,
      provenance: alert.provenance,
    });
  }

  const seen = new Set<string>();
  return alerts
    .filter((alert) => {
      if (seen.has(alert.id)) return false;
      seen.add(alert.id);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function useStudentAlerts(): StudentAlert[] {
  const { state } = useSafarState();
  const session = useStudentSession();
  const watches = useJourneyWatches();

  return useMemo(
    () => buildStudentAlerts({ state, sessionId: session.id, watches }),
    [state, session.id, watches],
  );
}
