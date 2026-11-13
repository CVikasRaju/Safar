# 08 — Student Demand and Capacity

## Required initial illustrative values

| Route | Expected students | Available seats |
|---|---:|---:|
| R101 | 145 | 100 |
| R102 | 90 | 110 |
| R103 | 185 | 140 |
| **Total** | **420** | **350** |

Initial potential shortage = 420 - 350 = **70 seats**.

These values are illustrative seed data. They are not measured passenger counts.

## Display
Expected students, occupied seats, remaining capacity, available seats, seat shortage, overcrowding risk, route-wise, village-wise, destination-wise, and time-window demand.

## Student travel submissions
Fields: origin, destination, travel date, required arrival time, group size. Validate input and aggregate by route/time window. Avoid exposing individual student details in analytics.

## Aggregation
Use journey-planning allocation or an explicit deterministic allocation rule. Do not count one student on every candidate route. Do not double-count a bus's capacity across overlapping services.

`shortage = max(0, expectedStudents - availableSeats)`

`surplus = max(0, availableSeats - expectedStudents)`

Calculate route totals and overall totals from the same records. Ensure seed totals match the required values.

## Demand estimation
Possible factors: historical passenger counts if present, weekday, college schedule, examination schedule, holidays, regional events, and submitted demand. Each adjustment must be documented. Missing historical data must not be fabricated.

Do not claim a trained ML model unless an actual model, training dataset, evaluation, and limitations exist. For this prototype call values `Estimated Demand` or `Illustrative Demand`.

## Event adjustments
Only apply event-related demand adjustments when a defined relationship exists. A festival does not automatically imply increased student demand. Keep demand adjustment separate from event congestion impact.

## Charts
Use Recharts for demand vs capacity, route demand, village demand, shortages, occupancy, and time trends. Derive charts from shared state.
