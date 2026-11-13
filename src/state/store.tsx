import React, { createContext, useContext } from "react";
import type {
  AppState,
  SafarEvent,
  StudentTravelRequest,
  AuditEvent,
} from "../domain/types";
import { buildSeedState } from "../data/seed";
import { calculateAllEventImpacts } from "../domain/calculations/eventImpact";
import {
  buildIncident,
  buildIncidentAlert,
  processDisruptionReport,
  verifyDisruption,
} from "../domain/calculations/disruption";
import { useSafarState } from "./SafarStateContext";
import { rankReplacementBuses } from "../domain/calculations/fleetRanking";

export type AppAction =
  | { type: "SUBMIT_TRAVEL_REQUEST"; payload: Omit<StudentTravelRequest, "id" | "submittedAt"> }
  | { type: "SUBMIT_DISRUPTION_REPORT"; payload: Parameters<typeof processDisruptionReport>[0] }
  | { type: "VERIFY_REPORT"; payload: { reportId: string; reason?: string } }
  | { type: "REJECT_REPORT"; payload: { reportId: string; reason: string } }
  | { type: "MARK_REPORT_DUPLICATE"; payload: { reportId: string; reason?: string } }
  | { type: "CONFIRM_INCIDENT"; payload: Parameters<typeof buildIncident>[0] }
  | { type: "CLOSE_INCIDENT"; payload: { incidentId: string; reason: string } }
  | { type: "ADD_EVENT"; payload: Omit<SafarEvent, "id" | "createdAt" | "updatedAt"> }
  | { type: "UPDATE_EVENT"; payload: { id: string } & Partial<SafarEvent> }
  | { type: "DELETE_EVENT"; payload: { eventId: string } }
  | { type: "RECALCULATE_EVENT_IMPACTS"; payload: { eventId?: string } }
  | { type: "MARK_BUS_UNAVAILABLE"; payload: { busId: string } }
  | { type: "GENERATE_REPLACEMENT_RECOMMENDATION"; payload: { incidentId: string } }
  | { type: "APPROVE_REPLACEMENT"; payload: { recommendationId: string } }
  | { type: "REJECT_REPLACEMENT"; payload: { recommendationId: string; reason: string } }
  | { type: "RUN_SCENARIO"; payload: { scenarioType: "A" | "B"; busId?: string } }
  | { type: "RESET_SCENARIO" }
  | { type: "MARK_ALERT_READ"; payload: { alertId: string } }
  | { type: "LOAD_STATE"; payload: AppState }
  | { type: "SET_SCENARIO_DATE"; payload: { date: string } };

