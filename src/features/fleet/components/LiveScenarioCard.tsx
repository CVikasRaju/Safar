import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { SafarState } from "../../../domain/types";
import {
  buildLiveScenarioSummary,
  prepareApproveReplacement,
  prepareSimulateBreakdown,
  runLiveDemonstrationScenario,
  type LiveScenarioOperationalSummary,
} from "../../../domain/services/fleetActions";
import { Badge, Button, Card, CardHeader, cx } from "../../../components/ui";
import { OperationalSummaryCard } from "./OperationalSummaryCard";

interface LiveScenarioCardProps {
  state: SafarState;
  onApplyScenarioState: (nextState: SafarState) => void;
  onResetScenario: () => void;
}

const SCENARIO_STEPS = [
  {
    step: 1,
    title: "1. Baseline Student Journey Search",
    description: "Student from Panaje/Kadaba searches journey to Puttur Government College, required before 09:00 AM.",
    role: "Student Portal (Member 2)",
  },
  {
    step: 2,
    title: "2. Predictive Regional Event Intelligence",
    description: "Puttur Mahalingeshwara Temple Festival scheduled for demo date. Impact window identifies R101 and R104 with 90-min buffer.",
    role: "Event Intelligence (Member 3)",
  },
  {
    step: 3,
    title: "3. Confirmed Bus Breakdown",
    description: "Bus KA-21-AB-102 breaks down on R101. Marked UNAVAILABLE; 41 students affected; active incident created.",
    role: "Fleet Operations (Member 4)",
  },
  {
    step: 4,
    title: "4. Multi-Criteria Replacement Ranking",
    description: "Deterministic 35/30/25/10 weighting ranks available reserve buses. KA-21-GH-407 and KA-21-LM-609 evaluated; KA-21-JK-512 excluded.",
    role: "Fleet Operations (Member 4)",
  },
  {
    step: 5,
    title: "5. Authority Approval & State Propagation",
    description: "Authority approves replacement. KA-21-GH-407 allocated to R101. Student Portal receives real-time operational alert.",
    role: "Authority Workflow (Member 4)",
  },
  {
    step: 6,
    title: "6. Final Operational Summary",
    description: "Consolidated operational outcome with passenger impacts, replacement ETA, alternative journeys, and updated reliability.",
    role: "Operational Command (Member 4)",
  },
];

