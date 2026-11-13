# SAFAR — Student Portal and Journey Experience (Member 2)

Functional student-facing side of **SAFAR — AI-Powered Rural Student Transport Intelligence System**
(*Predict Disruptions. Protect Student Journeys. Connect Every Village.*).

The Student Portal (journey planning, journey details, map visualisation, disruption reporting,
travel submissions and state-derived student alerts) was delivered first on `feature/student-portal`.

This branch (`feature/emergency-intelligence-engine`) adds the **advanced emergency intelligence
engine** on top of that shared foundation: a combined four-condition emergency scenario, a real
student-to-bus allocation engine, flooded-road alternative routing with walking legs, examination
prioritisation, before/after comparison, explainable decisions, advance event prediction and the
Control Centre interface. See [`EMERGENCY_INTELLIGENCE.md`](EMERGENCY_INTELLIGENCE.md) for the design,
rules and test matrix. Other authority workflows (report review, incident confirmation, replacement
approval) remain the other team members' scope and are not faked here.

All route, timetable, demand, delay, event and reliability values are **illustrative demo data**.
Nothing here is live GPS, an official schedule or a validated traffic forecast.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # 75 domain/integration tests (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

Node 20+ is sufficient. No API keys, `.env` values or external services are required. The map uses
OpenStreetMap tiles when they load and falls back to a local schematic when they do not.

## What is implemented

| Route | Screen | Contents |
|---|---|---|
| `/student` | Student dashboard | Quick journey search, next planned journey, route/journey status, latest alerts, reporting CTA |
| `/student/planner` | Journey Planner | Search form, three independently ranked recommendations, full comparison table, chronological itinerary, map/schematic, reliability breakdown, late alternatives, honest no-route state |
| `/student/submissions` | My Travel Plans | Intended-journey submission, own submissions with expected route, aggregated demand from this session |
| `/student/report` | Report a Disruption | `REPORT BUS NOT ARRIVED / DISRUPTION` form, reference ID, UNVERIFIED status, own report history |
| `/student/alerts` | Journey Alerts | Incident, report, replacement, event, recommendation-change and service alerts derived from shared state |
| `/control-centre` | Emergency overview | RUN / RESET scenario actions, 10 emergency KPIs, the four applied conditions, affected villages/routes, fleet status, before/after table, explainable decisions |
| `/control-centre/emergency` | Allocation & routes | Seat blocks, alternative routes, replacement pickups with walking distances, exam priority results, every assignment with its explanation, unserved groups with reasons |
| `/control-centre/prediction` | Event prediction | Predicted events with provenance, lead time, affected network, recommended alternatives and disclaimers |
| `/control-centre/integration` | Shared state | Honest hand-off page describing what the Student Portal publishes into the shared state |

### Journey planner behaviour (docs/04)

- Candidate journeys are generated from the shared demo route/stop/timetable/bus records — never
  from a separate mock list.
- Feasibility validates stop order, timetable chronology, minimum transfer buffer and arrival
  deadline. Journeys using `UNAVAILABLE` or `MAINTENANCE` buses are excluded, and routes with a
  confirmed road blockage/diversion are not offered.
- Three independent rankings: **Fastest** (lowest elapsed time), **Most Reliable** (highest
  illustrative reliability), **Fewest Transfers** (lowest bus count). Deterministic tie-breakers:
  reliability, earlier arrival, fewer transfers.
