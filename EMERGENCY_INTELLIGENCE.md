# SAFAR Emergency Intelligence Engine

The advanced emergency intelligence capability inside the existing SAFAR application. It is an
enhancement of the shared prototype: no second app, no duplicated store, no replacement of the
Student Portal.

**Everything here is simulated demo data.** Road geometry, travel times, passenger counts, event
information and examination times are illustrative. No live GPS, official timetable, weather feed or
real event notice is used or implied.

## The combined scenario

One run introduces four conditions at once, and all four are real inputs to the allocation engine:

| Condition | What happens | Where it comes from |
|---|---|---|
| Two simultaneous breakdowns | `KA-21-AB-102` (R101) and `KA-21-CD-204` (R103) become `UNAVAILABLE`; those routes lose their current-service seat block entirely | `EMERGENCY_CONFIG.failedBusIds` |
| Exactly +40% demand | 420 documented students become 588 (+168 surge groups) | `materialiseEmergencyStudents()` |
| Flooded road | `Puttur – Mangalore Road (Nettaravathi bridge)` is `FLOODED`; its pickup stop is submerged | `emergencyRoadConditions()` |
| Examination prioritisation | 63 students have examinations within 120 minutes; ordered ahead of every other tier | exam offsets stored relative to the scenario clock |

The documented baseline (420 students / 350 seats / 70 shortage) is untouched: `src/data/seed/demand.ts`
is unchanged, and the Student Portal still reports it.

## Why repeat runs cannot duplicate students

`SafarState.emergency` stores **only scenario inputs**: the clock, the failed bus IDs, the blocked
road, and the student groups. Allocations, alternative routes and before/after values are recomputed
by pure functions on every render. Running the scenario twice replaces the input object instead of
appending to an allocation list, and the four authority alert IDs are stable, so a repeat run cannot
create duplicate alerts either. Reset removes the emergency input, restores the seed fleet and
therefore restores the original allocations.

## Allocation engine — `src/domain/emergency/allocation.ts`

1. **Fleet filtering.** Only `OPERATING`, `AVAILABLE` and `REPLACEMENT_ASSIGNED` buses can receive
   students. Unavailable and maintenance buses are excluded structurally, not by a UI filter.
2. **Seat blocks.** A route with a documented demand record contributes its documented seat figure;
   routes without one contribute their operating bus's spare physical seats; each relief bus
   contributes its full physical capacity as `RELIEF`.
3. **Relief selection.** Relief buses are drawn only from buses marked `AVAILABLE` and unassigned.
   One bus is offered to each failed route first (so neither breakdown is ignored), then the rest go
   to the largest outstanding demand.
4. **Priority ordering.** `EXAM_IMMINENT` → `DEADLINE_IMMINENT` → `BUS_BREAKDOWN` → `FLOOD_AFFECTED`
   → `STANDARD`, then arrival deadline, examination time, most-constrained pickup (submerged stop),
   largest group, stable ID. Serving larger groups first maximises the number of students transported.
5. **Route compatibility.** A candidate block must have a timetable service that boards the group's
   effective pickup and reaches the college (PGC gate, or Puttur Bus Stand as the transfer anchor).
   Same-route candidates are preferred, then the block with the most free seats.
6. **Capacity.** No block is ever allocated past `capacity`; a group that cannot fit entirely is
   filled partially and the remainder is reported as unserved.
7. **Walking.** A submerged pickup is replaced by the nearest usable stop served by an operational
   route within 5 km, using the shared walking estimate. Walks beyond the documented 2.5 km
   access-walk limit are flagged as requiring a feeder shuttle.
8. **Arrival estimate.** `clock + walk-to-pickup + platform wait (or relief response time) +
   timetable travel time + detour minutes + egress walk`, compared with the required arrival and the
   examination start.
9. **Outputs.** Every assignment carries an explanation built from those calculations; every
   unserved group carries a specific reason (no compatible route, capacity exhausted with numbers,
   unreachable replacement pickup). `allocated + unserved = total` always holds.

## Road intelligence — `src/domain/emergency/roads.ts`

- Routes map to roads through their real stop sequences.
- Alternatives use a Dijkstra search that **excludes every closed road**, so a proposed alternative
  cannot contain the blocked segment.
