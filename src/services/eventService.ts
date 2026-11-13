import type {
  CrowdLevel,
  EventCategory,
  EventRouteImpact,
  RegionalEvent,
  SafarState,
  ServiceResult,
  VerificationStatus,
} from "../domain/types";
import {
  EVENT_AFFECTED_ROUTE_THRESHOLD,
  PREDICTED_EVENT_IMPACT_LABEL,
} from "../domain/constants";
import { addDaysISO, isValidDate, isValidTime, minutesToTime, nextId, timeToMinutes, todayISO } from "../domain/time";
import { getNetworkFromState } from "../domain/network";
import {
  identifyAffectedJourneys,
  identifyAffectedRoutes,
  type AffectedJourney,
} from "../domain/calculations/eventImpact";
import { appendAlert, appendAudit, fail, finalize, isNonEmptyString, ok, timestamp, type ServiceOptions } from "./shared";

const EVENT_CATEGORIES: EventCategory[] = [
  "TEMPLE_FESTIVAL",
  "RELIGIOUS_PROCESSION",
  "VILLAGE_FAIR",
  "WEEKLY_MARKET",
  "EXAMINATION",
  "SPORTS_EVENT",
  "PUBLIC_GATHERING",
  "POLITICAL_RALLY",
  "NATIONAL_CELEBRATION",
  "CONSTRUCTION",
  "ROAD_CLOSURE",
  "CUSTOM",
];

const CROWD_LEVELS: CrowdLevel[] = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"];
const VERIFICATION_STATUSES: VerificationStatus[] = ["UNVERIFIED", "VERIFIED", "SIMULATED"];

export interface CreateEventInput {
  /** Optional stable ID, used only to restore the seeded scenario event. */
  id?: string;
  name: string;
  category?: EventCategory;
  locationLabel: string;
  villageId?: string;
  latitude?: number;
  longitude?: number;
  date: string;
  startTime: string;
  endTime: string;
  crowdLevel?: CrowdLevel;
  nearbyVillageIds?: string[];
  affectedRoadLabels?: string[];
  declaredAffectedRouteIds?: string[];
  preparationBufferMinutes?: number;
  preparationBufferSource?: string;
  description?: string;
  source?: string;
  verificationStatus?: VerificationStatus;
  provenance?: "USER_ENTERED" | "SIMULATED" | "VERIFIED";
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, "id">>;

function validateEventFields(
  input: CreateEventInput,
  state: SafarState,
): string | null {
  if (!isNonEmptyString(input.name) || input.name.length > 120) {
    return "Event name is required and must be at most 120 characters.";
  }
  if (!isNonEmptyString(input.locationLabel) || input.locationLabel.length > 160) {
    return "Event location is required and must be at most 160 characters.";
  }
  if (!isValidDate(input.date)) return "Event date must be a valid YYYY-MM-DD date.";
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    return "Event start and end times must be valid HH:MM times.";
  }
  if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    return "Event end time must be after the start time.";
  }
  if (input.category && !EVENT_CATEGORIES.includes(input.category)) {
    return `Unknown event category "${input.category}".`;
  }
  if (input.crowdLevel && !CROWD_LEVELS.includes(input.crowdLevel)) {
    return `Unknown crowd level "${input.crowdLevel}".`;
  }
  if (input.verificationStatus && !VERIFICATION_STATUSES.includes(input.verificationStatus)) {
    return `Unknown verification status "${input.verificationStatus}".`;
  }
  if (input.description && input.description.length > 800) {
    return "Event description must be at most 800 characters.";
  }
  if (
    input.preparationBufferMinutes !== undefined &&
    (!Number.isInteger(input.preparationBufferMinutes) ||
      input.preparationBufferMinutes < 0 ||
      input.preparationBufferMinutes > 240)
  ) {
    return "Preparation buffer must be a whole number of minutes between 0 and 240.";
  }
  if (
    input.preparationBufferMinutes !== undefined &&
    !isNonEmptyString(input.preparationBufferSource)
  ) {
    return "A preparation-buffer source is required when a buffer is configured.";
  }
  if (input.villageId && !state.villages.some((village) => village.id === input.villageId)) {
    return `Unknown event village "${input.villageId}".`;
  }
  for (const villageId of input.nearbyVillageIds ?? []) {
    if (!state.villages.some((village) => village.id === villageId)) {
      return `Unknown nearby village "${villageId}".`;
    }
  }
  for (const routeId of input.declaredAffectedRouteIds ?? []) {
    if (!state.routes.some((route) => route.id === routeId)) {
      return `Unknown affected route "${routeId}". Only seeded routes can be associated with an event.`;
    }
  }
  if (
    input.latitude !== undefined &&
    (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)
  ) {
    return "Latitude must be between -90 and 90.";
  }
  if (
    input.longitude !== undefined &&
    (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)
  ) {
    return "Longitude must be between -180 and 180.";
  }
  return null;
}

