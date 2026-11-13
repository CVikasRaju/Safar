# SAFAR — Backend / Transport Intelligence Integration Contract

**Owner:** Agent 3 (Backend & Transport Intelligence)
**Status:** Domain, seed, services, shared state, persistence and tests implemented.
**Applies to:** Student Portal (Member 2), Government Control Centre (Members 2/4), foundation & integration (Member 1).

The repository is currently a **backend module inside an empty project shell**. No React app, routing or UI exists yet. Member 1 owns the foundation and should consume these modules rather than re-implementing transport logic.

> All route, bus, timetable, demand, event, response-time and reliability values are illustrative prototype data. They are never live GPS, official government schedules or validated predictions.

---

## 1. File map (do not create parallel versions)

| Path | Purpose |
|---|---|
| `src/domain/types.ts` | **Canonical shared types.** Import from here; do not redeclare entities in feature folders. |
| `src/domain/constants.ts` | Weights, risk bands, status labels, exact disclaimers, storage key, scenario constants. |
| `src/domain/time.ts` | `HH:MM` / ISO / minutes helpers, deterministic `nextId`, `clamp`. |
| `src/domain/network.ts` | Network lookups and `getNetworkFromState(state)`. |
| `src/domain/validation.ts` | `validateSeedData`, `validateState` (used on load). |
| `src/domain/calculations/journey.ts` | `generateJourneyOptions`, ranking, no-route explanation. |
| `src/domain/calculations/reliability.ts` | `calculateJourneyReliability`, exact disclaimer, labels. |
| `src/domain/calculations/eventImpact.ts` | `calculateEventImpact`, `identifyAffectedRoutes`, `identifyAffectedJourneys`. |
| `src/domain/calculations/demand.ts` | `calculateStudentDemand`, `routeImportanceScore`, allocation. |
| `src/domain/calculations/replacement.ts` | Eligibility, weighted ranking, explanation. |
| `src/domain/calculations/allocation.ts` | Pure fleet allocation/release helpers. |
| `src/data/seed.ts` | Immutable demo dataset + `createSeedData`, `createSeedEvent`. |
| `src/state/initialState.ts` | **`getInitialState(options)`** — the only way to seed/reset state. |
| `src/state/appReducer.ts` | `SafarAction`, `applyAction`, `safarReducer`, `appReducer`. |
| `src/services/*.ts` | Public service layer (see §5). |
| `src/services/persistenceService.ts` | Versioned LocalStorage adapter (`safar-state-v1`). |
| `src/index.ts` | Convenience barrel; feature code may import modules directly. |
| `tests/*.test.ts` | 63 acceptance/unit tests. |

**Do not modify:** `docs/` (specs), `src/data/seed.ts` totals, shared type field names/status values, `RELIABILITY_DISCLAIMER`.

---

## 2. Canonical demo data (must stay consistent)

- Villages: Puttur, Sullia, Uppinangady, Kadaba, Vittal.
- Destinations: Puttur Government College, Puttur Government PU College, Sullia Government Polytechnic.
- Routes: R101 (Vittal–Uppinangady–Puttur), R102 (Sullia–Kadaba–Puttur), R103 (Kadaba–Panemangalore–Puttur), R104 (Vittal express), 12 stops.
- Buses: 8 (5+ required). `KA-21-AB-102` (`bus-101`) is **initially OPERATING on R101**. Available pool: `bus-104` KA-21-CD-201 (65 seats, 12 min), `bus-105` (45), `bus-108` (40). `bus-106` is MAINTENANCE.
- Demand seed: R101 `145/100`, R102 `90/110`, R103 `185/140` → **420 students / 350 seats / 70-seat potential shortage**.
  - R104 intentionally has `0/0` baseline so the mandated totals stay exact; it is the express overlay used by the event/breakdown scenario. **Do not add a demand row for R104 to “fix” this.**
- Seeded event: `evt-town-b-festival` (Uppinangady/Town B temple festival) for the configured scenario date, crowd VERY_HIGH, explicit affected routes **R101, R104**, 90-minute preparation buffer with source label.
- Scenario date defaults to **tomorrow** relative to the clock (`getInitialState()`), overridable via `{ scenarioDate: "YYYY-MM-DD" }`. Never hardcode a date in UI.

