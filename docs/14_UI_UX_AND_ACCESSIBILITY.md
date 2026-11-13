# 14 — UI, UX, and Accessibility

## Visual system
Deep navy/charcoal/slate base, restrained cyan accent, emerald success, amber warning, red critical. Compact information-rich layout. Consistent typography, spacing, borders, shadows, and status labels.

## Navigation
Persistent sidebar on desktop; accessible collapsible navigation on smaller screens. Clearly indicate active workspace and page. Include a visible `DEMO DATA` label.

## Required interaction states
Every form needs labels, validation, loading/disabled state where appropriate, success/error feedback, and empty state. Every button must have a real action. Do not leave placeholder navigation, tabs, dropdowns, or chart controls.

## Important status language
Use exact, unambiguous terms:
- `UNVERIFIED STUDENT REPORT`
- `VERIFIED REPORT — INCIDENT NOT YET CONFIRMED` where applicable
- `CONFIRMED INCIDENT`
- `REPLACEMENT RECOMMENDED — AWAITING APPROVAL`
- `REPLACEMENT APPROVED`
- `NO FEASIBLE REPLACEMENT`
- `PREDICTED EVENT IMPACT`
- `SIMULATED / DEMO DATA`

Do not use a generic red "Breakdown" badge for an unverified report.

## Student report UX
Make the reporting CTA easy to find. Keep the form short. Show reference ID and unverified status after submit. Explain that authorities must review the report.

## Authority UX
Separate report review from incident confirmation. Show context and affected route. Require a confirmation dialog for incident confirmation and replacement approval. Require a reason for rejection where useful.

## Responsive behaviour
- Desktop: sidebar + multi-column dashboard.
- Tablet: condensed navigation and two-column content.
- Mobile: single-column cards, scrollable tables or stacked row cards, full-width form actions.
Do not allow critical buttons to be clipped.

## Accessibility
Use semantic HTML, keyboard-accessible controls, visible focus, appropriate contrast, form labels, status text in addition to colour, and descriptive chart summaries. Avoid colour-only status communication.