/**
 * Recomputes canonical event-route impacts from the current state. Only routes
 * associated with the event (explicit association when present, otherwise
 * impact above the documented threshold) are published as affected routes.
 */
export function recalculateEventImpacts(
  state: SafarState,
  eventId?: string,
): SafarState {
  const network = getNetworkFromState(state);
  const events = eventId
    ? state.events.filter((event) => event.id === eventId)
    : state.events;
  const impacts = events.flatMap((event) =>
    identifyAffectedRoutes(event, {
      network,
      demandSeed: state.demandSeed,
      state,
    }),
  );
  const otherImpacts = eventId
    ? state.eventImpacts.filter((impact) => impact.eventId !== eventId)
    : [];
  return { ...state, eventImpacts: [...otherImpacts, ...impacts] };
}

function eventAlert(state: SafarState, event: RegionalEvent): SafarState {
  const impacts = identifyAffectedRoutes(event, {
    network: getNetworkFromState(state),
    demandSeed: state.demandSeed,
    state,
  });
  if (impacts.length === 0) return state;
  const highest = impacts.reduce((best, impact) =>
    impact.score > best.score ? impact : best,
  );
  return appendAlert(state, {
    audience: "BOTH",
    severity:
      highest.risk === "CRITICAL"
        ? "CRITICAL"
        : highest.risk === "HIGH"
          ? "WARNING"
          : "INFO",
    category: "EVENT",
    title: `${PREDICTED_EVENT_IMPACT_LABEL} — ${event.name}`,
    message: `Predicted impact on ${impacts.map((impact) => `${impact.routeId} (${impact.risk})`).join(", ")}. ${highest.suggestedAction} This is a congestion estimate, not a verified road closure.`,
    eventId: event.id,
    routeId: highest.routeId,
    provenance: "CALCULATED",
  });
}

export function createEvent(
  input: CreateEventInput,
  state: SafarState,
  options?: ServiceOptions,
): ServiceResult<{ event: RegionalEvent; impacts: EventRouteImpact[] }> {
  const now = timestamp(options);
  const error = validateEventFields(input, state);
  if (error) return fail(state, "EVENT_INVALID", error);

  if (input.id && state.events.some((event) => event.id === input.id)) {
    return fail(state, "EVENT_DUPLICATE", `Event "${input.id}" already exists.`);
  }

  const event: RegionalEvent = {
    id:
      input.id ??
      nextId(
        "evt",
        state.events.map((candidate) => candidate.id),
      ),
    name: input.name.trim(),
    category: input.category ?? "CUSTOM",
    locationLabel: input.locationLabel.trim(),
    villageId: input.villageId,
    latitude: input.latitude,
    longitude: input.longitude,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    crowdLevel: input.crowdLevel ?? "MODERATE",
    nearbyVillageIds: input.nearbyVillageIds ?? [],
    affectedRoadLabels: input.affectedRoadLabels ?? [],
    declaredAffectedRouteIds: input.declaredAffectedRouteIds ?? [],
    preparationBuffer:
      input.preparationBufferMinutes !== undefined
        ? {
            minutes: input.preparationBufferMinutes,
            source: input.preparationBufferSource ?? "User-configured preparation buffer",
          }
        : undefined,
    description: input.description ?? "",
    source: input.source ?? "User-entered event (demo)",
    provenance: input.provenance ?? "USER_ENTERED",
    verificationStatus: input.verificationStatus ?? "UNVERIFIED",
    createdAt: now,
    updatedAt: now,
  };

  let nextState: SafarState = { ...state, events: [...state.events, event] };
  nextState = recalculateEventImpacts(nextState, event.id);
  nextState = eventAlert(nextState, event);
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "CREATE_EVENT",
    entityType: "RegionalEvent",
    entityIds: [event.id],
    at: now,
    details: {
      declaredAffectedRouteIds: event.declaredAffectedRouteIds,
      crowdLevel: event.crowdLevel,
    },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    event,
    impacts: nextState.eventImpacts.filter((impact) => impact.eventId === event.id),
  });
}

