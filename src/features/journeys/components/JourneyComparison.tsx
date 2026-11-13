import { formatClock, formatDuration } from "../../../domain/calculations/time";
import type { JourneyOption } from "../../../domain/types/journey";
import { Badge, Button, cx } from "../../../components/ui";

function categoryTags(journey: JourneyOption): string[] {
  const tags: string[] = [];
  if (journey.rankings.FASTEST === 1) tags.push("Fastest #1");
  if (journey.rankings.MOST_RELIABLE === 1) tags.push("Reliability #1");
  if (journey.rankings.FEWEST_TRANSFERS === 1) tags.push("Fewest changes #1");
  return tags;
}

export function JourneyComparison({
  journeys,
  selectedId,
  onSelect,
  caption,
}: {
  journeys: JourneyOption[];
  selectedId?: string;
  onSelect: (journey: JourneyOption) => void;
  caption: string;
}) {
  if (journeys.length === 0) return null;

  return (
    <div className="safar-card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Compare all calculated journeys</h3>
        <p className="mt-0.5 text-[11px] text-muted">{caption}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-panel-2/50 text-[10px] uppercase tracking-[0.08em] text-muted">
              <th scope="col" className="px-3 py-2 font-semibold">
                Journey
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Departs
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Arrives
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Duration
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Changes
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Walk (approx.)
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Reliability
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Arrival
              </th>
              <th scope="col" className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {journeys.map((journey) => {
              const tags = categoryTags(journey);
              return (
                <tr
                  key={journey.id}
                  className={cx(
                    "border-b border-line/60 last:border-0",
                    selectedId === journey.id ? "bg-brand/5" : "hover:bg-panel-2/40",
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-ink">
                        {journey.kind === "WALK_ONLY"
                          ? "Walk-only"
                          : journey.legs.map((leg) => leg.routeId).join(" → ")}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <Badge key={tag} tone="brand">
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </div>
                  </td>
                  <td className="safar-mono px-3 py-2 text-ink-dim">
                    {formatClock(journey.departureTime)}
                  </td>
                  <td className="safar-mono px-3 py-2 text-ink-dim">
                    {formatClock(journey.arrivalTime)}
                  </td>
                  <td className="px-3 py-2 text-ink-dim">{formatDuration(journey.totalDurationMinutes)}</td>
                  <td className="px-3 py-2 text-ink-dim">{journey.transferCount}</td>
                  <td className="px-3 py-2 text-ink-dim">
                    {journey.walkingMetersApprox > 0 ? `~${journey.walkingMetersApprox} m` : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-dim">
                    {journey.reliability.score}/100 · {journey.reliability.label}
                  </td>
                  <td className="px-3 py-2">
                    {journey.meetsRequiredArrival ? (
                      <Badge tone="success">On time</Badge>
                    ) : (
                      <Badge tone="critical">+{Math.max(1, journey.minutesRelativeToRequiredArrival)} min</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onSelect(journey)}>
                      Details
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
