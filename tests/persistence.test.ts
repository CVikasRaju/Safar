import { describe, expect, it } from "vitest";
import { makeState, makeStorage, SCENARIO_DATE, TEST_NOW } from "./helpers";
import {
  STORAGE_KEY,
  exportStateAsJSON,
  importStateFromJSON,
  loadState,
  resetState,
  saveState,
} from "../src/services/persistenceService";
import { submitDisruptionReport } from "../src/services/disruptionService";

describe("shared state persistence", () => {
  it("persists and reloads the canonical shared state", () => {
    const state = makeState();
    const storage = makeStorage();
    const saved = saveState(state, storage);
    expect(saved.ok).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeTruthy();

    const loaded = loadState(storage, { now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(loaded.restored).toBe(false);
    expect(loaded.state).toEqual(state);
  });

  it("restores seed data when stored JSON is malformed", () => {
    const storage = makeStorage({ [STORAGE_KEY]: "{not-json" });
    const loaded = loadState(storage, { now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(loaded.restored).toBe(true);
    expect(loaded.message).toContain("malformed");
    expect(loaded.state).toEqual(makeState());
  });

  it("restores seed data on an incompatible schema version", () => {
    const state = { ...makeState(), schemaVersion: 99 };
    const storage = makeStorage({ [STORAGE_KEY]: JSON.stringify(state) });
    const loaded = loadState(storage, { now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(loaded.restored).toBe(true);
    expect(loaded.state.schemaVersion).toBe(1);
    expect(loaded.message).toContain("incompatible schema version");
  });

  it("restores seed data when persisted references are invalid", () => {
    const broken = makeState();
    broken.stops = broken.stops.map((stop) =>
      stop.id === "st-vittal-bus-stand" ? { ...stop, villageId: "V_MISSING" } : stop,
    );
    const storage = makeStorage({ [STORAGE_KEY]: JSON.stringify(broken) });
    const loaded = loadState(storage, { now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(loaded.restored).toBe(true);
    expect(loaded.state).toEqual(makeState());
  });

  it("reset restores the exact seed state and persists it", () => {
    const storage = makeStorage();
    const state = makeState();
    const reported = submitDisruptionReport(
      {
        routeId: "R101",
        expectedBusId: "bus-101",
        stopId: "st-puttur-bus-stand",
        expectedArrivalTime: "07:30",
        reportType: "BUS_NOT_ARRIVED",
      },
      state,
      { now: TEST_NOW },
    );
    expect(reported.ok).toBe(true);
    if (!reported.ok) return;
    saveState(reported.state, storage);
    expect(loadState(storage).state.reports).toHaveLength(1);

    const reset = resetState(storage, { now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(reset.state).toEqual(makeState());
    expect(loadState(storage, { now: TEST_NOW, scenarioDate: SCENARIO_DATE }).state).toEqual(makeState());
  });

  it("survives a storage write failure with an actionable error", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => undefined,
    };
    const saved = saveState(makeState(), failing);
    expect(saved.ok).toBe(false);
    expect(saved.error).toContain("quota exceeded");
  });

  it("exports and re-imports state, rejecting invalid imports", () => {
    const state = makeState();
    const json = exportStateAsJSON(state);
    const imported = importStateFromJSON(json, { now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(imported.restored).toBe(false);
    expect(imported.state).toEqual(state);

    const invalid = importStateFromJSON("{}", { now: TEST_NOW, scenarioDate: SCENARIO_DATE });
    expect(invalid.restored).toBe(true);
    expect(invalid.state).toEqual(makeState());
  });
});
