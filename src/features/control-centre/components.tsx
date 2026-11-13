import type { ReactNode } from "react";
import { Badge } from "../../components/ui";
import type { EmergencyPriorityTier } from "../../domain/types/emergency";
import { PRIORITY_TIER_LABELS } from "../../domain/types/emergency";
import {
  PREDICTION_STATUS_LABELS,
  type PredictionStatus,
} from "../../domain/emergency/eventPrediction";

/** Small shared presentational helpers for the Control Centre pages. */

const TIER_TONES: Record<EmergencyPriorityTier, "critical" | "warning" | "brand" | "neutral"> = {
  EXAM_IMMINENT: "critical",
  DEADLINE_IMMINENT: "warning",
  BUS_BREAKDOWN: "brand",
  FLOOD_AFFECTED: "warning",
  STANDARD: "neutral",
};

const TIER_SHORT: Record<EmergencyPriorityTier, string> = {
  EXAM_IMMINENT: "Exam priority",
  DEADLINE_IMMINENT: "Deadline imminent",
  BUS_BREAKDOWN: "Bus unavailable",
  FLOOD_AFFECTED: "Flood affected",
  STANDARD: "Standard",
};

export function TierBadge({ tier, short = false }: { tier: EmergencyPriorityTier; short?: boolean }) {
  return (
    <Badge tone={TIER_TONES[tier]}>
      {short ? TIER_SHORT[tier] : PRIORITY_TIER_LABELS[tier]}
    </Badge>
  );
}

const STATUS_TONES: Record<PredictionStatus, "success" | "warning" | "brand" | "neutral" | "critical"> = {
  VERIFIED: "success",
  USER_REPORTED: "warning",
  HISTORICAL: "neutral",
  AI_GENERATED: "brand",
  SIMULATED: "warning",
};

export function PredictionStatusBadge({ status }: { status: PredictionStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{PREDICTION_STATUS_LABELS[status]}</Badge>;
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/60 py-1 last:border-0">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-xs text-ink">{children}</span>
    </div>
  );
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatWalk(metres?: number, minutes?: number): string {
  if (metres === undefined) return "—";
  const distance = metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${metres} m`;
  return `~${distance}${minutes === undefined ? "" : ` · ${minutes} min`} (approx.)`;
}
