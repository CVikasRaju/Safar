# 16 — Security, Privacy, and Trust

## Secrets
AI provider keys stay server-side in environment variables. Never put them in React source, browser storage, public env variables, or committed files. Provide `.env.example` with placeholders.

## Input validation
Validate IDs against known records, dates/times, route/bus/stop references, group sizes, text lengths, and status transitions. Sanitize user-provided descriptions before rendering.

## Student privacy
Collect only necessary travel/report data. Use anonymous/demo IDs in the prototype. Aggregate demand for authority analytics. Do not expose student names, phone numbers, or individual journey details on public dashboards.

## Provenance
Every important record or calculation should expose a source label:
- Demo.
- Simulated.
- User-entered.
- Calculated.
- AI-generated.
- Verified.

Do not mark AI-generated or demo data as Verified.

## Human authority
A student report cannot trigger a breakdown. AI cannot confirm incidents. A recommendation cannot allocate a bus. Require an explicit authority action for incident confirmation and replacement approval.

## Audit trail
Record meaningful state-changing demo actions and reasons. Clearly label as prototype audit history, not a certified government record.

## Honest limitations
Do not claim live GPS, live traffic, official timetable integration, statistically validated reliability, or trained ML unless genuinely implemented and verified.
