import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, BookOpen, Info, Route as RouteIcon, ShieldCheck } from "lucide-react";
import type { JourneySearchRequest } from "../../../domain/types/journey";
import {
  generateJourneyOptions,
  journeySignature,
} from "../../../domain/calculations/journeyPlanner";
import { formatDateLabel, formatDuration, isValidHhmm, isValidIsoDate } from "../../../domain/calculations/time";
import { useSafarState } from "../../../state/SafarStateContext";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  SectionHeading,
} from "../../../components/ui";
import { JourneySearchForm } from "../../journeys/components/JourneySearchForm";
import { RecommendationCard } from "../../journeys/components/RecommendationCard";
import { JourneyComparison } from "../../journeys/components/JourneyComparison";
import { JourneyDetails } from "../../journeys/components/JourneyDetails";
import { defaultJourneyRequest, plannerHref } from "../../journeys/defaultSearch";
import { saveWatch, watchFromJourney } from "../journeyWatch";

function readRequest(params: URLSearchParams, fallback: JourneySearchRequest, state: ReturnType<typeof useSafarState>["state"]): JourneySearchRequest {
  const origin = params.get("origin");
  const destination = params.get("destination");
  const date = params.get("date");
  const arrival = params.get("arrival");
  return {
    originVillageId:
      origin && state.villages.some((village) => village.id === origin)
        ? origin
        : fallback.originVillageId,
    destinationId:
      destination && state.destinations.some((entry) => entry.id === destination)
        ? destination
        : fallback.destinationId,
    travelDate: date && isValidIsoDate(date) ? date : fallback.travelDate,
    requiredArrivalTime:
      arrival && isValidHhmm(arrival) ? arrival : fallback.requiredArrivalTime,
  };
}

