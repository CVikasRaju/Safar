import {
  AlertTriangle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LiveScenarioOperationalSummary } from "../../../domain/services/fleetActions";
import { Badge, Card, CardHeader, Mono } from "../../../components/ui";

interface OperationalSummaryCardProps {
  summary: LiveScenarioOperationalSummary;
}

export function OperationalSummaryCard({ summary }: OperationalSummaryCardProps) {
  return (
    <Card className="border-emerald-400/40 bg-panel shadow-xl">
      <CardHeader
        title="Operational summary"
        description="End-to-end outcome of disruption response and replacement allocation (docs/15 Scenario A)."
        icon={<Sparkles size={18} className="text-emerald-300" />}
        action={<Badge tone="success">Operational Consensus Reached</Badge>}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2 text-xs">
        {/* Disruption & Event Context */}
        <div className="space-y-3 rounded-xl border border-line bg-abyss/60 p-4">
          <div className="flex items-center gap-2 border-b border-line pb-2 font-bold text-ink">
            <AlertTriangle size={15} className="text-red-400" />
            <span>Disruption & Regional Event Impact</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase text-muted">Failed Bus</p>
              <p className="font-bold text-red-300">{summary.failedBus.registration}</p>
              <p className="text-[10px] text-muted">
                Status: <span className="font-semibold text-red-400">{summary.failedBus.status}</span>
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-muted">Affected Students / Journeys</p>
              <p className="font-bold text-amber-300">
                <Mono>{summary.affectedStudentsCount}</Mono> passengers directly affected
              </p>
              <p className="text-[10px] text-muted">Onboard at breakdown time</p>
            </div>
          </div>

          <div className="border-t border-line/60 pt-2">
            <p className="text-[10px] uppercase text-muted">Affected Routes</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {summary.affectedRoutes.map((routeId) => (
                <span
                  key={routeId}
                  className="rounded border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-bold text-red-200"
                >
                  {routeId}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-line/60 pt-2">
            <p className="text-[10px] uppercase text-muted">Regional Event Trigger</p>
            <p className="font-semibold text-ink">{summary.eventImpact.eventName}</p>
            <p className="mt-0.5 text-[11px] text-ink-dim">
              Risk: <strong className="text-amber-300">{summary.eventImpact.riskLevel}</strong> (Score: {summary.eventImpact.impactScore}/100)
              · Advance Impact Buffer: <Mono>{summary.eventImpact.prepBufferMinutes} min</Mono>
            </p>
          </div>
        </div>

        {/* Replacement & Journey Recovery */}
        <div className="space-y-3 rounded-xl border border-line bg-abyss/60 p-4">
          <div className="flex items-center gap-2 border-b border-line pb-2 font-bold text-ink">
            <ShieldCheck size={15} className="text-emerald-300" />
            <span>Replacement Allocation & Alternative Journey</span>
          </div>

          {summary.recommendedBus ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase text-muted">Selected Replacement Bus</p>
                <p className="font-bold text-emerald-300">{summary.recommendedBus.registration}</p>
                <p className="text-[10px] text-muted">
                  Capacity: <Mono>{summary.recommendedBus.capacity}</Mono> seats (
                  {summary.recommendedBus.isFullCoverage ? "Full coverage" : `${summary.recommendedBus.capacityDeficit} seat deficit`})
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase text-muted">Estimated Response Time</p>
                <p className="font-bold text-ink">
                  <Mono>{summary.recommendedBus.responseTimeMinutes} min</Mono> ETA
                </p>
                <p className="text-[10px] text-muted">Suitability: {summary.recommendedBus.suitabilityScore}/100</p>
              </div>
            </div>
          ) : (
            <p className="text-amber-300">No replacement bus allocated.</p>
          )}

          <div className="border-t border-line/60 pt-2">
            <p className="text-[10px] uppercase text-muted">Alternative Journey Option</p>
            <p className="font-semibold text-ink">{summary.alternativeJourney.routeId}</p>
            <p className="mt-0.5 text-[11px] text-ink-dim">{summary.alternativeJourney.advice}</p>
          </div>

          <div className="border-t border-line/60 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-muted">Updated Route Reliability</span>
              <span className="safar-mono text-sm font-bold text-brand">
                {summary.updatedReliability.score}/100 ({summary.updatedReliability.label})
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted italic">
              "{summary.updatedReliability.disclaimer}"
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
