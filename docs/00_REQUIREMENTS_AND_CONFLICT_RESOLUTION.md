# 00 — Requirements and Conflict Resolution

## Source of truth

The user's updated SAFAR brief is authoritative. The earlier SAFAR brief remains binding wherever it adds detail and does not conflict with the updated brief. This package merges both.

## Explicit resolutions

| Topic | Binding rule |
|---|---|
| Development platform | Tool-agnostic. Google AI Studio is optional, not mandatory. |
| Product | One responsive web app; no separate Android app. |
| Workspaces | Student Portal and Government Control Centre share one state. |
| Routes | Seed R101, R102, R103, and R104. R104 is necessary because the scenario names it. |
| Student report | Submission creates an unverified report only. It cannot mark a bus unavailable. |
| Report verification | Verification/rejection/duplicate are review outcomes, not incident confirmation. |
| Incident confirmation | A separate authority action creates the active disruption and can mark the bus unavailable. |
| Replacement recommendation | A ranked proposal only; it does not allocate a bus. |
| Replacement approval | Human approval is required before assignment and student-facing operational update. |
| Predictive events | Event impact is an estimate and must be available before event start where time data permits. |
| Immediate response | Separate incident workflow uses the same journey/fleet calculation services. |
| AI | AI extracts/explains; deterministic logic decides feasibility, scores, capacity, and ranking. |
| Data | Demo/simulated values must be labelled and never described as official/live. |
| Maps | Tile display is not routing. Use real route geometry only if available; otherwise use a labelled schematic. |
| Reliability | 0–100 illustrative score with exact disclaimer; not probability. |
| Demand | Initial route values are fixed to 145/100, 90/110, 185/140; totals 420/350; shortage 70. |
| Fleet | At least five buses; failed/unavailable/maintenance/committed buses cannot be replacement candidates. |
| Scenario | Repeatable RUN and RESET; isolated immediate-breakdown demo also required. |

## Priority if implementation time is limited

Preserve working end-to-end flows in this order:
1. Shared state and consistent seed data.
2. Journey planner.
3. Student disruption report and authority review.
4. Authority incident confirmation.
5. Replacement ranking and approval.
6. Student Portal propagation and alerts.
7. Event intelligence.
8. Demand analytics.
9. AI explanations/extraction.
10. Advanced map enrichment.

Simplify presentation or optional integrations before omitting a core workflow.

## Non-negotiable distinctions

- `UNVERIFIED` is not `VERIFIED`.
- `VERIFIED REPORT` is not `CONFIRMED INCIDENT`.
- `RECOMMENDED REPLACEMENT` is not `APPROVED REPLACEMENT`.
- `PREDICTED CONGESTION` is not `VERIFIED ROAD CLOSURE`.
- `ILLUSTRATIVE ESTIMATE` is not `LIVE MEASUREMENT`.
- `AI-GENERATED EXPLANATION` is not a calculated result.
