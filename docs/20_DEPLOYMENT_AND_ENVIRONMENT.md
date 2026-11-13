# 20 — Deployment and Environment

## Local development
Use the package manager and scripts already defined by the repository. Typical commands for a Vite-based project may be:
- install dependencies using the repository lockfile/package manager;
- run the development server;
- run unit tests;
- run production build.

Do not assume these exact commands if the repository differs. Inspect `package.json` first.

## Environment
Provide `.env.example` with placeholders for optional server-side AI provider configuration. Never commit `.env` or real credentials.

## AI-off operation
If no AI key is configured, hide/disable only AI-assisted extraction/explanation actions with a clear message. Journey, fleet, event calculations, reports, demand, persistence, and scenarios must remain functional.

## Map-off operation
If map tiles cannot load, show schematic/list fallback. Do not block journey results.

## Persistence
LocalStorage is suitable for a single-browser demo. It is not a multi-user production database. Document this limitation.

## Deployment checklist
- Production build succeeds.
- Secrets are configured server-side.
- No secrets appear in client bundle.
- Fallbacks tested.
- Seed data validated.
- LocalStorage reset works.
- Mobile layout checked.
- Known limitations shown in README.
