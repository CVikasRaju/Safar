# SAFAR — Complete Build Package

**AI-Powered Rural Student Transport Intelligence System**  
**Tagline:** Predict Disruptions. Protect Student Journeys. Connect Every Village.

## What this package is

This package consolidates the original SAFAR brief and the updated brief into one consistent, implementation-ready specification. The updated brief is authoritative where it adds requirements. The earlier brief remains included wherever compatible.

SAFAR is a responsive full-stack web application with two connected workspaces:

1. **Student Portal** — journey planning, travel-demand submission, disruption reporting, and live-in-demo alerts.
2. **Government Control Centre** — fleet operations, event intelligence, demand/capacity analytics, report verification, disruption confirmation, replacement decisions, and route monitoring.

This is a functional competition prototype, not a claim of a live government transport network.

## Start here

1. Read `MASTER_BUILD_PROMPT.md` completely.
2. Read `docs/00_REQUIREMENTS_AND_CONFLICT_RESOLUTION.md`.
3. Give the master prompt and the entire `docs/` folder to your coding agent.
4. Ask the agent to inspect the existing repository before changing it.
5. Build in the order in `docs/18_IMPLEMENTATION_ROADMAP.md`.
6. Use `PROMPT_LOG.md` to record real prompts, bugs, fixes, and test outcomes.

## Files

- `MASTER_BUILD_PROMPT.md` — complete, tool-agnostic instruction to the coding agent.
- `PROMPT_LOG.md` — honest development and iteration log template.
- `docs/00_REQUIREMENTS_AND_CONFLICT_RESOLUTION.md` — source-of-truth rules and decisions.
- `docs/01_PRODUCT_AND_SCOPE.md` — product definition and boundaries.
- `docs/02_ARCHITECTURE_AND_STACK.md` — architecture and technology guidance.
- `docs/03_ROLES_AND_WORKSPACES.md` — student and authority workspace requirements.
- `docs/04_JOURNEY_PLANNER.md` — journey search and recommendations.
- `docs/05_EVENT_INTELLIGENCE.md` — predictive event and traffic impact.
- `docs/06_IMMEDIATE_DISRUPTION_RESPONSE.md` — student reports and immediate incident response.
- `docs/07_FLEET_AND_REPLACEMENT.md` — fleet, breakdown, replacement ranking and approval.
- `docs/08_DEMAND_AND_CAPACITY.md` — demand estimation and seat analytics.
- `docs/09_RELIABILITY_AND_DELAY.md` — transparent illustrative reliability model.
- `docs/10_MAPS_AND_DEMO_DATA.md` — coherent Puttur-region demonstration dataset rules.
- `docs/11_SHARED_STATE_AND_PERSISTENCE.md` — shared state, events, and LocalStorage.
- `docs/12_AI_INTEGRATION.md` — safe optional LLM/Gemini integration.
- `docs/13_DATA_MODELS_AND_API.md` — canonical entities and service boundaries.
- `docs/14_UI_UX_AND_ACCESSIBILITY.md` — interface and interaction rules.
- `docs/15_SCENARIOS_AND_DEMO_SCRIPT.md` — repeatable end-to-end demo.
- `docs/16_SECURITY_PRIVACY_AND_TRUST.md` — privacy, secrets, and provenance.
- `docs/17_TEST_PLAN_AND_ACCEPTANCE.md` — tests and completion criteria.
- `docs/18_IMPLEMENTATION_ROADMAP.md` — build sequence and time priorities.
- `docs/19_AGENT_WORKFLOW_AND_PORTABILITY.md` — using different AI coding agents.
- `docs/20_DEPLOYMENT_AND_ENVIRONMENT.md` — run, configure, and deploy guidance.

## Important truthfulness rules

- All supplied route, bus, timetable, event, capacity, demand, and response-time values are illustrative unless independently verified.
- Never claim live GPS, official schedules, actual traffic feeds, or trained ML predictions unless actually integrated and validated.
- A map tile layer is not a routing engine. Do not present straight-line distance as walking distance.
- A student report is unverified until an authority reviews it.
- A replacement recommendation does not change fleet allocation until approved.
- If no feasible route or replacement exists, show that honestly.

## Definition of done

SAFAR is not complete when the dashboard looks attractive. It is complete when a student can search a journey and submit a disruption report; an authority can review and verify that report, confirm an incident, see affected journeys, evaluate alternatives, approve a replacement, and see the Student Portal update from the same shared state. Reset must restore a clean, repeatable demo.