IDs: villages `V_*`, destinations `DST_*`, stops `st-*`, routes `R10x`, services `svc-r10x-hhmm`, buses `bus-10x`. Use IDs, not display names, for links.

---

## 3. Time, money-free and format contracts

- Entity times: ISO local date-time `"YYYY-MM-DDTHH:MM:00"`.
- Form inputs: dates `"YYYY-MM-DD"`, times `"HH:MM"` (24-hour).
- Journey planner treats travel as same-day; journeys crossing midnight are excluded (prototype limitation).
- Numeric scores are integers (reliability/impact) or one-decimal penalties. Do not re-round differently in the UI.
- `provenance` is required on important records: `DEMO | SIMULATED | USER_ENTERED | CALCULATED | AI_GENERATED | VERIFIED`. Never label demo/simulated data `VERIFIED`.

---

## 4. Shared state

### 4.1 Shape

`SafarState` (see `src/domain/types.ts`) contains one canonical source for:

- `villages`, `destinations`, `stops`, `routes`, `services`, `stopWalkLinks`
- `buses`
- `demandSeed`
- `events`, `eventImpacts` (published affected-route impacts only)
- `travelRequests`
- `reports`, `incidents`
- `recommendations`
- `alerts`, `auditEvents`
- `scenario`
- `meta` (`schemaVersion`, `seedVersion`, timestamps)

Dashboard numbers, demand, route statuses, shortages and affected journeys are **derived** via services. Do not store duplicate totals in components.

### 4.2 Creating / resetting state

```ts
import { getInitialState } from "./src/state/initialState";
const state = getInitialState({ scenarioDate: "2026-11-14" }); // optional fixed demo date
```

Reset **must** use `getInitialState()` (directly or via `scenarioService.resetState()` / `persistenceService.resetState()`). Do not reset individual slices.

### 4.3 React wiring

```ts
const [state, setState] = useReducer(safarReducer, undefined, () => loadState().state);

function dispatch(action: SafarAction) {
  const result = applyAction(state, action);   // structured success/failure
  if (result.ok) setState(action);             // or setState(result.state)
  else setError(result.error);                 // show actionable message
  return result;
}
```

`applyAction` never throws for invalid business operations — it returns `{ ok: false, code, error, state }`. `safarReducer` is provided for a plain reducer, but it cannot surface errors; prefer `applyAction` in forms.

Persist after meaningful changes (e.g. `useEffect(() => saveState(state), [state])`). Both workspaces must read the same Context state; never patch one page locally.

### 4.4 Persistence

```ts
loadState(storage?, { now?, scenarioDate? }) // -> { state, restored, message?, validation? }
saveState(state, storage?)                   // -> { ok, savedAt, error? }
resetState(storage?, { now?, scenarioDate? }) // -> { state, restored, message }
```

Key: `safar-state-v1`, schema version `1`. Malformed JSON, incompatible versions, bad references or unreadable storage automatically restore seed state and return a non-blocking `message`. `createMemoryStorage()` is exported for tests/SSR. LocalStorage is single-browser only; multi-user concurrency needs a server + transactions.

### 4.5 Reducer actions

`SUBMIT_TRAVEL_REQUEST`, `SUBMIT_DISRUPTION_REPORT`, `VERIFY_REPORT`, `REJECT_REPORT`, `MARK_REPORT_DUPLICATE`, `CONFIRM_INCIDENT`, `CLOSE_INCIDENT`, `ADD_EVENT`, `UPDATE_EVENT`, `DELETE_EVENT`, `MARK_BUS_UNAVAILABLE`, `SIMULATE_BREAKDOWN`, `GENERATE_REPLACEMENT_RECOMMENDATION`, `APPROVE_REPLACEMENT`, `REJECT_REPLACEMENT`, `RUN_SCENARIO`, `RUN_BREAKDOWN_SCENARIO`, `APPROVE_SCENARIO_REPLACEMENT`, `RESET_SCENARIO`, `RESET_STATE`.

Prefer named service functions for reads (no state mutation): dashboard, journeys, demand, fleet, reports, recommendations, scenario summary.

---

## 5. Service API

