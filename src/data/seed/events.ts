import type { EventRouteImpact, SafarEvent } from "../../domain/types";
import { hhmmToMinutes, minutesToIso } from "../../domain/calculations/time";

/**
 * Demo event for the central scenario (docs/05, docs/10, docs/15).
 *
 * The event date is derived from the configurable demo scenario date, never a
 * hardcoded calendar date. The impact-window buffer (90 minutes of preparation
 * time) is supplied explicitly by scenario configuration and its source is
 * displayed to students.
 */
export const EVENT_PREPARATION_BUFFER_MINUTES = 90;

export function buildSeedEvents(scenarioDate: string): SafarEvent[] {
  const startMinute = hhmmToMinutes("06:00");
  const endMinute = hhmmToMinutes("23:00");
  return [
    {
      id: "EVT001",
      name: "Puttur Mahalingeshwara Temple Festival",
      category: "TEMPLE_FESTIVAL",
      locationLabel: "Puttur town centre, near the bus stand approach road",
      coordinates: { lat: 12.7605, lon: 75.1985 },
      date: scenarioDate,
      startTime: "06:00",
      endTime: "23:00",
      expectedCrowdLevel: "VERY_HIGH",
      nearbyVillageIds: ["v-puttur", "v-kadaba"],
      affectedRoads: ["Puttur Main Road", "Bus Stand approach road"],
      affectedRouteIds: ["R101", "R104"],
      impactWindow: {
        start: minutesToIso(scenarioDate, startMinute - EVENT_PREPARATION_BUFFER_MINUTES),
        end: minutesToIso(scenarioDate, endMinute + 30),
      },
      impactWindowBufferMinutes: EVENT_PREPARATION_BUFFER_MINUTES,
      impactWindowBasis:
        "Scenario-configured 90-minute preparation/arrival buffer before the 06:00 event start.",
      description:
        "Illustrative full-day temple festival with processions and heavy pedestrian movement around the Puttur bus stand approach. This is demo data, not a real event notice.",
      source: "Demo scenario configuration (illustrative)",
      verificationStatus: "PREDICTED",
      provenance: "DEMO",
    },
  ];
}

/**
 * Seed event-route impact records.
 *
 * The weighted impact calculation itself belongs to the Event Intelligence
 * module (Member 3). These records exist so the Student Portal has impact data
 * before that module ships, and are explicitly labelled as seed demo values.
 * When Member 3 recalculates impacts, the shared state replaces them.
 */
export function buildSeedEventImpacts(now: Date): EventRouteImpact[] {
  const computedAt = now.toISOString();
  return [
    {
      id: "eri-r101-festival",
      eventId: "EVT001",
      routeId: "R101",
      impactScore: 62,
      riskLevel: "HIGH",
      overlapMinutes: 120,
      proximityBasis:
        "R101 terminates at Puttur Bus Stand, ~400 m from the festival approach road (estimated proximity).",
      estimatedDelayMinutes: 12,
      explanation:
        "Seed demo impact: high crowd intensity overlapping two hours of R101 evening services near the Puttur bus stand approach. Recalculation is owned by the Event Intelligence module.",
      computedAt,
      provenance: "DEMO",
    },
    {
      id: "eri-r104-festival",
      eventId: "EVT001",
      routeId: "R104",
      impactScore: 44,
      riskLevel: "MODERATE",
      overlapMinutes: 120,
      proximityBasis:
        "R104 starts at Puttur Bus Stand and runs past the festival approach road (estimated proximity).",
      estimatedDelayMinutes: 8,
      explanation:
        "Seed demo impact: moderate predicted congestion on the short college feeder during festival preparation and procession hours. Recalculation is owned by the Event Intelligence module.",
      computedAt,
      provenance: "DEMO",
    },
  ];
}

