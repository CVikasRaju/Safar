# 04 — Journey Planner

## Inputs
- Origin village.
- Destination.
- Travel date.
- Required arrival time.

## Candidate generation
Generate feasible journey candidates from route, stop, service, timetable, bus, and disruption data. Validate stop order and timetable chronology. A connection is invalid if the next bus departs before the previous segment arrives or if the transfer buffer is insufficient.

## Three categories
- **Fastest:** lowest total elapsed time.
- **Most Reliable:** highest illustrative reliability score.
- **Fewest Transfers:** lowest number of bus changes.

Rank independently. Use deterministic tie-breakers: reliability, earlier arrival, then fewer transfers. Do not manufacture different routes to fill three cards.

## Journey segments
Represent WALK, BUS, WAIT, and TRANSFER segments in chronological order. Each segment has start/end location and time, duration, and relevant service/stop reference.

## Required result fields
- Journey ID.
- Origin/destination.
- Bus registration/service identifiers.
- Boarding/drop-off/intermediate stops.
- Scheduled departure and expected arrival.
- Walking to first stop.
- Walking between transfer points.
- Walking from final stop.
- Waiting time.
- Transfer count.
- Total elapsed duration.
- Estimated delay.
- Reliability score.
- Warnings.
- Required-arrival status.

## Calculations
`totalDuration = finalArrival - journeyStart`

`transferCount = max(0, busSegmentCount - 1)`

Waiting time is the actual gap between arrival at a transfer stop and next departure. Negative gap means infeasible, not zero.

Do not double-count waiting within total duration. Do not count the same passenger multiple times.

## Walking truthfulness
Use a pedestrian routing provider only if configured and successful. If only coordinates exist, do not call haversine/straight-line distance a walking distance. Show `Walking distance unavailable` or a clearly labelled approximate estimate with method and provenance. Schematic walking lines are not road directions.

## Arrival deadline
A journey arriving after the required time must be labelled late/not meeting requirement. Do not present it as a successful recommendation. It may appear under late alternatives.

## No-route behaviour
Show no feasible route, explain known reason, and offer adjustable departure/arrival or alternate origin/destination. Never invent a connection.

## Recalculation triggers
Recalculate after event edits, road closures, incident confirmation, bus status/assignment changes, replacement approval, timetable edits, and scenario reset.
