# 17 — Test Plan and Acceptance Criteria

## Unit tests
Test:
- Journey chronology and transfer feasibility.
- Total duration and waiting time.
- Transfer count.
- Arrival deadline status.
- Event impact and risk bands.
- Event time overlap.
- Demand aggregation and initial totals.
- Seat shortage arithmetic.
- Replacement eligibility and weighted score.
- Reliability bounds and penalty normalisation.
- Report/incident status transitions.

## Required seed assertions
- Expected demand = 420.
- Available seats = 350.
- Potential shortage = 70.
- Routes R101/R102/R103/R104 exist.
- KA-21-AB-102 exists and is initially assigned to R101.
- At least five buses, ten stops, five villages, and three destinations exist.
- All IDs referenced by routes/timetables/scenarios resolve.

## Workflow integration tests
1. Student submits report -> report UNVERIFIED; bus remains unchanged.
2. Authority verifies report -> status VERIFIED; no incident unless separately confirmed.
3. Authority confirms breakdown -> incident ACTIVE; failed bus UNAVAILABLE.
4. Affected journeys recalculate.
5. Replacement candidates exclude unavailable/maintenance/committed buses.
6. Recommendation generated -> fleet assignment unchanged.
7. Approve -> assignment updates and Student Portal changes.
8. Reject -> assignment remains unchanged.
9. No candidate -> no fabricated replacement.
10. Event edit -> impact and affected journeys update.
11. Event delete -> impact removed.
12. Reset -> exact initial state restored.

## UI tests
- Navigation works.
- All primary buttons work.
- Forms validate.
- Empty/loading/error/success states exist.
- Charts render from state.
- Student and authority views synchronise.
- Responsive desktop/tablet/mobile.
- Keyboard focus and labels.

## Persistence tests
- State survives refresh.
- Malformed LocalStorage is handled.
- Schema version mismatch restores seed safely.
- Reset restores exact seed.

## Fallback tests
- AI provider unavailable: core app still works with deterministic explanations.
- Map tiles unavailable: schematic/list fallback remains usable.
- Network/server AI failure does not crash app.

## Definition of done
Do not claim complete until all critical workflow tests pass and known limitations are documented. Record actual command outputs and results in `PROMPT_LOG.md`.
