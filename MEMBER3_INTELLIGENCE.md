# Member 3 — Intelligence Module Notes

Branch: `feature/intelligence`

This branch implements the regional event, disruption-incident, demand and
reliability intelligence for SAFAR. It builds on the shared architecture in
`src/domain/types`, `src/data/seed` and `src/state/store.tsx`; it does not
change any shared type or add a new state action.

## Implemented

### 1. Regional event intelligence
- Page: `src/pages/government/EventIntelligence.tsx`
- Full CRUD with validation, edit/delete confirmation, recalculation.
- Categories, crowd intensity, location, date, start/end, nearby villages,
  affected roads, affected routes, preparation buffer, description, source,
  provenance and verification status.
- Impacts are derived canonical data and are now calculated at seed time
  (`src/data/seed/index.ts`) so dashboards are consistent on first load.
- Impact window is only advanced when the event record supplies a buffer; the
  buffer source is displayed. Estimated proximity is labelled and never saved
  automatically.

### 2. Event impact calculation
- `src/domain/calculations/eventImpact.ts`
- Deterministic weighted score 0–100: crowd 25%, proximity 25%, time overlap
  20%, route importance 15%, duration 15%. Missing inputs are removed,
  weights renormalised, and the omission disclosed in the explanation.
- Time overlap uses the route's actual timetable service span, not a hardcoded
  morning window. Proximity uses an explicit association first, otherwise a
  labelled straight-line estimate.
- Risk bands: 0–24 Low, 25–49 Moderate, 50–74 High, 75–100 Critical.
- Delay is a documented illustrative 0–45 min conversion, not a forecast.
- Exports `explainEventImpact`, `identifyAffectedRoutes`,
  `getRelevantEventImpacts`, `eventImpactWindow`.

### 3. Disruption reports and incident verification
- Pages: `src/pages/government/DisruptionReports.tsx`
- Student reports remain `UNVERIFIED` until reviewed. Verify/reject/duplicate
  are review outcomes only; a separate two-step `CONFIRM INCIDENT` action creates
  the operational incident.
- Validation (`validateReportInput`, `validateIncidentConfirmation`) prevents
  linking unverified reports, requires a bus for breakdowns, validates route
  stops and requires at least a route or bus.
- Confirmation publishes an alert, links reviewed reports, marks a bus
  unavailable only for confirmed bus failures, and generates the shared
  replacement recommendation record (ranking UI remains Member 4's).
- Audit entries are written for report review, incident confirmation, incident
  closure and event changes.

### 4. Demand and capacity analytics
- Page: `src/pages/government/DemandAnalytics.tsx`
- Combined analysis in `src/domain/calculations/demand.ts`.
- Documented seed totals are preserved: 420 expected / 350 seats / 70 network
  shortage (baseline check shown on the page).
- Travel intent is allocated once per submission to a seeded route serving both
  ends (fewest stops, then route id). Unmatched intent is reported as
  unallocated, never silently added. Only aggregates are shown.
- Route, village and required-arrival-window demand charts; occupancy,
  remaining seats, shortage and overcrowding indicators.

### 5. Reliability and delay
- Pages: `src/pages/government/ReliabilityDashboard.tsx`
- `src/domain/calculations/reliability.ts`
- Penalty caps: delay 25, event 20, transfer waiting 15, connection buffer 15,
  bus availability 15, transfers 10; score = clamp(100 − penalties, 0, 100).
- Fixed the scaffold's service-id → route-id mapping (`T101A` → `R101`), which
  previously prevented event and fleet factors from applying to journeys.
- Event-attributable delay is excluded from the delay penalty to avoid double
  counting; only the strongest corridor event is penalised.
- Route-level and journey-level scores, recommended departures, alternatives,
  risk factors and the exact required disclaimer are displayed.
- Reliability is derived from shared state on every render, so event, incident
  and fleet changes update it.

### 6. Intelligence dashboard
- Page: `src/pages/government/IntelligenceDashboard.tsx`
- Event impact by route, demand vs capacity, route reliability, active
  incidents, routes requiring attention and upcoming events.
- Shared chart wrappers: `src/components/charts/index.tsx`.
- Shared status atoms/labels: `src/components/intelligence/`.

## Shared interfaces used (no changes to types)
`SafarEvent`, `EventRouteImpact`, `DisruptionReport`, `Incident`, `Bus`,
`RouteDemand`, `JourneyOption`, `Alert`, `AppState`, and existing actions
`ADD_EVENT`, `UPDATE_EVENT`, `DELETE_EVENT`, `RECALCULATE_EVENT_IMPACTS`,
`SUBMIT_DISRUPTION_REPORT`, `VERIFY_REPORT`, `REJECT_REPORT`,
`MARK_REPORT_DUPLICATE`, `CONFIRM_INCIDENT`, `CLOSE_INCIDENT`, `RESET_SCENARIO`.

Member 2 integration: `SUBMIT_DISRUPTION_REPORT` is the reporting contract; the
authority queue reads the same records. Travel intent arrives through
`SUBMIT_TRAVEL_REQUEST` and is aggregated here.

Member 4 integration: confirmed incidents and replacement recommendation records
are produced here; ranking/allocation/approval UI and fleet status screens remain
Member 4's. `calculateRouteReliability` reads fleet status directly.

## Verification actually run
- `npx tsc --noEmit` — passed.
- `npx vitest run` — 4 files, 44 tests passed.
- `npm run build` — passed (Vite production build).
- Dev server `http://127.0.0.1:5173` — Intelligence, Event Intelligence, Demand
  Analytics, Reliability and Disruption Reports pages loaded; no console errors.

## Known limitations / unfinished
- The portal and fleet pages on this branch are clearly labelled placeholders
  because those modules belong to other members and are not yet merged.
- Authority views have no authentication; role labels are demo only.
- LocalStorage is single-browser demo persistence, not a multi-user database.
- Impact/demand/reliability values are illustrative prototype calculations, not
  validated forecasts, live GPS, official traffic data or trained ML.
- The authority confirmation form was verified through reducer/domain tests, not
  through a browser end-to-end flow, because the student report form (Member 2)
  is not present on this branch.
- Responsive behaviour was not visually inspected at tablet/mobile widths; the
  new intelligence pages use single-column fallbacks but this was not screenshotted.
