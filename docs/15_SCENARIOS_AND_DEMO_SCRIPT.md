# 15 — Scenarios and Demonstration Script

## Scenario A — Central SAFAR live scenario

Controls:
- `RUN SAFAR LIVE SCENARIO`
- `RESET SCENARIO`

Use configurable scenario date and relative labels. Do not hardcode a stale calendar date.

Sequence:
1. Student from a seeded village searches to Puttur Government College, required before 9:00 AM.
2. A simulated major festival is scheduled near Town B for the configured demo date.
3. The event-route relationship identifies R101 and R104 as impacted only if seed configuration supports it.
4. SAFAR calculates impact before event start and explains the estimated impact window.
5. Show earlier departure/alternative only if timetable calculation supports it.
6. KA-21-AB-102 on R101 is marked as failed through a simulated confirmed incident.
7. Identify affected journeys and estimated affected passengers.
8. Rank eligible replacement buses.
9. Display component scores and recommendation.
10. Authority approves the replacement.
11. Update fleet, route, journey, reliability, alerts, and Student Portal.
12. Display final operations summary.

Final summary:
- Affected students (calculated).
- Affected routes.
- Event impact/risk.
- Failed bus.
- Recommended/approved replacement.
- Illustrative response time.
- Additional capacity.
- Alternative journey.
- Updated reliability.

## Scenario B — Immediate breakdown only

Must run independently without festival scenario:
1. Select an Operating bus.
2. Confirm simulated breakdown.
3. Identify affected journeys.
4. Evaluate replacement and alternatives.
5. Approve or reject.
6. Verify Student Portal update.

## Scenario C — Student report only

1. Student submits bus-not-arrived report.
2. Status becomes UNVERIFIED.
3. Authority queue shows it.
4. Fleet status remains unchanged.
5. Authority verifies/rejects/marks duplicate.
6. If verified, authority may separately confirm incident.
7. Only incident confirmation applies operational disruption.

## Scenario D — No replacement available

Make all eligible buses unavailable/committed or configure insufficient capacity. Confirm SAFAR shows no feasible replacement, identifies seat deficit, and does not invent a bus.

## Scenario E — Surprise challenge

Allow judge to modify event location/date/duration/crowd, route, bus, demand, arrival deadline, bus availability, road closure, or incident type. Reuse the same domain functions.

## Reset
Reset restores seed data, reports, incidents, fleet assignments, event impacts, recommendations, alerts, and scenario state. Running a scenario twice after reset must produce the same results for the same configured seed inputs.
