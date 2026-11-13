// SAFAR — Shared Application State (React Context + Reducer)
// One canonical store feeding both Student Portal and Government Control Centre.
// Persistence: LocalStorage key 'safar-state-v1'

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AppState, DisruptionReport, SafarEvent, Incident, ReplacementRecommendation, StudentTravelRequest, Alert, AuditEvent } from '../domain/types';
import { buildSeedState, SEED_SCHEMA_VERSION } from '../data/seed';
import { calculateAllEventImpacts } from '../domain/calculations/eventImpact';
import { buildIncident, estimateAffectedPassengers, buildIncidentAlert, processDisruptionReport, verifyDisruption } from '../domain/calculations/disruption';
import { rankReplacementBuses } from '../domain/calculations/replacement';
import { runScenarioA, runScenarioB, approveReplacement } from '../domain/calculations/scenario';

const STORAGE_KEY = 'safar-state-v1';

// ─── Action Types ─────────────────────────────────────────────────────────────
export type AppAction =
  | { type: 'SUBMIT_TRAVEL_REQUEST'; payload: Omit<StudentTravelRequest, 'id' | 'submittedAt'> }
  | { type: 'SUBMIT_DISRUPTION_REPORT'; payload: Parameters<typeof processDisruptionReport>[0] }
  | { type: 'VERIFY_REPORT'; payload: { reportId: string; reason?: string } }
  | { type: 'REJECT_REPORT'; payload: { reportId: string; reason: string } }
  | { type: 'MARK_REPORT_DUPLICATE'; payload: { reportId: string; reason?: string } }
  | { type: 'CONFIRM_INCIDENT'; payload: Parameters<typeof buildIncident>[0] }
  | { type: 'CLOSE_INCIDENT'; payload: { incidentId: string; reason: string } }
  | { type: 'ADD_EVENT'; payload: Omit<SafarEvent, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_EVENT'; payload: { id: string } & Partial<SafarEvent> }
  | { type: 'DELETE_EVENT'; payload: { eventId: string } }
  | { type: 'RECALCULATE_EVENT_IMPACTS'; payload: { eventId?: string } }
  | { type: 'MARK_BUS_UNAVAILABLE'; payload: { busId: string } }
  | { type: 'GENERATE_REPLACEMENT_RECOMMENDATION'; payload: { incidentId: string } }
  | { type: 'APPROVE_REPLACEMENT'; payload: { recommendationId: string } }
  | { type: 'REJECT_REPLACEMENT'; payload: { recommendationId: string; reason: string } }
  | { type: 'RUN_SCENARIO'; payload: { scenarioType: 'A' | 'B'; busId?: string } }
  | { type: 'RESET_SCENARIO' }
  | { type: 'MARK_ALERT_READ'; payload: { alertId: string } }
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'SET_SCENARIO_DATE'; payload: { date: string } };

