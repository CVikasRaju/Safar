import { describe, expect, it } from "vitest";
import { createSeedState } from "../src/data/seed";
import { buildStudentAlerts } from "../src/features/student/alerts";
import type { DisruptionReport, SafarState } from "../src/domain/types";
import type { JourneyWatch } from "../src/domain/types/journey";

const NOW = new Date("2026-11-13T06:00:00.000Z");
const sessionId = "student-demo-01";
const baseState = createSeedState({ scenarioDate: "2026-11-14", now: NOW });

function withReport(state: SafarState, overrides: Partial<DisruptionReport>): SafarState {
  const report: DisruptionReport = {
    id: "RPT-20261113-001",
    routeId: "R101",
    stopId: "st-puttur-busstand",
    reportType: "BUS_NOT_ARRIVED",
    submittedAt: "2026-11-13T07:00:00.000Z",
    status: "UNVERIFIED",
    provenance: "USER_ENTERED",
    submittedBySessionId: sessionId,
    ...overrides,
  };
  return { ...state, disruptionReports: [report] };
}

describe("student alerts derived from shared state (docs/03, docs/11)", () => {
  it("announces an unverified report without claiming confirmation", () => {
    const alerts = buildStudentAlerts({
      state: withReport(baseState, {}),
      sessionId,
      now: NOW,
    });
    const reportAlert = alerts.find((alert) => alert.category === "REPORT");
    expect(reportAlert?.title).toContain("UNVERIFIED STUDENT REPORT");
    expect(reportAlert?.body).toContain("has not confirmed an incident");
  });

  it("does not leak another demo session's report details", () => {
    const alerts = buildStudentAlerts({
      state: withReport(baseState, { submittedBySessionId: "student-demo-02" }),
      sessionId,
      now: NOW,
    });
    expect(alerts.find((alert) => alert.category === "REPORT")).toBeUndefined();
  });

  it("marks a verified report as still not a confirmed incident", () => {
    const alerts = buildStudentAlerts({
      state: withReport(baseState, {
        status: "VERIFIED",
        reviewedAt: "2026-11-13T07:20:00.000Z",
      }),
      sessionId,
      now: NOW,
    });
    const reportAlert = alerts.find((alert) => alert.category === "REPORT");
    expect(reportAlert?.title).toContain("incident not yet confirmed");
    expect(reportAlert?.provenance).toBe("VERIFIED");
  });

  it("reports rejection reasons and closure", () => {
    const rejected = buildStudentAlerts({
      state: withReport(baseState, { status: "REJECTED", reviewReason: "No service scheduled" }),
      sessionId,
      now: NOW,
    });
    expect(rejected.find((alert) => alert.category === "REPORT")?.body).toContain(
      "No service scheduled",
    );

    const closed = buildStudentAlerts({
      state: withReport(baseState, { status: "CLOSED", reviewReason: "Bus arrived late" }),
      sessionId,
      now: NOW,
    });
    expect(closed.find((alert) => alert.category === "REPORT")?.severity).toBe("SUCCESS");
  });

  it("raises a critical alert only for confirmed active incidents", () => {
    const state: SafarState = {
      ...baseState,
      incidents: [
        {
          id: "inc-1",
          type: "BUS_BREAKDOWN",
          status: "ACTIVE",
          routeId: "R101",
          busId: "bus-ka21ab102",
          occurredAt: "2026-11-14T01:30:00.000Z",
          severity: "HIGH",
          description: "Confirmed mechanical failure.",
          relatedReportIds: [],
          provenance: "SIMULATED",
        },
        {
          id: "inc-2",
          type: "BUS_BREAKDOWN",
          status: "RESOLVED",
          routeId: "R102",
          occurredAt: "2026-11-12T01:30:00.000Z",
          severity: "MEDIUM",
          relatedReportIds: [],
          provenance: "SIMULATED",
        },
      ],
    };
    const alerts = buildStudentAlerts({ state, sessionId, now: NOW });
    const incidentAlerts = alerts.filter((alert) => alert.category === "INCIDENT");
    expect(incidentAlerts).toHaveLength(1);
    expect(incidentAlerts[0].severity).toBe("CRITICAL");
    expect(incidentAlerts[0].title).toContain("CONFIRMED INCIDENT");
    expect(incidentAlerts[0].routeIds).toEqual(["R101"]);
  });

  it("announces an approved replacement as an operational update", () => {
    const state: SafarState = {
      ...baseState,
      incidents: [
        {
          id: "inc-1",
          type: "BUS_BREAKDOWN",
          status: "ACTIVE",
          routeId: "R101",
          occurredAt: "2026-11-14T01:30:00.000Z",
          severity: "HIGH",
          relatedReportIds: [],
          provenance: "SIMULATED",
        },
      ],
      replacementRecommendations: [
        {
          id: "rec-1",
          incidentId: "inc-1",
          candidateBusIds: ["bus-ka21gh407"],
          rankedCandidates: [],
          recommendedBusId: "bus-ka21gh407",
          status: "APPROVED",
        },
      ],
    };
    const alerts = buildStudentAlerts({ state, sessionId, now: NOW });
    const replacement = alerts.find((alert) => alert.category === "REPLACEMENT");
    expect(replacement?.title).toBe("REPLACEMENT APPROVED");
    expect(replacement?.body).toContain("KA-21-GH-407");
    expect(replacement?.severity).toBe("SUCCESS");
  });

  it("announces an honest no-replacement state", () => {
    const state: SafarState = {
      ...baseState,
      replacementRecommendations: [
        {
          id: "rec-none",
          incidentId: "inc-missing",
          candidateBusIds: [],
          rankedCandidates: [],
          status: "NO_FEASIBLE_CANDIDATE",
        },
      ],
    };
    const alerts = buildStudentAlerts({ state, sessionId, now: NOW });
    expect(alerts.find((alert) => alert.category === "REPLACEMENT")?.title).toBe(
      "NO FEASIBLE REPLACEMENT",
    );
  });

  it("surfaces predicted event impact as a warning, not a closure", () => {
    const alerts = buildStudentAlerts({ state: baseState, sessionId, now: NOW });
    const eventAlert = alerts.find((alert) => alert.category === "EVENT");
    expect(eventAlert).toBeDefined();
    expect(eventAlert?.title).toContain("PREDICTED EVENT IMPACT");
    expect(eventAlert?.body).toContain("not a verified road closure");
    expect(eventAlert?.routeIds.sort()).toEqual(["R101", "R104"]);
  });

  it("detects a changed recommendation for a saved search", () => {
    const watch: JourneyWatch = {
      key: "v-vittal|d-pgc|2026-11-14|09:00",
      request: {
        originVillageId: "v-vittal",
        destinationId: "d-pgc",
        travelDate: "2026-11-14",
        requiredArrivalTime: "09:00",
      },
      topJourneySignature: "stale-signature",
      topJourneyLabel: "R102 07:30",
      savedAt: "2026-11-13T05:00:00.000Z",
    };
    const alerts = buildStudentAlerts({
      state: baseState,
      sessionId,
      watches: [watch],
      now: NOW,
    });
    const change = alerts.find((alert) => alert.category === "JOURNEY_CHANGE");
    expect(change).toBeDefined();
    expect(change?.body).toContain("Was:");
    expect(change?.body).toContain("Now:");
  });

  it("does not raise a change alert when the recommendation is unchanged", () => {
    const watch: JourneyWatch = {
      key: "v-vittal|d-pgc|2026-11-14|09:00",
      request: {
        originVillageId: "v-vittal",
        destinationId: "d-pgc",
        travelDate: "2026-11-14",
        requiredArrivalTime: "09:00",
      },
      topJourneySignature: "placeholder",
      topJourneyLabel: "placeholder",
      savedAt: "2026-11-13T05:00:00.000Z",
    };
    const first = buildStudentAlerts({ state: baseState, sessionId, watches: [watch], now: NOW });
    const change = first.find((alert) => alert.category === "JOURNEY_CHANGE");
    expect(change).toBeDefined();
    // Feed the reported signature back and confirm the alert disappears.
    const currentSignature = change!.id.replace(`watch-${watch.key}-`, "");
    const stable = buildStudentAlerts({
      state: baseState,
      sessionId,
      watches: [{ ...watch, topJourneySignature: currentSignature }],
      now: NOW,
    });
    expect(stable.find((alert) => alert.category === "JOURNEY_CHANGE")).toBeUndefined();
  });

  it("includes shared student announcements from canonical alerts", () => {
    const state: SafarState = {
      ...baseState,
      alerts: [
        {
          id: "shared-1",
          audience: "STUDENT",
          severity: "INFO",
          title: "Route R103 timetable changed",
          body: "The demo timetable for R103 has been updated.",
          createdAt: "2026-11-13T05:30:00.000Z",
          relatedRouteIds: ["R103"],
          provenance: "DEMO",
        },
        {
          id: "shared-2",
          audience: "AUTHORITY",
          severity: "INFO",
          title: "Authority-only notice",
          body: "Not for students.",
          createdAt: "2026-11-13T05:30:00.000Z",
          relatedRouteIds: [],
          provenance: "DEMO",
        },
      ],
    };
    const alerts = buildStudentAlerts({ state, sessionId, now: NOW });
    expect(alerts.some((alert) => alert.title === "Route R103 timetable changed")).toBe(true);
    expect(alerts.some((alert) => alert.title === "Authority-only notice")).toBe(false);
  });

  it("returns unique, newest-first alerts", () => {
    const alerts = buildStudentAlerts({ state: withReport(baseState, {}), sessionId, now: NOW });
    const ids = alerts.map((alert) => alert.id);
    expect(new Set(ids).size).toBe(ids.length);
    const times = alerts.map((alert) => new Date(alert.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
