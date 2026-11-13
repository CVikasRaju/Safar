import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bus,
  CloudRain,
  GraduationCap,
  Route as RouteIcon,
  Users,
} from "lucide-react";
import { useSafarState } from "../../../state/SafarStateContext";
import {
  MAX_ACCESS_WALK_METERS,
  closedStopIds,
  findAlternativePickup,
} from "../../../domain/emergency/roads";
import { Badge, Card, CardHeader, EmptyState, Notice, SectionHeading } from "../../../components/ui";
import { TierBadge, formatNumber, formatWalk } from "../components";
import { useEmergencyAnalysis } from "../useEmergency";

export function ControlCentreEmergencyPage() {
  const { state } = useSafarState();
  const { analysis } = useEmergencyAnalysis();
  const emergency = state.emergency;

  const replacementPickups = useMemo(() => {
    if (!emergency || !analysis) return [];
    const submerged = closedStopIds(emergency.roadConditions);
    const operationalRouteIds = [
      ...new Set(analysis.allocation.seatBlocks.map((block) => block.routeId)),
    ];
    return submerged
      .map((stopId) => {
        const pickup = findAlternativePickup(
          state.stops,
          state.routes,
          operationalRouteIds,
          submerged,
          stopId,
        );
        return pickup
          ? {
              ...pickup,
              originalStopName:
                state.stops.find((stop) => stop.id === stopId)?.name ?? stopId,
            }
          : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [analysis, emergency, state.routes, state.stops]);

  if (!emergency || !analysis) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Emergency allocation"
            description="Allocation details appear once the emergency scenario is running."
            icon={<Users size={15} />}
          />
          <div className="mt-3">
            <EmptyState
              title="No active emergency"
              body="Run the emergency scenario from the Control Centre dashboard to allocate students with the full four-condition engine."
              icon={<AlertTriangle size={20} />}
              action={
                <Link
                  to="/control-centre"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel-2 px-3 py-1.5 text-xs text-ink hover:border-brand/60 hover:text-brand"
                >
                  <ArrowLeft size={13} /> Back to Control Centre
                </Link>
              }
            />
          </div>
        </Card>
      </div>
    );
  }

  const allocation = analysis.allocation;
  const examAssignments = allocation.assignments.filter(
    (assignment) => assignment.priorityTier === "EXAM_IMMINENT",
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Emergency response
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Student allocation, alternatives and walking
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-dim">
            Every number below is computed from the active scenario: {allocation.assignments.length}{" "}
            assignments across {allocation.seatBlocks.length} seat blocks, ordered by examination
            priority, deadline, breakdown, flood exposure and standard demand.
          </p>
        </div>
        <Link
          to="/control-centre"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel-2 px-3 py-1.5 text-xs text-ink hover:border-brand/60 hover:text-brand"
        >
          <ArrowLeft size={13} /> Emergency overview
        </Link>
      </div>

      <Notice tone="info" title="Allocation rules enforced by the engine">
        An unavailable bus cannot receive students, no seat block is over-allocated, each group appears
        in at most one assignment, and groups that cannot be placed are listed with the reason they were
        left out.
      </Notice>

      <Card>
        <CardHeader
          title="Seat capacity actually used"
          description="Current-service blocks use the documented route seat figure; relief buses offer physical capacity from buses marked AVAILABLE."
          icon={<Bus size={15} />}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-2 font-semibold">Route</th>
                <th className="py-1.5 pr-2 font-semibold">Bus</th>
                <th className="py-1.5 pr-2 font-semibold">Type</th>
                <th className="py-1.5 pr-2 font-semibold">Capacity</th>
                <th className="py-1.5 pr-2 font-semibold">Allocated</th>
                <th className="py-1.5 pr-2 font-semibold">Free</th>
                <th className="py-1.5 font-semibold">Basis</th>
              </tr>
            </thead>
            <tbody>
              {allocation.seatBlocks.map((block) => (
                <tr key={block.id} className="border-b border-line/60 last:border-0">
                  <td className="py-1.5 pr-2 text-ink">{block.routeId}</td>
                  <td className="safar-mono py-1.5 pr-2 text-ink-dim">{block.registration}</td>
                  <td className="py-1.5 pr-2">
                    <Badge tone={block.kind === "RELIEF" ? "brand" : "success"}>
                      {block.kind === "RELIEF" ? "Relief bus" : "Current service"}
                    </Badge>
                  </td>
                  <td className="safar-mono py-1.5 pr-2">{block.capacity}</td>
                  <td className="safar-mono py-1.5 pr-2">{block.used}</td>
                  <td className="safar-mono py-1.5 pr-2">{block.capacity - block.used}</td>
                  <td className="py-1.5 text-[10px] text-muted">
                    {block.basis === "ROUTE_SEAT_SUPPLY"
                      ? "Documented route seats"
                      : block.basis === "RELIEF_BUS_CAPACITY"
                        ? "Relief bus capacity"
                        : "Spare physical seats"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Buses {emergency.failedBusIds.join(", ")} are UNAVAILABLE and therefore have no seat block at
          all. Routes {emergency.failedRouteIds.join(", ")} are covered only by relief capacity.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Alternative routes around the flooded road"
          description={`${emergency.blockedRoadName} is closed. These paths are the shortest simulated alternatives that never use a blocked road.`}
          icon={<CloudRain size={15} />}
        />
        <div className="mt-3 space-y-2">
          {analysis.routeAlternatives.length === 0 ? (
            <p className="text-[11px] text-muted">No route uses the closed road in this scenario.</p>
          ) : (
            analysis.routeAlternatives.map((alternative) => (
              <div key={alternative.routeId} className="rounded-lg border border-line bg-abyss/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink">
                    {alternative.routeId} · {alternative.routeName}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="critical">Road blocked</Badge>
                    <Badge tone="warning">
                      +{alternative.additionalDistanceKm} km · +{alternative.additionalMinutes} min
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Blocked: {alternative.blockedRoadName}. Alternative path:{" "}
                  {alternative.alternativePath.roadIds
                    .map(
                      (roadId) =>
                        emergency.roads.find((road) => road.id === roadId)?.name ?? roadId,
                    )
                    .join(" → ")}{" "}
                  ({alternative.alternativePath.distanceKm} km, {alternative.alternativePath.minutes}{" "}
                  min, simulated).
                </p>
                <p className="mt-1 text-[10px] text-muted">
                  Replacement bus:{" "}
                  {alternative.replacementBusRegistrations.length > 0
                    ? alternative.replacementBusRegistrations.join(", ")
                    : "none assigned to this route — its capacity is provided by the current service"}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-4">
          <SectionHeading
            title="Replacement pickups and walking distance"
            description="Walking values are approximations (straight-line × 1.35 at 4.8 km/h), not road-routed pedestrian distances."
          />
          {replacementPickups.length === 0 ? (
            <p className="text-[11px] text-muted">No pickup stop is submerged.</p>
          ) : (
            replacementPickups.map((pickup) => (
              <div
                key={pickup.stopId}
                className="rounded-lg border border-line bg-abyss/40 p-3 text-[11px] leading-relaxed"
              >
                <p className="font-semibold text-ink">
                  {pickup.originalStopName} → {pickup.stopName}
                </p>
                <p className="mt-0.5 text-muted">
                  Walking distance {formatWalk(pickup.approxMetres, pickup.minutes)} · method:{" "}
                  {pickup.method}
                </p>
                {pickup.exceedsAccessWalkLimit ? (
                  <p className="mt-1 text-amber-300">
                    This exceeds the documented {MAX_ACCESS_WALK_METERS / 1000} km access-walk limit, so
                    those students are flagged as requiring a feeder shuttle rather than being presented
                    with a realistic walk.
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Examination priority"
          description={`${allocation.examPriorityStudents} students have an examination within ${emergency.examWindowMinutes} minutes of the scenario clock.`}
          icon={<GraduationCap size={15} />}
        />
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge tone="critical">{allocation.examPriorityStudents} exam students</Badge>
          <Badge tone="success">{allocation.examPriorityServed} seated</Badge>
          <Badge tone={allocation.examPriorityUnserved > 0 ? "critical" : "success"}>
            {allocation.examPriorityUnserved} without a seat
          </Badge>
        </div>
        <div className="mt-3 space-y-1.5">
          {examAssignments.length === 0 ? (
            <p className="text-[11px] text-muted">No examination group received a seat.</p>
          ) : (
            examAssignments.map((assignment) => (
              <div
                key={assignment.studentId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-abyss/40 px-3 py-2 text-[11px]"
              >
                <span className="text-ink">
                  {assignment.label} · {assignment.students} students
                </span>
                <span className="safar-mono text-ink-dim">
                  {assignment.routeId} · {assignment.busRegistration} · arrives{" "}
                  {assignment.estimatedArrival}
                </span>
                <Badge tone={assignment.meetsExam ? "success" : "critical"}>
                  {assignment.meetsExam ? "before exam" : "after exam start"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`Allocation results — ${allocation.allocatedStudents} of ${allocation.totalStudents} students seated`}
          description="Each assignment carries the reasoning produced by the engine from the actual capacity and timing calculations."
          icon={<Users size={15} />}
        />
        <div className="mt-3 space-y-2">
          {allocation.assignments.map((assignment) => (
            <div key={assignment.studentId} className="rounded-lg border border-line bg-abyss/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink">
                  {assignment.label} · {assignment.students} student
                  {assignment.students === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap gap-1">
                  <TierBadge tier={assignment.priorityTier} short />
                  {assignment.isReassignment ? <Badge tone="brand">REALLOCATED</Badge> : null}
                  {assignment.isReliefBus ? <Badge tone="warning">Replacement bus</Badge> : null}
                  {assignment.alternativePickup ? (
                    <Badge tone="warning">Alternative pickup</Badge>
                  ) : null}
                  <Badge tone={assignment.meetsDeadline ? "success" : "critical"}>
                    {assignment.meetsDeadline ? "On time" : "Late"}
                  </Badge>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {assignment.routeId} · {assignment.busRegistration} · boards{" "}
                {state.stops.find((stop) => stop.id === assignment.effectivePickupStopId)?.name ??
                  assignment.effectivePickupStopId}{" "}
                · estimated arrival {assignment.estimatedArrival}
                {assignment.walkingMetresApprox !== undefined
                  ? ` · walk ${formatWalk(assignment.walkingMetresApprox, assignment.walkingMinutes)}`
                  : ""}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-dim">{assignment.explanation}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`Unserved students — ${allocation.unservedStudents}`}
          description="These groups could not be placed. They are reported explicitly, never silently dropped."
          icon={<AlertTriangle size={15} />}
        />
        <div className="mt-3 space-y-2">
          {allocation.unserved.length === 0 ? (
            <p className="text-[11px] text-muted">Every student group received a seat.</p>
          ) : (
            allocation.unserved.map((group) => (
              <div
                key={`${group.studentId}-${group.reason}`}
                className="rounded-lg border border-red-400/25 bg-red-400/5 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-red-200">
                    {group.label} · {group.students} student{group.students === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <TierBadge tier={group.priorityTier} short />
                    {group.hasExam ? <Badge tone="critical">Exam {group.examStartTime}</Badge> : null}
                  </div>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">{group.reason}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <SectionHeading title="Calculation notes" />
        <ul className="space-y-1 text-[11px] leading-relaxed text-muted">
          {allocation.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
          <li>
            • Route {emergency.blockedRoadId} closure and all road distances are simulated demo data.
          </li>
        </ul>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
          <RouteIcon size={11} /> {formatNumber(allocation.totalStudents)} students requested transport
          · {formatNumber(allocation.availableSeats)} seats offered ·{" "}
          {formatNumber(allocation.unservedStudents)} unserved
        </p>
      </Card>
    </div>
  );
}
