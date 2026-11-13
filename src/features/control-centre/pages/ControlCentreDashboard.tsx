import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bus,
  CalendarClock,
  CloudRain,
  GraduationCap,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useSafarState } from "../../../state/SafarStateContext";
import { buildEmergencyPlan } from "../../../domain/emergency/scenario";
import { Badge, Button, Card, CardHeader, EmptyState, Notice, SectionHeading, StatCard } from "../../../components/ui";
import { formatNumber } from "../components";
import { useEmergencyAnalysis } from "../useEmergency";

const CONDITION_ICONS = {
  breakdown: Bus,
  demand: Users,
  flood: CloudRain,
  exam: GraduationCap,
};

export function ControlCentreDashboard() {
  const { state, dispatch } = useSafarState();
  const { analysis, comparison } = useEmergencyAnalysis();
  const emergency = state.emergency;

  const documentedDemand = state.demandSeed.reduce((sum, record) => sum + record.expectedStudents, 0);
  const documentedSeats = state.demandSeed.reduce((sum, record) => sum + record.availableSeats, 0);

  const runScenario = () => {
    const plan = buildEmergencyPlan(state, new Date());
    dispatch({ type: "RUN_EMERGENCY_SCENARIO", plan });
  };

  const resetScenario = () => {
    dispatch({ type: "RESET_EMERGENCY_SCENARIO" });
  };

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Badge tone="brand">
              <ShieldCheck size={11} /> Control centre
            </Badge>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              Four-condition emergency simulation
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
              One combined scenario: two buses break down, demand rises by exactly 40%, a road floods
              and students have examinations within two hours. SAFAR allocates students across the
              remaining fleet, calculates detours and walking legs, and reports who cannot be served.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" onClick={runScenario}>
                <AlertTriangle size={14} /> Start simulation
              </Button>
              <Button variant="secondary" onClick={resetScenario} disabled={!emergency}>
                <RotateCcw size={14} /> Reset simulation
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-abyss/60 p-3 text-[11px] leading-relaxed text-muted">
            <p className="font-semibold text-ink-dim">Scenario clock</p>
            <p className="safar-mono text-sm text-ink">
              {emergency ? `${emergency.startedAt.slice(11, 16)} local` : "not running"}
            </p>
            <p className="mt-2 font-semibold text-ink-dim">Documented baseline</p>
            <p>
              {documentedDemand} students · {documentedSeats} seats ·{" "}
              {Math.max(0, documentedDemand - documentedSeats)} shortage
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-amber-300">
              Simulated / demo data
            </p>
          </div>
        </div>
      </Card>

      {!emergency ? (
        <Card>
          <CardHeader
            title="No emergency scenario is running"
            description="The Control Centre is showing the normal demo network. Run the scenario to introduce all four conditions at once."
            icon={<Activity size={15} />}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                key: "breakdown" as const,
                title: "Two simultaneous breakdowns",
                body: "KA-21-AB-102 (R101) and KA-21-CD-204 (R103) are marked unavailable and their routes stop receiving students.",
              },
              {
                key: "demand" as const,
                title: "+40% demand",
                body: `${documentedDemand} documented students plus ${Math.round(documentedDemand * 0.4)} surge students enter the real allocation engine.`,
              },
              {
                key: "flood" as const,
                title: "Flooded road",
                body: "Puttur – Mangalore Road is closed, its pickup stop submerged, and ring-road detours are calculated.",
              },
              {
                key: "exam" as const,
                title: "Examinations within 2 hours",
                body: "Examination groups are ordered ahead of every other tier and checked against their exam start time.",
              },
            ].map((condition) => {
              const Icon = CONDITION_ICONS[condition.key];
              return (
                <div key={condition.key} className="rounded-lg border border-line bg-abyss/40 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                    <Icon size={13} className="text-brand" /> {condition.title}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">{condition.body}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <EmptyState
              title="Simulation not running"
              body="Everything remains at the documented baseline: 420 students, 350 seats, 70 seat shortage, all buses operating and all roads open."
              icon={<ShieldCheck size={20} />}
              action={
                <Button variant="danger" size="sm" onClick={runScenario}>
                  <AlertTriangle size={14} /> Start simulation
                </Button>
              }
            />
          </div>
        </Card>
      ) : (
        <>
          <Notice tone="warning" title="Simulated emergency — values are calculated from the scenario inputs">
            The engine recomputed demand, seat supply, allocations, detours and walking legs from the
            scenario inputs below. Reset restores the original fleet, roads and allocations, and the
            scenario can be run again without duplicating any student.
          </Notice>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Students in emergency demand"
              value={formatNumber(emergency.emergencyDemandStudents)}
              hint={`${emergency.baseDemandStudents} baseline + ${emergency.surgeStudents} surge (+${emergency.demandIncreasePct}%)`}
              tone="warning"
              icon={<Users size={15} />}
            />
            <StatCard
              label="Operational buses"
              value={`${analysis?.allocation.operationalBusCount ?? 0}/${state.buses.length}`}
              hint={`${analysis?.busSummary.unavailable ?? 0} unavailable · ${analysis?.busSummary.maintenance ?? 0} maintenance`}
              tone="brand"
              icon={<Bus size={15} />}
            />
            <StatCard
              label="Available seats"
              value={formatNumber(analysis?.allocation.availableSeats ?? 0)}
              hint="Documented route seats plus relief-bus capacity"
              tone="brand"
              icon={<Bus size={15} />}
            />
            <StatCard
              label="Students allocated"
              value={formatNumber(analysis?.allocation.allocatedStudents ?? 0)}
              hint={`${analysis?.allocation.assignments.length ?? 0} assignments across ${analysis?.allocation.seatBlocks.length ?? 0} seat blocks`}
              tone="success"
              icon={<ShieldCheck size={15} />}
            />
            <StatCard
              label="Students unserved"
              value={formatNumber(analysis?.allocation.unservedStudents ?? 0)}
              hint="Every unserved group is listed with a reason"
              tone="critical"
              icon={<AlertTriangle size={15} />}
            />
            <StatCard
              label="On replacement buses"
              value={formatNumber(analysis?.allocation.assignedToReplacementBus ?? 0)}
              hint="Relief buses drawn from AVAILABLE fleet only"
              tone="brand"
              icon={<Bus size={15} />}
            />
            <StatCard
              label="Using alternative pickups"
              value={formatNumber(analysis?.allocation.usingAlternativePickup ?? 0)}
              hint="Flooded stop replaced by a walkable pickup"
              tone="warning"
              icon={<CloudRain size={15} />}
            />
            <StatCard
              label="Examination priority"
              value={formatNumber(analysis?.allocation.examPriorityStudents ?? 0)}
              hint={`${analysis?.allocation.examPriorityServed ?? 0} served · ${analysis?.allocation.examPriorityUnserved ?? 0} unserved`}
              tone="critical"
              icon={<GraduationCap size={15} />}
            />
            <StatCard
              label="Expected to arrive late"
              value={formatNumber(analysis?.allocation.lateStudents ?? 0)}
              hint="Estimated arrival compared with the required arrival time"
              tone="warning"
              icon={<CalendarClock size={15} />}
            />
            <StatCard
              label="Awaiting transportation"
              value={formatNumber(analysis?.allocation.unservedStudents ?? 0)}
              hint={`${analysis?.unservedGroups.length ?? 0} groups with explicit reasons`}
              tone="critical"
              icon={<RouteIcon size={15} />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader
                title="Conditions actually applied to the state"
                description="Each condition is an input the allocation engine used, not a dashboard-only figure."
                icon={<Activity size={15} />}
              />
              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-line bg-abyss/40 p-3">
                  <p className="text-xs font-semibold text-ink">1 · Two simultaneous breakdowns</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {state.buses
                      .filter((bus) => emergency.failedBusIds.includes(bus.id))
                      .map((bus) => `${bus.registration} (${bus.assignedRouteId ?? "unassigned"})`)
                      .join(" and ")}{" "}
                    are UNAVAILABLE. Routes {emergency.failedRouteIds.join(", ")} have no current-service
                    seat block, so no student can be assigned to them.
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-abyss/40 p-3">
                  <p className="text-xs font-semibold text-ink">
                    2 · Demand increased by exactly {emergency.demandIncreasePct}%
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {emergency.baseDemandStudents} baseline students became{" "}
                    {emergency.emergencyDemandStudents} emergency students (+{emergency.surgeStudents}).
                    The surge groups are real allocation requests, so the shortage below is calculated
                    from them.
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-abyss/40 p-3">
                  <p className="text-xs font-semibold text-ink">3 · Flooded road</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {emergency.blockedRoadName} is closed to buses and the adjacent pickup stop is
                    submerged. {analysis?.routeAlternatives.length ?? 0} routes were re-routed and no
                    alternative path contains the closed road.
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-abyss/40 p-3">
                  <p className="text-xs font-semibold text-ink">4 · Examination prioritisation</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {analysis?.allocation.examPriorityStudents ?? 0} students have an examination within{" "}
                    {emergency.examWindowMinutes} minutes and were ordered before every other group,
                    then checked against their examination start time.
                  </p>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader
                  title="Affected villages and routes"
                  description="Derived from the student groups and the blocked road."
                  icon={<RouteIcon size={15} />}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {analysis?.affectedRoutes.map((routeId) => (
                    <Badge key={routeId} tone="critical">
                      {routeId}
                    </Badge>
                  ))}
                  {analysis?.affectedRoutes.length === 0 ? (
                    <span className="text-[11px] text-muted">No affected routes.</span>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  {analysis?.affectedStudentGroups ?? 0} student groups across{" "}
                  {analysis?.affectedVillages.length ?? 0} villages were directly affected by a
                  breakdown or the flooded pickup:{" "}
                  {analysis?.affectedVillages
                    .map((villageId) => state.villages.find((village) => village.id === villageId)?.name ?? villageId)
                    .join(", ")}
                  .
                </p>
              </Card>

              <Card>
                <CardHeader
                  title="Fleet and capacity"
                  description="Unavailable and maintenance buses are never used for allocation."
                  icon={<Bus size={15} />}
                />
                <div className="mt-2 space-y-1">
                  {state.buses.map((bus) => (
                    <div
                      key={bus.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 py-1 last:border-0"
                    >
                      <span className="safar-mono text-[11px] text-ink">{bus.registration}</span>
                      <span className="text-[10px] text-muted">{bus.assignedRouteId ?? "unassigned"}</span>
                      <Badge
                        tone={
                          bus.status === "UNAVAILABLE"
                            ? "critical"
                            : bus.status === "MAINTENANCE"
                              ? "warning"
                              : bus.status === "AVAILABLE"
                                ? "brand"
                                : "success"
                        }
                      >
                        {bus.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader
              title="Before and after the emergency"
              description="Both columns are produced by the same allocation engine: 'before' restores the fleet, opens the roads and removes the surge students."
              icon={<Activity size={15} />}
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                    <th className="py-1.5 pr-2 font-semibold">Measure</th>
                    <th className="py-1.5 pr-2 font-semibold">Before emergency</th>
                    <th className="py-1.5 pr-2 font-semibold">After emergency</th>
                    <th className="py-1.5 font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison?.metrics.map((row) => (
                    <tr key={row.key} className="border-b border-line/60 last:border-0">
                      <td className="py-1.5 pr-2 text-ink-dim">{row.label}</td>
                      <td className="safar-mono py-1.5 pr-2 text-ink">{row.before}</td>
                      <td className="safar-mono py-1.5 pr-2 text-ink">{row.after}</td>
                      <td className="py-1.5">
                        <span
                          className={
                            row.tone === "bad"
                              ? "text-red-300"
                              : row.tone === "good"
                                ? "text-emerald-300"
                                : "text-muted"
                          }
                        >
                          {row.delta}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Seat supply uses the documented planning figure for a route and the physical capacity of a
              relief bus, so the two columns describe the same illustrative model with and without the
              emergency.
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Why SAFAR made these decisions"
              description="Generated from the actual allocation, not from a template."
              icon={<ShieldCheck size={15} />}
            />
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ink-dim">
              {analysis?.allocation.decisions.map((decision) => (
                <li key={decision} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                  <span>{decision}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/control-centre/emergency"
              className="safar-card flex items-center justify-between gap-2 p-3 transition-colors hover:border-brand/50"
            >
              <span>
                <span className="block text-xs font-semibold text-ink">Allocation details</span>
                <span className="text-[10px] text-muted">Seat blocks, explanations, unserved groups</span>
              </span>
              <ArrowRight size={14} className="text-brand" />
            </Link>
            <Link
              to="/control-centre/prediction"
              className="safar-card flex items-center justify-between gap-2 p-3 transition-colors hover:border-brand/50"
            >
              <span>
                <span className="block text-xs font-semibold text-ink">Advance prediction</span>
                <span className="text-[10px] text-muted">Events, exams, seasonal risk, provenance</span>
              </span>
              <ArrowRight size={14} className="text-brand" />
            </Link>
            <Link
              to="/control-centre/integration"
              className="safar-card flex items-center justify-between gap-2 p-3 transition-colors hover:border-brand/50"
            >
              <span>
                <span className="block text-xs font-semibold text-ink">Shared integration state</span>
                <span className="text-[10px] text-muted">Reports and incidents from the portal</span>
              </span>
              <ArrowRight size={14} className="text-brand" />
            </Link>
          </div>
        </>
      )}

      <SectionHeading title="Reset behaviour" />
      <p className="text-[11px] leading-relaxed text-muted">
        RESET EMERGENCY SCENARIO restores the original fleet composition, bus availability, road
        conditions and therefore the original student allocations, while keeping student reports and
        travel requests. The scenario can then be run again; because allocations are recomputed from
        scenario inputs rather than stored, repeated runs never duplicate a student assignment.
      </p>
    </div>
  );
}
