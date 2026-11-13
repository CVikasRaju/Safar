# MASTER BUILD PROMPT — SAFAR

You are the lead product engineer, solution architect, UI/UX engineer, and test engineer for **SAFAR — AI-Powered Rural Student Transport Intelligence System**.

**Tagline:** Predict Disruptions. Protect Student Journeys. Connect Every Village.

Build the actual working application in the repository. Do not merely describe a solution, produce mockups, or stop after a static dashboard.

This prompt is tool-agnostic. You may be running in Cursor, Claude Code, Codex, Gemini, Windsurf, an IDE agent, or another coding environment. Do not assume Google AI Studio is required. Adapt commands and preview/deployment steps to the environment you actually have.

The complete supporting specification is in `docs/`. Read it before implementation. If a requirement appears inconsistent, follow `docs/00_REQUIREMENTS_AND_CONFLICT_RESOLUTION.md`.

---

## 1. Mission

Build a responsive full-stack web application that helps rural students plan journeys to educational institutions and helps transport authorities anticipate and respond to transportation disruptions.

SAFAR has two connected capabilities:

1. **Predictive intelligence:** anticipate possible disruption from regional events, road works, closures, schedules, and demand conditions before the disruption occurs.
2. **Immediate response intelligence:** respond to a bus that has not arrived, a confirmed breakdown, a cancellation, a road blockage, or insufficient capacity.

The application must coordinate a response rather than simply display information.

## 2. Non-negotiable product structure

Create two workspaces in one application:

### Student Portal
- Search journeys by origin village, destination, travel date, and required arrival time.
- Compare Fastest Route, Most Reliable Route, and Fewest Transfers.
- Inspect a chronological journey breakdown.
- See route/event/disruption alerts.
- Submit intended travel requirements for aggregated demand.
- Submit a `REPORT BUS NOT ARRIVED / DISRUPTION` report.
- See report status and approved operational updates.

### Government Control Centre
- View fleet and route status.
- Manage regional events and predicted impact.
- Review demand and capacity.
- Review student disruption reports.
- Verify, reject, or mark reports duplicate.
- Confirm an incident through a separate authority workflow.
- View affected journeys and passengers.
- Evaluate replacement buses and alternative journeys.
- Approve or reject replacement recommendations.
- Monitor alerts and operational recommendations.

Both workspaces must use the same shared application state. Government changes must propagate to the Student Portal through state updates, not DOM manipulation or hardcoded text.

## 3. Required technology direction

Use a maintainable stack compatible with the existing repository. If the repository is empty, prefer:

- React
- TypeScript
- Tailwind CSS
- Lucide React
- Recharts
- Leaflet with OpenStreetMap tiles
- A Node.js server-side runtime for optional AI calls
- Local TypeScript/JSON seed data
- LocalStorage persistence for the prototype

Do not add a separate Android application.

Do not expose AI API keys in browser code. The app must work without an AI provider and without external map tiles. If the repository already has a suitable equivalent stack, preserve it rather than rewriting everything without reason.

## 4. Required design

Create a premium, professional rural transportation command centre.

Visual direction:
- Deep navy, charcoal, slate.
- Restrained cyan accents.
- Emerald for successful operations.
- Amber for warnings.
- Red for critical disruptions.
- Clear typography, compact information-dense cards, readable tables, subtle borders, consistent spacing.
- Responsive desktop, tablet, and mobile layouts.

Avoid generic AI dashboard templates, excessive gradients, giant empty cards, decorative animations, and nonfunctional controls.

Provide a persistent navigation system with SAFAR branding, workspace switching, active-page indicators, and a visible demo-data label.

## 5. Core journey planner

Inputs:
- Origin village.
- Destination.
- Travel date.
- Required arrival time.

Generate feasible journey candidates from the actual demo route, stop, bus, and timetable data. Rank candidates independently:

- Fastest Route: minimum total elapsed journey time.
- Most Reliable Route: highest calculated illustrative reliability score.
- Fewest Transfers: minimum bus changes.

