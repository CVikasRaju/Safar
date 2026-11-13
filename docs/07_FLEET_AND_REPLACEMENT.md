# 07 — Fleet and Replacement Optimisation

## Bus entity
- ID.
- Registration number.
- Assigned route.
- Seating capacity.
- Occupied seats.
- Derived remaining seats.
- Status.
- Current/last-known demo location.
- Estimated response time.
- Availability.
- Current commitments.

`remainingSeats = max(0, capacity - occupiedSeats)`

Validate occupied seats do not exceed capacity unless an explicit overload incident is recorded.

## Statuses
Operating, Available, Unavailable, Maintenance, Replacement Assigned.

An Operating bus serves its assigned route. Available may be considered for deployment. Unavailable/Maintenance/failed/already committed candidates are excluded. Replacement Assigned cannot be double-booked.

## Breakdown simulation
Select only an Operating bus. Confirm action. Mark Unavailable, create a simulated incident, identify affected route and journeys, estimate passenger impact, and rank eligible candidates.

## Eligibility
Candidate must:
- Not be failed bus.
- Not be unavailable or maintenance.
- Not be committed to an incompatible task.
- Be operationally assignable.
- Have route compatibility under explicit rules.
- Have adequate capacity for full coverage, or be clearly identified as partial coverage.

## Weighted ranking
- Capacity 35%.
- Route compatibility 30%.
- Response time 25%.
- Operational availability 10%.

Each component normalised 0–100. Final score = weighted sum. Exclude ineligible candidates before ranking; do not allow a high score to override ineligibility. Explain each component.

If no full-capacity bus exists, show the deficit. Multiple buses may be combined only if route/time/assignment constraints permit and combined capacity is calculated.

## Approval workflow
Recommendation is not allocation. Before approval, revalidate candidate availability, capacity, route compatibility, and commitments. On approval:
- Record authority decision.
- Allocate candidate.
- Set appropriate status/assignment.
- Keep failed bus unavailable.
- Update route coverage.
- Recalculate journeys, delay, reliability, demand capacity, and alerts.
- Reflect result in Student Portal.

On rejection:
- Record reason.
- Do not allocate.
- Keep incident active.
- Allow another candidate/alternative.

## Response time
All response times/ETAs in seed data are illustrative estimates, not live GPS-derived values.

## Reset
Restore exact seed fleet, assignments, incidents, recommendations, and statuses.
