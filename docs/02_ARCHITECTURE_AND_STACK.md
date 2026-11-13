# 02 — Architecture and Stack

## Recommended stack

- React + TypeScript.
- Tailwind CSS.
- Lucide React.
- Recharts.
- Leaflet + OpenStreetMap tiles.
- Node.js server runtime for AI calls.
- Local TypeScript/JSON seed data.
- LocalStorage for demo persistence.
- Vitest or the repository's existing test framework.

Adapt to the existing repository. Avoid unnecessary rewrites and dependency additions.

## Layering

1. **Presentation:** pages, components, layouts, forms, charts, maps.
2. **Application:** use cases/actions such as submit report, verify report, confirm incident, approve replacement, run scenario.
3. **Domain:** typed entities and pure calculations.
4. **Infrastructure:** LocalStorage adapter, optional server API, AI provider adapter, map tile layer.

UI components must not implement transport calculations.

## Suggested structure

```text
src/
  app/
  components/
  pages/
  layouts/
  features/
    student/
    government/
    journeys/
    events/
    disruptions/
    fleet/
    demand/
  domain/
    types/
    calculations/
    rules/
  data/
    seed/
    validation/
  state/
  services/
    persistence/
    ai/
    maps/
  hooks/
  styles/
server/
  routes/
  services/
tests/
  unit/
  integration/
```

Use a different structure if the repository already has a sound convention.

## Domain services

- `generateJourneyOptions(request, network, state)`
- `calculateJourneyReliability(journey, context)`
- `calculateEventImpact(event, route, context)`
- `identifyAffectedRoutes(eventOrIncident, network)`
- `calculateStudentDemand(submissions, demandSeed, context)`
- `rankReplacementBuses(incident, fleet, affectedDemand)`
- `updateFleetAllocation(approvedDecision, state)`
- `processDisruptionReport(input, state)`
- `verifyDisruption(reportId, decision, state)`
- `generateRecommendationExplanation(calculationResult)`

Pure calculations should be deterministic and independently testable.

## State management

Use React Context + reducer or an existing predictable store. One canonical state feeds both workspaces. Derived metrics should be computed from canonical state, not independently hardcoded in each page.

## Provider boundaries

- AI provider interface: provider can be Gemini or another model provider.
- Map adapter: map tiles can fail without breaking route results.
- Persistence adapter: LocalStorage can be replaced later with a database.
- Domain logic must not depend on an AI SDK or map library.

## Error handling

Show actionable errors for invalid forms and failed operations. Keep core journeys, fleet logic, and event calculations usable when optional providers are unavailable.
