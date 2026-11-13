# 01 — Product and Scope

## Product statement

SAFAR is an AI-assisted rural student transport intelligence and coordination platform. It helps students plan journeys and report problems, while authorities anticipate regional disruption, monitor capacity, verify incidents, and coordinate alternatives.

## Primary users

- Student / traveller.
- Transport authority operator.
- Demonstration judge / administrator.

The prototype may use a workspace switcher rather than full authentication. Do not imply real role-based security if the prototype has no authentication.

## Core outcomes

1. Student can find a feasible journey before a required arrival time.
2. Student can submit a bus-not-arrived or disruption report.
3. Authority can review the report without prematurely changing fleet status.
4. Authority can separately confirm a real/simulated incident.
5. SAFAR identifies affected journeys and estimates passenger impact.
6. SAFAR ranks eligible replacement options and alternatives.
7. Authority approves or rejects the recommendation.
8. The Student Portal reflects the approved state.
9. Upcoming events can trigger advance warnings.
10. Demand and capacity are visible as aggregated information.

## In scope

Journey planning, timetable feasibility, event management, event impact, disruption reporting, authority verification, incident confirmation, fleet status, replacement ranking, alternative connections, demand submissions, capacity analytics, reliability scoring, alerts, repeatable demos, optional AI explanations/extraction, LocalStorage persistence.

## Out of scope for this prototype

- Official government dispatch integration.
- Real-time GPS tracking unless a real provider is connected.
- Real-time bus location claims from seed coordinates.
- Production-grade identity verification.
- Payment/ticketing.
- Emergency-service dispatch.
- Validated traffic forecasting.
- Statistically validated reliability probability.
- Trained ML demand forecasting unless data/model/evaluation actually exist.

## Success measures

Measure functional completion, not visual polish alone:
- Valid journey search.
- Correct unverified report workflow.
- Correct authority verification and incident confirmation.
- Correct replacement eligibility and approval.
- Shared-state propagation.
- Correct seed demand totals.
- Event impact recalculation.
- Repeatable run/reset.
- Responsive interface and graceful provider failure.
