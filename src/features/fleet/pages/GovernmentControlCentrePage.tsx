import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bus as BusIcon,
  CheckCircle2,
  Layers,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useSafarState } from "../../../state/SafarStateContext";
import { calculateFleetIndicators } from "../../../domain/calculations/fleetRanking";
import {
  prepareApproveReplacement,
  prepareRejectReplacement,
  prepareSimulateBreakdown,
  runLiveDemonstrationScenario,
} from "../../../domain/services/fleetActions";
import type { Bus } from "../../../domain/types";
import { Badge, Button, Card, CardHeader, Mono, cx } from "../../../components/ui";
import { FleetMetricsGrid } from "../components/FleetMetricsGrid";
import { FleetTable } from "../components/FleetTable";
import { BusDetailsModal } from "../components/BusDetailsModal";
import { BreakdownModal } from "../components/BreakdownModal";
import { ReplacementRecommendationCard } from "../components/ReplacementRecommendationCard";
import { LiveScenarioCard } from "../components/LiveScenarioCard";

type TabType = "overview" | "fleet" | "recommendations" | "scenario";

export function GovernmentControlCentrePage() {
  const { state, dispatch, resetDemoData } = useSafarState();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Modals state
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [breakdownTargetBus, setBreakdownTargetBus] = useState<Bus | null>(null);
  const [statusFilterPreset, setStatusFilterPreset] = useState<string>("ALL");

  // Operational indicators calculated purely from shared canonical state
  const indicators = useMemo(() => calculateFleetIndicators(state), [state]);

  // Active incidents & recommendations
  const activeIncidents = state.incidents.filter((i) => i.status === "ACTIVE");
  const activeRecommendation = state.replacementRecommendations.find((r) => r.status === "PENDING") ??
    state.replacementRecommendations[0];

  // Actions
  const handleSimulateBreakdown = (busId: string) => {
    const res = prepareSimulateBreakdown(state, busId);
    if (res.ok) {
      dispatch({
        type: "SIMULATE_BREAKDOWN",
        incident: res.value.incident,
        recommendation: res.value.recommendation,
        updatedBuses: res.value.updatedBuses,
        alerts: res.value.alerts,
        audit: res.value.audit,
      });
      setActiveTab("recommendations");
    }
  };

  const handleApproveReplacement = (recommendationId: string, approvedBusId: string) => {
    const res = prepareApproveReplacement(state, recommendationId, approvedBusId);
    if (res.ok) {
      dispatch({
        type: "APPROVE_REPLACEMENT",
        updatedBuses: res.value.updatedBuses,
        updatedRecommendation: res.value.updatedRecommendation,
        updatedTimetableServices: res.value.updatedTimetableServices,
        alerts: res.value.alerts,
        audit: res.value.audit,
      });
    }
  };

  const handleRejectReplacement = (recommendationId: string, reason: string) => {
    const res = prepareRejectReplacement(state, recommendationId, reason);
    if (res.ok) {
      dispatch({
        type: "REJECT_REPLACEMENT",
        updatedRecommendation: res.value.updatedRecommendation,
        alerts: res.value.alerts,
        audit: res.value.audit,
      });
    }
  };

  const handleRunLiveScenario = () => {
    const { state: nextState } = runLiveDemonstrationScenario(state);
    dispatch({ type: "APPLY_LIVE_SCENARIO", state: nextState });
    setActiveTab("scenario");
  };

  return (
    <div className="space-y-5">
      {/* Top Authority Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/40 bg-brand/10 text-brand">
              <ShieldCheck size={18} />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Government Control Centre
            </h1>
            <Badge tone="brand">Transport Authority Workspace</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-dim max-w-2xl leading-relaxed">
            Real-time rural transit command, fleet operations, capacity monitoring, immediate breakdown response,
            and automated multi-criteria replacement dispatch (Puttur regional network).
          </p>
        </div>

        {/* Global Quick Action CTAs */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              const defaultOperatingBus = state.buses.find((b) => b.id === "bus-ka21ab102" && b.status === "OPERATING") ??
                state.buses.find((b) => b.status === "OPERATING");
              if (defaultOperatingBus) setBreakdownTargetBus(defaultOperatingBus);
            }}
          >
            <AlertTriangle size={14} /> Simulate Bus Breakdown
          </Button>

          <Button variant="primary" size="sm" onClick={handleRunLiveScenario}>
            <Play size={14} /> Run SAFAR Live Scenario
          </Button>

          <Button variant="secondary" size="sm" onClick={resetDemoData}>
            <RefreshCw size={13} /> Reset Scenario
          </Button>
        </div>
      </div>

      {/* Disruption Alert Banner if active incidents exist */}
      {activeIncidents.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 rounded-full bg-red-400/20 p-1 text-red-300">
              <ShieldAlert size={18} />
            </span>
            <div>
              <p className="font-bold text-red-200">
                ACTIVE DISRUPTION DETECTED — IMMEDIATE AUTHORITY RESPONSE REQUIRED
              </p>
              <p className="mt-0.5 text-ink-dim leading-relaxed">
                {activeIncidents.length} confirmed operational incident(s). Bus breakdown on{" "}
                <strong>{activeIncidents[0]?.routeId ?? "network"}</strong>. Review ranked replacement options.
              </p>
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setActiveTab("recommendations")}
          >
            Review Replacement Proposal →
          </Button>
        </div>
      ) : null}

      {/* Workspace Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cx(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
            activeTab === "overview"
              ? "bg-brand/15 text-brand border border-brand/40"
              : "text-ink-dim hover:bg-panel-2 hover:text-ink",
          )}
        >
          <Layers size={14} /> Operational Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fleet")}
          className={cx(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
            activeTab === "fleet"
              ? "bg-brand/15 text-brand border border-brand/40"
              : "text-ink-dim hover:bg-panel-2 hover:text-ink",
          )}
        >
          <BusIcon size={14} /> Fleet Operations & Management
          <span className="rounded-full bg-panel-2 px-1.5 py-0.2 text-[10px] text-muted">
            {state.buses.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recommendations")}
          className={cx(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
            activeTab === "recommendations"
              ? "bg-brand/15 text-brand border border-brand/40"
              : "text-ink-dim hover:bg-panel-2 hover:text-ink",
          )}
        >
          <ShieldCheck size={14} /> Replacement Recommendations
          {state.replacementRecommendations.length > 0 ? (
            <span className="rounded-full bg-red-400/20 px-1.5 py-0.2 text-[10px] font-bold text-red-200">
              {state.replacementRecommendations.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("scenario")}
          className={cx(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
            activeTab === "scenario"
              ? "bg-brand/15 text-brand border border-brand/40"
              : "text-ink-dim hover:bg-panel-2 hover:text-ink",
          )}
        >
          <Sparkles size={14} className="text-brand" /> SAFAR Live Scenario
        </button>
      </div>

      {/* Tab 1: Operational Overview */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <FleetMetricsGrid
            indicators={indicators}
            onFilterStatus={(status) => {
              setStatusFilterPreset(status);
              setActiveTab("fleet");
            }}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Active Incident Summary */}
            <Card>
              <CardHeader
                title="Active Operational Disruption Status"
                description="Real-time incidents confirmed by transport authorities requiring coordination."
                icon={<AlertTriangle size={16} className="text-amber-300" />}
              />
              {activeIncidents.length > 0 ? (
                <div className="mt-3 space-y-2.5">
                  {activeIncidents.map((inc) => {
                    const bus = state.buses.find((b) => b.id === inc.busId);
                    return (
                      <div
                        key={inc.id}
                        className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-red-300">{inc.type.replace("_", " ")}</span>
                          <Badge tone="critical">{inc.severity}</Badge>
                        </div>
                        <p className="mt-1 text-ink-dim leading-relaxed">{inc.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                          <span>Route: <strong className="text-brand">{inc.routeId}</strong></span>
                          <span>Bus: <strong className="text-ink">{bus?.registration ?? inc.busId}</strong></span>
                          <span>Time: {new Date(inc.occurredAt).toTimeString().slice(0, 5)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-1.5" />
                  <p className="font-semibold text-ink">All Routes Operating Normally</p>
                  <p className="mt-0.5">No active confirmed breakdowns on the rural network.</p>
                </div>
              )}
            </Card>

            {/* Demand & Capacity Overview */}
            <Card>
              <CardHeader
                title="Student Demand & Capacity Distribution"
                description="Aggregated demand and seat allocation across seeded rural routes (docs/08)."
                icon={<Users size={16} className="text-brand" />}
              />
              <div className="mt-3 space-y-2 text-xs">
                {state.demandSeed.map((item) => {
                  const shortage = Math.max(0, item.expectedStudents - item.availableSeats);
                  const surplus = Math.max(0, item.availableSeats - item.expectedStudents);
                  const route = state.routes.find((r) => r.id === item.routeId);

                  return (
                    <div
                      key={item.routeId}
                      className="flex items-center justify-between rounded-lg border border-line bg-abyss/40 p-2.5"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-brand">{item.routeId}</span>
                          <span className="text-ink-dim text-[11px]">{route?.name}</span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted">
                          Demand: <Mono>{item.expectedStudents}</Mono> · Seats: <Mono>{item.availableSeats}</Mono>
                        </p>
                      </div>

                      <div className="text-right">
                        {shortage > 0 ? (
                          <span className="rounded bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                            Shortage: {shortage} seats
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            Surplus: {surplus} seats
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Quick jump to Fleet Table */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-ink">Fleet Overview Snapshot</p>
                <p className="text-[11px] text-muted">
                  Inspect bus locations, seat occupancies, and operational statuses.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab("fleet")}>
                View Full Fleet Table ({state.buses.length} buses) →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Fleet Operations & Management */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          <FleetTable
            buses={state.buses}
            routes={state.routes}
            initialStatusFilter={statusFilterPreset}
            onSelectBus={(bus) => setSelectedBus(bus)}
            onSimulateBreakdown={(bus) => setBreakdownTargetBus(bus)}
          />
        </div>
      )}

      {/* Tab 3: Replacement Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          {activeRecommendation ? (
            <ReplacementRecommendationCard
              recommendation={activeRecommendation}
              incident={state.incidents.find((i) => i.id === activeRecommendation.incidentId)}
              buses={state.buses}
              routes={state.routes}
              onApprove={handleApproveReplacement}
              onReject={handleRejectReplacement}
              onReset={resetDemoData}
            />
          ) : (
            <Card className="text-center py-8">
              <BusIcon size={32} className="mx-auto text-muted mb-2" />
              <h3 className="text-sm font-semibold text-ink">No Pending Replacement Recommendations</h3>
              <p className="text-xs text-muted max-w-md mx-auto mt-1 leading-relaxed">
                When an operating bus suffers a breakdown, SAFAR's multi-criteria evaluation algorithm
                automatically ranks available reserve buses and presents recommendations here for authority approval.
              </p>
              <div className="mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const opBus = state.buses.find((b) => b.id === "bus-ka21ab102" && b.status === "OPERATING") ??
                      state.buses.find((b) => b.status === "OPERATING");
                    if (opBus) setBreakdownTargetBus(opBus);
                  }}
                >
                  <AlertTriangle size={14} /> Simulate Bus Breakdown Now
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 4: Live Demonstration Scenario */}
      {activeTab === "scenario" && (
        <LiveScenarioCard
          state={state}
          onApplyScenarioState={(nextState) => dispatch({ type: "APPLY_LIVE_SCENARIO", state: nextState })}
          onResetScenario={resetDemoData}
        />
      )}

      {/* Bus Details Inspect Modal */}
      {selectedBus && (
        <BusDetailsModal
          bus={selectedBus}
          route={state.routes.find((r) => r.id === selectedBus.assignedRouteId)}
          onClose={() => setSelectedBus(null)}
          onSimulateBreakdown={(bus) => setBreakdownTargetBus(bus)}
        />
      )}

      {/* Bus Breakdown Simulation Modal */}
      {breakdownTargetBus && (
        <BreakdownModal
          bus={breakdownTargetBus}
          route={state.routes.find((r) => r.id === breakdownTargetBus.assignedRouteId)}
          isOpen={true}
          onClose={() => setBreakdownTargetBus(null)}
          onConfirm={handleSimulateBreakdown}
        />
      )}
    </div>
  );
}