export function JourneyPlannerPage() {
  const { state } = useSafarState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const fallback = useMemo(() => defaultJourneyRequest(state), [state]);
  const request = useMemo(() => readRequest(searchParams, fallback, state), [searchParams, fallback, state]);
  const plan = useMemo(() => generateJourneyOptions(state, request), [state, request]);

  const selected =
    plan.options.find((journey) => journey.id === selectedId) ??
    plan.recommendations[0]?.journey ??
    plan.options[0];

  const originName =
    state.villages.find((village) => village.id === request.originVillageId)?.name ?? "Origin";
  const destinationName =
    state.destinations.find((entry) => entry.id === request.destinationId)?.name ?? "Destination";

  const handleSearch = (next: JourneySearchRequest) => {
    const nextPlan = generateJourneyOptions(state, next);
    const top = nextPlan.meetingRequiredArrival[0];
    saveWatch(watchFromJourney(next, top));
    setSearchParams({
      origin: next.originVillageId,
      destination: next.destinationId,
      date: next.travelDate,
      arrival: next.requiredArrivalTime,
    });
    setSelectedId(undefined);
    setNotice(
      top
        ? `Plan updated: best option departs ${new Date(top.departureTime).toTimeString().slice(0, 5)} and arrives ${new Date(top.arrivalTime).toTimeString().slice(0, 5)} (${journeySignature(top).split("|").length} leg${journeySignature(top).split("|").length > 1 ? "s" : ""}).`
        : "Plan updated. No journey currently meets the required arrival time.",
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Journey experience
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Journey Planner</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-dim">
            Enter your village, destination, travel date and the time you must arrive. SAFAR builds
            feasible journeys from the demo timetable and ranks fastest, most reliable and fewest
            transfers independently.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge tone="muted">{formatDateLabel(request.travelDate)}</Badge>
          <Badge tone="brand">arrive by {request.requiredArrivalTime}</Badge>
          <Badge tone="warning">Simulated / demo data</Badge>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Search parameters"
          description={`${originName} → ${destinationName}`}
          icon={<RouteIcon size={15} />}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchParams({
                  origin: fallback.originVillageId,
                  destination: fallback.destinationId,
                  date: fallback.travelDate,
                  arrival: fallback.requiredArrivalTime,
                });
                setSelectedId(undefined);
                setNotice(undefined);
              }}
            >
              Suggested demo search
            </Button>
          }
        />
        <div className="mt-3">
          <JourneySearchForm initial={request} onSubmit={handleSearch} />
        </div>
      </Card>

      {notice ? (
        <Notice tone="info" onDismiss={() => setNotice(undefined)} title="Search applied">
          {notice}
        </Notice>
      ) : null}

      {plan.notes.length > 0 ? (
        <Notice tone="warning" title="Planning notices">
          <ul className="list-disc space-y-1 pl-4">
            {plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {plan.recommendations.length > 0 ? (
        <section aria-labelledby="recommendations-heading">
          <SectionHeading
            title="Three calculated recommendations"
            description={`${plan.meetingRequiredArrival.length} feasible journey${
              plan.meetingRequiredArrival.length === 1 ? "" : "s"
            } ranked independently from the same candidate set — the same journey may legitimately win more than one category.`}
          />
          <div className="grid gap-3 lg:grid-cols-3">
            {plan.recommendations.map((optionSet) => (
              <RecommendationCard
                key={optionSet.category}
                optionSet={optionSet}
                selected={selected?.id === optionSet.journey.id}
                onSelect={() => setSelectedId(optionSet.journey.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {plan.noRouteReason ? (
        <Notice tone="critical" title="No feasible journey for this search">
          <p>{plan.noRouteReason}</p>
          <p className="mt-1.5">
            Try a later required arrival time, a different travel date, or another origin village.
            SAFAR does not invent a connection when the demo timetable does not support one.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                handleSearch({
                  ...request,
                  requiredArrivalTime: "10:00",
                })
              }
            >
              Try arriving by 10:00
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                handleSearch({
                  ...request,
                  originVillageId: fallback.originVillageId,
                  destinationId: fallback.destinationId,
                })
              }
            >
              Use suggested demo search
            </Button>
          </div>
        </Notice>
      ) : null}

      {plan.options.length > 0 ? (
        <JourneyComparison
          journeys={plan.options}
          selectedId={selected?.id}
          onSelect={(journey) => setSelectedId(journey.id)}
          caption={
            plan.lateAlternatives.length > 0
              ? `${plan.meetingRequiredArrival.length} meeting your deadline and ${plan.lateAlternatives.length} late alternative${
                  plan.lateAlternatives.length === 1 ? "" : "s"
                } (clearly marked).`
              : "Every calculated journey appears here with its own metrics — no duplicated cards."
          }
        />
      ) : (
        <EmptyState
          title="No journeys calculated"
          body="Adjust the search parameters above. If the network cannot serve the trip, SAFAR will say so instead of showing a fabricated route."
          icon={<RouteIcon size={22} />}
        />
      )}

      {selected ? (
        <JourneyDetails
          journey={selected}
          title={`Itinerary · ${originName} → ${destinationName}`}
          description={`${formatDuration(selected.totalDurationMinutes)} door to door · depart ${
            selected.departureTime.slice(11, 16)
          } · arrive ${selected.arrivalTime.slice(11, 16)} · ${
            selected.transferCount
          } change${selected.transferCount === 1 ? "" : "s"}.`}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <BookOpen size={15} className="text-brand" /> Planning assumptions and data provenance
            </summary>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              {plan.assumptions.map((assumption) => (
                <li key={assumption}>• {assumption}</li>
              ))}
              <li>
                • Journey candidates come from the shared demo route, stop and timetable records —
                never from an independent mock list.
              </li>
              <li>
                • Expected times include the documented illustrative delay conversion for confirmed
                incidents and any computed event impact that overlaps the journey window.
              </li>
            </ul>
            <p className="mt-2 text-[10px] text-muted">
              Provenance: timetable and event values are demo or simulated; feasibility, duration,
              waiting and reliability are calculated.
            </p>
          </details>
        </Card>

        <Card>
          <div className="flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-semibold text-ink">How the three categories are chosen</p>
              <ul className="mt-1.5 space-y-1.5 text-[11px] leading-relaxed text-muted">
                <li>
                  <span className="font-semibold text-ink-dim">Fastest</span> — lowest total elapsed
                  time, tie-broken by earlier arrival, then fewer changes.
                </li>
                <li>
                  <span className="font-semibold text-ink-dim">Most reliable</span> — highest
                  calculated illustrative reliability score, tie-broken by earlier arrival, then
                  fewer changes.
                </li>
                <li>
                  <span className="font-semibold text-ink-dim">Fewest transfers</span> — lowest
                  number of bus changes, tie-broken by reliability, then earlier arrival.
                </li>
              </ul>
              <p className="mt-2 flex items-start gap-1.5 text-[10px] text-muted">
                <Info size={11} className="mt-0.5 shrink-0" />
                If one journey wins several categories, the cards say so explicitly instead of
                inventing alternatives.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
        <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-300" />
        SAFAR is a prototype: no live GPS, official schedule feed or validated traffic forecast is
        connected. Shared planner link:{" "}
        <span className="safar-mono">{plannerHref(request)}</span>
      </p>
    </div>
  );
}
