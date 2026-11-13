import { ArrowRight, Bus, Clock, Footprints, MapPin, Timer } from "lucide-react";
import type { JourneyOption, JourneySegment } from "../../../domain/types/journey";
import { formatClock, formatDuration } from "../../../domain/calculations/time";
import { formatWalkingDistance } from "../../../domain/calculations/walking";
import { useSafarState } from "../../../state/SafarStateContext";
import { Badge, Mono } from "../../../components/ui";

const SEGMENT_ICONS = {
  ACCESS_WALK: Footprints,
  EGRESS_WALK: Footprints,
  TRANSFER_WALK: Footprints,
  BOARD_WAIT: Clock,
  TRANSFER_WAIT: Clock,
  BUS_RIDE: Bus,
} as const;

function segmentGuidance(segment: JourneySegment, stopName: (id: string) => string): string {
  switch (segment.kind) {
    case "ACCESS_WALK":
      return `Start at ${segment.startLocation.label}. Walk to ${segment.endLocation.label} and wait near the stop board.`;
    case "BOARD_WAIT":
      return `Wait at ${segment.startLocation.label}. Check the route number on the front of the bus before boarding.`;
    case "BUS_RIDE": {
      const stops = segment.intermediateStopIds ?? [];
      const intermediate =
        stops.length > 0 ? ` Passes ${stops.map((id) => stopName(id)).join(", ")}.` : "";
      return `Board ${segment.routeId} (${segment.busRegistration}) at ${segment.startLocation.label}. Get off at ${segment.endLocation.label}.${intermediate}`;
    }
    case "TRANSFER_WALK":
      return `Get off at ${segment.startLocation.label} and walk to ${segment.endLocation.label} for your connection.`;
    case "TRANSFER_WAIT":
      return `Wait at ${segment.startLocation.label} for the next bus. Keep your ticket or pass ready.`;
    case "EGRESS_WALK":
      return `You have arrived at ${segment.startLocation.label}. Walk to ${segment.endLocation.label}.`;
    default:
      return "";
  }
}

export function JourneyTimeline({ journey }: { journey: JourneyOption }) {
  const { state } = useSafarState();
  const stopName = (stopId: string) =>
    state.stops.find((stop) => stop.id === stopId)?.name ?? "unknown stop";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Step-by-step itinerary</h3>
        <Badge tone="muted">
          {journey.segments.length} step{journey.segments.length === 1 ? "" : "s"} ·{" "}
          {formatDuration(journey.totalDurationMinutes)}
        </Badge>
      </div>

      <ol className="safar-timeline space-y-4">
        {journey.segments.map((segment) => {
          const Icon = SEGMENT_ICONS[segment.kind];
          const isBus = segment.kind === "BUS_RIDE";
          return (
            <li key={segment.id} className="relative">
              <span
                className="absolute -left-[1.32rem] top-0.5 grid h-6 w-6 place-items-center rounded-full border border-line-strong bg-panel text-ink-dim"
                aria-hidden="true"
              >
                <Icon size={13} />
              </span>

              <div className="rounded-lg border border-line bg-abyss/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{segment.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                      {segmentGuidance(segment, stopName)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="safar-mono text-xs font-semibold text-ink">
                      {formatClock(segment.startTime)}
                      <ArrowRight size={10} className="mx-1 inline text-muted" />
                      {formatClock(segment.endTime)}
                    </p>
                    <p className="text-[10px] text-muted">{formatDuration(segment.durationMinutes)}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {isBus ? (
                    <>
                      <Badge tone="brand">
                        <Bus size={10} /> {segment.routeId}
                      </Badge>
                      <Badge tone="muted">{segment.busRegistration}</Badge>
                      {segment.intermediateStopIds && segment.intermediateStopIds.length > 0 ? (
                        <Badge tone="neutral">
                          {segment.intermediateStopIds.length} intermediate stop
                          {segment.intermediateStopIds.length > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Next stop off</Badge>
                      )}
                    </>
                  ) : null}
                  {segment.walking ? (
                    <Badge tone="warning">
                      <Footprints size={10} /> {formatWalkingDistance(segment.walking)} · approx.
                    </Badge>
                  ) : null}
                  {segment.kind === "BOARD_WAIT" || segment.kind === "TRANSFER_WAIT" ? (
                    <Badge tone="muted">
                      <Timer size={10} /> wait
                    </Badge>
                  ) : null}
                </div>

                {segment.walking ? (
                  <details className="mt-2 rounded-md border border-line/70 bg-panel/60 px-2 py-1.5">
                    <summary className="cursor-pointer text-[10px] font-medium text-muted">
                      How this walking distance was estimated
                    </summary>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">
                      {segment.walking.method} Straight-line reference:{" "}
                      {segment.walking.straightLineMeters} m. Provenance:{" "}
                      {segment.walking.provenance.toLowerCase()}.
                    </p>
                  </details>
                ) : null}

                {isBus && segment.intermediateStopIds && segment.intermediateStopIds.length > 0 ? (
                  <details className="mt-2 rounded-md border border-line/70 bg-panel/60 px-2 py-1.5">
                    <summary className="cursor-pointer text-[10px] font-medium text-muted">
                      Intermediate stops on this leg
                    </summary>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">
                      {segment.intermediateStopIds.map((id) => stopName(id)).join(" → ")}
                    </p>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border border-line bg-panel-2/60 p-3">
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <MapPin size={12} /> Arrive at{" "}
          <Mono className="text-ink">{formatClock(journey.arrivalTime)}</Mono>
          {journey.estimatedDelayMinutes > 0 ? (
            <span className="text-amber-300">
              (scheduled {formatClock(journey.scheduledArrivalTime)}, including ~
              {journey.estimatedDelayMinutes} min estimated delay)
            </span>
          ) : (
            <span className="text-emerald-300">(no confirmed delay applied)</span>
          )}
        </p>
      </div>
    </div>
  );
}