- Each alternative reports its path, extra kilometres and extra minutes (R102/R103/R104 all detour via
  the ring road: +3.2 km, +7 min).
- Replacement pickups reuse the shared walking estimate and are labelled approximate.

The journey planner also consumes this: `buildRouteContexts()` adds the detour minutes to affected
routes during an active emergency, so student-facing journey estimates react to the flood.

## Before/after comparison

`buildBeforeAfterComparison()` runs the **same allocator** over a derived "before" model (failed buses
restored, roads open, surge groups removed) and the live "after" model. Both columns are therefore
calculated, including unserved students, late students, relief-bus usage and alternative pickups.

## Advance event prediction — `src/domain/emergency/eventPrediction.ts`

Predictions are generated roughly a day ahead and always carry their provenance:

- **Verified** — a confirmed closure within the simulated scenario.
- **Student reported (unverified)** — an unreviewed disruption report from the portal.
- **AI-generated prediction** — a predicted event record with its impact window.
- **Simulated scenario** — examination pressure inside the running emergency.
- **Historical pattern** — seasonal flooding risk on the low-lying bridge approach.

Each item states lead time, expected traffic increase, extra minutes, affected villages and routes,
students affected, a recommended alternative and an explicit disclaimer. Predictions never change bus
status, create incidents or alter allocations.

## Control Centre UI

| Route | Page | Contents |
|---|---|---|
| `/control-centre` | Emergency overview | RUN / RESET actions, 10 emergency KPIs, the four applied conditions, affected villages/routes, fleet status, before/after table, explainable decisions |
| `/control-centre/emergency` | Allocation & routes | Seat blocks, alternative routes, replacement pickups with walking, exam priority results, every assignment with its explanation, unserved groups with reasons |
| `/control-centre/prediction` | Event prediction | Prediction cards with provenance, lead time, affected network, alternatives and disclaimers |
| `/control-centre/integration` | Shared state | The Student Portal hand-off page, unchanged |

The sidebar switches to a Control Centre navigation group while inside the workspace, and the Student
Portal navigation is unchanged.

## State actions

```ts
{ type: "RUN_EMERGENCY_SCENARIO"; plan: EmergencyPlan }
{ type: "RESET_EMERGENCY_SCENARIO" }
```

`RUN` writes the scenario inputs, the modified fleet (including released reserve buses), four
`AUTHORITY` alerts and an audit entry. `RESET` clears the emergency, restores the seed fleet, removes
the emergency alerts and audit entries, and preserves student reports and travel requests.

## Tests — `tests/emergencyEngine.test.ts` (14 tests)

| Test | Asserts |
|---|---|
| 1 | Two buses break down simultaneously, both routes identified, affected groups counted |
| 2 | Baseline 420 + 168 = 588 and exactly 40.00% increase, and the surge drives allocation |
| 3 | The flooded road yields valid alternatives for R102/R103/R104 |
| 4 | No alternative path contains the blocked road |
| 5 | Exam groups are ordered first and all 63 are seated |
| 6 | No seat block or relief bus exceeds its capacity |
| 7 | No student is assigned to an unavailable bus or a failed route's current service |
| 8 | No duplicate group assignments; allocated + unserved reconciles |
| 9 | Walking distances equal the shared walking estimate between the real stops |
| 10 | Unserved groups are reported with reasons |
| 11 | Before/after values are calculated (420 → 588, 0 → 2 unavailable) |
| 12 | Reset restores fleet, alerts and analysis, and planning still works |
| 13 | A second run produces identical totals, unique assignments and 4 alerts (no duplicates) |
| 14 | Journey planning, detour delay, student alerts, demand baseline and student actions still work |

Run with `npm run test` (75 tests total across 7 files).

## Known limitations

- The allocation is a deterministic greedy pass over priority tiers, not a proven optimal solution.
- Route seat supply uses documented planning figures, which can exceed a single bus's physical seats;
  relief buses use real capacity. Both are labelled in the UI.
- Two of the four available relief buses already exist in the seed fleet; the scenario releases two
  more depot reserves. Nothing is invented beyond the labelled simulation.
- Road distance/time values are simulated from seed coordinates with a fixed road factor.
- Walking values are approximations, not pedestrian routing.
- At most one transfer is modelled by the existing journey planner; the allocator boards a single
  route per group.
