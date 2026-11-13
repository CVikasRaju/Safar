import { useState } from "react";
import {
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type {
  Bus,
  Incident,
  ReplacementRecommendation,
  Route,
} from "../../../domain/types";
import { Badge, Button, Card, CardHeader, Mono, Notice, cx } from "../../../components/ui";

interface ReplacementRecommendationCardProps {
  recommendation: ReplacementRecommendation;
  incident?: Incident;
  buses: Bus[];
  routes: Route[];
  onApprove: (recommendationId: string, approvedBusId: string) => void;
  onReject: (recommendationId: string, reason: string) => void;
  onReset?: () => void;
}

export function ReplacementRecommendationCard({
  recommendation,
  incident,
  buses,
  routes,
  onApprove,
  onReject,
  onReset,
}: ReplacementRecommendationCardProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    recommendation.recommendedBusId ?? recommendation.rankedCandidates[0]?.busId ?? "",
  );

  const route = incident?.routeId ? routes.find((r) => r.id === incident.routeId) : undefined;
  const failedBus = incident?.busId ? buses.find((b) => b.id === incident.busId) : undefined;

  const isApproved = recommendation.status === "APPROVED";
  const isRejected = recommendation.status === "REJECTED";
  const isPending = recommendation.status === "PENDING";
  const isNoCandidate = recommendation.status === "NO_FEASIBLE_CANDIDATE";

  const selectedCandidate = recommendation.rankedCandidates.find((c) => c.busId === selectedCandidateId);
  const selectedBus = buses.find((b) => b.id === selectedCandidateId);

  return (
    <Card className="border-brand/40 shadow-lg">
      <CardHeader
        title="Bus Replacement Recommendation"
        description="Deterministic multi-criteria ranking (docs/07): Capacity 35%, Compatibility 30%, Response 25%, Availability 10%."
        icon={<ShieldCheck size={18} className="text-brand" />}
        action={
          <div className="flex items-center gap-2">
            {isApproved ? (
              <Badge tone="success">REPLACEMENT APPROVED</Badge>
            ) : isRejected ? (
              <Badge tone="warning">RECOMMENDATION REJECTED</Badge>
            ) : isNoCandidate ? (
              <Badge tone="critical">NO FEASIBLE REPLACEMENT</Badge>
            ) : (
              <Badge tone="brand">AWAITING AUTHORITY APPROVAL</Badge>
            )}
          </div>
        }
      />

      {/* Incident Context */}
      <div className="mt-3 rounded-lg border border-line bg-abyss/60 p-3.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">Incident:</span>
            <span className="font-mono text-ink-dim">{incident?.id ?? "active-incident"}</span>
            <Badge tone="critical">Mechanical Failure</Badge>
          </div>
          {route ? (
            <span className="font-medium text-brand">
              Route {route.id} — {route.name}
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase text-muted">Broken-down Bus</p>
            <p className="font-bold text-ink">{failedBus?.registration ?? "KA-21-AB-102"}</p>
            <p className="text-[10px] text-muted">Status: UNAVAILABLE</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted">Required Capacity</p>
            <p className="font-bold text-ink">
              <Mono>{failedBus?.capacity ?? 52}</Mono> seats
            </p>
            <p className="text-[10px] text-amber-300">
              <Mono>{failedBus?.occupiedSeats ?? 41}</Mono> passengers affected
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted">Decision Status</p>
            <p className="font-bold text-ink">{recommendation.status}</p>
            <p className="text-[10px] text-muted">Authority validation required</p>
          </div>
        </div>
      </div>

      {/* No candidate or shortage alert */}
      {isNoCandidate ? (
        <Notice tone="critical" className="mt-3" title="No Eligible Replacement Bus Available">
          Every candidate bus in the fleet is currently unavailable, under maintenance, or already committed.
          Authorities must arrange alternate transit or advise students to use secondary route connections.
        </Notice>
      ) : null}

      {/* Decision Reason Banner if already decided */}
      {recommendation.decisionReason && (isApproved || isRejected) ? (
        <Notice
          tone={isApproved ? "success" : "warning"}
          className="mt-3"
          title={isApproved ? "Authority Approval Recorded" : "Authority Rejection Recorded"}
        >
          {recommendation.decisionReason}
        </Notice>
      ) : null}

      {/* Candidate Ranking List */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Evaluated Fleet Candidates ({recommendation.rankedCandidates.length})
          </p>
          <span className="text-[10px] text-muted">
            Weights: Capacity 35% · Compatibility 30% · Response 25% · Availability 10%
          </span>
        </div>

        <div className="grid gap-2.5">
          {recommendation.rankedCandidates.map((candidate, idx) => {
            const bus = buses.find((b) => b.id === candidate.busId);
            const isSelected = candidate.busId === selectedCandidateId;
            const isRecommended = candidate.busId === recommendation.recommendedBusId;
            const requiredCap = failedBus?.capacity ?? 52;
            const deficit = Math.max(0, requiredCap - (bus?.capacity ?? 0));
            const hasShortage = deficit > 0;

            return (
              <div
                key={candidate.busId}
                onClick={() => setSelectedCandidateId(candidate.busId)}
                className={cx(
                  "cursor-pointer rounded-xl border p-3.5 transition-all text-xs",
                  isSelected
                    ? "border-brand bg-panel-2 shadow-md ring-1 ring-brand/50"
                    : "border-line bg-abyss/40 hover:border-line-strong hover:bg-panel-2/40",
                  !candidate.eligible && "opacity-60 bg-abyss/20 border-dashed",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-line-strong bg-panel text-ink">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink">
                          {bus?.registration ?? candidate.busId}
                        </span>
                        {isRecommended ? (
                          <Badge tone="brand">★ System Recommended</Badge>
                        ) : null}
                        {!candidate.eligible ? (
                          <Badge tone="critical">Ineligible</Badge>
                        ) : bus?.status === "REPLACEMENT_ASSIGNED" ? (
                          <Badge tone="brand">Assigned</Badge>
                        ) : (
                          <Badge tone="success">Available</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted">
                        {bus?.lastKnownLocationLabel ?? "Reserve bay"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] uppercase text-muted">Suitability:</span>
                      <span
                        className={cx(
                          "safar-mono text-base font-extrabold",
                          candidate.finalScore >= 80
                            ? "text-brand"
                            : candidate.finalScore >= 60
                            ? "text-emerald-300"
                            : candidate.finalScore > 0
                            ? "text-amber-300"
                            : "text-muted",
                        )}
                      >
                        {candidate.finalScore}/100
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">
                      Response: <Mono>{bus?.estimatedResponseMinutes ?? 20} min</Mono>
                    </p>
                  </div>
                </div>

                {/* Score component breakdown bars */}
                <div className="mt-3 grid gap-2 sm:grid-cols-4 rounded-lg border border-line bg-abyss/60 p-2 text-[10px]">
                  {/* Capacity */}
                  <div>
                    <div className="flex justify-between text-muted">
                      <span>Capacity (35%)</span>
                      <span className="font-semibold text-ink"><Mono>{candidate.capacityScore}</Mono></span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded bg-panel-3 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded"
                        style={{ width: `${candidate.capacityScore}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted">
                      {bus?.capacity ?? 0} seats {hasShortage ? `(${deficit} deficit)` : "(full)"}
                    </p>
                  </div>

                  {/* Compatibility */}
                  <div>
                    <div className="flex justify-between text-muted">
                      <span>Route Compat (30%)</span>
                      <span className="font-semibold text-ink"><Mono>{candidate.compatibilityScore}</Mono></span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded bg-panel-3 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded"
                        style={{ width: `${candidate.compatibilityScore}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted">Depot proximity</p>
                  </div>

                  {/* Response Time */}
                  <div>
                    <div className="flex justify-between text-muted">
                      <span>Response (25%)</span>
                      <span className="font-semibold text-ink"><Mono>{candidate.responseTimeScore}</Mono></span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded bg-panel-3 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded"
                        style={{ width: `${candidate.responseTimeScore}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted">
                      {bus?.estimatedResponseMinutes ?? 20} min ETA
                    </p>
                  </div>

                  {/* Availability */}
                  <div>
                    <div className="flex justify-between text-muted">
                      <span>Availability (10%)</span>
                      <span className="font-semibold text-ink"><Mono>{candidate.availabilityScore}</Mono></span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded bg-panel-3 overflow-hidden">
                      <div
                        className="h-full bg-purple-400 rounded"
                        style={{ width: `${candidate.availabilityScore}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted">Operational readiness</p>
                  </div>
                </div>

                {/* Explanation text */}
                <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">
                  {candidate.explanation}
                </p>

                {/* Shortage warning if partial coverage */}
                {hasShortage && candidate.eligible ? (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-300">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>
                      Partial coverage: {bus?.capacity} seats leaves a deficit of {deficit} seats compared to {requiredCap} needed.
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Candidate Action Panel */}
      {selectedCandidate && selectedBus && isPending ? (
        <div className="mt-4 rounded-xl border border-line-strong bg-panel-2 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">
                Authority Action for: <span className="text-brand">{selectedBus.registration}</span>
              </p>
              <p className="text-[11px] text-muted">
                Suitability Score: <Mono>{selectedCandidate.finalScore}/100</Mono> · Response ETA:{" "}
                <Mono>{selectedBus.estimatedResponseMinutes ?? 15} min</Mono>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectInput(!showRejectInput)}
              >
                <ThumbsDown size={14} /> Reject Proposal
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => onApprove(recommendation.id, selectedBus.id)}
              >
                <ThumbsUp size={14} /> Approve & Deploy Replacement
              </Button>
            </div>
          </div>

          {/* Rejection reason box */}
          {showRejectInput ? (
            <div className="mt-3 border-t border-line pt-3">
              <label className="safar-label" htmlFor="reject-reason">
                Reason for Rejection (required for audit):
              </label>
              <div className="flex gap-2">
                <input
                  id="reject-reason"
                  type="text"
                  placeholder="e.g. Depot reserve required for peak evening school load..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="safar-input text-xs"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onReject(recommendation.id, rejectReason);
                    setShowRejectInput(false);
                  }}
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Reset button if already decided */}
      {onReset && (isApproved || isRejected) ? (
        <div className="mt-4 flex justify-end border-t border-line pt-3">
          <Button variant="secondary" size="sm" onClick={onReset}>
            <RefreshCw size={13} /> Reset Scenario to Seed
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
