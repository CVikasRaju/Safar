# SAFAR

**AI-Powered Rural Student Transport Intelligence System**

*Predict Disruptions. Protect Student Journeys. Connect Every Village.*

SAFAR is a local-first web prototype for rural student transport around Puttur, Karnataka. It gives students a journey planner, live disruption reporting and journey alerts, and gives transport authorities a control centre for fleet status, breakdown response, replacement buses, event prediction and emergency allocation.

The prototype runs entirely in the browser with a shared, persisted application state. There is no backend, database, login or external API, and no API keys are required.

> **Demo data notice:** every route, timetable, fare, demand figure, delay, reliability score, event and map position in this project is illustrative prototype data. Nothing here is live GPS, an official schedule, a validated traffic forecast or a trained-machine-learning prediction.

---

## What is implemented

### Student Portal

| Route | Screen | What it does |
|---|---|---|
| `/student` | Dashboard | Quick journey search, next planned journey, service status and latest alerts |
| `/student/planner` | Journey Planner | Search by origin, destination and required arrival time; three independently ranked journeys, comparison table, itinerary, map and reliability breakdown |
| `/student/submissions` | My Travel Plans | Submit an intended journey and review the plans submitted in this demo session |
| `/student/report` | Report a Disruption | Report a bus that did not arrive; creates a reference ID and an `UNVERIFIED` report |
| `/student/alerts` | Journey Alerts | Alerts derived from reports, incidents, replacements, events and reliability changes |

The planner produces **Fastest**, **Most Reliable** and **Fewest Transfers** options from the shared timetable. It validates stop order, service times, transfer buffers and arrival deadlines, excludes unavailable or maintenance buses, and supports at most one transfer. If the same journey wins several categories it says so rather than inventing alternatives, and journeys that arrive late are shown separately and never recommended.

### Government Control Centre

| Route | Screen | What it does |
|---|---|---|
| `/control-centre` | Fleet & Operations | Fleet metrics and status, bus details, simulated breakdowns, replacement recommendations, approval or rejection, and reset |
| `/control-centre/emergency` | Allocation & Routes | Emergency seat allocation, exam priority, alternative routes and detours, replacement pickups and walking legs, with an explanation for every assignment |
| `/control-centre/scenario` | Emergency Scenario | Runs the four-condition emergency and shows KPIs and a calculated before/after comparison |
| `/control-centre/prediction` | Event Prediction | Advance event predictions with provenance, lead time, affected network and alternatives |
| `/control-centre/integration` | Shared State & Logs | What each module publishes into shared state, plus the audit trail |

**Fleet and replacement.** A simulated breakdown marks the bus unavailable and generates a *recommendation*, never an allocation. Only eligible buses are ranked; the authority can approve a candidate, which records the assignment and increases route capacity, or reject it with a reason for the audit log. A recommendation is not an incident confirmation and a breakdown simulation is clearly labelled as a simulation.

**Emergency scenario.** `RUN EMERGENCY SCENARIO` applies four conditions at once: two bus breakdowns, an exact +40% demand surge, a flooded road, and examinations within two hours. The allocation engine excludes unavailable buses, seats examination students first, respects capacity, assigns alternative routes that never cross the closed road, computes replacement pickups and walking distances, and reports every unserved group with a reason. Reset restores the seed fleet and clears emergency alerts while keeping student submissions.

### Shared intelligence

- **Journey planning** works from the shared route, stop, timetable and bus records — not a separate mock list.
- **Reliability** is an illustrative 0–100 score: `clamp(100 − penalties, 0, 100)` with capped penalties for delay, event impact, transfer waiting, connection buffer, bus availability and transfer count. The required disclaimer is shown wherever a score appears:

  > Illustrative prototype reliability score. Not a statistically validated probability.

- **Event impact** combines crowd intensity, proximity, time overlap, route importance and duration, renormalises when an input is missing, and labels every estimate.
- **Demand and capacity** preserve the seeded baseline of **420 expected students / 350 seats / 70-seat network shortage** and allocate travel intent once per submission.
- **Maps** use Leaflet with OpenStreetMap tiles and fall back to a local schematic when tiles are unavailable. Bus lines and walking legs are labelled as schematic, not road geometry.

---

## Tech stack

- React 19 + TypeScript 5.9
- Vite 7
- React Router 7
- Tailwind CSS 4
- Leaflet / OpenStreetMap
- Recharts
- Lucide icons
- Vitest for domain and integration tests

---

## Run locally

