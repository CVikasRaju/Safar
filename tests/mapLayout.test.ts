import { describe, expect, it } from "vitest";
import { createSeedState } from "../src/data/seed";
import { generateJourneyOptions } from "../src/domain/calculations/journeyPlanner";
import { buildJourneyMapPlan, buildSchematicLayout } from "../src/features/journeys/mapLayout";

const NOW = new Date("2026-11-13T06:00:00.000Z");
const state = createSeedState({ scenarioDate: "2026-11-14", now: NOW });
const stopsById = new Map(state.stops.map((stop) => [stop.id, stop]));
const plan = generateJourneyOptions(
  state,
  {
    originVillageId: "v-vittal",
    destinationId: "d-pgc",
    travelDate: "2026-11-14",
    requiredArrivalTime: "09:00",
  },
  NOW,
);
const journey = plan.meetingRequiredArrival[0];
const mapPlan = buildJourneyMapPlan(journey, stopsById, state.events);

describe("journey map plan and schematic fallback (docs/04, docs/10)", () => {
  it("has a bus journey to visualise", () => {
    expect(journey).toBeDefined();
    expect(journey.kind).toBe("BUS");
  });

  it("includes origin, destination, stop and transfer markers", () => {
    expect(mapPlan.markers.some((marker) => marker.kind === "ORIGIN")).toBe(true);
    expect(mapPlan.markers.some((marker) => marker.kind === "DESTINATION")).toBe(true);
    expect(mapPlan.markers.some((marker) => marker.kind === "STOP")).toBe(true);
  });

  it("draws a bus path through the served stops", () => {
    const busPath = mapPlan.paths.find((path) => path.kind === "BUS");
    expect(busPath).toBeDefined();
    expect(busPath!.points.length).toBeGreaterThanOrEqual(2);
    expect(busPath!.routeId).toBeTruthy();
  });

  it("draws walking segments separately from bus lines", () => {
    expect(mapPlan.paths.some((path) => path.kind === "WALK")).toBe(true);
  });

  it("marks a predicted event that affects a route on the journey", () => {
    const townPlan = generateJourneyOptions(
      state,
      {
        originVillageId: "v-kadaba",
        destinationId: "d-pgc",
        travelDate: "2026-11-14",
        requiredArrivalTime: "09:00",
      },
      NOW,
    );
    const townJourney = townPlan.options.find((option) =>
      option.usedRouteIds.includes("R104"),
    );
    expect(townJourney).toBeDefined();
    if (!townJourney) throw new Error("Expected a journey using R104");

    const townMapPlan = buildJourneyMapPlan(townJourney, stopsById, state.events);
    const eventMarker = townMapPlan.markers.find((marker) => marker.kind === "EVENT");
    expect(eventMarker).toBeDefined();
    expect(eventMarker?.note).toContain("Predicted event impact");
  });

  it("projects every point inside the schematic canvas", () => {
    const layout = buildSchematicLayout(mapPlan, 720, 360, 40);
    expect(layout.markers.length).toBe(mapPlan.markers.length);
    for (const marker of layout.markers) {
      expect(marker.x).toBeGreaterThanOrEqual(0);
      expect(marker.x).toBeLessThanOrEqual(720);
      expect(marker.y).toBeGreaterThanOrEqual(0);
      expect(marker.y).toBeLessThanOrEqual(360);
      expect(Number.isFinite(marker.x)).toBe(true);
      expect(Number.isFinite(marker.y)).toBe(true);
    }
    for (const path of layout.paths) {
      for (const point of path.points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(720);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(360);
      }
    }
  });

  it("keeps bounds finite for a walk-only journey", () => {
    const walkPlan = generateJourneyOptions(
      state,
      {
        originVillageId: "v-kadaba",
        destinationId: "d-kadaba-pu",
        travelDate: "2026-11-14",
        requiredArrivalTime: "09:00",
      },
      NOW,
    );
    const walkJourney = walkPlan.options.find((option) => option.kind === "WALK_ONLY");
    expect(walkJourney).toBeDefined();
    const walkMap = buildJourneyMapPlan(walkJourney!, stopsById, []);
    expect(walkMap.paths).toHaveLength(1);
    const layout = buildSchematicLayout(walkMap, 400, 240, 30);
    for (const marker of layout.markers) {
      expect(Number.isFinite(marker.x)).toBe(true);
      expect(marker.x).toBeGreaterThanOrEqual(0);
      expect(marker.x).toBeLessThanOrEqual(400);
    }
  });
});
