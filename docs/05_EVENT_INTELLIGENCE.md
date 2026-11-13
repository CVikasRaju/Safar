# 05 — Regional Event and Traffic Intelligence

## Event categories
Temple festivals, religious processions, village fairs, weekly markets, national/state examinations, sports events, public gatherings, political rallies, national celebrations, construction, road closures, and custom categories.

## Event fields
ID, name, category, location, optional coordinates, date, start/end time, expected crowd level, nearby villages, affected roads, affected routes, expected impact window, description, source, provenance, verification status.

## Impact factors
- Crowd intensity.
- Distance/proximity to route.
- Time overlap.
- Route importance.
- Event duration.
- Optional historical disruption data only if available.

Use a documented deterministic weighted score from 0–100. Example starting weights: crowd 25%, proximity 25%, overlap 20%, route importance 15%, duration 15%. If a factor is unavailable, do not invent it; renormalise available weights and disclose missing inputs.

Risk thresholds (prototype):
- 0–24 Low.
- 25–49 Moderate.
- 50–74 High.
- 75–100 Critical.

These are illustrative prototype thresholds, not validated traffic standards.

## Advance warning
Calculate an impact window that may begin before the event's official start only when the event record or explicit scenario rule supplies a preparation/arrival buffer. Do not invent an early start time. Display the source of the buffer (e.g. scenario-configured 90 minutes).

## Route identification
Use route geometry or explicit event-route associations where available. If using approximate proximity, label it estimated. Do not claim an event lies on a road without evidence.

## Outputs
For each route: event name/category, route ID, impact score, risk, overlap, proximity basis, estimated delay if a documented conversion is configured, explanation, suggested preventive action, affected journeys/passenger estimate.

Do not confuse event impact score with delay minutes. Avoid double-counting overlapping events.

## CRUD and recalculation
Add/edit/delete event. Recalculate route impact, affected journeys, alerts, recommendations, and dashboard summaries. Deleting an event removes its future impact.

## AI event extraction
AI may parse announcements into proposed structured event fields. Missing fields remain unknown. Do not infer coordinates, affected roads, official permissions, closures, or crowd counts. Human reviews before save. Keep source/provenance.
