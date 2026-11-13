# SAFAR — Agent 3 (Backend) Prompt & Iteration Log

> Truthful log of the actual work in this workspace. `docs/` was read and left unmodified.

## Environment

- Coding agent: Buffy (Freebuff)
- Workspace: `D:/Freebuff/Safar` on Windows (bash)
- Repository state at start: **no code, no `.git`, no remote configured**; only `docs/`, `docs.zip`, empty `Prompt.md`.
- Node v24.14.1, npm 11.11.0
- Framework: none existing. Added a minimal TypeScript + Vitest module (`package.json`, `tsconfig.json`, `vitest.config.ts`) so the backend could be built and tested independently.
- Team assignment: Agent 3 — backend, seed data, transportation calculations, shared state, persistence, tests. No frontend/UI built.

## Actual prompt used (summary)

Full pasted team rules + Agent 3 brief: implement the local-first backend for SAFAR using the documentation as source of truth; seed dataset with five villages, three destinations, R101–R104, at least ten stops/five buses, demand 420/350/70, `KA-21-AB-102` on R101, repeatable breakdown; journey planning, reliability, event impact, demand/capacity, breakdown replacement ranking/approval, disruption report/incident workflow, shared state + `safar-state-v1` persistence, tests, and integration contracts. Do not build other members' UI.

## Iteration 0 — Repository inspection

- Read every Markdown file in `docs/` (21 files + master prompt + prompt log template).
- Found no application code, package manager files or git metadata. No existing components to preserve or duplicate.
- Constraint: cannot verify browser/UI behaviour or create a PR; foundation is Member 1's responsibility.
- Decision: implement a framework-agnostic TypeScript domain/service layer with Vitest, exposing typed services that a React foundation can consume.

## Iteration 1 — Types, seed and validation

- Created canonical types (`SafarState`, network, fleet, events, reports/incidents, recommendations, journeys, alerts/audit/scenario, `ServiceResult`).
- Created immutable seed: 5 villages, 3 destinations, 12 stops, 4 routes, 20 timetable services, 8 buses, demand seed, festival event, explicit interchange walking links.
- Retained exact required totals: R101 145/100, R102 90/110, R103 185/140 = 420/350, shortage 70. R104 has `0/0` baseline by design so totals remain exact; documented in the seed and contract.
- Added referential/temporal seed validation and state validation for persistence.
- Result: `npx tsc --noEmit` passed after fixing literal-union assignment errors.

## Iteration 2 — Calculation engines

- Journey generation from service stop sequences, up to one transfer, explicit transfer buffer (5 min + interchange walk), late-alternative window, walking labels, no-route reason, independent fastest/reliable/fewest-transfer rankings.
- Reliability model: documented caps (25/20/15/15/15/10/0), event delay kept separate from incident delay to avoid double counting; exact disclaimer constant.
- Event impact: documented weights (25/25/20/15/15), renormalisation over available factors, risk bands, documented delay conversion (score × 20 min), explicit association precedence.
- Demand: single-route allocation to prevent double counting; aggregate shortage computed from totals (70) while route deficits/surplus remain visible.
- Replacement: eligibility before scoring; failed/unavailable/maintenance/committed buses excluded; partial coverage and combined suggestion; recommendation is not allocation.
- Fleet allocation and incident/report state machinery added with audit + alerts.

## Iteration 3 — Services, shared state, persistence

- Added `dataService`, `journeyService`, `reliabilityService`, `eventService`, `demandService`, `disruptionService`, `fleetService`, `replacementService`, `scenarioService`, `persistenceService`.
- Added `getInitialState`, `SafarAction`/`applyAction`/`safarReducer`, versioned LocalStorage adapter (`safar-state-v1`), malformed-data recovery and exact reset.
- Central scenario: event → predicted impact → simulated student request → simulated `KA-21-AB-102` breakdown → recalculated alternatives → PENDING recommendation; approval is a separate action. Isolated breakdown scenario also supported.

## Iteration 4 — First typecheck/test failures and fixes

Actual failures observed:

1. `tsc` errors:
   - `INCIDENT_ROUTE_DELAY_MINUTES[...]` produced a literal-union type incompatible with `Math.min` → annotated `minutes: number`.
   - Reliability reduce over `(1 | 0 | 0.5)[]` → annotated `number[]`.
   - `journeyService` imported a non-existent `AffectedJourney` type from the journey calculation module → removed.
   - Scenario summary call passed a breakpoint-only input type → passed `{}`.
2. First test run: 58 passed, 4 failed:
   - Scenario summary listed R102/R103 as event-affected because it read every stored impact. Fixed by publishing only explicitly associated routes in canonical `eventImpacts` and scoping the summary.
   - Scenario demand expectation was wrong because `runScenario` adds one simulated student request. Corrected the test to the real value (421 expected/415 available/6 shortage after approval) rather than changing behaviour.
   - Test asserted object identity for the three ranking categories; replaced with criterion-based assertions (fastest duration, highest reliability, fewest transfers), which matches the spec that one journey may win multiple categories.
   - Test referenced `recommendation.explanation`, which belongs to the generation result, not the entity; switched to `generateRecommendationExplanation`.
3. Also fixed a demand note-filtering bug that silently dropped approved-replacement capacity notes.

## Final verification (actual commands)

```
npx tsc --noEmit
# exit 0, no output

npm test
# Test Files  8 passed (8)
# Tests       63 passed (63)
```

Test coverage includes every required acceptance item: initial demand/seat/shortage totals, referential validity, timetable chronology, arrival deadline, transfer buffer, reliability bounds/disclaimer, event impact/risk/renormalisation, event CRUD recalculation, unverified reports, verification ≠ confirmation, confirmed breakdown marks bus unavailable, eligibility exclusions, partial capacity, no-feasible replacement, recommendation ≠ allocation, approval updates fleet and demand, rejection allocates nothing, stale revalidation, scenario propagation, repeatability, reset exactness, persistence corruption/version mismatch.

## Known limitations (also in `INTEGRATION_CONTRACT.md`)

- No UI/app shell, navigation, map, or browser E2E run — those belong to other members; no browser test was executed.
- No AI provider endpoint; deterministic explanations only.
- Maximum one transfer; same-day journeys only.
- Walking times are illustrative; not routed distances.
- LocalStorage is single-browser/demo-only.
- Git branch/commit/push/PR could not be performed because this workspace has no `.git` or remote.

## Files changed

`package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`,
`src/domain/*`, `src/domain/calculations/*`, `src/data/seed.ts`, `src/state/*`, `src/services/*`,
`tests/*`, `INTEGRATION_CONTRACT.md`, `PROMPT_LOG.md`.