// ─── Audit helper ─────────────────────────────────────────────────────────────
function makeAudit(action: string, recordType: string, recordId: string, reason?: string): AuditEvent {
  return {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    action,
    performedByRole: 'AUTHORITY',
    timestamp: new Date().toISOString(),
    affectedRecordType: recordType,
    affectedRecordId: recordId,
    reason,
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
// Exported for domain/integration tests. All operational preconditions are
// validated in domain services; the reducer only applies valid transitions.
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {

    case 'LOAD_STATE':
      return action.payload;

    case 'SET_SCENARIO_DATE':
      return { ...state, scenario: { ...state.scenario, scenarioDate: action.payload.date } };

    case 'SUBMIT_TRAVEL_REQUEST': {
      const req: StudentTravelRequest = {
        id: `STR-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        ...action.payload,
      };
      return { ...state, travelRequests: [...state.travelRequests, req] };
    }

    case 'SUBMIT_DISRUPTION_REPORT': {
      const report = processDisruptionReport(action.payload);
      return { ...state, disruptionReports: [...state.disruptionReports, report] };
    }

    case 'VERIFY_REPORT': {
      const updated = state.disruptionReports.map(r =>
        r.id === action.payload.reportId
          ? verifyDisruption(r, { action: 'VERIFY', reason: action.payload.reason })
          : r
      );
      const audit = makeAudit('VERIFY_REPORT', 'DisruptionReport', action.payload.reportId, action.payload.reason);
      return { ...state, disruptionReports: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case 'REJECT_REPORT': {
      const updated = state.disruptionReports.map(r =>
        r.id === action.payload.reportId
          ? verifyDisruption(r, { action: 'REJECT', reason: action.payload.reason })
          : r
      );
      const audit = makeAudit('REJECT_REPORT', 'DisruptionReport', action.payload.reportId, action.payload.reason);
      return { ...state, disruptionReports: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case 'MARK_REPORT_DUPLICATE': {
      const updated = state.disruptionReports.map(r =>
        r.id === action.payload.reportId
          ? verifyDisruption(r, { action: 'DUPLICATE', reason: action.payload.reason })
          : r
      );
      const audit = makeAudit('MARK_REPORT_DUPLICATE', 'DisruptionReport', action.payload.reportId, action.payload.reason);
      return { ...state, disruptionReports: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case 'CONFIRM_INCIDENT': {
      const incident = buildIncident(action.payload);
      let updatedBuses = state.buses;
      if (incident.busId && (incident.type === 'BUS_BREAKDOWN' || incident.type === 'MECHANICAL_FAILURE')) {
        updatedBuses = state.buses.map(b =>
          b.id === incident.busId ? { ...b, status: 'UNAVAILABLE' as const } : b
        );
      }
      const alert = buildIncidentAlert(incident, state.routes.find(r => r.id === incident.routeId)?.name);
      const rec = rankReplacementBuses(incident, updatedBuses, incident.estimatedAffectedPassengers);
      // Link the reviewed student reports to the confirmed incident without
      // treating the reports themselves as the confirmation.
      const linkedReportIds = new Set(incident.relatedReportIds);
      const updatedReports = state.disruptionReports.map(report =>
        linkedReportIds.has(report.id)
          ? { ...report, relatedIncidentId: incident.id }
          : report
      );
      const audits = [
        makeAudit('CONFIRM_INCIDENT', 'Incident', incident.id, incident.description),
        ...incident.relatedReportIds.map(reportId =>
          makeAudit('LINK_REPORT_TO_INCIDENT', 'DisruptionReport', reportId, `Linked to ${incident.id}`)
        ),
      ];
      return {
        ...state,
        incidents: [...state.incidents, incident],
        buses: updatedBuses,
        disruptionReports: updatedReports,
        alerts: [...state.alerts, alert],
        replacementRecommendations: [...state.replacementRecommendations, rec],
        auditEvents: [...state.auditEvents, ...audits],
      };
    }

    case 'CLOSE_INCIDENT': {
      const updated = state.incidents.map(i =>
        i.id === action.payload.incidentId ? { ...i, status: 'CLOSED' as const } : i
      );
      const audit = makeAudit('CLOSE_INCIDENT', 'Incident', action.payload.incidentId, action.payload.reason);
      return { ...state, incidents: updated, auditEvents: [...state.auditEvents, audit] };
    }

    case 'ADD_EVENT': {
      const event: SafarEvent = {
        id: `EVT-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...action.payload,
      };
      const impacts = calculateAllEventImpacts(event, state.routes, {
        timetables: state.timetables,
        stops: state.stops,
      });
      const audit = makeAudit('ADD_EVENT', 'SafarEvent', event.id, `Impact calculated for ${impacts.length} route(s)`);
      return {
        ...state,
        events: [...state.events, event],
        eventImpacts: [...state.eventImpacts.filter(i => i.eventId !== event.id), ...impacts],
        auditEvents: [...state.auditEvents, audit],
      };
    }

    case 'UPDATE_EVENT': {
      const updated = state.events.map(e =>
        e.id === action.payload.id ? { ...e, ...action.payload, updatedAt: new Date().toISOString() } : e
      );
      const updatedEvent = updated.find(e => e.id === action.payload.id);
      const newImpacts = updatedEvent
        ? calculateAllEventImpacts(updatedEvent, state.routes, {
            timetables: state.timetables,
            stops: state.stops,
          })
        : [];
      const audit = makeAudit('UPDATE_EVENT', 'SafarEvent', action.payload.id, 'Event edited and impact recalculated');
      return {
        ...state,
        events: updated,
        eventImpacts: [
          ...state.eventImpacts.filter(i => i.eventId !== action.payload.id),
          ...newImpacts,
        ],
        auditEvents: [...state.auditEvents, audit],
      };
    }

    case 'DELETE_EVENT': {
      const audit = makeAudit('DELETE_EVENT', 'SafarEvent', action.payload.eventId, 'Event deleted; future impact removed');
      return {
        ...state,
        events: state.events.filter(e => e.id !== action.payload.eventId),
        eventImpacts: state.eventImpacts.filter(i => i.eventId !== action.payload.eventId),
        auditEvents: [...state.auditEvents, audit],
      };
    }

    case 'RECALCULATE_EVENT_IMPACTS': {
      const targetEvents = action.payload.eventId
        ? state.events.filter(e => e.id === action.payload.eventId)
        : state.events;
      const newImpacts = targetEvents.flatMap(e =>
        calculateAllEventImpacts(e, state.routes, {
          timetables: state.timetables,
          stops: state.stops,
        })
      );
      const eventIds = targetEvents.map(e => e.id);
      return {
        ...state,
        eventImpacts: [
          ...state.eventImpacts.filter(i => !eventIds.includes(i.eventId)),
          ...newImpacts,
        ],
      };
    }

    case 'MARK_BUS_UNAVAILABLE': {
      return {
        ...state,
        buses: state.buses.map(b =>
          b.id === action.payload.busId ? { ...b, status: 'UNAVAILABLE' as const } : b
        ),
      };
    }

    case 'GENERATE_REPLACEMENT_RECOMMENDATION': {
      const incident = state.incidents.find(i => i.id === action.payload.incidentId);
      if (!incident) return state;
      const rec = rankReplacementBuses(incident, state.buses, incident.estimatedAffectedPassengers);
      return {
        ...state,
        replacementRecommendations: [
          ...state.replacementRecommendations.filter(r => r.incidentId !== incident.id),
          rec,
        ],
      };
    }

    case 'APPROVE_REPLACEMENT': {
      const updates = approveReplacement(action.payload.recommendationId, state);
      const audit = makeAudit('APPROVE_REPLACEMENT', 'ReplacementRecommendation', action.payload.recommendationId);
      return { ...state, ...updates, auditEvents: [...state.auditEvents, audit] };
    }

    case 'REJECT_REPLACEMENT': {
      const updated = state.replacementRecommendations.map(r =>
        r.id === action.payload.recommendationId
          ? { ...r, status: 'REJECTED' as const, decisionReason: action.payload.reason, decidedAt: new Date().toISOString() }
          : r
      ) as ReplacementRecommendation[];
      return { ...state, replacementRecommendations: updated };
    }

    case 'RUN_SCENARIO': {
      if (action.payload.scenarioType === 'A') {
        const updates = runScenarioA(state);
        return { ...state, ...updates };
      } else {
        const busId = action.payload.busId ?? state.buses.find(b => b.status === 'OPERATING')?.id ?? '';
        const updates = runScenarioB(busId, state);
        return { ...state, ...updates };
      }
    }

    case 'RESET_SCENARIO': {
      const seed = buildSeedState();
      return { ...seed, scenario: { ...seed.scenario, status: 'IDLE' } };
    }

    case 'MARK_ALERT_READ': {
      return {
        ...state,
        alerts: state.alerts.map(a =>
          a.id === action.payload.alertId ? { ...a, read: true } : a
        ),
      };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadFromStorage(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schemaVersion !== SEED_SCHEMA_VERSION) {
      console.warn('SAFAR: schema version mismatch — restoring seed data.');
      return null;
    }
    return parsed;
  } catch {
    console.warn('SAFAR: malformed localStorage — restoring seed data.');
    return null;
  }
}

function saveToStorage(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastSavedAt: new Date().toISOString() }));
  } catch {
    // Ignore quota errors
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const initial = loadFromStorage() ?? buildSeedState();
  const [state, dispatch] = useReducer(appReducer, initial);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

export function useAppDispatch() {
  return useAppState().dispatch;
}
