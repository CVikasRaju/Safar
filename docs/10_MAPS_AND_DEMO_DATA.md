# 10 — Maps and Demonstration Data

## Region
Illustrative rural network around Puttur, Karnataka.

Required villages/towns:
- Puttur
- Sullia
- Uppinangady
- Kadaba
- Vittal

At least three destinations, including Puttur Government College.

## Required network
- Four routes: R101, R102, R103, R104.
- At least five buses.
- At least ten stops.
- Timetables.
- Demand seed data.
- At least one event.
- Breakdown scenario using `KA-21-AB-102` assigned to R101 initially.

R104 is explicitly seeded because the event scenario refers to R101 and R104. Do not mention a route in scenario UI unless it exists in data.

## Consistency
Use stable IDs and references. Every route stop ID must exist. Every timetable service must reference an existing route, stop, and bus/service. Stop sequence and times must be chronological. Every bus assignment must reference a valid route. Validate seed data at startup/tests.

Recommended seed files: villages, destinations, stops, routes, services/timetables, buses, events, demand, scenario configuration.

## Geographic truthfulness
Do not invent actual road paths or official bus schedules. Use verified route geometry only if sourced. If geometry is unavailable, render a labelled schematic network. Do not present straight-line distance as pedestrian distance.

Leaflet/OpenStreetMap tile failure must not crash the application. Show a local schematic or list-based journey visualization. Keep journey calculations operational.

## Provenance
Label data as Demo, Simulated, User-entered, Calculated, AI-generated, or Verified. `Verified` requires actual verification. Do not claim live GPS or official government operations.