function makeAudit(action: string, recordType: string, recordId: string, reason?: string): AuditEvent {
  return {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    action,
    performedByRole: "AUTHORITY",
    actor: "AUTHORITY",
    timestamp: new Date().toISOString(),
    at: new Date().toISOString(),
    affectedRecordType: recordType,
    affectedRecordId: recordId,
    recordIds: [recordId],
    reason,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.payload;

    case "SET_SCENARIO_DATE":
      return { ...state, scenario: { ...state.scenario, scenarioDate: action.payload.date } };

    case "SUBMIT_TRAVEL_REQUEST": {
      const req: StudentTravelRequest = {
        id: `STR-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        ...action.payload,
      };
      return { ...state, travelRequests: [...state.travelRequests, req] };
    }

    case "SUBMIT_DISRUPTION_REPORT": {
      const report = processDisruptionReport(action.payload);
      return { ...state, disruptionReports: [...state.disruptionReports, report] };
    }

    case "VERIFY_REPORT": {
      const updated = state.disruptionReports.map((r) =>
        r.id === action.payload.reportId
          ? verifyDisruption(r, { action: "VERIFY", reason: action.payload.reason })
          : r,
      );
      const audit = makeAudit("VERIFY_REPORT", "DisruptionReport", action.payload.reportId, action.payload.reason);
      return { ...state, disruptionReports: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case "REJECT_REPORT": {
      const updated = state.disruptionReports.map((r) =>
        r.id === action.payload.reportId
          ? verifyDisruption(r, { action: "REJECT", reason: action.payload.reason })
          : r,
      );
      const audit = makeAudit("REJECT_REPORT", "DisruptionReport", action.payload.reportId, action.payload.reason);
      return { ...state, disruptionReports: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case "MARK_REPORT_DUPLICATE": {
      const updated = state.disruptionReports.map((r) =>
        r.id === action.payload.reportId
          ? verifyDisruption(r, { action: "DUPLICATE", reason: action.payload.reason })
          : r,
      );
      const audit = makeAudit("MARK_REPORT_DUPLICATE", "DisruptionReport", action.payload.reportId, action.payload.reason);
      return { ...state, disruptionReports: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case "CONFIRM_INCIDENT": {
      const incident = buildIncident(action.payload);
      const busFailure =
        incident.type === "BUS_BREAKDOWN" || incident.type === "MECHANICAL_FAILURE";
      const failedBus = incident.busId
        ? state.buses.find((bus) => bus.id === incident.busId)
        : undefined;
      const route = state.routes.find((r) => r.id === incident.routeId);

      let updatedBuses = state.buses;
      let replacementRecommendations = state.replacementRecommendations;

      if (busFailure && failedBus) {
        updatedBuses = state.buses.map((b) =>
          b.id === failedBus.id ? { ...b, status: "UNAVAILABLE" as const } : b,
        );

        const ranked = rankReplacementBuses(failedBus, updatedBuses, {
          affectedRoute: route,
          requiredCapacity: failedBus.capacity,
          occupiedPassengers: failedBus.occupiedSeats,
        });
        const best = ranked.find((candidate) => candidate.eligible);
        const recommendation = {
          id: `rec-${incident.id}`,
          incidentId: incident.id,
          candidateBusIds: ranked.map((candidate) => candidate.busId),
          rankedCandidates: ranked.map((candidate) => ({
            busId: candidate.busId,
            capacityScore: candidate.capacityScore,
            compatibilityScore: candidate.compatibilityScore,
            responseTimeScore: candidate.responseTimeScore,
            availabilityScore: candidate.availabilityScore,
            finalScore: candidate.finalScore,
            eligible: candidate.eligible,
            explanation: candidate.explanation,
          })),
          recommendedBusId: best?.busId,
          status: best ? ("PENDING" as const) : ("NO_FEASIBLE_CANDIDATE" as const),
          decisionReason: best
            ? `Top recommendation: ${best.bus.registration} with score ${best.finalScore}/100. ${best.explanation}`
            : "No eligible replacement bus with sufficient operational status is currently available.",
        };
        replacementRecommendations = [...replacementRecommendations, recommendation];
      }

      const linkedReports = state.disruptionReports.map((report) =>
        incident.relatedReportIds.includes(report.id)
          ? { ...report, relatedIncidentId: incident.id }
          : report,
      );
      const linkAudits = incident.relatedReportIds.map((reportId) =>
        makeAudit(
          "LINK_REPORT_TO_INCIDENT",
          "DisruptionReport",
          reportId,
          `Linked to confirmed incident ${incident.id}`,
        ),
      );

      const routeName = route?.name;
      const alert = buildIncidentAlert(incident, routeName);
      const audit = makeAudit(
        "CONFIRM_INCIDENT",
        "Incident",
        incident.id,
        `${incident.type} confirmed; ${incident.relatedReportIds.length} report(s) associated`,
      );
      return {
        ...state,
        incidents: [...state.incidents, incident],
        buses: updatedBuses,
        disruptionReports: linkedReports,
        replacementRecommendations,
        alerts: [...state.alerts, alert],
        auditEvents: [...state.auditEvents, audit, ...linkAudits],
      };
    }

    case "CLOSE_INCIDENT": {
      const updated = state.incidents.map((i) =>
        i.id === action.payload.incidentId ? { ...i, status: "CLOSED" as const } : i,
      );
      const audit = makeAudit("CLOSE_INCIDENT", "Incident", action.payload.incidentId, action.payload.reason);
      return { ...state, incidents: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case "ADD_EVENT": {
      const event: SafarEvent = {
        id: `EVT-${Date.now()}`,
        ...action.payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const context = {
        timetables: state.timetables ?? state.timetableServices,
        stops: state.stops,
      };
      const impacts = calculateAllEventImpacts(event, state.routes, context);
      const audit = makeAudit("ADD_EVENT", "SafarEvent", event.id, `Event added: ${event.name}`);
      const currentImpacts = state.eventImpacts ?? state.eventRouteImpacts;
      const newImpacts = [...currentImpacts, ...impacts];
      return {
        ...state,
        events: [...state.events, event],
        eventRouteImpacts: newImpacts,
        eventImpacts: newImpacts,
        auditEvents: [...state.auditEvents, audit],
      };
    }

    case "UPDATE_EVENT": {
      const updated = state.events.map((e) =>
        e.id === action.payload.id ? { ...e, ...action.payload, updatedAt: new Date().toISOString() } : e,
      );
      const event = updated.find((e) => e.id === action.payload.id);
      let impacts = state.eventImpacts ?? state.eventRouteImpacts;
      if (event) {
        const context = {
          timetables: state.timetables ?? state.timetableServices,
          stops: state.stops,
        };
        const fresh = calculateAllEventImpacts(event, state.routes, context);
        impacts = [...impacts.filter((i) => i.eventId !== event.id), ...fresh];
      }
      const audit = makeAudit("UPDATE_EVENT", "SafarEvent", action.payload.id, "Event details updated");
      return {
        ...state,
        events: updated,
        eventRouteImpacts: impacts,
        eventImpacts: impacts,
        auditEvents: [...state.auditEvents, audit],
      };
    }

    case "DELETE_EVENT": {
      const audit = makeAudit("DELETE_EVENT", "SafarEvent", action.payload.eventId, "Event deleted; future impact removed");
      const currentImpacts = state.eventImpacts ?? state.eventRouteImpacts;
      const freshImpacts = currentImpacts.filter((i) => i.eventId !== action.payload.eventId);
      return {
        ...state,
        events: state.events.filter((e) => e.id !== action.payload.eventId),
        eventRouteImpacts: freshImpacts,
        eventImpacts: freshImpacts,
        auditEvents: [...state.auditEvents, audit],
      };
    }

    case "RECALCULATE_EVENT_IMPACTS": {
      const targetEvents = action.payload.eventId
        ? state.events.filter((e) => e.id === action.payload.eventId)
        : state.events;
      const newImpacts = targetEvents.flatMap((e) =>
        calculateAllEventImpacts(e, state.routes, {
          timetables: state.timetables ?? state.timetableServices,
          stops: state.stops,
        }),
      );
      const eventIds = targetEvents.map((e) => e.id);
      const currentImpacts = state.eventImpacts ?? state.eventRouteImpacts;
      const merged = [
        ...currentImpacts.filter((i) => !eventIds.includes(i.eventId)),
        ...newImpacts,
      ];
      return {
        ...state,
        eventRouteImpacts: merged,
        eventImpacts: merged,
      };
    }

    case "MARK_BUS_UNAVAILABLE": {
      return {
        ...state,
        buses: state.buses.map((b) =>
          b.id === action.payload.busId ? { ...b, status: "UNAVAILABLE" as const } : b,
        ),
      };
    }

    case "RESET_SCENARIO": {
      const seed = buildSeedState();
      return { ...seed, scenario: { ...seed.scenario, status: "IDLE" } };
    }

    case "MARK_ALERT_READ": {
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.payload.alertId ? { ...a, read: true } : a,
        ),
      };
    }

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const safar = useSafarState();

  const dispatch = (action: AppAction) => {
    // If it's a known SafarAction, dispatch directly, otherwise reduce locally
    try {
      const nextState = appReducer(safar.state, action);
      safar.dispatch({ type: "APPLY_LIVE_SCENARIO", state: nextState });
    } catch (e) {
      console.error("Error dispatching app action:", e);
    }
  };

  return (
    <AppContext.Provider value={{ state: safar.state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): { state: AppState } {
  const ctx = useContext(AppContext);
  if (ctx) return { state: ctx.state };
  const safar = useSafarState();
  return { state: safar.state };
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  const ctx = useContext(AppContext);
  if (ctx) return ctx.dispatch;
  const safar = useSafarState();
  return (action: AppAction) => {
    const nextState = appReducer(safar.state, action);
    safar.dispatch({ type: "APPLY_LIVE_SCENARIO", state: nextState });
  };
}