Every mutation returns:
```ts
type ServiceResult<T> =
  | { ok: true; state: SafarState; data: T }
  | { ok: false; state: SafarState; code: string; error: string };
```
Always replace your state with `result.state` (including failures, which preserve current state). Display `result.error`; branch on `result.code` only where the UI needs a specific recovery path.

### 5.1 `dataService` (read/dashboard)
- `getDashboardMetrics(state)` → bus counts, demand totals/shortage, active incidents, unverified reports, pending recommendations, `routesRequiringAttention`, `highRiskEventRoutes`, nested `demand`, per-route statuses.
- `getRouteStatuses(state)`, `getDemandSummary(state)`, `getAlerts(state, "STUDENT" | "AUTHORITY")`, `getEventImpacts(state)`, lookups (`getRouteById`, `getBusByRegistration`, …).
- `validateSeed(state)`, `validateState(unknown)`.

### 5.2 `journeyService`
- `searchJourneys(request, state)` → `ServiceResult<JourneySearchResult>` (`options`, `fastest`, `mostReliable`, `fewestTransfers`, optional `noRouteReason`). Use this from the planner.
- `generateJourneyOptionsForState(request, state)` → `JourneyOption[]` (raw).
- `getAlternativeJourneys(incidentId, request, state)` → alternatives + `waitForReplacement` + `noFeasibleOption` + explanation.
- `getAffectedJourneysForRoute(routeId, state, requests?)`.
- Required request: `{ originVillageId, destinationId, travelDate, requiredArrivalTime, passengers? }`.
- Each option includes segments (`WALK | BUS | WAIT | TRANSFER`), legs, boarding/alighting stops, walking/waiting minutes, transfers, total duration, estimated delay + sources, reliability + exact disclaimer, warnings, arrival status and ranking categories.
- **Never** display `noRouteReason` as a successful journey. Late options are labelled `LATE`; do not promote them as meeting the deadline.

### 5.3 `reliabilityService`
- `calculateJourneyReliability(journey, state)`, `reliabilityLabelFor(score)`, `getReliabilityDisclaimer()`.
- Always render exactly: `Illustrative prototype reliability score. Not a statistically validated probability.` (`RELIABILITY_DISCLAIMER`).

### 5.4 `eventService`
- `createEvent(input, state, { now? })`, `updateEvent(eventId, patch, state)`, `deleteEvent(eventId, state)`.
- `getAffectedRoutesForEvent(eventId, state)`, `getAffectedJourneysForEvent(eventId, state)`, `getAdvanceWarnings(state, { today?, withinDays? })`.
- `recalculateEventImpacts(state, eventId?)` (already called by the mutations).
- Rules: event-route impact recalculates on every change; deleting removes impacts and event alerts. Only the declarative association counts as “affected” when an event declares routes. Congestion is **PREDICTED EVENT IMPACT**, never a verified closure. An event does not automatically increase student demand.
- Required event fields: name, location, date, start/end, crowd level, nearby villages, affected roads, declared routes, source. Provide `preparationBufferMinutes` **and** `preparationBufferSource` if you show an early impact window.

### 5.5 `demandService`
- `getDemandSummary(state, adjustments?)` → per-route `expectedStudents`, `baselineStudents`, `submittedStudents`, `availableSeats`, `occupiedSeats`, `remainingCapacity`, `shortage`, `surplus`, `loadFactor`, `overcrowdingRisk`; totals (aggregate `shortage` defined as `max(0, totalExpected - totalSeats)`), village/destination aggregates, unallocated submissions, notes.
- `submitTravelRequest(input, state)` → `{ request, demand }`; validates IDs/date/time/group size 1–60; stores anonymous ref only. Each submission is allocated to **one** route (journey-based, then origin-stop fallback) so charts never double-count.
- Chart from `getDemandSummary`/`getDashboardMetrics`; do not hardcode 420/350/70 in components (tests assert them from the seed).