export function updateEvent(
  eventId: string,
  patch: UpdateEventInput,
  state: SafarState,
  options?: ServiceOptions,
): ServiceResult<{ event: RegionalEvent; impacts: EventRouteImpact[] }> {
  const existing = state.events.find((event) => event.id === eventId);
  if (!existing) return fail(state, "EVENT_NOT_FOUND", `Unknown event "${eventId}".`);

  const mergedInput: CreateEventInput = {
    id: existing.id,
    name: patch.name ?? existing.name,
    category: patch.category ?? existing.category,
    locationLabel: patch.locationLabel ?? existing.locationLabel,
    villageId: patch.villageId ?? existing.villageId,
    latitude: patch.latitude ?? existing.latitude,
    longitude: patch.longitude ?? existing.longitude,
    date: patch.date ?? existing.date,
    startTime: patch.startTime ?? existing.startTime,
    endTime: patch.endTime ?? existing.endTime,
    crowdLevel: patch.crowdLevel ?? existing.crowdLevel,
    nearbyVillageIds: patch.nearbyVillageIds ?? existing.nearbyVillageIds,
    affectedRoadLabels: patch.affectedRoadLabels ?? existing.affectedRoadLabels,
    declaredAffectedRouteIds:
      patch.declaredAffectedRouteIds ?? existing.declaredAffectedRouteIds,
    preparationBufferMinutes:
      patch.preparationBufferMinutes ?? existing.preparationBuffer?.minutes,
    preparationBufferSource:
      patch.preparationBufferSource ?? existing.preparationBuffer?.source,
    description: patch.description ?? existing.description,
    source: patch.source ?? existing.source,
    verificationStatus: patch.verificationStatus ?? existing.verificationStatus,
    provenance:
      (patch.provenance as CreateEventInput["provenance"]) ??
      (existing.provenance as CreateEventInput["provenance"]),
  };

  const error = validateEventFields(mergedInput, state);
  if (error) return fail(state, "EVENT_INVALID", error);

  const now = timestamp(options);
  const event: RegionalEvent = {
    ...existing,
    name: mergedInput.name.trim(),
    category: mergedInput.category ?? existing.category,
    locationLabel: mergedInput.locationLabel.trim(),
    villageId: mergedInput.villageId,
    latitude: mergedInput.latitude,
    longitude: mergedInput.longitude,
    date: mergedInput.date,
    startTime: mergedInput.startTime,
    endTime: mergedInput.endTime,
    crowdLevel: mergedInput.crowdLevel ?? existing.crowdLevel,
    nearbyVillageIds: mergedInput.nearbyVillageIds ?? [],
    affectedRoadLabels: mergedInput.affectedRoadLabels ?? [],
    declaredAffectedRouteIds: mergedInput.declaredAffectedRouteIds ?? [],
    preparationBuffer: mergedInput.preparationBufferMinutes
      ? {
          minutes: mergedInput.preparationBufferMinutes,
          source: mergedInput.preparationBufferSource ?? "User-configured preparation buffer",
        }
      : undefined,
    description: mergedInput.description ?? "",
    source: mergedInput.source ?? existing.source,
    verificationStatus: mergedInput.verificationStatus ?? existing.verificationStatus,
    updatedAt: now,
  };

  let nextState: SafarState = {
    ...state,
    events: state.events.map((candidate) => (candidate.id === eventId ? event : candidate)),
  };
  nextState = recalculateEventImpacts(nextState, eventId);
  nextState = eventAlert(nextState, event);
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "UPDATE_EVENT",
    entityType: "RegionalEvent",
    entityIds: [eventId],
    at: now,
    details: { changedFields: Object.keys(patch) },
  });
  nextState = finalize(nextState, now);

  return ok(nextState, {
    event,
    impacts: nextState.eventImpacts.filter((impact) => impact.eventId === eventId),
  });
}