Requires **Node.js 20+**.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check and production build
npm run preview    # preview the production build
npm run test       # run the Vitest suite once
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit
```

No `.env` file, API key or third-party account is needed.

---

## Demo walkthrough

1. **Plan a journey.** Open `/student/planner` and search from Vittal to Puttur Government College, arriving before 09:00. Compare the three ranked options, open the itinerary and map, and inspect the reliability factors.
2. **Report a problem.** Open `/student/report`, submit a "bus not arrived" report and note the reference ID and `UNVERIFIED` status. The report does not mark a bus unavailable or create an incident.
3. **Respond to a breakdown.** Open `/control-centre`, simulate a breakdown on R101 (for example `KA-21-AB-102`), review the ranked replacement recommendation, then approve or reject it. Approval updates the route's operational capacity and writes an audit entry.
4. **Run the emergency.** Open `/control-centre/scenario` and run the four-condition scenario. Inspect the allocation, detours and unserved groups on `/control-centre/emergency`, then reset.
5. **Check the prediction.** Open `/control-centre/prediction` to see predicted events, their provenance and affected network.
6. **Inspect shared state.** `/control-centre/integration` shows what the portal published and the audit history.

---

## Project structure

```text
src/
  components/     shared UI primitives
  data/           demo seed dataset and validation
  domain/         types, constants and calculation engines
    calculations/ journey planning, reliability, event impact, demand, replacement, allocation
    emergency/    emergency scenario, road detours, event prediction
  features/
    student/      dashboard, planner, submissions, reporting, alerts
    journeys/     planner UI, comparison, timeline, map
    control-centre/ emergency allocation, scenario and prediction pages
    fleet/        fleet operations and replacement approval UI
  layouts/        application shell and navigation
  state/          canonical state, reducer, context and LocalStorage persistence
tests/            domain and integration tests
docs/             product, design and acceptance specifications
```

State is persisted in the browser under the versioned key **`safar-state-v1`**. Malformed or incompatible saved state is replaced with the seed data and a non-blocking notice rather than crashing the app. Student and authority workspaces read and write the same canonical records, so a change in one workspace recalculates the other.

---

## Seeded demo network

- 5 villages and 4 destinations, including Puttur Government College
- Routes R101–R104, 13 stops and 7 buses
- `KA-21-AB-102` starts on R101
- Demand baseline: 145 / 100, 90 / 110 and 185 / 140 → **420 students, 350 seats, 70 shortage**
- One pre-seeded town festival event with derived route impacts
- A labelled demo student session; no personal data is collected

The seed is validated on load so routes, stops, services, buses and demand references stay consistent.

---

## Scope and limitations

This is a hackathon-style prototype, not a production transport system.

- No authentication, multi-user sync or server database. LocalStorage is a single-browser demo store.
- Student reports remain `UNVERIFIED` in this build; the authority review and incident-confirmation screens are future work, although the state actions exist.
- At most one transfer per journey; no multi-day or overnight planning.
- Walking distances and times are approximations, not routed directions.
- Reliability, demand, delay and event impacts are deterministic illustrative calculations, not statistical or ML forecasts.
- Predicted congestion is not a verified road closure.
- The emergency allocator is a deterministic priority-based pass, not a proven optimal solution.
- Map tiles require network access; the schematic fallback is used otherwise.
- No AI/LLM provider is called at runtime — explanations are generated deterministically from the data.

---

## Documentation

The `docs/` directory is the design source of truth for the full SAFAR concept, including modules that are planned but not present in this build.

| Document | Contents |
|---|---|
| [`docs/01_PRODUCT_AND_SCOPE.md`](docs/01_PRODUCT_AND_SCOPE.md) | Product scope and users |
| [`docs/02_ARCHITECTURE_AND_STACK.md`](docs/02_ARCHITECTURE_AND_STACK.md) | Architecture and stack |
| [`docs/04_JOURNEY_PLANNER.md`](docs/04_JOURNEY_PLANNER.md) | Journey planning rules |
| [`docs/06_IMMEDIATE_DISRUPTION_RESPONSE.md`](docs/06_IMMEDIATE_DISRUPTION_RESPONSE.md) | Reports, verification and incidents |
| [`docs/07_FLEET_AND_REPLACEMENT.md`](docs/07_FLEET_AND_REPLACEMENT.md) | Fleet and replacement rules |
| [`docs/09_RELIABILITY_AND_DELAY.md`](docs/09_RELIABILITY_AND_DELAY.md) | Reliability scoring |
| [`docs/11_SHARED_STATE_AND_PERSISTENCE.md`](docs/11_SHARED_STATE_AND_PERSISTENCE.md) | Shared state and persistence |
| [`docs/15_SCENARIOS_AND_DEMO_SCRIPT.md`](docs/15_SCENARIOS_AND_DEMO_SCRIPT.md) | Demo script |
| [`EMERGENCY_INTELLIGENCE.md`](EMERGENCY_INTELLIGENCE.md) | Emergency engine design and test matrix |

---

## Status

Student Portal, journey intelligence, disruption reporting, fleet operations, replacement workflow, emergency allocation and event prediction are implemented on `main`. Other workspaces and authority review screens described in `docs/` are not part of this build.