Do not fabricate three different routes if the data does not support them. The same journey may rank first in more than one category.

Each result must show:
- Bus registration/service.
- Boarding and dropping stops.
- Intermediate stops.
- Scheduled departure and expected arrival.
- Walking to first stop.
- Walking between transfers.
- Walking from final stop to destination.
- Waiting time.
- Transfer count.
- Total duration.
- Estimated delay.
- Reliability score and its disclaimer.
- Disruption warnings.
- Whether the required arrival time is met.

Selecting a result must show a chronological segment breakdown and a map or honest schematic fallback. Never label straight-line distance as walking distance. See `docs/04_JOURNEY_PLANNER.md`.

## 6. Predictive event intelligence

Support:
- Temple festivals.
- Religious processions.
- Village fairs.
- Weekly markets.
- National/state examinations.
- Sports events.
- Public gatherings.
- Political rallies.
- Celebrations.
- Construction and road closures.
- Custom events.

Each event stores name, category, location, date, start/end time, crowd level, nearby villages, affected roads/routes, impact window, source, and verification status.

Implement deterministic event-impact calculation using crowd intensity, route proximity, time overlap, route importance, and duration. Historical information is optional and must only be used if actual data exists.

Show Low, Moderate, High, or Critical risk with an explanation. Generate advance warnings before an event begins when its configured impact window overlaps future journeys. Distinguish predicted congestion from verified road closure or live traffic.

Event create/edit/delete must update affected routes, journeys, dashboard indicators, and student alerts.

## 7. Immediate disruption reporting and response — core feature

### Student report workflow

The Student Portal must show a visible action:

`REPORT BUS NOT ARRIVED / DISRUPTION`

Form fields:
- Route number.
- Expected bus number.
- Bus stop.
- Expected arrival time.
- Report type.
- Optional description.

On submission:
1. Validate the report.
2. Save it in shared state.
3. Assign a unique report ID and submission time.
4. Set status to `UNVERIFIED`.
5. Show `UNVERIFIED STUDENT REPORT` in the Student Portal and authority queue.
6. Do not mark the bus unavailable.
7. Do not create a confirmed breakdown.
8. Do not allocate a replacement bus.

### Authority review workflow

Authorities can:
- Verify report.
- Reject report.
- Mark as duplicate.

A verified report is still not automatically a confirmed breakdown. Verification means the report is credible enough for operational review. The authority must separately choose to confirm an incident or close it with a reason.

### Authority incident confirmation

Provide a separate action:

`REPORT / CONFIRM BUS BREAKDOWN`

Fields:
- Bus registration.
- Current route.
- Location or affected stop.
- Breakdown time.
- Severity.
- Expected repair status.
- Description.

On confirmation:
1. Validate the selected bus and incident.
2. Create an active disruption record.
3. Mark the affected bus unavailable.
4. Identify affected routes, services, journeys, and estimated affected passengers.
5. Recalculate journeys and reliability.
6. Evaluate replacement buses.
7. Compare replacement response with alternative journeys.
8. Publish student-facing alerts.
9. Require human approval before allocating a replacement.

Support bus not arrived, cancellation, mechanical failure, driver-reported issue, road blockage, route diversion, and capacity shortage as incident/report categories. A report type alone does not prove the incident.

## 8. Alternative response options

When a replacement is delayed or unavailable, evaluate feasible alternatives using actual timetable/network data:
- Wait for replacement.
- Board another eligible bus at a nearby stop.
- Walk to another boarding point if a valid walking estimate exists.
- Transfer to another route.
- Use another feasible connection.

Show additional walking, waiting, expected arrival, and required-arrival status. If no feasible option exists, say so and alert the authority. Never invent a solution.

All replacement response times and ETAs are illustrative estimates in the prototype.

## 9. Fleet and replacement optimisation

Maintain at least five buses. Each bus has registration, assigned route, capacity, occupied seats, derived remaining seats, status, location/last-known demo location, estimated response time, and availability.

