import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bus,
  CalendarDays,
  ClipboardList,
  Clock,
  MapPin,
  Route as RouteIcon,
  Users,
} from "lucide-react";
import {
  buildRouteContexts,
  generateJourneyOptions,
} from "../../../domain/calculations/journeyPlanner";
import { formatClock, formatDateLabel, formatDuration, todayIso } from "../../../domain/calculations/time";
import { EVENT_CATEGORY_LABELS } from "../../../domain/constants";
import { useSafarState } from "../../../state/SafarStateContext";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  SectionHeading,
  StatCard,
} from "../../../components/ui";
import { JourneySearchForm } from "../../journeys/components/JourneySearchForm";
import { defaultJourneyRequest, plannerHref } from "../../journeys/defaultSearch";
import { useStudentAlerts } from "../alerts";
import { useAlertReadState } from "../useStudentHooks";
import { useStudentSession } from "../session";
import type { JourneySearchRequest } from "../../../domain/types/journey";

const SEVERITY_DOT: Record<string, string> = {
  INFO: "bg-brand",
  WARNING: "bg-amber-300",
  CRITICAL: "bg-red-400",
  SUCCESS: "bg-emerald-400",
};

export function StudentDashboard() {
  const { state } = useSafarState();
  const navigate = useNavigate();
  const session = useStudentSession();
  const alerts = useStudentAlerts();
  const { isRead } = useAlertReadState();

  const unreadAlerts = alerts.filter((alert) => !isRead(alert.id));
  const myReports = state.disruptionReports.filter(
    (report) => report.submittedBySessionId === session.id,
  );
  const myRequests = state.travelRequests.filter(
    (request) => request.submittedBySessionId === session.id,
  );
  const unverifiedReports = myReports.filter((report) => report.status === "UNVERIFIED");
  const activeIncidents = state.incidents.filter((incident) => incident.status === "ACTIVE");

  const nextRequest = useMemo(() => {
    const today = todayIso();
    return [...myRequests]
      .filter((request) => request.travelDate >= today)
      .sort((a, b) =>
        `${a.travelDate}${a.requiredArrivalTime}`.localeCompare(`${b.travelDate}${b.requiredArrivalTime}`),
      )[0];
  }, [myRequests]);

  const nextPlan = useMemo(() => {
    if (!nextRequest) return undefined;
    return generateJourneyOptions(state, {
      originVillageId: nextRequest.originVillageId,
      destinationId: nextRequest.destinationId,
      travelDate: nextRequest.travelDate,
      requiredArrivalTime: nextRequest.requiredArrivalTime,
    });
  }, [state, nextRequest]);

  const routeContexts = useMemo(() => buildRouteContexts(state), [state]);
  const routeStatusRows = state.routes.map((route) => {
    const context = routeContexts.get(route.id);
    return {
      route,
      blocked: context?.blocked ?? false,
      incidents: context?.activeIncidents ?? [],
      impacts: context?.eventImpacts ?? [],
      delay: context?.baseDelayMinutes ?? 0,
    };
  });
  const affectedRouteCount = routeStatusRows.filter(
    (row) => row.blocked || row.incidents.length > 0 || row.impacts.length > 0,
  ).length;

  const defaultRequest = defaultJourneyRequest(state, session.homeVillageId);

  const handleQuickSearch = (request: JourneySearchRequest) => {
    navigate(plannerHref(request));
  };

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Badge tone="brand">
              <Bus size={11} /> Student services
            </Badge>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              Plan your journey to college
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
              Search bus journeys from your village, compare arrival times, check service updates and
              report a bus that has not arrived.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => navigate(plannerHref(defaultRequest))}>
                <RouteIcon size={14} /> Plan a journey
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate("/student/report")}>
                <AlertTriangle size={14} /> Report a disruption
              </Button>
              <Link
                to="/student/alerts"
                className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-ink-dim hover:border-line-strong hover:text-ink"
              >
                <Bell size={14} /> {unreadAlerts.length} new alert
                {unreadAlerts.length === 1 ? "" : "s"}
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-panel-2 p-3 text-[11px] leading-relaxed text-muted">
            <p className="font-semibold text-ink-dim">Signed in</p>
            <p className="text-ink">{session.displayName}</p>
            <p>{session.label}</p>
            <p className="mt-2 font-semibold text-ink-dim">Journey date</p>
            <p>{formatDateLabel(state.scenario.scenarioDate)}</p>
            <p className="mt-2 text-[10px] text-amber-800">Illustrative demonstration data</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Unread alerts"
          value={unreadAlerts.length}
          hint="Derived from shared demo state"
          tone={unreadAlerts.length > 0 ? "warning" : "success"}
          icon={<Bell size={15} />}
        />
        <StatCard
          label="Unverified reports"
          value={unverifiedReports.length}
          hint="Awaiting authority review"
          tone={unverifiedReports.length > 0 ? "warning" : "muted"}
          icon={<AlertTriangle size={15} />}
        />
        <StatCard
          label="Confirmed incidents"
          value={activeIncidents.length}
          hint="Network-wide in the demo state"
          tone={activeIncidents.length > 0 ? "critical" : "success"}
          icon={<Bus size={15} />}
        />
        <StatCard
          label="Routes needing attention"
          value={`${affectedRouteCount}/${state.routes.length}`}
          hint="Predicted event impact or confirmed disruption"
          tone={affectedRouteCount > 0 ? "warning" : "success"}
          icon={<RouteIcon size={15} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Quick journey search"
              description="Origin village, destination, travel date and the time you must arrive by."
              icon={<RouteIcon size={15} />}
            />
            <div className="mt-3">
              <JourneySearchForm
                initial={defaultRequest}
                onSubmit={handleQuickSearch}
                submitLabel="Open journey planner"
                compact
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Your next planned journey"
              description="Based on your most recent travel submission."
              icon={<CalendarDays size={15} />}
              action={
                <Link to="/student/submissions" className="text-[11px] text-brand hover:underline">
                  My travel plans
                </Link>
              }
            />
            <div className="mt-3">
              {!nextRequest ? (
                <EmptyState
                  title="No upcoming travel plan"
                  body="Submit your intended journey so SAFAR can aggregate demand and watch for changes on your route."
                  icon={<ClipboardList size={20} />}
                  action={
                    <Link to="/student/submissions">
                      <Button size="sm" variant="secondary">
                        Add a travel plan
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>
                      {state.villages.find((village) => village.id === nextRequest.originVillageId)?.name ??
                        "Origin"}{" "}
                      <ArrowRight size={11} className="inline" />{" "}
                      {state.destinations.find((destination) => destination.id === nextRequest.destinationId)
                        ?.name ?? "Destination"}
                    </span>
                    <Badge tone="muted">
                      <Users size={10} /> {nextRequest.groupSize} traveller
                      {nextRequest.groupSize === 1 ? "" : "s"}
                    </Badge>
                    <Badge tone="muted">{formatDateLabel(nextRequest.travelDate)}</Badge>
                    <Badge tone="brand">arrive by {nextRequest.requiredArrivalTime}</Badge>
                  </div>

                  {nextPlan?.recommendations[0] ? (
                    <div className="rounded-lg border border-line bg-abyss/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted">
                        Current fastest option
                      </p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-2">
                        <span className="safar-mono text-lg font-semibold text-ink">
                          {formatClock(nextPlan.recommendations[0].journey.departureTime)}
                        </span>
                        <ArrowRight size={13} className="text-muted" />
                        <span className="safar-mono text-lg font-semibold text-ink">
                          {formatClock(nextPlan.recommendations[0].journey.arrivalTime)}
                        </span>
                        <span className="text-[11px] text-muted">
                          {formatDuration(nextPlan.recommendations[0].journey.totalDurationMinutes)} ·{" "}
                          {nextPlan.recommendations[0].journey.transferCount} change
                          {nextPlan.recommendations[0].journey.transferCount === 1 ? "" : "s"} · ~
                          {nextPlan.recommendations[0].journey.walkingMetersApprox} m walking (approx.)
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {nextPlan.recommendations[0].journey.legs.map((leg) => (
                          <span key={leg.serviceId} className="safar-chip">
                            {leg.routeId} · {leg.busRegistration}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Notice tone="critical" title="No journey currently meets your arrival time">
                      Re-plan from the Journey Planner to compare late alternatives or change your
                      deadline.
                    </Notice>
                  )}

                  <Link
                    to={plannerHref({
                      originVillageId: nextRequest.originVillageId,
                      destinationId: nextRequest.destinationId,
                      travelDate: nextRequest.travelDate,
                      requiredArrivalTime: nextRequest.requiredArrivalTime,
                    })}
                    className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                  >
                    View full plan and alternatives <ArrowRight size={11} />
                  </Link>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Route and journey status today"
              description="Confirmed incidents and predicted event impact from the shared demo state."
              icon={<Bus size={15} />}
            />
            <div className="mt-3 space-y-2">
              {routeStatusRows.map((row) => (
                <div
                  key={row.route.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line bg-abyss/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">
                      {row.route.id} · {row.route.name}
                    </p>
                    <p className="text-[10px] text-muted">
                      {row.impacts.length > 0
                        ? row.impacts
                            .map(
                              ({ event, impact }) =>
                                `${EVENT_CATEGORY_LABELS[event.category] ?? event.category} · impact ${impact.impactScore}/100`,
                            )
                            .join(" · ")
                        : "No predicted event impact for this date"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {row.blocked ? <Badge tone="critical">Route blocked</Badge> : null}
                    {row.incidents.map((incident) => (
                      <Badge key={incident.id} tone="critical">
                        Confirmed incident
                      </Badge>
                    ))}
                    {row.delay > 0 ? <Badge tone="warning">~{row.delay} min delay</Badge> : null}
                    {!row.blocked && row.incidents.length === 0 && row.impacts.length === 0 ? (
                      <Badge tone="success">Operating normally</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Latest alerts"
              description="Only updates that come from the shared application state."
              icon={<Bell size={15} />}
              action={
                <Link to="/student/alerts" className="text-[11px] text-brand hover:underline">
                  View all
                </Link>
              }
            />
            <div className="mt-3 space-y-2">
              {alerts.length === 0 ? (
                <EmptyState
                  title="No alerts right now"
                  body="Event warnings, confirmed incidents, report updates and approved replacements will appear here."
                  icon={<Bell size={20} />}
                />
              ) : (
                alerts.slice(0, 3).map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.actionHref ?? "/student/alerts"}
                    className="block rounded-lg border border-line bg-abyss/40 p-2.5 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          SEVERITY_DOT[alert.severity] ?? "bg-muted"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold leading-snug text-ink">
                          {alert.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted">
                          {alert.body}
                        </p>
                        {!isRead(alert.id) ? (
                          <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wide text-brand">
                            New
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Missed your bus?"
              description="See the next feasible departure, or tell the control room what happened. Reports stay unverified until an operator reviews them."
              icon={<AlertTriangle size={15} />}
            />
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Link to={plannerHref(defaultRequest)}>
                  <Button variant="primary" className="w-full">
                    <RouteIcon size={14} /> Find the next bus
                  </Button>
                </Link>
                <Link to="/student/report">
                  <Button variant="danger" className="w-full">
                    <AlertTriangle size={14} /> Report it
                  </Button>
                </Link>
              </div>
              <p className="text-[10px] leading-relaxed text-muted">
                A report does not mark a bus unavailable and does not create a confirmed incident.
                Only an authority can confirm an incident after review.
              </p>
              <div className="flex flex-wrap gap-2 border-t border-line pt-2 text-[10px] text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {unverifiedReports.length} awaiting review
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {myReports.length} total report
                  {myReports.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeading title="How SAFAR decides" />
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>• Timetable feasibility and journey duration are calculated deterministically.</li>
              <li>• The three recommendations are ranked independently, never duplicated by label.</li>
              <li>• Reliability is illustrative, not a validated probability.</li>
              <li>• Walking distances are approximations, not road-routed measurements.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
