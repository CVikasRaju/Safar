# 06 — Immediate Disruption Response

## Purpose
Handle unexpected transport failures quickly while preserving the distinction between a user report, a reviewed report, and a confirmed incident.

## Supported report/incident types
Bus not arrived, bus breakdown, mechanical failure, driver-reported issue, unexpected cancellation, road blockage, route diversion, insufficient capacity, and custom issue.

## A. Student report
Fields:
- Route number.
- Expected bus number.
- Bus stop.
- Expected arrival time.
- Report type.
- Optional description.

On submission:
1. Validate route/bus/stop references where possible.
2. Create report ID and timestamp.
3. Save report as `UNVERIFIED`.
4. Publish to authority review queue.
5. Notify student with reference ID.
6. Do not mark bus unavailable or create a confirmed incident.

## B. Report statuses
- `UNVERIFIED`
- `VERIFIED`
- `REJECTED`
- `DUPLICATE`
- `CLOSED`

A verified report is a credible report, not necessarily a confirmed breakdown. Rejection and duplicate require a reason. A report can be closed with resolution details.

## C. Authority review
Authority can verify, reject, or mark duplicate. Verification records reviewer/action/time in the demo audit trail. Only a separate explicit `CONFIRM INCIDENT` action creates an operational incident.

## D. Authority incident confirmation
Fields:
- Incident type.
- Bus registration, if applicable.
- Route.
- Location/affected stop.
- Incident time.
- Severity.
- Expected repair/resolution status.
- Description.
- Related student report IDs, optional.

On confirmation:
1. Validate data.
2. Create incident record.
3. Set incident active.
4. If it is a confirmed bus failure, mark that bus `Unavailable`.
5. Identify affected route/services/journeys/passengers.
6. Recalculate route feasibility, delay, alternatives, and reliability.
7. Trigger replacement evaluation if applicable.
8. Publish alerts.
9. Preserve authority action history.

A road closure need not mark a bus unavailable. Apply incident-specific effects.

## E. Immediate response panel
Show `DISRUPTION DETECTED — ACTION REQUIRED`, original bus, affected route/stop, incident type, estimated affected passengers, available replacements, estimated response times, alternative connections, estimated delay, and decision status.

## F. Alternative journeys
Compare:
- Wait for replacement.
- Board another eligible bus at a nearby stop.
- Walk to another boarding point, only with a defensible walking estimate.
- Transfer to another route.
- Other timetable-feasible connections.

Show extra walking, waiting, revised arrival, and whether required arrival is met.

## G. No solution
If no feasible replacement or alternative exists, say so clearly. Show nearby operating buses and remaining capacity only if supported by data, calculate additional seats required, and alert authority for further action. Never invent a solution.

## H. Auditability
Record who/which demo role performed each action, action type, timestamp, affected record IDs, and decision reason. Do not represent this prototype audit trail as legally certified.