Statuses:
- Operating
- Available
- Unavailable
- Maintenance
- Replacement Assigned

Support a breakdown simulation selecting an Operating bus. Mark it Unavailable, identify affected journeys, and rank eligible replacement candidates.

Use these illustrative weights:
- Capacity: 35%.
- Route compatibility: 30%.
- Response time: 25%.
- Operational availability: 10%.

Exclude unavailable, maintenance, failed, already committed, or otherwise ineligible buses. Explain component scores. If capacity is insufficient, show the shortage and consider multiple buses or partial coverage only when the calculation supports it.

Show recommended bus, registration, remaining seats, compatibility, estimated response time, suitability score, and explanation.

Actions:
- Approve Replacement.
- Reject Recommendation.
- Reset Scenario.

Only approval changes fleet allocation. On approval, update the bus assignment/status, affected route, journeys, reliability, alerts, and student-facing information. Revalidate eligibility immediately before approval to prevent stale or double allocation.

## 10. Student demand and capacity

Use the exact illustrative initial values:

| Route | Expected students | Available seats |
|---|---:|---:|
| R101 | 145 | 100 |
| R102 | 90 | 110 |
| R103 | 185 | 140 |
| Total | 420 | 350 |

Initial potential shortage = 70.

Display expected demand, available/occupied/remaining seats, shortages, overcrowding risk, and route-, village-, destination-, and time-based aggregates.

Allow students to submit intended travel requirements. Aggregate these for authority analytics and minimise personal data exposure.

Use transparent estimates based on available factors such as passenger counts, weekday, college/exam schedules, holidays, events, and submitted demand. Do not claim a trained ML model unless one has genuinely been trained and evaluated. Do not count one student's journey multiple times across candidate routes.

## 11. Journey reliability

Calculate a deterministic illustrative score from 0–100 using delay, event impact, transfer waiting, connection buffer, bus availability, transfer count, and active disruptions. Define normalisation and avoid double-counting the same delay.

Display this exact disclaimer wherever the score appears:

`Illustrative prototype reliability score. Not a statistically validated probability.`

The score must recalculate when events, incidents, fleet assignments, routes, or timetables change.

## 12. Maps and dataset consistency

Use illustrative locations around Puttur, Karnataka:
- Puttur
- Sullia
- Uppinangady
- Kadaba
- Vittal

Include:
- At least three destinations, including Puttur Government College.
- At least four routes: R101, R102, R103, and R104. R104 is required because the central scenario names it.
- At least five buses.
- At least ten stops.
- Timetable data.
- Demand data.
- One event.
- Breakdown scenario bus `KA-21-AB-102` assigned to R101 initially.

Every route, stop, bus, timetable, and scenario reference must resolve to a real record in the seed data. Use stable IDs and validation.

All operations, schedules, events, passenger counts, and locations are illustrative unless verified. Do not invent road geometry or real walking paths. Use a schematic map if route geometry is unavailable. Map tile failure must not break the application.

## 13. Central repeatable demonstration

Provide:
- `RUN SAFAR LIVE SCENARIO`
- `RESET SCENARIO`
- A separate immediate-breakdown demo that does not require running the festival scenario first.

Central sequence:
1. Student from a demo village needs to reach Puttur Government College before 9 AM.
2. A major festival is scheduled near Town B tomorrow (use a configurable scenario date, not a hardcoded assumption about the real current date).
3. Identify R101 and R104 as affected only if the seeded event-route relationship says so.
4. Predict impact before the event starts.
5. Recommend earlier departure or a feasible alternative.
6. Bus KA-21-AB-102 on R101 breaks down.
7. Identify affected journeys and estimated affected students.
8. Evaluate and rank eligible replacements.
9. Authority approves a replacement.
10. Update Student Portal, bus allocation, route status, alerts, journey recommendations, and reliability.
11. Show an operations summary with affected students/routes, event impact, replacement bus, illustrative response time, additional capacity, alternative journey, and updated reliability.

The scenario must be repeatable and resettable. Do not hardcode it inside UI components; use scenario actions and reusable domain functions.

