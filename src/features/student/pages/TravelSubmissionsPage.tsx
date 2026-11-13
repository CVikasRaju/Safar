import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Send, Users } from "lucide-react";
import type { StudentTravelRequest } from "../../../domain/types";
import type { JourneyOption } from "../../../domain/types/journey";
import { generateJourneyOptions } from "../../../domain/calculations/journeyPlanner";
import { formatClock, formatDateLabel, formatDuration, isValidHhmm, isValidIsoDate } from "../../../domain/calculations/time";
import { prepareTravelRequest } from "../../../domain/services/studentActions";
import { useSafarState } from "../../../state/SafarStateContext";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Notice,
  Select,
  TextInput,
} from "../../../components/ui";
import { useStudentSession } from "../session";

interface PlannedSubmission {
  request: StudentTravelRequest;
  fastest?: JourneyOption;
}

export function TravelSubmissionsPage() {
  const { state, dispatch } = useSafarState();
  const session = useStudentSession();

  const [originVillageId, setOriginVillageId] = useState(session.homeVillageId);
  const [destinationId, setDestinationId] = useState(
    state.destinations.find((destination) => destination.id === "d-pgc")?.id ??
      state.destinations[0]?.id ??
      "",
  );
  const [travelDate, setTravelDate] = useState(state.scenario.scenarioDate);
  const [requiredArrivalTime, setRequiredArrivalTime] = useState("09:00");
  const [groupSize, setGroupSize] = useState("1");
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const myRequests = useMemo(
    () =>
      state.travelRequests
        .filter((request) => request.submittedBySessionId === session.id)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [state.travelRequests, session.id],
  );

  const planned: PlannedSubmission[] = useMemo(
    () =>
      myRequests.map((request) => ({
        request,
        fastest: generateJourneyOptions(state, {
          originVillageId: request.originVillageId,
          destinationId: request.destinationId,
          travelDate: request.travelDate,
          requiredArrivalTime: request.requiredArrivalTime,
        }).meetingRequiredArrival[0],
      })),
    [myRequests, state],
  );

  const aggregation = useMemo(() => {
    const rows = new Map<string, { routeId: string; submissions: number; students: number }>();
    let unmappedStudents = 0;
    for (const entry of planned) {
      const routeId = entry.fastest?.legs[0]?.routeId;
      if (!routeId) {
        unmappedStudents += entry.request.groupSize;
        continue;
      }
      const existing = rows.get(routeId) ?? { routeId, submissions: 0, students: 0 };
      existing.submissions += 1;
      existing.students += entry.request.groupSize;
      rows.set(routeId, existing);
    }
    return {
      rows: [...rows.values()].sort((a, b) => a.routeId.localeCompare(b.routeId)),
      unmappedStudents,
      totalStudents: planned.reduce((sum, entry) => sum + entry.request.groupSize, 0),
    };
  }, [planned]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedGroupSize = Number(groupSize);
    if (!isValidIsoDate(travelDate) || !isValidHhmm(requiredArrivalTime)) {
      setErrors(["Enter a valid travel date and required arrival time."]);
      setSuccess(null);
      return;
    }

    const result = prepareTravelRequest(state, {
      originVillageId,
      destinationId,
      travelDate,
      requiredArrivalTime,
      groupSize: parsedGroupSize,
      sessionId: session.id,
    });

    if (!result.ok) {
      setErrors(result.errors);
      setSuccess(null);
      return;
    }

    dispatch({
      type: "SUBMIT_TRAVEL_REQUEST",
      request: result.value.request,
      audit: result.value.audit,
    });
    setErrors([]);
    setSuccess(result.value.request.id);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Demand contribution
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">My Travel Plans</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-dim">
          Submit the journey you intend to make. SAFAR aggregates submissions to help authorities
          understand demand. Only aggregated numbers are shown — never individual students.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            title="Add an intended journey"
            description="Origin, destination, travel date, required arrival time and group size."
            icon={<ClipboardList size={15} />}
          />
          <form className="mt-3 space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Origin village" htmlFor="plan-origin" required>
                <Select
                  id="plan-origin"
                  value={originVillageId}
                  onChange={(event) => setOriginVillageId(event.target.value)}
                >
                  {state.villages.map((village) => (
                    <option key={village.id} value={village.id}>
                      {village.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Destination" htmlFor="plan-destination" required>
                <Select
                  id="plan-destination"
                  value={destinationId}
                  onChange={(event) => setDestinationId(event.target.value)}
                >
                  {state.destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Travel date" htmlFor="plan-date" required>
                <TextInput
                  id="plan-date"
                  type="date"
                  value={travelDate}
                  onChange={(event) => setTravelDate(event.target.value)}
                />
              </Field>

              <Field label="Required arrival time" htmlFor="plan-arrival" required>
                <TextInput
                  id="plan-arrival"
                  type="time"
                  value={requiredArrivalTime}
                  onChange={(event) => setRequiredArrivalTime(event.target.value)}
                />
              </Field>

              <Field
                label="Group size"
                htmlFor="plan-group"
                hint="Include yourself. Between 1 and 20 travellers."
                required
              >
                <TextInput
                  id="plan-group"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={groupSize}
                  onChange={(event) => setGroupSize(event.target.value)}
                />
              </Field>
            </div>

            {errors.length > 0 ? (
              <Notice tone="critical" title="Please fix these before submitting">
                <ul className="list-disc space-y-1 pl-4">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}

            {success ? (
              <Notice tone="success" title={`Travel plan saved · reference ${success}`}>
                Your intended journey is part of the aggregated demand view. It does not reserve a
                seat or a bus.
              </Notice>
            ) : null}

            <Button type="submit" variant="primary">
              <Send size={14} /> Submit travel plan
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Aggregated demand from this demo session"
            description="Each submission is counted once, allocated to its fastest feasible demo route."
            icon={<Users size={15} />}
          />
          <div className="mt-3 space-y-2">
            {aggregation.rows.length === 0 ? (
              <EmptyState
                title="No submissions to aggregate"
                body="Submit an intended journey to see how SAFAR assigns one traveller to one route instead of counting them on every candidate."
                icon={<Users size={20} />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                      <th scope="col" className="py-1.5 pr-2 font-semibold">Route</th>
                      <th scope="col" className="py-1.5 pr-2 font-semibold">Submissions</th>
                      <th scope="col" className="py-1.5 pr-2 font-semibold">Travellers</th>
                      <th scope="col" className="py-1.5 font-semibold">Seed expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregation.rows.map((row) => {
                      const seed = state.demandSeed.find((record) => record.routeId === row.routeId);
                      return (
                        <tr key={row.routeId} className="border-b border-line/60 last:border-0">
                          <td className="py-1.5 pr-2 font-medium text-ink">{row.routeId}</td>
                          <td className="py-1.5 pr-2 text-ink-dim">{row.submissions}</td>
                          <td className="py-1.5 pr-2 text-ink-dim">{row.students}</td>
                          <td className="py-1.5 text-muted">
                            {seed ? `${seed.expectedStudents} students / ${seed.availableSeats} seats` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[10px] leading-relaxed text-muted">
              {aggregation.totalStudents} traveller
              {aggregation.totalStudents === 1 ? "" : "s"} submitted in this session
              {aggregation.unmappedStudents > 0
                ? ` · ${aggregation.unmappedStudents} could not be allocated to a feasible route`
                : ""}
              . Seed demand values are illustrative demo numbers and are not modified by student
              submissions here — the Demand Analytics module owns combined totals.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Submitted plans"
          description="Planned journeys inferred from the shared timetable. These are estimates, not reservations."
          icon={<CalendarDays size={15} />}
        />
        <div className="mt-3 space-y-2">
          {planned.length === 0 ? (
            <EmptyState
              title="Nothing submitted yet"
              body="Your intended journeys will be listed here with the route SAFAR would expect you to use."
              icon={<CalendarDays size={20} />}
            />
          ) : (
            planned.map(({ request, fastest }) => (
              <article
                key={request.id}
                className="rounded-lg border border-line bg-abyss/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      {state.villages.find((village) => village.id === request.originVillageId)?.name}{" "}
                      →{" "}
                      {
                        state.destinations.find(
                          (destination) => destination.id === request.destinationId,
                        )?.name
                      }
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {request.id} · {formatDateLabel(request.travelDate)} · arrive by{" "}
                      {request.requiredArrivalTime}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="muted">
                      <Users size={10} /> {request.groupSize}
                    </Badge>
                    <Badge tone="brand">User-entered</Badge>
                  </div>
                </div>

                {fastest ? (
                  <p className="mt-2 text-[11px] text-ink-dim">
                    Expected route:{" "}
                    <span className="font-semibold text-ink">
                      {fastest.legs.map((leg) => leg.routeId).join(" → ")}
                    </span>{" "}
                    · depart {formatClock(fastest.departureTime)} → arrive{" "}
                    {formatClock(fastest.arrivalTime)} ({formatDuration(fastest.totalDurationMinutes)})
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-amber-300">
                    No feasible demo journey currently matches this plan.
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