### 5.6 `disruptionService`
- `submitDisruptionReport(input, state)` → `{ report }`, status **UNVERIFIED**. Never changes fleet status or creates an incident.
- `verifyDisruption(reportId, "VERIFY" | "REJECT" | "MARK_DUPLICATE", state, { reason?, reviewer? })`. Reason required for reject/duplicate. Verification is not confirmation.
- `confirmIncident(input, state, { now? })` → `{ incident, affectedRouteId, affectedPassengers, affectedJourneyCount, recommendation?, warning? }`. Only this path applies operational disruption: a confirmed bus failure marks that bus `UNAVAILABLE` and auto-generates a **PENDING** replacement proposal. It never allocates a bus.
- `closeIncident(incidentId, { resolution, restoreBus? }, state)`. Failed bus stays `UNAVAILABLE` unless `restoreBus: true`; closing releases an approved replacement bus back to the pool.
- Required incident input: `type`, plus `busId`/`routeId`; optional stop, time, severity, expected resolution, description, related reports.

### 5.7 `fleetService`
- `getFleetSummary(state)` → buses with `remainingSeats`, route label, `assignableForReplacement`, status counts.
- `simulateBusBreakdown({ busId, routeId?, affectedStopId?, description? }, state)` → only an `OPERATING` bus; uses the same confirmed-incident workflow (`SIMULATED` provenance), returns incident + passengers + journeys + recommendation.
- `markBusUnavailable(busId, reason, state)` (explicit authority action; does not create an incident).
- `updateFleetAllocation({ incidentId, busId }, state)` is low-level; **UI should call `approveReplacement` instead**.

### 5.8 `replacementService`
- `generateReplacementRecommendation(incidentId, state)` → PENDING or `NO_FEASIBLE_CANDIDATE`; idempotent for an existing pending recommendation.
- `rankReplacementBuses(incident, fleet, { routeId, requiredSeats, failedBusId? }, { network? })` exposed for explanation panels. Weights: capacity 35%, compatibility 30%, response 25%, availability 10%. Ineligible candidates are excluded before ranking and never win on score.
- `approveReplacement(recommendationId, state, { busId?, reason?, actor? })` — the documented `approveReplacement(recommendationId, busId, state, options?)` order is also supported. Revalidates current fleet, prevents stale/double allocation, assigns the bus, sets `REPLACEMENT_ASSIGNED`, updates demand capacity and adds `REPLACEMENT APPROVED` alerts for both workspaces.
- `rejectReplacement(recommendationId, reason, state)` records the reason; no allocation.
- A recommendation is **not** an allocation. Show `REPLACEMENT RECOMMENDED — AWAITING APPROVAL` until approval.
- Partial coverage is explicit (`coverage: "PARTIAL"`, `remainingShortage`). The combined-bus suggestion is a separate operational decision and is not allocated.

### 5.9 `scenarioService`
- `runScenario({ scenarioDate?, eventId?, busId?, originVillageId?, destinationId?, requiredArrivalTime?, now? }, state)` → state + `ScenarioSummary`.
  - Ensures event for scenario date, demo student request (anonymous, simulated), confirmed simulated R101 breakdown, recalculated alternatives and recommendation. **Does not approve.**
- `approveScenarioReplacement(state, { busId?, reason?, now? })` → completes the approval step.
- `runBreakdownScenario({ busId? }, state)` — independent Scenario B, does not need the festival.
- `getScenarioSummary(state)` — derived summary for both dashboards (steps, affected routes/students, failed bus, recommendation, alternative, reliability, awaiting/complete flags).
- `resetState({ now?, scenarioDate? })` / `resetScenario(...)` → exact seed state.
- Scenario date is configurable; never display a stale calendar date. The demo request adds 1 student to demand analytics (documented; totals become 421 after `runScenario`).

### 5.10 `persistenceService`
See §4.4. Also `exportStateAsJSON`, `importStateFromJSON`, `clearState`, `STORAGE_KEY`.

---

## 6. Page-level integration map

**Student Portal**
- Journey Planner → `journeyService.searchJourneys`; render the three categories independently; show segments chronologically; honest schematic when no map; disclaimer on scores.
- My Travel Submissions → `state.travelRequests` + `demandService.submitTravelRequest`; show reference, not identity data.
- Report a Disruption → `disruptionService.submitDisruptionReport`; after submit show `UNVERIFIED STUDENT REPORT` + reference and explicitly say fleet status is unchanged.
- Journey Alerts → `dataService.getAlerts(state, "STUDENT")`.