- If one journey legitimately wins several categories, the card says so ("Same journey also ranks
  #1 for …") instead of fabricating alternatives. The full comparison table always shows every
  distinct itinerary.
- Journeys arriving after the required time are never recommended: they appear under late
  alternatives and are labelled late.
- Prototype limit: at most one bus change per journey (documented in the UI).

### Reliability (docs/09)

`score = clamp(100 − Σ penalties, 0, 100)` with the documented penalty caps (delay 25, event 20,
transfer waiting 15, connection buffer 15, bus availability 15, transfer count 10). The exact
required disclaimer is displayed wherever a score appears:

> Illustrative prototype reliability score. Not a statistically validated probability.

### Maps (docs/10)

Leaflet + OpenStreetMap tiles render stop markers, bus-leg lines, walking segments, transfers and
predicted-event markers. `tileerror` (or offline) switches to a local SVG schematic; a manual
toggle is always available. Bus lines connect stop points and walking lines are straight-line
approximations — both are labelled as schematic, never presented as road geometry or walking
directions.

### Disruption reporting (docs/06)

A submission validates route/bus/stop references, creates a reference ID (`RPT-YYYYMMDD-NNN`),
records the timestamp, saves status `UNVERIFIED`, and publishes to the shared store. It never marks
a bus unavailable, never confirms an incident and never allocates a replacement. Student reports
and travel submissions are tagged with a labelled demo session (`student-demo-01`); no personal
data is collected.

### Shared-state integration

- Canonical types: `src/domain/types` mirror `docs/13`.
- Seed data: `src/data/seed` (R101–R104, 7 buses, 13 stops, 5 villages, 4 destinations, one festival
  event, demand seed 145/90/185 = 420 students and 350 seats, shortage 70), validated at startup
  (`src/data/validation.ts`).
- Store: React Context + reducer (`src/state`), persisted under the versioned key
  `safar-state-v1`; malformed or incompatible saved state is replaced with seed data and a
  non-blocking notice.
- Implemented actions: `SUBMIT_DISRUPTION_REPORT`, `SUBMIT_TRAVEL_REQUEST`, `RESET_SCENARIO`,
  `HYDRATE`. Authority actions extend the same union (they are not duplicated here).
- Reads from other modules: `incidents`, `replacementRecommendations`, `eventRouteImpacts`, `alerts`.
  When those records change, the planner and the alerts feed recalculate automatically.
- Additive optional field on `DisruptionReport`: `submittedBySessionId` so the demo session can
  show "my reports". Recommend keeping it in the shared model (Member 1 coordination point).

### Files another member will want to reuse

- `src/domain/calculations/journeyPlanner.ts` — `generateJourneyOptions` (shared journey service).
- `src/domain/calculations/reliability.ts` — `calculateJourneyReliability`.
- `src/domain/services/studentActions.ts` — report/travel-request validation and creation.
- `src/features/student/alerts.ts` — `buildStudentAlerts` (state-derived student feed).
- `src/features/journeys/mapLayout.ts` — map plan + schematic projection (pure, testable).

## Emergency intelligence

`RUN EMERGENCY SCENARIO` on `/control-centre` applies four conditions simultaneously — two bus
breakdowns, exactly +40% demand, a flooded road and examinations within two hours — and then
recalculates everything from the modified state:

- **Allocation engine** (`src/domain/emergency/allocation.ts`): excludes unavailable buses, builds
  seat blocks from documented route seats and relief-bus capacity, orders groups by examination
  priority → deadline → breakdown → flood exposure → standard demand, respects capacity, assigns the
  best compatible route, calculates replacement pickups and walking legs, and reports every unserved
  group with a reason. Every assignment carries an explanation generated from those numbers.
- **Road intelligence** (`src/domain/emergency/roads.ts`): maps routes to the simulated road network
  and finds detours with a shortest-path search that can never traverse a closed road
  (R102/R103/R104 detour at +3.2 km / +7 min). The journey planner also adds that detour time to
  affected routes during an active emergency.
- **Scenario and comparison** (`src/domain/emergency/scenario.ts`): stores only scenario inputs, so
  allocations are recomputed rather than persisted and repeat runs cannot duplicate students. The
  before/after table is produced by running the same allocator over a restored "before" model.
- **Advance prediction** (`src/domain/emergency/eventPrediction.ts`): predicts roughly a day ahead and
  labels every item as verified, student-reported, AI-generated, simulated or historical.
- **State actions**: `RUN_EMERGENCY_SCENARIO` and `RESET_EMERGENCY_SCENARIO` extend the existing
  reducer. Reset restores the seed fleet and clears emergency alerts while keeping student data.

Scenario figures on the demo network: 420 baseline + 168 surge = 588 students, 324 seats after the
two breakdowns (documented seats + relief buses), 63/63 examination students seated, 196 students on
relief buses, 18 on alternative pickups, 264 unserved with reasons.

## Tests performed

`npm run test` → **75 passed** across:

- `tests/seed.test.ts` — referential integrity, R101–R104, KA-21-AB-102 on R101, 420/350/70 demand,
  chronology, fresh object graph per reset.
- `tests/journeyPlanner.test.ts` — Vittal→PGC before 09:00, three categories and their rankings,
  duplicate-winner honesty, chronological segments, labelled walking estimates, late handling,
  different origins, walk-only trip, unavailable-bus exclusion, confirmed-incident delay,
  predicted event warning, no-route honesty.
- `tests/reliability.test.ts` — bounds, penalty caps, buffer behaviour, exact disclaimer.
- `tests/studentActions.test.ts` — UNVERIFIED creation, fleet/incident untouched, validation rules.
- `tests/studentAlerts.test.ts` — report/incident/replacement/event/recommendation-change alerts,
  session isolation, uniqueness and ordering.
- `tests/mapLayout.test.ts` — markers, bus/walk paths, event marker, schematic bounds.
- `tests/emergencyEngine.test.ts` — the 14 required emergency tests: simultaneous breakdowns, exact
  +40% demand, valid flooded-road alternatives, no alternative containing the blocked road,
  examination priority, capacity limits, no assignment to unavailable buses, no duplicate
  assignments, walking distances from real stop coordinates, unserved identification, calculated
  before/after values, reset, repeatability and continued operation of existing SAFAR features.

Also executed: `npm run typecheck` (clean) and `npm run build` (succeeds; bundle-size warning only).

## Known limitations

- No authentication; a single labelled demo session represents the student (documented in the UI).
- LocalStorage is a single-browser demo store, not a multi-user database.
- At most one transfer per journey; no multi-day or overnight planning.
- Walking distances are approximations (straight-line × 1.35 at 4.8 km/h), never road-routed.
- Delay from a confirmed incident uses a documented prototype severity→minutes conversion.
- Seed event-route impact records are demo values; recalculation belongs to Member 3. The Student
  Portal only reads them, and the UI labels them as predicted, not verified.
- The emergency allocation is a deterministic greedy pass over priority tiers, not a proven optimal
  solution.
- Route seat supply uses documented planning figures (which can exceed one bus's physical seats);
  relief buses use real capacity. Both are labelled in the Control Centre.
- Other authority workflows (report review, incident confirmation, replacement approval) remain
  unimplemented by design, so reports stay UNVERIFIED and no incident is created outside the
  simulated emergency.
- Map tiles need network access; without them the schematic fallback is used (verified in code and
  unit tests, not visually in a browser).
- End-to-end integration with the other three modules cannot be claimed until Member 1's foundation
  branch exists and the combined application is tested.

## Branch and delivery

Working branch: `feature/emergency-intelligence-engine`, based on `feature/student-portal`.
No secrets are stored in the repo, and no external service or API key is required.
