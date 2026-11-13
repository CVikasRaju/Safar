import { ArrowLeftRight, ArrowRight, Footprints, ShieldCheck, Zap } from "lucide-react";
import type {
  JourneyOption,
  JourneyOptionSet,
  JourneyRecommendationCategory,
} from "../../../domain/types/journey";
import { formatClock, formatDuration } from "../../../domain/calculations/time";
import { RELIABILITY_DISCLAIMER } from "../../../domain/calculations/reliability";
import { Badge, Button, cx } from "../../../components/ui";

const CATEGORY_META: Record<
  JourneyRecommendationCategory,
  { icon: typeof Zap; label: string; accent: string }
> = {
  FASTEST: { icon: Zap, label: "Fastest Route", accent: "text-brand" },
  MOST_RELIABLE: { icon: ShieldCheck, label: "Most Reliable Route", accent: "text-emerald-300" },
  FEWEST_TRANSFERS: { icon: ArrowLeftRight, label: "Fewest Transfers", accent: "text-amber-300" },
};

function reliabilityTone(score: number): "success" | "warning" | "critical" | "neutral" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  if (score >= 40) return "critical";
  return "critical";
}

export function ArrivalStatusBadge({ journey }: { journey: JourneyOption }) {
  if (journey.meetsRequiredArrival) {
    return (
      <Badge tone="success">
        Meets {journey.requiredArrivalTime} arrival
        {journey.minutesRelativeToRequiredArrival < -2
          ? ` · ${Math.abs(journey.minutesRelativeToRequiredArrival)} min early`
          : ""}
      </Badge>
    );
  }
  return (
    <Badge tone="critical">
      Late by {Math.max(1, journey.minutesRelativeToRequiredArrival)} min — misses{" "}
      {journey.requiredArrivalTime}
    </Badge>
  );
}

export function RouteChips({ journey }: { journey: JourneyOption }) {
  if (journey.kind === "WALK_ONLY") {
    return <Badge tone="muted">Walk-only · no bus</Badge>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {journey.legs.map((leg, index) => (
        <span key={`${leg.serviceId}-${index}`} className="safar-chip">
          <span className="font-semibold text-ink">{leg.routeId}</span>
          <span className="text-muted">{leg.busRegistration}</span>
        </span>
      ))}
    </div>
  );
}

export function RecommendationCard({
  optionSet,
  selected,
  onSelect,
}: {
  optionSet: JourneyOptionSet;
  selected: boolean;
  onSelect: () => void;
}) {
  const { journey } = optionSet;
  const meta = CATEGORY_META[optionSet.category];
  const Icon = meta.icon;
  const worstWarning = journey.warnings.find((warning) => warning.severity === "CRITICAL");

  return (
    <article
      className={cx(
        "safar-card flex h-full flex-col gap-3 p-4 transition-colors",
        selected ? "border-brand/60 ring-1 ring-brand/30" : "hover:border-line-strong",
      )}
      aria-labelledby={`rec-${optionSet.category}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cx("grid h-7 w-7 place-items-center rounded-md bg-panel-2", meta.accent)}>
            <Icon size={15} />
          </span>
          <div>
            <h3 id={`rec-${optionSet.category}`} className="text-sm font-semibold text-ink">
              {meta.label}
            </h3>
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted">
              {journey.kind === "WALK_ONLY" ? "Walking option" : `${journey.legs.length} bus leg${journey.legs.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {journey.reliability.score >= 80 ? <Badge tone="brand">Recommended</Badge> : null}
      </div>

      {optionSet.alsoWins.length > 0 ? (
        <Badge tone="brand" className="w-fit">
          Same journey also ranks #1 for{" "}
          {optionSet.alsoWins.map((category) => CATEGORY_META[category].label).join(" & ")}
        </Badge>
      ) : null}

      <div>
        <div className="flex items-baseline gap-2">
          <span className="safar-mono text-2xl font-semibold leading-none text-ink">
            {formatClock(journey.departureTime)}
          </span>
          <ArrowRight size={14} className="text-muted" />
          <span className="safar-mono text-2xl font-semibold leading-none text-ink">
            {formatClock(journey.arrivalTime)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {formatDuration(journey.totalDurationMinutes)} door to door
          {journey.estimatedDelayMinutes > 0
            ? ` · includes ~${journey.estimatedDelayMinutes} min estimated delay`
            : " · no confirmed delay"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-abyss/60 p-2 text-center">
        <div>
          <p className="safar-mono text-sm font-semibold text-ink">{journey.transferCount}</p>
          <p className="text-[10px] text-muted">change{journey.transferCount === 1 ? "" : "s"}</p>
        </div>
        <div>
          <p className="safar-mono text-sm font-semibold text-ink">{journey.waitingMinutes}</p>
          <p className="text-[10px] text-muted">min waiting</p>
        </div>
        <div>
          <p className="safar-mono text-sm font-semibold text-ink">
            {journey.walkingMinutes}
          </p>
          <p className="text-[10px] text-muted">min walking</p>
        </div>
      </div>

      <RouteChips journey={journey} />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={reliabilityTone(journey.reliability.score)}>
          Reliability {journey.reliability.score}/100 · {journey.reliability.label}
        </Badge>
        <ArrivalStatusBadge journey={journey} />
      </div>

      <p className="text-[10px] leading-relaxed text-muted">{RELIABILITY_DISCLAIMER}</p>

      {worstWarning ? (
        <p className="rounded-md border border-red-400/30 bg-red-400/5 px-2 py-1.5 text-[11px] leading-relaxed text-red-200">
          {worstWarning.message}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Footprints size={12} /> ~{journey.walkingMetersApprox} m total walking (approx.)
        </p>
      )}

      <p className="mt-auto text-[11px] leading-relaxed text-ink-dim">{optionSet.reason}</p>

      <Button variant={selected ? "primary" : "secondary"} size="sm" onClick={onSelect}>
        {selected ? "Showing itinerary" : "View itinerary"}
      </Button>
    </article>
  );
}
