import { describe, expect, it } from "vitest";
import { createSeedState } from "../src/data/seed";
import {
  prepareDisruptionReport,
  prepareTravelRequest,
  validateReportInput,
} from "../src/domain/services/studentActions";
import { reducer } from "../src/state/reducer";

const NOW = new Date("2026-11-13T06:00:00.000Z");
const SUBMITTED_AT = new Date("2026-11-13T07:30:00.000Z");
const state = createSeedState({ scenarioDate: "2026-11-14", now: NOW });
const sessionId = "student-demo-01";

const validReport = {
  routeId: "R101",
  expectedBusId: "bus-ka21ab102",
  stopId: "st-puttur-busstand",
  expectedArrivalTime: "08:15",
  reportType: "BUS_NOT_ARRIVED",
  description: "The 08:15 bus has not arrived and there is no announcement.",
  sessionId,
};

describe("student disruption reporting (docs/06, docs/17 scenario C)", () => {
  it("creates an UNVERIFIED report with a reference ID and user-entered provenance", () => {
    const result = prepareDisruptionReport(state, validReport, SUBMITTED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.report.status).toBe("UNVERIFIED");
    expect(result.value.report.provenance).toBe("USER_ENTERED");
    expect(result.value.report.id).toMatch(/^RPT-\d{8}-\d{3}$/);
    expect(result.value.report.submittedAt).toBe(SUBMITTED_AT.toISOString());
    expect(result.value.report.submittedBySessionId).toBe(sessionId);
    expect(result.value.audit.action).toBe("SUBMIT_DISRUPTION_REPORT");
    expect(result.value.audit.actor).toBe("STUDENT_DEMO");
  });

  it("never changes fleet status or creates an incident", () => {
    const result = prepareDisruptionReport(state, validReport, SUBMITTED_AT);
    if (!result.ok) throw new Error("expected a valid report");
    const next = reducer(state, {
      type: "SUBMIT_DISRUPTION_REPORT",
      report: result.value.report,
      audit: result.value.audit,
    });
    expect(next.disruptionReports).toHaveLength(1);
    expect(next.disruptionReports[0].status).toBe("UNVERIFIED");
    expect(next.incidents).toEqual([]);
    expect(next.buses).toEqual(state.buses);
    expect(next.replacementRecommendations).toEqual([]);
    expect(next.auditEvents[0].action).toBe("SUBMIT_DISRUPTION_REPORT");
  });

  it("rejects a route that is not in the demo network", () => {
    const result = prepareDisruptionReport(
      state,
      { ...validReport, routeId: "R999" },
      SUBMITTED_AT,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("route");
  });

  it("rejects a bus that is not assigned to the selected route", () => {
    const result = prepareDisruptionReport(
      state,
      { ...validReport, expectedBusId: "bus-ka21ab118" },
      SUBMITTED_AT,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("KA-21-AB-118");
  });

  it("rejects a stop that the selected route does not serve", () => {
    const errors = validateReportInput(state, { ...validReport, stopId: "st-vittal-town" });
    expect(errors.join(" ")).toContain("served by the selected route");
  });

  it("rejects an unknown report type and an over-long description", () => {
    const unknownType = validateReportInput(state, { ...validReport, reportType: "ALIEN_ABDUCTION" });
    expect(unknownType.join(" ")).toContain("type of disruption");

    const longDescription = validateReportInput(state, {
      ...validReport,
      description: "x".repeat(501),
    });
    expect(longDescription.join(" ")).toContain("500 characters");
  });

  it("makes optional fields optional yet keeps the report usable", () => {
    const result = prepareDisruptionReport(
      state,
      { routeId: "R102", reportType: "OVER_CROWDED", sessionId },
      SUBMITTED_AT,
    );
    // OVER_CROWDED is not a documented report type, so reject it.
    expect(result.ok).toBe(false);

    const minimal = prepareDisruptionReport(
      state,
      { routeId: "R102", reportType: "INSUFFICIENT_CAPACITY", sessionId },
      SUBMITTED_AT,
    );
    expect(minimal.ok).toBe(true);
    if (!minimal.ok) return;
    expect(minimal.value.report.expectedBusId).toBeUndefined();
    expect(minimal.value.report.stopId).toBeUndefined();
    expect(minimal.value.report.status).toBe("UNVERIFIED");
  });
});

describe("student travel submissions (docs/08)", () => {
  const validRequest = {
    originVillageId: "v-vittal",
    destinationId: "d-pgc",
    travelDate: "2026-11-14",
    requiredArrivalTime: "09:00",
    groupSize: 2,
    sessionId,
  };

  it("creates a user-entered travel request and records an audit event", () => {
    const result = prepareTravelRequest(state, validRequest, SUBMITTED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.request.id).toMatch(/^TRV-\d{8}-\d{3}$/);
    expect(result.value.request.provenance).toBe("USER_ENTERED");
    expect(result.value.request.groupSize).toBe(2);

    const next = reducer(state, {
      type: "SUBMIT_TRAVEL_REQUEST",
      request: result.value.request,
      audit: result.value.audit,
    });
    expect(next.travelRequests).toHaveLength(1);
    expect(next.auditEvents[0].actor).toBe("STUDENT_DEMO");
    expect(next.buses).toEqual(state.buses);
  });

  it("validates group size, date and arrival time", () => {
    expect(prepareTravelRequest(state, { ...validRequest, groupSize: 0 }, SUBMITTED_AT).ok).toBe(false);
    expect(prepareTravelRequest(state, { ...validRequest, groupSize: 21 }, SUBMITTED_AT).ok).toBe(false);
    expect(prepareTravelRequest(state, { ...validRequest, groupSize: 1.5 }, SUBMITTED_AT).ok).toBe(false);
    expect(prepareTravelRequest(state, { ...validRequest, travelDate: "14-11-2026" }, SUBMITTED_AT).ok).toBe(false);
    expect(prepareTravelRequest(state, { ...validRequest, requiredArrivalTime: "9am" }, SUBMITTED_AT).ok).toBe(false);
  });

  it("refuses a destination that does not exist", () => {
    const result = prepareTravelRequest(
      state,
      { ...validRequest, destinationId: "d-mars" },
      SUBMITTED_AT,
    );
    expect(result.ok).toBe(false);
  });
});