## 14. Adaptability

Allow the judge/operator to change:
- Event location/date/duration/crowd level.
- Affected route.
- Breakdown bus.
- Student demand.
- Required arrival time.
- Bus availability.
- Road closure.
- Incident type and affected stop.

Support multiple simultaneous disruptions without corrupting state. New test cases must use the same reusable functions as the central demo.

## 15. AI integration

Use an AI provider adapter. Gemini may be the first provider, but the app must not be locked to Google AI Studio.

AI tasks:
- Parse natural-language event announcements into proposed structured event fields.
- Explain calculated event/route impact.
- Summarise government dashboard insights.
- Explain a deterministic replacement recommendation.
- Summarise a verified incident.

AI must not decide bus eligibility, calculate timetable feasibility, alter replacement rankings, invent missing facts, or automatically confirm incidents.

Require human review before saving extracted event details or applying operational changes. Use deterministic fallback when AI is unavailable. Keep provider calls server-side and validate outputs.

## 16. Architecture and code quality

Separate:
- UI components/pages/layouts.
- Domain types.
- Seed/demo data.
- Pure calculation functions.
- Shared state/store.
- Persistence adapter.
- Map adapter.
- AI provider adapter.
- Server routes/services.
- Tests.

Required domain functions:
- `generateJourneyOptions`
- `calculateJourneyReliability`
- `calculateEventImpact`
- `identifyAffectedRoutes`
- `calculateStudentDemand`
- `rankReplacementBuses`
- `updateFleetAllocation`
- `processDisruptionReport`
- `verifyDisruption`
- `generateRecommendationExplanation`

Keep business logic out of React components. Use typed inputs/outputs and unit-testable pure functions.

## 17. Persistence and reset

Persist prototype state in LocalStorage using a versioned key. Validate stored state on load. Handle malformed/old data by safely restoring seed data and showing a non-blocking message.

Reset must restore the original demo dataset, bus statuses/assignments, events, demand, reports, incidents, alerts, and scenario state. Use immutable seed data and clone it for each run.

## 18. Security and trust

- No secrets in frontend.
- Validate and sanitise user inputs.
- Avoid storing unnecessary student personal information.
- Aggregate demand for authority charts.
- Show provenance labels: Demo, Simulated, User-entered, Calculated, AI-generated, Verified.
- Only use Verified when actually verified.
- Do not expose sensitive student details in public dashboards.
- Confirm authority actions before state mutation.

## 19. Required build sequence

Build and test in this order:
1. Inspect repository and report its current stack.
2. Create application shell, routing/navigation, workspaces, shared state, seed data, persistence.
3. Implement journey planner and detailed journey results.
4. Implement student disruption reporting and authority review.
5. Implement incident confirmation and immediate response.
6. Implement fleet ranking and approval.
7. Implement event intelligence and advance warnings.
8. Implement demand/capacity analytics.
9. Implement reliability recalculation and alternative journeys.
10. Implement central and isolated demo scenarios.
11. Add AI adapter and fallback.
12. Run tests, fix defects, verify responsive behaviour and build.

At every phase, run the app and test the completed flow before proceeding. Do not build all screens as static placeholders and wire them at the end.

## 20. Completion gate

Do not claim completion until:
- App runs without major console/build errors.
- Every navigation item and primary action works.
- Student report remains unverified until reviewed.
- Authority confirmation creates an incident.
- Breakdown updates fleet and affected journeys.
- Replacement approval updates both workspaces.
- Rejection does not allocate a bus.
- No eligible replacement produces an honest no-solution state.
- Event changes recalculate route impact.
- Demand totals match the seed values.
- Journey calculations respect timetable chronology and arrival deadline.
- LocalStorage survives refresh.
- Reset restores exact initial state.
- AI-off and map-off fallbacks work.
- Tests pass and limitations are documented.

Start by inspecting the repository. Then implement the real application. Ask a question only if a genuinely blocking ambiguity cannot be resolved from this specification. Do not silently omit a required feature.
