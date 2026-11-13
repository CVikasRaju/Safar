import { useMemo } from "react";
import { CalendarClock, Info, Radar } from "lucide-react";
import { useSafarState } from "../../../state/SafarStateContext";
import { Badge, Card, CardHeader, Notice } from "../../../components/ui";
import {
  PREDICTION_STATUS_LABELS,
  predictUpcomingEvents,
  type PredictionStatus,
} from "../../../domain/emergency/eventPrediction";
import { formatDateTimeLabel } from "../../../domain/calculations/time";
import { PredictionStatusBadge, formatNumber } from "../components";

const STATUS_GUIDE: Array<{ status: PredictionStatus; description: string }> = [
  { status: "VERIFIED", description: "Confirmed in the scenario data. Still simulated, never live." },
  { status: "USER_REPORTED", description: "Submitted by a student and not yet reviewed by an authority." },
  { status: "AI_GENERATED", description: "A prediction derived from event records — not confirmed." },
  { status: "SIMULATED", description: "Created by the scenario itself, such as examination pressure." },
  { status: "HISTORICAL", description: "A past pattern used as a risk signal, not a forecast." },
];

export function ControlCentrePredictionPage() {
  const { state } = useSafarState();
  const now = useMemo(() => new Date(), []);
  const predictions = useMemo(() => predictUpcomingEvents(state, now), [state, now]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Event intelligence
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Advance event prediction</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-dim">
          Predictions run roughly a day ahead of a known event rather than 30 minutes before it, and
          each item states where it came from. Nothing unverified is presented as confirmed.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {STATUS_GUIDE.map((entry) => (
          <div key={entry.status} className="rounded-lg border border-line bg-abyss/40 p-2.5">
            <PredictionStatusBadge status={entry.status} />
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{entry.description}</p>
          </div>
        ))}
      </div>

      <Notice tone="info" title="How to read these predictions">
        Lead time is the distance between now and the start of the event&apos;s impact window. Traffic
        increases and extra minutes are estimates derived from the event category, expected crowd level
        and the recorded route impact — never from invented real-world information.
      </Notice>

      <div className="space-y-3">
        {predictions.map((prediction) => (
          <Card key={prediction.id}>
            <CardHeader
              title={prediction.title}
              description={`${prediction.categoryLabel} · ${prediction.locationLabel}`}
              icon={<Radar size={15} />}
              action={
                <div className="flex flex-wrap items-center gap-1">
                  <PredictionStatusBadge status={prediction.status} />
                  <Badge tone={prediction.confidence === "HIGH" ? "success" : prediction.confidence === "MEDIUM" ? "warning" : "neutral"}>
                    {prediction.confidence} confidence
                  </Badge>
                </div>
              }
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-line bg-abyss/50 p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Lead time</p>
                <p className="safar-mono text-sm text-ink">{prediction.leadTimeHours} h ahead</p>
              </div>
              <div className="rounded-md border border-line bg-abyss/50 p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Traffic increase</p>
                <p className="safar-mono text-sm text-ink">+{prediction.expectedTrafficIncreasePct}%</p>
              </div>
              <div className="rounded-md border border-line bg-abyss/50 p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Extra journey time</p>
                <p className="safar-mono text-sm text-ink">+{prediction.estimatedExtraMinutes} min</p>
              </div>
              <div className="rounded-md border border-line bg-abyss/50 p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">Students affected</p>
                <p className="safar-mono text-sm text-ink">{formatNumber(prediction.studentsAffected)}</p>
              </div>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
              <CalendarClock size={11} /> Impact window from {formatDateTimeLabel(prediction.startsAt)}
              {prediction.endsAt ? ` to ${formatDateTimeLabel(prediction.endsAt)}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {prediction.affectedRouteIds.map((routeId) => (
                <Badge key={routeId} tone="warning">
                  {routeId}
                </Badge>
              ))}
              {prediction.affectedVillageIds.map((villageId) => (
                <Badge key={villageId} tone="neutral">
                  {state.villages.find((village) => village.id === villageId)?.name ?? villageId}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">{prediction.warning}</p>
            <p className="mt-1.5 rounded-md border border-line bg-abyss/40 p-2 text-[11px] leading-relaxed text-muted">
              <span className="font-semibold text-ink-dim">Recommended alternative: </span>
              {prediction.recommendedAlternative}
            </p>
            <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
              <Info size={11} className="mt-0.5 shrink-0" /> {prediction.disclaimer}
            </p>
          </Card>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-muted">
        {PREDICTION_STATUS_LABELS.HISTORICAL} entries describe past patterns only. A prediction never
        marks a bus unavailable, never creates an incident and never changes an allocation — only the
        emergency scenario and confirmed state do that.
      </p>
    </div>
  );
}
