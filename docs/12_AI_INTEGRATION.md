# 12 — AI Integration

## Provider-neutral design
Define an AI provider interface. Gemini can be the first implementation, but the app must work without it and must not be tied to Google AI Studio.

## Appropriate AI tasks
- Parse a natural-language event announcement into proposed structured fields.
- Explain deterministic event/route impact.
- Summarise dashboard metrics.
- Explain why a ranked replacement is suitable.
- Summarise a confirmed incident and response options.

## Deterministic tasks — never delegate final decision
- Timetable feasibility.
- Journey duration and transfer waits.
- Walking distance provenance.
- Event impact score.
- Demand/capacity arithmetic.
- Bus eligibility.
- Replacement ranking.
- Fleet allocation.
- Reliability score.
- Report/incident state transitions.

## Event extraction
Return schema-validated proposed fields. Missing data stays null/unknown. Never invent coordinates, roads, route effects, official closure status, crowd counts, or event time. Show extracted values to user for review before saving.

## Explanation grounding
Pass only calculated facts to the model. Ask it to explain, not recompute or change the ranking. If model output conflicts with calculation, discard the conflicting claim.

## Safety and failure
- Server-side provider call only.
- API key in server environment variable.
- Validate inputs and structured outputs.
- Set timeouts and handle rate limits/errors.
- No secret in browser bundle.
- Deterministic fallback when unavailable.
- Label generated text as AI-generated.
- Human approval for operational changes.

## Example environment variables
Use names appropriate to provider and deployment. Example:
`AI_PROVIDER=gemini`
`GEMINI_API_KEY=...`
`GEMINI_MODEL=...`

Never commit real secrets. Keep `.env.example` placeholders only.