**Government Control Centre**
- Dashboard → `dataService.getDashboardMetrics`; `DEMO DATA` / `SIMULATED` labels.
- Fleet Overview → `fleetService.getFleetSummary`.
- Event Intelligence → `eventService` + `calculateAllRouteImpacts` (analysis) + `getAdvanceWarnings`; label `PREDICTED EVENT IMPACT`.
- Demand Analytics → `dataService.getDemandSummary`; charts from state.
- Disruption Reports → `getUnverifiedReports`; buttons call `verifyDisruption`; separate confirmation dialog calls `confirmIncident`; never merge the two actions.
- Replacement Recommendations → `replacementService.getRecommendations`; explain component scores; `approveReplacement` / `rejectReplacement`.
- Route Monitoring → `dataService.getRouteStatuses`.
- Alerts & scenario controls → `dataService.getAlerts(state,"AUTHORITY")`, `scenarioService.runScenario`, `runBreakdownScenario`, `approveScenarioReplacement`, `resetState`.

Status text constants are exported from `src/domain/constants.ts` (`UNVERIFIED_REPORT_LABEL`, `VERIFIED_REPORT_NOT_CONFIRMED_LABEL`, `CONFIRMED_INCIDENT_LABEL`, `REPLACEMENT_RECOMMENDED_LABEL`, `REPLACEMENT_APPROVED_LABEL`, `NO_FEASIBLE_REPLACEMENT_LABEL`, `PREDICTED_EVENT_IMPACT_LABEL`). Use them verbatim.

---

## 7. Verification (actual, executed)

```
npx tsc --noEmit        # exit 0
npm test                # 8 files, 63 tests passed
```

Covered: seed totals/references, timetable chronology, arrival deadline, transfer buffers, no-route honesty, reliability bounds/disclaimer, event impact/risk/renormalisation, event CRUD recalculation, report remains unverified, verification does not confirm, incident confirmation, fleet eligibility, weighted ranking, partial coverage, no-feasible state, approval/rejection/stale revalidation, demand propagation, scenario end-to-end, reset exactness, persistence corruption handling.

Not executed: a browser/UI end-to-end run (no app shell exists), production frontend build (no bundler/React configured), real LocalStorage in a browser (memory adapter tested).

---

## 8. Known limitations / decisions to disclose

1. **No UI or app shell** was built by Agent 3; Member 1 owns foundation/navigation. There is no runnable page to demo until both are merged.
2. **No AI provider adapter / server endpoint** was implemented. All required explanations are deterministic (`generateRecommendationExplanation`, reliability factors, event explanations). AI is optional and must remain server-side.
3. Journey generation supports **at most one transfer** (two legs). Seed data does not require deeper chains.
4. Walking minutes are explicit illustrative demo values, never straight-line “walking distance”. No map/geocoding.
5. Response times, reliability, event delay and demand are **illustrative**, capped and labelled. Reliability is not a probability.
6. `eventImpacts` publishes only associated/affected routes. `calculateAllRouteImpacts` is available for analysis screens but should be labelled predicted.
7. Multi-bus coverage is a **suggestion only**; approval allocates exactly one bus and may leave a shortage (`remainingShortage`).
8. LocalStorage is single-browser; there is no authentication, role security, database or concurrency control. Authority actions are demo-role actions.
9. The seeded R104 has no baseline demand by design (fixed totals). Scenario submission adds 1 to demand.
10. `package.json` currently contains only TypeScript/Vitest. Member 1 must merge frontend dependencies/scripts; do not replace the domain/service modules.
11. Git workflow (feature branch, push, PR) could not be performed: this workspace has **no `.git` directory and no remote**. Files are ready to commit to `feature/backend-intelligence` in the real clone.

---

## 9. Coordination notes for Member 1

- Publish `src/domain/types.ts` as the shared type source; extend it additively only.
- Keep `getInitialState`, `safarReducer`/`applyAction` and `persistenceService` as the only state entry points.
- Register the pages above in navigation; do not duplicate calculations in components.
- If your foundation already defines design tokens/components, consume them — this module has no UI and no conflicts there.
- Merge `package.json` scripts rather than overwriting: keep `test` (Vitest) and `typecheck` (tsc), add dev/build.
- Do not alter seed totals, bus `KA-21-AB-102` assignment, `R101/R104` event association, or status labels without coordinating.
- For the final acceptance run, use `scenarioService.runScenario` → `approveScenarioReplacement` → verify demand/alerts/fleet in both workspaces → `resetState`.
