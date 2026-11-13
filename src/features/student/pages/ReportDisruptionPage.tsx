import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Info, Send, ShieldAlert } from "lucide-react";
import { REPORT_STATUS_LABELS, REPORT_TYPE_OPTIONS } from "../../../domain/constants";
import { formatDateTimeLabel } from "../../../domain/calculations/time";
import { prepareDisruptionReport } from "../../../domain/services/studentActions";
import { useSafarState } from "../../../state/SafarStateContext";
import { busesForRoute, stopName, stopsForRoute } from "../../../state/selectors";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Notice,
  Select,
  Textarea,
  TextInput,
} from "../../../components/ui";
import { useStudentSession } from "../session";

const STATUS_TONES: Record<string, "neutral" | "brand" | "success" | "warning" | "critical" | "muted"> = {
  UNVERIFIED: "warning",
  VERIFIED: "brand",
  REJECTED: "critical",
  DUPLICATE: "muted",
  CLOSED: "success",
};

const WORKFLOW_STEPS = [
  "You submit a report. It is saved as UNVERIFIED STUDENT REPORT with a reference ID.",
  "An authority reviews it and marks it VERIFIED, REJECTED or DUPLICATE with a reason.",
  "A verified report is still not a confirmed incident — authorities review it separately.",
  "Only an explicit authority CONFIRM INCIDENT action changes bus status and journey plans.",
];

export function ReportDisruptionPage() {
  const { state, dispatch } = useSafarState();
  const session = useStudentSession();

  const [routeId, setRouteId] = useState(state.routes[0]?.id ?? "");
  const [expectedBusId, setExpectedBusId] = useState("");
  const [stopId, setStopId] = useState("");
  const [expectedArrivalTime, setExpectedArrivalTime] = useState("08:00");
  const [reportType, setReportType] = useState("BUS_NOT_ARRIVED");
  const [description, setDescription] = useState("");

  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const routeStops = stopsForRoute(state, routeId);
  const routeBuses = busesForRoute(state, routeId);
  const myReports = state.disruptionReports
    .filter((report) => report.submittedBySessionId === session.id)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = prepareDisruptionReport(state, {
      routeId,
      expectedBusId: expectedBusId || undefined,
      stopId: stopId || undefined,
      expectedArrivalTime: expectedArrivalTime || undefined,
      reportType,
      description: description || undefined,
      sessionId: session.id,
    });

    if (!result.ok) {
      setErrors(result.errors);
      setSuccess(null);
      return;
    }

    dispatch({
      type: "SUBMIT_DISRUPTION_REPORT",
      report: result.value.report,
      audit: result.value.audit,
    });
    setErrors([]);
    setSuccess(result.value.report.id);
    setDescription("");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Immediate disruption reporting
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          REPORT BUS NOT ARRIVED / DISRUPTION
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-dim">
          Tell the transport authorities what you are seeing at your stop. Keep it factual: route,
          expected bus, stop, expected arrival time and what went wrong.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Submit a disruption report"
            description="Required fields are marked. Only the minimum information is collected."
            icon={<AlertTriangle size={15} />}
            action={<Badge tone="warning">UNVERIFIED on submit</Badge>}
          />

          <form className="mt-3 space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Route number" htmlFor="report-route" required>
                <Select
                  id="report-route"
                  value={routeId}
                  onChange={(event) => {
                    setRouteId(event.target.value);
                    setStopId("");
                    setExpectedBusId("");
                  }}
                >
                  {state.routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.id} · {route.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Expected bus number"
                htmlFor="report-bus"
                hint="Optional if you are not sure which bus was scheduled."
              >
                <Select
                  id="report-bus"
                  value={expectedBusId}
                  onChange={(event) => setExpectedBusId(event.target.value)}
                >
                  <option value="">Not sure</option>
                  {routeBuses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.registration}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Bus stop" htmlFor="report-stop">
                <Select
                  id="report-stop"
                  value={stopId}
                  onChange={(event) => setStopId(event.target.value)}
                >
                  <option value="">Select the stop (optional)</option>
                  {routeStops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Expected arrival time" htmlFor="report-time">
                <TextInput
                  id="report-time"
                  type="time"
                  value={expectedArrivalTime}
                  onChange={(event) => setExpectedArrivalTime(event.target.value)}
                />
              </Field>

              <Field label="Report type" htmlFor="report-type" required className="sm:col-span-2">
                <Select
                  id="report-type"
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value)}
                >
                  {REPORT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="What happened?"
                htmlFor="report-description"
                hint="Optional. Do not include personal information about other passengers."
                className="sm:col-span-2"
              >
                <Textarea
                  id="report-description"
                  value={description}
                  maxLength={500}
                  placeholder="e.g. The 08:15 bus to Puttur has not arrived and there is no announcement at the stop."
                  onChange={(event) => setDescription(event.target.value)}
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
              <Notice tone="success" title={`Report submitted · reference ${success}`}>
                <p>
                  Status: <span className="font-semibold">UNVERIFIED STUDENT REPORT</span>. The
                  authority review queue now shows this report. Your submission has not marked the
                  bus unavailable and has not created a confirmed incident.
                </p>
              </Notice>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary">
                <Send size={14} /> Submit report
              </Button>
              <p className="text-[10px] text-muted">
                Reference IDs are generated for the demo session; no personal details are stored.
              </p>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="What happens to your report"
              description="Unverified is not verified, and a verified report is not a confirmed incident."
              icon={<ClipboardCheck size={15} />}
            />
            <ol className="mt-3 space-y-2">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step} className="flex gap-2 text-[11px] leading-relaxed text-ink-dim">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong bg-panel-2 text-[10px] font-semibold text-brand">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-400/25 bg-amber-400/5 p-2 text-[10px] leading-relaxed text-amber-100">
              <ShieldAlert size={12} className="mt-0.5 shrink-0" />
              Prototype limitation: this demo has no sign-in, so reports are tagged to a labelled
              demo session. In production, report ownership would require authenticated students.
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Your reports"
              description="Status updates come from the shared application state."
              icon={<Clock size={15} />}
            />
            <div className="mt-3 space-y-2">
              {myReports.length === 0 ? (
                <EmptyState
                  title="No reports submitted yet"
                  body="Reports you submit in this demo session appear here with their review status."
                  icon={<Info size={20} />}
                />
              ) : (
                myReports.map((report) => (
                  <article key={report.id} className="rounded-lg border border-line bg-abyss/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-ink">{report.id}</p>
                        <p className="text-[10px] text-muted">
                          {report.routeId} · {stopName(state, report.stopId)} ·{" "}
                          {formatDateTimeLabel(report.submittedAt)}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONES[report.status] ?? "neutral"}>
                        {REPORT_STATUS_LABELS[report.status] ?? report.status}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-dim">
                      {REPORT_TYPE_OPTIONS.find((option) => option.value === report.reportType)?.label ??
                        report.reportType}
                      {report.expectedArrivalAt ? ` · expected ${report.expectedArrivalAt}` : ""}
                    </p>
                    {report.description ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">{report.description}</p>
                    ) : null}
                    {report.reviewReason ? (
                      <p className="mt-1.5 rounded-md border border-line bg-panel-2/60 px-2 py-1 text-[10px] text-ink-dim">
                        Authority note: {report.reviewReason}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
              <CheckCircle2 size={11} className="text-emerald-300" />
              Fleet status is unchanged by student reports.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
