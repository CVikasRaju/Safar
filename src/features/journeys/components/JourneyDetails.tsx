import { AlertTriangle, Bus, Clock, Footprints, Info, Timer } from "lucide-react";
import type { JourneyOption } from "../../../domain/types/journey";
import { formatClock, formatDuration } from "../../../domain/calculations/time";
import { RELIABILITY_DISCLAIMER } from "../../../domain/calculations/reliability";
import { Badge, Card, CardHeader, cx } from "../../../components/ui";
import { JourneyMap } from "./JourneyMap";
import { JourneyTimeline } from "./JourneyTimeline";
import { ArrivalStatusBadge, RouteChips } from "./RecommendationCard";

const SEVERITY_STYLES = {
  INFO: "border-line bg-panel-2/60 text-ink-dim",
  WARNING: "border-amber-400/30 bg-amber-400/5 text-amber-100",
  CRITICAL: "border-red-400/30 bg-red-400/5 text-red-100",
} as const;

function ReliabilityBreakdown({ journey }: { journey: JourneyOption }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Reliability breakdown</h3>
        <Badge
          tone={
            journey.reliability.score >= 80
              ? "success"
              : journey.reliability.score >= 60
                ? "warning"
                : "critical"
          }
        >
          {journey.reliability.score}/100 · {journey.reliability.label}
        </Badge>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-abyss">
        <div
          className={cx(
            "h-full rounded-full",
            journey.reliability.score >= 80
              ? "bg-emerald-400"
              : journey.reliability.score >= 60
                ? "bg-amber-400"
                : "bg-red-400",
          )}
          style={{ width: `${journey.reliability.score}%` }}
        />
      </div>
      <ul className="mt-3 space-y-1.5">
        {journey.reliability.penalties.map((penalty) => (
          <li key={penalty.key} className="flex items-start justify-between gap-2 text-[11px]">
            <div>
              <p className="font-medium text-ink-dim">{penalty.label}</p>
              <p className="text-[10px] leading-relaxed text-muted">{penalty.reason}</p>
            </div>
            <span className="safar-mono shrink-0 text-muted">
              −{penalty.value}
              <span className="text-[9px]">/{penalty.maxPenalty}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">{RELIABILITY_DISCLAIMER}</p>
    </div>
  );
}

export function JourneyDetails({
  journey,
  title = "Journey details",
  description,
}: {
  journey: JourneyOption;
  title?: string;
  description?: string;
}) {
  return (
    <Card className="space-y-4">
      <CardHeader
        title={title}
        description={description ?? "Full chronological itinerary, map view and calculated reliability."}
        icon={<Bus size={16} />}
        action={<ArrivalStatusBadge journey={journey} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-line bg-abyss/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Depart</p>
          <p className="safar-mono text-sm font-semibold text-ink">{formatClock(journey.departureTime)}</p>
        </div>
        <div className="rounded-lg border border-line bg-abyss/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Arrive</p>
          <p className="safar-mono text-sm font-semibold text-ink">{formatClock(journey.arrivalTime)}</p>
        </div>
        <div className="rounded-lg border border-line bg-abyss/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Duration</p>
          <p className="text-sm font-semibold text-ink">
            {formatDuration(journey.totalDurationMinutes)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-abyss/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Changes</p>
          <p className="text-sm font-semibold text-ink">{journey.transferCount}</p>
        </div>
        <div className="rounded-lg border border-line bg-abyss/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Est. delay</p>
          <p
            className={cx(
              "text-sm font-semibold",
              journey.estimatedDelayMinutes > 0 ? "text-amber-300" : "text-emerald-300",
            )}
          >
            {journey.estimatedDelayMinutes > 0 ? `~${journey.estimatedDelayMinutes} min` : "None recorded"}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-abyss/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted">Walking</p>
          <p className="text-sm font-semibold text-ink">{journey.walkingMinutes} min</p>
          <p className="text-[9px] text-muted">~{journey.walkingMetersApprox} m approx.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <RouteChips journey={journey} />
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Clock size={11} /> {journey.waitingMinutes} min waiting
          </span>
          <span className="flex items-center gap-1">
            <Timer size={11} /> deadline {journey.requiredArrivalTime}
          </span>
          <span className="flex items-center gap-1">
            <Footprints size={11} /> walking is approximate
          </span>
        </div>
      </div>

      {journey.warnings.length > 0 ? (
        <ul className="space-y-1.5">
          {[...journey.warnings]
            .sort((a, b) => {
              const order = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
              return order[a.severity] - order[b.severity];
            })
            .map((warning) => (
              <li
                key={`${warning.code}-${warning.message}`}
                className={cx(
                  "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] leading-relaxed",
                  SEVERITY_STYLES[warning.severity],
                )}
              >
                {warning.severity === "INFO" ? (
                  <Info size={12} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                )}
                <span>
                  {warning.message}
                  <span className="ml-1 text-[9px] uppercase tracking-wide opacity-70">
                    {warning.provenance.toLowerCase()}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <JourneyTimeline journey={journey} />
        <div className="space-y-3">
          <JourneyMap journey={journey} />
          <ReliabilityBreakdown journey={journey} />
        </div>
      </div>

      {journey.legs.length > 0 ? (
        <div className="rounded-lg border border-line">
          <div className="border-b border-line px-3 py-2">
            <h3 className="text-sm font-semibold text-ink">Bus legs</h3>
            <p className="text-[10px] text-muted">
              Scheduled and expected times include any estimated delay from confirmed operational
              records.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-panel-2/50 text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="px-3 py-2 font-semibold">Route · bus</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Boarding stop</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Drop-off stop</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Departs</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Arrives</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Delay</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Wait before</th>
                </tr>
              </thead>
              <tbody>
                {journey.legs.map((leg, index) => (
                  <tr key={`${leg.serviceId}-${index}`} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink">{leg.routeId}</p>
                      <p className="text-[10px] text-muted">{leg.busRegistration}</p>
                    </td>
                    <td className="px-3 py-2 text-ink-dim">
                      {leg.boardStopName}
                      <p className="text-[10px] text-muted">{leg.expectedDeparture.slice(11, 16)}</p>
                    </td>
                    <td className="px-3 py-2 text-ink-dim">
                      {leg.alightStopName}
                      <p className="text-[10px] text-muted">{leg.expectedArrival.slice(11, 16)}</p>
                    </td>
                    <td className="safar-mono px-3 py-2 text-ink-dim">
                      {leg.scheduledDeparture.slice(11, 16)}
                    </td>
                    <td className="safar-mono px-3 py-2 text-ink-dim">
                      {leg.scheduledArrival.slice(11, 16)}
                    </td>
                    <td className="px-3 py-2">
                      {leg.delayMinutes > 0 ? (
                        <Badge tone="warning">+{leg.delayMinutes} min</Badge>
                      ) : (
                        <Badge tone="success">On schedule</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-dim">{leg.waitBeforeMinutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