export function deleteEvent(
  eventId: string,
  state: SafarState,
  options?: ServiceOptions,
): ServiceResult<{ eventId: string }> {
  const existing = state.events.find((event) => event.id === eventId);
  if (!existing) return fail(state, "EVENT_NOT_FOUND", `Unknown event "${eventId}".`);
  const now = timestamp(options);

  let nextState: SafarState = {
    ...state,
    events: state.events.filter((event) => event.id !== eventId),
    eventImpacts: state.eventImpacts.filter((impact) => impact.eventId !== eventId),
    alerts: state.alerts.filter((alert) => alert.eventId !== eventId),
  };
  nextState = appendAudit(nextState, {
    actor: "AUTHORITY",
    action: "DELETE_EVENT",
    entityType: "RegionalEvent",
    entityIds: [eventId],
    at: now,
    reason: "Event removed; its predicted route impact and event alerts were removed.",
  });
  nextState = finalize(nextState, now);
  return ok(nextState, { eventId });
}

export function getAffectedRoutesForEvent(
  eventId: string,
  state: SafarState,
): EventRouteImpact[] {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) return [];
  return identifyAffectedRoutes(event, {
    network: getNetworkFromState(state),
    demandSeed: state.demandSeed,
    state,
  });
}

export function getAffectedJourneysForEvent(
  eventId: string,
  state: SafarState,
): AffectedJourney[] {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) return [];
  return identifyAffectedJourneys(event, state);
}

export interface AdvanceWarning {
  eventId: string;
  eventName: string;
  date: string;
  impactWindowStart: string;
  risk: string;
  routeIds: string[];
  message: string;
}

/** Advance warnings for events whose impact window has not yet started. */
export function getAdvanceWarnings(
  state: SafarState,
  options: { today?: string; withinDays?: number } = {},
): AdvanceWarning[] {
  const today = options.today ?? todayISO();
  const withinDays = options.withinDays ?? 7;
  const horizon = addDaysISO(today, withinDays);
  const warnings: AdvanceWarning[] = [];

  for (const event of state.events) {
    if (event.date < today || event.date > horizon) continue;
    const impacts = state.eventImpacts.filter(
      (impact) => impact.eventId === event.id && impact.score >= EVENT_AFFECTED_ROUTE_THRESHOLD,
    );
    if (impacts.length === 0) continue;
    const highest = impacts.reduce((best, impact) =>
      impact.score > best.score ? impact : best,
    );
    const startMinute = Math.max(
      0,
      timeToMinutes(event.startTime) - (event.preparationBuffer?.minutes ?? 0),
    );
    warnings.push({
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      impactWindowStart: `${event.date}T${minutesToTime(startMinute)}:00`,
      risk: highest.risk,
      routeIds: impacts.map((impact) => impact.routeId),
      message: `PREDICTED EVENT IMPACT: ${event.name} on ${event.date}. ${highest.suggestedAction}`,
    });
  }

  return warnings.sort((a, b) =>
    a.impactWindowStart < b.impactWindowStart ? -1 : 1,
  );
}

export const eventService = {
  createEvent,
  updateEvent,
  deleteEvent,
  recalculateEventImpacts,
  getAffectedRoutesForEvent,
  getAffectedJourneysForEvent,
  getAdvanceWarnings,
};
