import { describe, expect, it } from "vitest";
import { makeState, TEST_NOW } from "./helpers";
import {
  closeIncident,
  confirmIncident,
  getUnverifiedReports,
  submitDisruptionReport,
  verifyDisruption,
} from "../src/services/disruptionService";
import { UNVERIFIED_REPORT_LABEL } from "../src/domain/constants";

const reportInput = {
  routeId: "R101",
  expectedBusId: "bus-101",
  stopId: "st-puttur-bus-stand",
  expectedArrivalTime: "07:30",
  reportType: "BUS_NOT_ARRIVED" as const,
  description: "Bus has not arrived at the stop.",
};

describe("disruption report and incident workflow", () => {
  it("creates an UNVERIFIED report without changing bus or incident state", () => {
    const state = makeState();
    const result = submitDisruptionReport(reportInput, state, { now: TEST_NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.report.status).toBe("UNVERIFIED");
    expect(result.data.report.reference).toMatch(/^SAFAR-RPT-\d{4}$/);
    expect(result.state.incidents).toEqual([]);
    expect(result.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("OPERATING");
    expect(getUnverifiedReports(result.state)).toHaveLength(1);
    expect(
      result.state.alerts.some(
        (alert) => alert.audience === "AUTHORITY" && alert.title === UNVERIFIED_REPORT_LABEL,
      ),
    ).toBe(true);
    expect(result.state.auditEvents.some((event) => event.action === "SUBMIT_DISRUPTION_REPORT")).toBe(true);
  });

  it("verifying a report does not confirm an incident or change fleet status", () => {
    const state = makeState();
    const submitted = submitDisruptionReport(reportInput, state, { now: TEST_NOW });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const verified = verifyDisruption(
      submitted.data.report.id,
      "VERIFY",
      submitted.state,
      { reviewer: "AUTHORITY", now: TEST_NOW },
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.data.report.status).toBe("VERIFIED");
    expect(verified.state.incidents).toEqual([]);
    expect(verified.state.recommendations).toEqual([]);
    expect(verified.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("OPERATING");
    expect(
      verified.state.alerts.some((alert) => alert.title.includes("INCIDENT NOT YET CONFIRMED")),
    ).toBe(true);
  });

  it("requires a reason for rejection or duplicate, and never creates an incident", () => {
    const state = makeState();
    const submitted = submitDisruptionReport(reportInput, state, { now: TEST_NOW });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const rejectedWithoutReason = verifyDisruption(
      submitted.data.report.id,
      "REJECT",
      submitted.state,
    );
    expect(rejectedWithoutReason.ok).toBe(false);

    const rejected = verifyDisruption(
      submitted.data.report.id,
      "REJECT",
      submitted.state,
      { reason: "Duplicate of an earlier call", now: TEST_NOW },
    );
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.data.report.status).toBe("REJECTED");
    expect(rejected.state.incidents).toEqual([]);

    const secondReview = verifyDisruption(
      submitted.data.report.id,
      "MARK_DUPLICATE",
      rejected.state,
      { reason: "Already reviewed", now: TEST_NOW },
    );
    expect(secondReview.ok).toBe(false);
  });

  it("confirms an active incident and marks only the failed bus unavailable", () => {
    const state = makeState();
    const confirmed = confirmIncident(
      {
        type: "BUS_BREAKDOWN",
        busId: "bus-101",
        routeId: "R101",
        affectedStopId: "st-puttur-bus-stand",
        severity: "HIGH",
        description: "Mechanical failure confirmed by depot.",
        confirmedBy: "AUTHORITY",
      },
      state,
      { now: TEST_NOW },
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const { incident, affectedPassengers, recommendation } = confirmed.data;
    expect(incident.status).toBe("ACTIVE");
    expect(affectedPassengers).toBe(60);
    expect(confirmed.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("UNAVAILABLE");
    expect(confirmed.state.buses.find((bus) => bus.id === "bus-102")?.status).toBe("OPERATING");
    expect(recommendation?.status).toBe("PENDING");
    expect(recommendation?.requiredSeats).toBe(60);
    expect(confirmed.state.buses.some((bus) => bus.status === "REPLACEMENT_ASSIGNED")).toBe(false);
  });

  it("rejects a duplicate active breakdown confirmation", () => {
    const state = makeState();
    const first = confirmIncident({ type: "BUS_BREAKDOWN", busId: "bus-101" }, state, { now: TEST_NOW });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = confirmIncident({ type: "BUS_BREAKDOWN", busId: "bus-101" }, first.state, { now: TEST_NOW });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("BUS_ALREADY_UNAVAILABLE");
  });

  it("records a road blockage without marking the bus unavailable", () => {
    const state = makeState();
    const confirmed = confirmIncident(
      { type: "ROAD_BLOCKAGE", busId: "bus-102", routeId: "R102", severity: "MODERATE" },
      state,
      { now: TEST_NOW },
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.state.buses.find((bus) => bus.id === "bus-102")?.status).toBe("OPERATING");
    expect(confirmed.data.recommendation).toBeUndefined();
  });

  it("keeps the failed bus unavailable when an incident is closed without explicit restoration", () => {
    const state = makeState();
    const confirmed = confirmIncident({ type: "BUS_BREAKDOWN", busId: "bus-101" }, state, { now: TEST_NOW });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const closed = closeIncident(
      confirmed.data.incident.id,
      { resolution: "Vehicle repaired at depot.", now: TEST_NOW },
      confirmed.state,
    );
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.data.incident.status).toBe("CLOSED");
    expect(closed.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("UNAVAILABLE");
    expect(closed.state.auditEvents.some((event) => event.action === "CLOSE_INCIDENT")).toBe(true);
  });

  it("can explicitly restore the failed bus when the authority chooses", () => {
    const state = makeState();
    const confirmed = confirmIncident({ type: "BUS_BREAKDOWN", busId: "bus-101" }, state, { now: TEST_NOW });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    const closed = closeIncident(
      confirmed.data.incident.id,
      { resolution: "Repaired and inspected.", restoreBus: true, now: TEST_NOW },
      confirmed.state,
    );
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.state.buses.find((bus) => bus.id === "bus-101")?.status).toBe("OPERATING");
  });

  it("rejects a report referencing a stop not served by the route", () => {
    const state = makeState();
    const result = submitDisruptionReport(
      { ...reportInput, stopId: "st-sullia-bus-stand" },
      state,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("not served by route");
  });
});
