import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Bus, ShieldCheck } from "lucide-react";
import { useSafarState } from "../../../state/SafarStateContext";
import { Badge, Card, CardHeader, StatCard } from "../../../components/ui";

/**
 * Honest placeholder for the Government Control Centre workspace.
 *
 * Member 2 is responsible only for the Student Portal. This page documents the
 * shared contract points instead of faking an authority workflow.
 */
export function ControlCentreStatusPage() {
  const { state } = useSafarState();
  const unverified = state.disruptionReports.filter((report) => report.status === "UNVERIFIED");
  const activeIncidents = state.incidents.filter((incident) => incident.status === "ACTIVE");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Workspace
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Government Control Centre</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-dim">
          The Control Centre is delivered by the other SAFAR team members. This page shows the
          shared state that the Student Portal already publishes into, so the two workspaces stay
          connected without a second store or duplicated workflow.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Unverified reports in shared state"
          value={unverified.length}
          hint="Produced by the Student Portal"
          tone={unverified.length > 0 ? "warning" : "muted"}
          icon={<AlertTriangle size={15} />}
        />
        <StatCard
          label="Active confirmed incidents"
          value={activeIncidents.length}
          hint="Consumed by the Student Portal"
          tone={activeIncidents.length > 0 ? "critical" : "success"}
          icon={<Bus size={15} />}
        />
        <StatCard
          label="Fleet records available"
          value={state.buses.length}
          hint="Seed demo fleet shared by every module"
          tone="brand"
          icon={<ShieldCheck size={15} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Integration points already implemented"
            description="Everything the Student Portal reads or writes through the shared contract."
            icon={<ShieldCheck size={15} />}
          />
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>• Canonical state shape and reducer from <code>src/state</code>.</li>
            <li>• Domain entities from <code>src/domain/types</code> matching docs/13.</li>
            <li>• Seed network R101–R104, seven buses, thirteen stops and demand seed 420/350/70.</li>
            <li>• Student actions: SUBMIT_DISRUPTION_REPORT, SUBMIT_TRAVEL_REQUEST, RESET_SCENARIO.</li>
            <li>• Reads: incidents, replacement recommendations, event impacts, shared alerts.</li>
            <li>• Versioned LocalStorage key <code>safar-state-v1</code>.</li>
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Owned by other members"
            description="Deliberately not implemented here to avoid duplicate workflows."
            icon={<Bus size={15} />}
          />
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
            <li>• Report review (verify / reject / duplicate) and incident confirmation.</li>
            <li>• Fleet allocation, replacement ranking and approval.</li>
            <li>• Event CRUD and the weighted event-impact calculation.</li>
            <li>• Demand analytics and capacity charts.</li>
            <li>• Scenario runner, audit presentation and AI explanation panels.</li>
          </ul>
          <p className="mt-2 rounded-md border border-amber-400/25 bg-amber-400/5 p-2 text-[10px] leading-relaxed text-amber-100">
            If those actions are not implemented yet, reports stay UNVERIFIED and no incident,
            replacement or fleet change appears — which is the correct, honest behaviour.
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Return to the Student Portal</p>
            <p className="text-[11px] text-muted">
              Student reminders remain available while the authority workspace is being built.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="muted">Member 2 scope</Badge>
            <Link
              to="/student"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel-2 px-3 py-1.5 text-xs text-ink hover:border-brand/60 hover:text-brand"
            >
              <ArrowLeft size={13} /> Student Dashboard
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
