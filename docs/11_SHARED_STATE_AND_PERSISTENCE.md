# 11 — Shared State and Persistence

## Canonical state
Store one shared source of truth for:
- villages, destinations, stops, routes, timetables, buses;
- events and event impacts;
- student travel submissions;
- disruption reports;
- confirmed incidents;
- replacement recommendations and decisions;
- alerts;
- scenario state and audit events.

## State transitions
Suggested actions:
- `SUBMIT_TRAVEL_REQUEST`
- `SUBMIT_DISRUPTION_REPORT`
- `VERIFY_REPORT`
- `REJECT_REPORT`
- `MARK_REPORT_DUPLICATE`
- `CONFIRM_INCIDENT`
- `CLOSE_INCIDENT`
- `ADD_EVENT`
- `UPDATE_EVENT`
- `DELETE_EVENT`
- `MARK_BUS_UNAVAILABLE`
- `GENERATE_REPLACEMENT_RECOMMENDATION`
- `APPROVE_REPLACEMENT`
- `REJECT_REPLACEMENT`
- `RUN_SCENARIO`
- `RESET_SCENARIO`

Validate preconditions in domain/application services, not only in button disabled states.

## Derived data
Calculate dashboard counts, available capacity, shortages, affected journeys, event impact, and reliability from canonical state. Avoid separate manually maintained totals.

## Student/government synchronisation
A government action updates the shared store. Student views subscribe to the same state and update. Never patch only one page's local component state.

## LocalStorage
Use a versioned key such as `safar-state-v1`. Persist after meaningful changes. Validate parsed state and schema version. If malformed/incompatible, restore seed data safely and notify the user.

## Reset
Restore seed buses/statuses/assignments, routes, events, demand, reports, incidents, alerts, recommendations, and scenario state. Use immutable seed data and clone it. Reset must not merely clear the current page.

## Concurrency/stale actions
Before approval, re-read current state and validate the selected replacement is still eligible. Prevent double allocation. In a single-browser prototype, reducer transaction/action validation is sufficient; document that multi-user concurrency requires a server database and transactional updates.
