import type {
  Alert,
  AuditEvent,
  DemoActor,
  NetworkData,
  SafarState,
  ServiceFailure,
  ServiceResult,
  ServiceSuccess,
} from "../domain/types";
import { getNetworkFromState } from "../domain/network";
import { nextId, nowISO } from "../domain/time";

export interface ServiceOptions {
  now?: Date;
}

export function timestamp(options?: ServiceOptions): string {
  return nowISO(options?.now ?? new Date());
}

export function ok<T>(state: SafarState, data: T): ServiceSuccess<T> {
  return { ok: true, state, data };
}

export function fail(state: SafarState, code: string, error: string): ServiceFailure {
  return { ok: false, state, code, error };
}

export function networkOf(state: SafarState): NetworkData {
  return getNetworkFromState(state);
}

export function appendAudit(
  state: SafarState,
  input: {
    actor: DemoActor;
    action: string;
    entityType: string;
    entityIds: string[];
    reason?: string;
    details?: Record<string, unknown>;
    at: string;
  },
): SafarState {
  const event: AuditEvent = {
    id: nextId(
      "audit",
      state.auditEvents.map((entry) => entry.id),
    ),
    at: input.at,
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityIds: input.entityIds,
    reason: input.reason,
    details: input.details,
  };
  return { ...state, auditEvents: [...state.auditEvents, event] };
}

export function appendAlert(
  state: SafarState,
  input: Omit<Alert, "id" | "createdAt"> & { createdAt?: string },
): SafarState {
  const alert: Alert = {
    ...input,
    id: nextId(
      "alert",
      state.alerts.map((entry) => entry.id),
    ),
    createdAt: input.createdAt ?? nowISO(),
  };
  return { ...state, alerts: [...state.alerts, alert] };
}

export function touchState(state: SafarState, at: string): SafarState {
  return { ...state, meta: { ...state.meta, updatedAt: at } };
}

export function finalize(state: SafarState, at: string): SafarState {
  return touchState(state, at);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function asResult<T>(
  state: SafarState,
  code: string,
  message: string | null,
  data: T,
): ServiceResult<T> {
  return message ? fail(state, code, message) : ok(state, data);
}
