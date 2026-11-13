import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from "lucide-react";
import { formatDateTimeLabel } from "../../../domain/calculations/time";
import { useSafarState } from "../../../state/SafarStateContext";
import { Badge, Button, Card, CardHeader, EmptyState, cx } from "../../../components/ui";
import { useStudentAlerts, type StudentAlertCategory } from "../alerts";
import { useAlertReadState } from "../useStudentHooks";

const CATEGORY_LABELS: Record<StudentAlertCategory | "ALL", string> = {
  ALL: "All",
  REPORT: "My reports",
  INCIDENT: "Confirmed incidents",
  REPLACEMENT: "Replacements",
  EVENT: "Event warnings",
  JOURNEY_CHANGE: "Recommendation changes",
  SERVICE: "Service notices",
};

const SEVERITY_META = {
  INFO: { icon: Info, className: "border-brand/25 bg-brand/5", accent: "text-brand" },
  WARNING: { icon: AlertTriangle, className: "border-amber-400/25 bg-amber-400/5", accent: "text-amber-300" },
  CRITICAL: { icon: XCircle, className: "border-red-400/25 bg-red-400/5", accent: "text-red-300" },
  SUCCESS: { icon: CheckCircle2, className: "border-emerald-400/25 bg-emerald-400/5", accent: "text-emerald-300" },
} as const;

export function JourneyAlertsPage() {
  const { state } = useSafarState();
  const alerts = useStudentAlerts();
  const { isRead, markRead, markAllRead } = useAlertReadState();
  const [category, setCategory] = useState<StudentAlertCategory | "ALL">("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(
    () =>
      alerts.filter((alert) => {
        if (category !== "ALL" && alert.category !== category) return false;
        if (unreadOnly && isRead(alert.id)) return false;
        return true;
      }),
    [alerts, category, unreadOnly, isRead],
  );

  const unreadCount = alerts.filter((alert) => !isRead(alert.id)).length;
  const categories = useMemo(() => {
    const present = new Set(alerts.map((alert) => alert.category));
    return ["ALL", ...Object.keys(CATEGORY_LABELS).filter((key) => key !== "ALL" && present.has(key as StudentAlertCategory))] as Array<
      StudentAlertCategory | "ALL"
    >;
  }, [alerts]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Operational updates
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Journey Alerts</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-dim">
            Event predictions, confirmed incidents, report reviews, replacement approvals and
            changed journey recommendations — all derived from the shared demo state, never a
            hardcoded notification list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={unreadCount > 0 ? "warning" : "success"}>{unreadCount} unread</Badge>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => markAllRead(alerts.map((alert) => alert.id))}
            disabled={alerts.length === 0}
          >
            <CheckCheck size={13} /> Mark all read
          </Button>
        </div>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {categories.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  category === key
                    ? "border-brand/50 bg-brand/10 text-brand"
                    : "border-line text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {CATEGORY_LABELS[key]}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-line-strong bg-abyss accent-cyan-400"
            />
            Unread only
          </label>
        </div>

        <div className="space-y-2 p-4">
          {filtered.length === 0 ? (
            <EmptyState
              title="No alerts match this view"
              body={
                alerts.length === 0
                  ? `No operational updates in the shared demo state. The demo scenario date is ${state.scenario.scenarioDate}.`
                  : "Try another category or clear the unread filter."
              }
              icon={<Bell size={22} />}
              action={
                alerts.length === 0 ? (
                  <Link to="/student/planner">
                    <Button size="sm" variant="secondary">
                      Plan a journey
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            filtered.map((alert) => {
              const meta = SEVERITY_META[alert.severity];
              const Icon = meta.icon;
              const read = isRead(alert.id);
              return (
                <article
                  key={alert.id}
                  className={cx(
                    "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start",
                    meta.className,
                    !read && "border-l-2 border-l-brand",
                  )}
                >
                  <span className={cx("mt-0.5 shrink-0", meta.accent)}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xs font-semibold text-ink">{alert.title}</h2>
                      {!read ? (
                        <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                          New
                        </span>
                      ) : null}
                      <span className="text-[10px] text-muted">
                        {formatDateTimeLabel(alert.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">{alert.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="muted">{alert.provenance.toLowerCase()}</Badge>
                      {alert.routeIds.map((routeId) => (
                        <Badge key={routeId} tone="neutral">
                          {routeId}
                        </Badge>
                      ))}
                      {alert.actionHref ? (
                        <Link to={alert.actionHref} className="text-[10px] font-semibold text-brand hover:underline">
                          {alert.actionLabel ?? "Open"}
                        </Link>
                      ) : null}
                      {!read ? (
                        <button
                          type="button"
                          onClick={() => markRead(alert.id)}
                          className="text-[10px] text-muted hover:text-ink"
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Alert provenance"
          description="Why each alert type appears."
          icon={<Info size={15} />}
        />
        <ul className="mt-2 grid gap-1.5 text-[11px] leading-relaxed text-muted sm:grid-cols-2">
          <li>• Reports: status changes written by the authority review workflow.</li>
          <li>• Incidents: only CONFIRMED, active incidents produce a critical alert.</li>
          <li>• Replacements: approved allocations appear as operational updates.</li>
          <li>• Events: predicted impact warnings, explicitly not road closures.</li>
          <li>• Recommendation changes: re-plans your saved searches against current state.</li>
          <li>• Service notices: shared student/authority announcements from the store.</li>
        </ul>
      </Card>
    </div>
  );
}