export function LiveScenarioCard({
  state,
  onApplyScenarioState,
  onResetScenario,
}: LiveScenarioCardProps) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);
  const [summary, setSummary] = useState<LiveScenarioOperationalSummary | null>(null);

  // Check current scenario progression in state
  const hasBreakdown = state.incidents.some((i) => i.status === "ACTIVE" && i.busId === "bus-ka21ab102");
  const hasApprovedReplacement = state.replacementRecommendations.some((r) => r.status === "APPROVED");

  const handleRunAll = () => {
    setIsRunningAll(true);
    const { state: nextState, summary: nextSummary } = runLiveDemonstrationScenario(state);
    onApplyScenarioState(nextState);
    setSummary(nextSummary);
    setActiveStep(6);
    setIsRunningAll(false);
  };

  const handleStepNext = () => {
    if (activeStep === 1) {
      // Advance to step 2
      setActiveStep(2);
    } else if (activeStep === 2) {
      // Advance to step 3: trigger breakdown
      if (!hasBreakdown) {
        const res = prepareSimulateBreakdown(state, "bus-ka21ab102");
        if (res.ok) {
          onApplyScenarioState({
            ...state,
            buses: res.value.updatedBuses,
            incidents: [res.value.incident, ...state.incidents],
            replacementRecommendations: [res.value.recommendation, ...state.replacementRecommendations],
            alerts: [...res.value.alerts, ...state.alerts],
            auditEvents: [res.value.audit, ...state.auditEvents],
          });
        }
      }
      setActiveStep(3);
    } else if (activeStep === 3) {
      // Advance to step 4: ranking already exists
      setActiveStep(4);
    } else if (activeStep === 4) {
      // Advance to step 5: trigger approval
      const rec = state.replacementRecommendations.find((r) => r.recommendedBusId);
      if (rec && rec.status !== "APPROVED") {
        const res = prepareApproveReplacement(state, rec.id, rec.recommendedBusId);
        if (res.ok) {
          onApplyScenarioState({
            ...state,
            buses: res.value.updatedBuses,
            timetableServices: res.value.updatedTimetableServices,
            replacementRecommendations: [
              res.value.updatedRecommendation,
              ...state.replacementRecommendations.filter((r) => r.id !== rec.id),
            ],
            alerts: [...res.value.alerts, ...state.alerts],
            auditEvents: [res.value.audit, ...state.auditEvents],
          });
        }
      }
      setActiveStep(5);
    } else if (activeStep === 5) {
      // Step 6: Summary
      const finalSummary = buildLiveScenarioSummary(state);
      setSummary(finalSummary);
      setActiveStep(6);
    }
  };

  const handleStepPrev = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSimulateNoReplacement = () => {
    // Scenario D: make all reserve buses unavailable
    const modifiedBuses = state.buses.map((b) => {
      if (b.status === "AVAILABLE") {
        return { ...b, status: "UNAVAILABLE" as const, commitments: ["Depot mechanical hold"] };
      }
      return b;
    });
    const res = prepareSimulateBreakdown({ ...state, buses: modifiedBuses }, "bus-ka21ab102");
    if (res.ok) {
      onApplyScenarioState({
        ...state,
        buses: res.value.updatedBuses,
        incidents: [res.value.incident, ...state.incidents],
        replacementRecommendations: [res.value.recommendation, ...state.replacementRecommendations],
        alerts: [...res.value.alerts, ...state.alerts],
        auditEvents: [res.value.audit, ...state.auditEvents],
      });
      setActiveStep(4);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-brand/40 bg-panel">
        <CardHeader
          title="Central SAFAR Live Demonstration Scenario (Scenario A)"
          description="Repeatable end-to-end demonstration walking through student travel, regional event impact, bus breakdown, 35/30/25/10 replacement evaluation, authority approval, and state propagation (docs/15)."
          icon={<Sparkles size={18} className="text-brand" />}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onResetScenario}>
                <RefreshCw size={13} /> Reset Scenario
              </Button>
              <Button variant="primary" size="sm" onClick={handleRunAll} disabled={isRunningAll}>
                <Play size={13} /> Run SAFAR Live Scenario
              </Button>
            </div>
          }
        />

        {/* Step Progression Indicators */}
        <div className="mt-4 grid gap-2 sm:grid-cols-6 text-xs">
          {SCENARIO_STEPS.map((s) => {
            const isCurrent = activeStep === s.step;
            const isCompleted = activeStep > s.step || (s.step === 3 && hasBreakdown) || (s.step === 5 && hasApprovedReplacement);

            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setActiveStep(s.step)}
                className={cx(
                  "flex flex-col items-start rounded-lg border p-2.5 text-left transition-all",
                  isCurrent
                    ? "border-brand bg-brand/10 text-brand shadow-sm ring-1 ring-brand/40"
                    : isCompleted
                    ? "border-emerald-400/40 bg-emerald-400/5 text-emerald-300"
                    : "border-line bg-abyss/40 text-muted hover:border-line-strong",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-[10px] font-bold">Step {s.step}</span>
                  {isCompleted ? <CheckCircle2 size={12} className="text-emerald-400" /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight text-ink">
                  {s.title.replace(/^\d+\.\s*/, "")}
                </p>
                <p className="mt-1 text-[9px] text-muted">{s.role.split(" ")[0]}</p>
              </button>
            );
          })}
        </div>

        {/* Current Active Step Card */}
        <div className="mt-4 rounded-xl border border-line-strong bg-abyss/70 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                Active Scenario Step {activeStep} of 6
              </span>
              <h3 className="text-sm font-bold text-ink">
                {SCENARIO_STEPS[activeStep - 1]?.title}
              </h3>
            </div>
            <Badge tone="brand">{SCENARIO_STEPS[activeStep - 1]?.role}</Badge>
          </div>

          <p className="mt-2 text-ink-dim leading-relaxed">
            {SCENARIO_STEPS[activeStep - 1]?.description}
          </p>

          {/* Interactive Step Content Details */}
          <div className="mt-3 rounded-lg border border-line bg-panel p-3">
            {activeStep === 1 && (
              <div className="space-y-1.5 text-ink-dim">
                <p><strong>Origin:</strong> Panaje / Kadaba village</p>
                <p><strong>Destination:</strong> Puttur Government College (required before 09:00 AM)</p>
                <p><strong>Primary Route:</strong> R101 (Puttur – Kadaba – Sullia) with bus KA-21-AB-102</p>
                <p className="text-[11px] text-emerald-300">✓ Feasible baseline itinerary generated with 07:45 scheduled arrival.</p>
              </div>
            )}

            {activeStep === 2 && (
              <div className="space-y-1.5 text-ink-dim">
                <p><strong>Predicted Event:</strong> Puttur Mahalingeshwara Temple Festival (Crowd: VERY HIGH)</p>
                <p><strong>Impact Window:</strong> 04:30 – 23:30 (includes scenario-configured 90-min buffer)</p>
                <p><strong>Impacted Routes:</strong> R101 (High Risk, 62/100, 12 min delay) and R104 (Moderate Risk, 44/100)</p>
                <p className="text-[11px] text-amber-300">⚠ Predictive intelligence advises earlier departure or route transfer before event starts.</p>
              </div>
            )}

            {activeStep === 3 && (
              <div className="space-y-1.5 text-ink-dim">
                <p><strong>Simulated Incident:</strong> Bus KA-21-AB-102 breakdown on R101 near Puttur approach road.</p>
                <p><strong>Direct Impact:</strong> 41 students and passengers currently onboard.</p>
                <p><strong>Status:</strong> Bus KA-21-AB-102 set to <span className="font-bold text-red-400">UNAVAILABLE</span>.</p>
                <p className="text-[11px] text-red-300">🚨 Immediate disruption detected — authority decision required to deploy replacement.</p>
              </div>
            )}

            {activeStep === 4 && (
              <div className="space-y-2 text-ink-dim">
                <p><strong>Ranking Methodology:</strong> Capacity (35%) · Route Compatibility (30%) · Response Time (25%) · Availability (10%)</p>
                <div className="grid gap-2 sm:grid-cols-2 pt-1">
                  <div className="rounded border border-brand/40 bg-brand/5 p-2">
                    <p className="font-bold text-brand">Candidate #1: KA-21-GH-407 (Suitability: 87/100)</p>
                    <p className="text-[11px]">40 seats · 12 min response from Puttur depot reserve bay. Ranked #1 for rapid response.</p>
                  </div>
                  <div className="rounded border border-line p-2">
                    <p className="font-bold text-ink">Candidate #2: KA-21-LM-609 (Suitability: 84/100)</p>
                    <p className="text-[11px]">56 seats (full coverage) · 25 min response from Uppinangady depot.</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted">Excluded: KA-21-JK-512 (MAINTENANCE in workshop).</p>
              </div>
            )}

            {activeStep === 5 && (
              <div className="space-y-1.5 text-ink-dim">
                <p><strong>Authority Decision:</strong> Approved replacement bus KA-21-GH-407.</p>
                <p><strong>Fleet Update:</strong> KA-21-GH-407 allocated to R101 with status REPLACEMENT_ASSIGNED.</p>
                <p><strong>Student Portal Sync:</strong> Critical breakdown replaced with SUCCESS alert: "Replacement bus KA-21-GH-407 deployed on R101 (ETA: 12 min)."</p>
                <p className="text-[11px] text-emerald-300">✓ Timetable services updated; student journey restored.</p>
              </div>
            )}

            {activeStep === 6 && (
              <div className="space-y-1.5 text-ink-dim">
                <p className="text-emerald-300 font-semibold">✓ Live demonstration scenario complete!</p>
                <p>The operational summary below reflects the real-time calculations from shared state.</p>
              </div>
            )}
          </div>

          {/* Navigation controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStepPrev}
                disabled={activeStep === 1}
              >
                <ChevronLeft size={14} /> Previous Step
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStepNext}
                disabled={activeStep === 6}
              >
                Next Step ({activeStep + 1}) <ChevronRight size={14} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSimulateNoReplacement}
                title="Scenario D: All reserve buses unavailable to test shortage analysis"
              >
                <AlertTriangle size={13} className="text-amber-300" /> Test No-Replacement Scenario (Scenario D)
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Show Final Operational Summary if step 6 or completed */}
      {(activeStep === 6 || hasApprovedReplacement) && (
        <OperationalSummaryCard
          summary={summary ?? buildLiveScenarioSummary(state)}
        />
      )}
    </div>
  );
}
