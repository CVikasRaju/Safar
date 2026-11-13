// SAFAR — Authority Disruption Review & Incident Confirmation (Member 3)
//
// This page keeps the documented distinction visible at all times:
//   UNVERIFIED student report → VERIFIED/REJECTED/DUPLICATE review outcome
//   → separate CONFIRM INCIDENT action → operational disruption + fleet effect.
// Student reports never change fleet status on submission.

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAppState, useAppDispatch } from '../../state/store';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  canReviewReport,
  estimateAffectedPassengers,
  incidentMarksBusUnavailable,
  validateIncidentConfirmation,
  type IncidentInput,
} from '../../domain/calculations/disruption';
import type {
  IncidentSeverity,
  IncidentType,
  ReportStatus,
  ReportType,
} from '../../domain/types';
import {
  EmptyState,
  Metric,
  ReportStatusBadge,
  SeverityBadge,
} from '../../components/intelligence/Badges';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  REPORT_TYPE_LABELS,
  formatDateTime,
  shortId,
} from '../../components/intelligence/labels';

type ReviewAction = 'VERIFY' | 'REJECT' | 'DUPLICATE';
type StatusFilter = 'ALL' | ReportStatus;

interface IncidentFormState {
  type: IncidentType;
  routeId: string;
  busId: string;
  affectedStopId: string;
  severity: IncidentSeverity;
  expectedResolution: string;
  description: string;
}

const EMPTY_INCIDENT_FORM: IncidentFormState = {
  type: 'BUS_BREAKDOWN',
  routeId: '',
  busId: '',
  affectedStopId: '',
  severity: 'HIGH',
  expectedResolution: '',
  description: '',
};

export default function DisruptionReports() {
  const { state } = useAppState();
  const dispatch = useAppDispatch();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('UNVERIFIED');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction>('VERIFY');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const [incidentForm, setIncidentForm] = useState<IncidentFormState>(EMPTY_INCIDENT_FORM);
  const [relatedReportIds, setRelatedReportIds] = useState<string[]>([]);
  const [incidentErrors, setIncidentErrors] = useState<string[]>([]);
  const [incidentWarnings, setIncidentWarnings] = useState<string[]>([]);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [incidentSuccess, setIncidentSuccess] = useState<string | null>(null);

  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [closeReasons, setCloseReasons] = useState<Record<string, string>>({});
  const [closeError, setCloseError] = useState<string | null>(null);

  const reports = useMemo(() => {
    return [...state.disruptionReports]
      .filter(report => statusFilter === 'ALL' || report.status === statusFilter)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [state.disruptionReports, statusFilter]);

  const selectedReport = state.disruptionReports.find(report => report.id === selectedReportId);
  const verifiedReports = state.disruptionReports.filter(report => report.status === 'VERIFIED');
  const unverifiedCount = state.disruptionReports.filter(
    report => report.status === 'UNVERIFIED',
  ).length;
  const verifiedAwaitingCount = verifiedReports.filter(report => !report.relatedIncidentId).length;
  const rejectedCount = state.disruptionReports.filter(
    report => report.status === 'REJECTED' || report.status === 'DUPLICATE',
  ).length;
  const activeIncidents = state.incidents.filter(incident => incident.status === 'ACTIVE');

  const routeStops = state.stops.filter(stop => {
    if (!incidentForm.routeId) return true;
    const r = state.routes.find(route => route.id === incidentForm.routeId);
    return r ? (r.stopIds ?? r.stops ?? []).includes(stop.id) : true;
  });

  const estimatedPassengers = incidentForm.routeId
    ? estimateAffectedPassengers(incidentForm.routeId, state.buses)
    : 0;

  function beginReview(reportId: string) {
    setSelectedReportId(reportId);
    setReviewAction('VERIFY');
    setReviewReason('');
    setReviewError(null);
    setReviewSuccess(null);
  }

  function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedReport) return;

    const permission = canReviewReport(selectedReport);
    if (!permission.allowed) {
      setReviewError(permission.reason ?? 'This report cannot be reviewed again.');
      return;
    }
    if (reviewAction !== 'VERIFY' && !reviewReason.trim()) {
      setReviewError('A reason is required when rejecting a report or marking it duplicate.');
      return;
    }

    if (reviewAction === 'VERIFY') {
      dispatch({ type: 'VERIFY_REPORT', payload: { reportId: selectedReport.id } });
      setReviewSuccess(
        `Report ${selectedReport.id} marked VERIFIED. This is a credible report, not a confirmed incident. Use CONFIRM INCIDENT below if operational action is required.`,
      );
    } else if (reviewAction === 'REJECT') {
      dispatch({
        type: 'REJECT_REPORT',
        payload: { reportId: selectedReport.id, reason: reviewReason.trim() },
      });
      setReviewSuccess(`Report ${selectedReport.id} rejected. Reason recorded in the demo audit trail.`);
    } else {
      dispatch({
        type: 'MARK_REPORT_DUPLICATE',
        payload: { reportId: selectedReport.id, reason: reviewReason.trim() },
      });
      setReviewSuccess(`Report ${selectedReport.id} marked duplicate. Reason recorded.`);
    }

    setReviewError(null);
    setSelectedReportId(null);
    setReviewReason('');
  }

  function resetIncidentForm() {
    setIncidentForm(EMPTY_INCIDENT_FORM);
    setRelatedReportIds([]);
    setIncidentErrors([]);
    setIncidentWarnings([]);
    setAwaitingConfirmation(false);
  }

  function submitIncident(event: React.FormEvent) {
    event.preventDefault();
    setIncidentSuccess(null);

    const input: IncidentInput = {
      type: incidentForm.type,
      routeId: incidentForm.routeId || undefined,
      busId: incidentForm.busId || undefined,
      affectedStopId: incidentForm.affectedStopId || undefined,
      severity: incidentForm.severity,
      expectedResolution: incidentForm.expectedResolution.trim() || undefined,
      description: incidentForm.description.trim() || undefined,
      relatedReportIds,
      estimatedAffectedPassengers: estimatedPassengers,
    };

    const validation = validateIncidentConfirmation(input, state);
    setIncidentWarnings(validation.warnings);
    if (!validation.valid) {
      setIncidentErrors(validation.errors);
      setAwaitingConfirmation(false);
      return;
    }
    setIncidentErrors([]);

    if (!awaitingConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }

    dispatch({ type: 'CONFIRM_INCIDENT', payload: input });
    const bus = state.buses.find(item => item.id === incidentForm.busId);
    const fleetNote =
      bus && incidentMarksBusUnavailable(incidentForm.type)
        ? ` ${bus.registration} is now marked UNAVAILABLE.`
        : '';
    setIncidentSuccess(
      `CONFIRMED INCIDENT created${incidentForm.routeId ? ` on ${incidentForm.routeId}` : ''}${bus ? ` with ${bus.registration}` : ''}.${fleetNote} Alerts, reliability and journey calculations now use this confirmed disruption.`,
    );
    resetIncidentForm();
  }

  function closeIncident(incidentId: string) {
    const reason = (closeReasons[incidentId] ?? '').trim();
    if (!reason) {
      setCloseError('A closure reason is required to close an incident.');
      return;
    }
    dispatch({ type: 'CLOSE_INCIDENT', payload: { incidentId, reason } });
    setCloseError(null);
    setExpandedIncident(null);
    setCloseReasons(current => ({ ...current, [incidentId]: '' }));
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Review student reports, verify credibility and separately confirm operational incidents ·{' '}
            <span className="demo-label">DEMO DATA</span>
          </p>
        </div>
        <span className="badge-slate">
          Prototype audit trail — not a certified government record
        </span>
      </div>

      <div className="alert-bar warning" role="note">
        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
        <span>
          <strong>UNVERIFIED STUDENT REPORT ≠ VERIFIED REPORT ≠ CONFIRMED INCIDENT.</strong> A student
          report never changes fleet status. Verification records credibility only; only CONFIRM
          INCIDENT creates an operational disruption.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label="Unverified reports"
          value={unverifiedCount}
          sub="Awaiting authority review"
          icon={<ClipboardList size={14} />}
          color="var(--color-amber)"
        />
        <Metric
          label="Verified, not confirmed"
          value={verifiedAwaitingCount}
          sub="No operational effect yet"
          icon={<ShieldCheck size={14} />}
          color="var(--color-cyan)"
        />
        <Metric
          label="Active incidents"
          value={activeIncidents.length}
          sub="Confirmed operational disruptions"
          icon={<AlertTriangle size={14} />}
          color="var(--color-rose)"
        />
        <Metric
          label="Rejected / duplicate"
          value={rejectedCount}
          sub="No operational effect"
          icon={<XCircle size={14} />}
          color="var(--color-text-secondary)"
        />
      </div>

      {/* Report queue */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="section-title mb-0">Student report queue</h2>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter reports by status">
            {(['ALL', 'UNVERIFIED', 'VERIFIED', 'REJECTED', 'DUPLICATE', 'CLOSED'] as StatusFilter[]).map(
              filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter);
                    setSelectedReportId(null);
                  }}
                  className={`btn text-xs ${statusFilter === filter ? 'btn-primary' : 'btn-ghost'}`}
                  aria-pressed={statusFilter === filter}
                >
                  {filter === 'ALL' ? 'All' : filter.replace(/_/g, ' ')}
                </button>
              ),
            )}
          </div>
        </div>

        {reports.length === 0 ? (
          <EmptyState
            title="No reports in this filter"
            detail="Student submissions from the Student Portal appear here as UNVERIFIED records."
          />
        ) : (
          <div className="table-wrapper mt-2">
            <table className="table">
              <caption className="sr-only">Student disruption reports and review actions.</caption>
              <thead>
                <tr>
                  <th scope="col">Report</th>
                  <th scope="col">Route</th>
                  <th scope="col">Type</th>
                  <th scope="col">Stop</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                  <th scope="col">Incident</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => {
                  const stop = state.stops.find(item => item.id === report.stopId);
                  const bus = state.buses.find(item => item.id === report.expectedBusId);
                  return (
                    <tr key={report.id}>
                      <td>
                        <span className="font-mono text-xs">{shortId(report.id, 18)}</span>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {report.provenance}
                        </div>
                      </td>
                      <td>{report.routeId}</td>
                      <td>{REPORT_TYPE_LABELS[report.reportType as ReportType] ?? report.reportType}</td>
                      <td>
                        {stop?.name ?? '—'}
                        {bus && (
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Bus {bus.registration}
                          </div>
                        )}
                      </td>
                      <td>{report.expectedArrivalAt ?? '—'}</td>
                      <td>{formatDateTime(report.submittedAt)}</td>
                      <td>
                        <ReportStatusBadge status={report.status} />
                      </td>
                      <td>{report.relatedIncidentId ? shortId(report.relatedIncidentId, 14) : '—'}</td>
                      <td>
                        {report.status === 'UNVERIFIED' ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => beginReview(report.id)}
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Reviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport && (
          <form
            onSubmit={submitReview}
            className="card mt-3"
            style={{ background: 'rgba(5,13,26,0.6)', borderColor: 'rgba(34,211,238,0.3)' }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="section-title mb-0">Review report {shortId(selectedReport.id, 22)}</h3>
              <span className="badge-slate">
                {selectedReport.routeId} · {REPORT_TYPE_LABELS[selectedReport.reportType as ReportType] ?? selectedReport.reportType}
              </span>
            </div>
            {selectedReport.description && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Student description: {selectedReport.description}
              </p>
            )}

            <fieldset className="mt-2">
              <legend className="label">Review outcome</legend>
              <div className="flex flex-wrap gap-2">
                {(['VERIFY', 'REJECT', 'DUPLICATE'] as ReviewAction[]).map(action => (
                  <label
                    key={action}
                    className={`btn cursor-pointer ${reviewAction === action ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    <input
                      type="radio"
                      name="review-action"
                      className="sr-only"
                      value={action}
                      checked={reviewAction === action}
                      onChange={() => setReviewAction(action)}
                    />
                    {action === 'VERIFY' ? 'Verify report' : action === 'REJECT' ? 'Reject' : 'Mark duplicate'}
                  </label>
                ))}
              </div>
            </fieldset>

            {reviewAction !== 'VERIFY' && (
              <div className="mt-2">
                <label className="label" htmlFor="review-reason">
                  Reason (required)
                </label>
                <textarea
                  id="review-reason"
                  className="input"
                  rows={2}
                  maxLength={300}
                  value={reviewReason}
                  onChange={event => setReviewReason(event.target.value)}
                  placeholder="e.g. Bus arrived on time per depot log"
                />
              </div>
            )}

            {reviewError && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-rose)' }} role="alert">
                {reviewError}
              </p>
            )}
            {reviewSuccess && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-emerald)' }} role="status">
                {reviewSuccess}
              </p>
            )}

            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn-primary">
                {reviewAction === 'VERIFY' ? 'VERIFY REPORT' : reviewAction === 'REJECT' ? 'REJECT REPORT' : 'MARK DUPLICATE'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSelectedReportId(null)}>
                Cancel
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Verification does not create an incident and does not mark a bus unavailable.
            </p>
          </form>
        )}
      </div>

      {/* Incident confirmation */}
      <form onSubmit={submitIncident} className="card" style={{ borderColor: 'rgba(251,113,133,0.3)' }}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 className="section-title mb-0.5">Confirm operational incident</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Separate authority action. Creates an ACTIVE incident, publishes an alert and updates
              journey/reliability calculations.
            </p>
          </div>
          <span className="badge-rose">AUTHORITY ACTION</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label" htmlFor="inc-type">
              Incident type *
            </label>
            <select
              id="inc-type"
              className="select"
              value={incidentForm.type}
              onChange={event =>
                setIncidentForm(form => ({ ...form, type: event.target.value as IncidentType }))
              }
            >
              {INCIDENT_TYPES.map(type => (
                <option key={type} value={type}>
                  {INCIDENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="inc-route">
              Route
            </label>
            <select
              id="inc-route"
              className="select"
              value={incidentForm.routeId}
              onChange={event =>
                setIncidentForm(form => ({
                  ...form,
                  routeId: event.target.value,
                  affectedStopId: '',
                }))
              }
            >
              <option value="">No specific route</option>
              {state.routes.map(route => (
                <option key={route.id} value={route.id}>
                  {route.id} — {route.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="inc-bus">
              Bus {incidentMarksBusUnavailable(incidentForm.type) ? '*' : '(optional)'}
            </label>
            <select
              id="inc-bus"
              className="select"
              value={incidentForm.busId}
              onChange={event =>
                setIncidentForm(form => ({ ...form, busId: event.target.value }))
              }
            >
              <option value="">No specific bus</option>
              {state.buses.map(bus => (
                <option key={bus.id} value={bus.id}>
                  {bus.registration} · {bus.status.replace(/_/g, ' ')} · {bus.assignedRouteId ?? 'no route'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="inc-stop">
              Affected stop (optional)
            </label>
            <select
              id="inc-stop"
              className="select"
              value={incidentForm.affectedStopId}
              onChange={event =>
                setIncidentForm(form => ({ ...form, affectedStopId: event.target.value }))
              }
            >
              <option value="">Not specified</option>
              {routeStops.map(stop => (
                <option key={stop.id} value={stop.id}>
                  {stop.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="inc-severity">
              Severity *
            </label>
            <select
              id="inc-severity"
              className="select"
              value={incidentForm.severity}
              onChange={event =>
                setIncidentForm(form => ({
                  ...form,
                  severity: event.target.value as IncidentSeverity,
                }))
              }
            >
              {INCIDENT_SEVERITIES.map(severity => (
                <option key={severity} value={severity}>
                  {INCIDENT_SEVERITY_LABELS[severity]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="inc-resolution">
              Expected resolution
            </label>
            <input
              id="inc-resolution"
              className="input"
              maxLength={200}
              value={incidentForm.expectedResolution}
              onChange={event =>
                setIncidentForm(form => ({ ...form, expectedResolution: event.target.value }))
              }
              placeholder="e.g. Repair assessment within 45 minutes"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="inc-description">
            Description
          </label>
          <textarea
            id="inc-description"
            className="input"
            rows={2}
            maxLength={500}
            value={incidentForm.description}
            onChange={event =>
              setIncidentForm(form => ({ ...form, description: event.target.value }))
            }
            placeholder="What was confirmed, where, and by whom (demo authority)"
          />
        </div>

        {verifiedReports.length > 0 && (
          <fieldset className="mt-3">
            <legend className="label">Link verified reports (optional)</legend>
            <div className="space-y-1">
              {verifiedReports.map(report => (
                <label key={report.id} className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={relatedReportIds.includes(report.id)}
                    onChange={event =>
                      setRelatedReportIds(current =>
                        event.target.checked
                          ? [...current, report.id]
                          : current.filter(id => id !== report.id),
                      )
                    }
                  />
                  <span>
                    {shortId(report.id, 20)} · {REPORT_TYPE_LABELS[report.reportType as ReportType] ?? report.reportType} · {report.routeId}
                    {report.relatedIncidentId ? ' (already linked)' : ''}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Only VERIFIED reports can be linked. Linking does not change the report's own status.
            </p>
          </fieldset>
        )}

        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Illustrative affected passengers (occupied seats on route buses): {estimatedPassengers}. This
          is not a measured passenger count.
        </p>

        {incidentErrors.length > 0 && (
          <ul className="mt-2 text-xs space-y-0.5" style={{ color: 'var(--color-rose)' }} role="alert">
            {incidentErrors.map(error => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        )}
        {incidentWarnings.length > 0 && (
          <ul className="mt-2 text-xs space-y-0.5" style={{ color: 'var(--color-amber)' }}>
            {incidentWarnings.map(warning => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        )}
        {incidentSuccess && (
          <div className="alert-bar info mt-2" role="status">
            <CheckCircle size={12} className="mt-0.5 flex-shrink-0" />
            <span>{incidentSuccess}</span>
          </div>
        )}
        {awaitingConfirmation && (
          <div className="alert-bar critical mt-2" role="alert">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>
              Confirm this operational incident? It will become an ACTIVE disruption, publish an alert
              and may mark the selected bus unavailable. Press the confirmation button again to proceed.
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          <button type="submit" className={awaitingConfirmation ? 'btn-danger' : 'btn-primary'}>
            {awaitingConfirmation ? 'CONFIRM INCIDENT — APPLY DISRUPTION' : 'REVIEW INCIDENT DETAILS'}
          </button>
          {awaitingConfirmation && (
            <button type="button" className="btn-ghost" onClick={resetIncidentForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Confirmed incidents */}
      <div className="card">
        <h2 className="section-title">Confirmed incidents and simulated breakdowns</h2>
        {state.incidents.length === 0 ? (
          <EmptyState
            title="No confirmed incidents"
            detail="Simulated fleet breakdowns and authority confirmations appear here with their operational effects."
          />
        ) : (
          <div className="space-y-2">
            {state.incidents.map(incident => {
              const bus = state.buses.find(item => item.id === incident.busId);
              const route = state.routes.find(item => item.id === incident.routeId);
              const isExpanded = expandedIncident === incident.id;
              return (
                <div key={incident.id} className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
                  <button
                    type="button"
                    className="flex items-start justify-between gap-2 w-full text-left"
                    onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                    aria-expanded={isExpanded}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge-rose">CONFIRMED INCIDENT</span>
                        <span className="text-xs font-semibold">
                          {INCIDENT_TYPE_LABELS[incident.type as IncidentType] ?? incident.type}
                        </span>
                        <SeverityBadge severity={(incident.severity ?? 'MEDIUM') as IncidentSeverity} />
                        <span
                          className={
                            incident.status === 'ACTIVE'
                              ? 'badge-amber'
                              : incident.status === 'RESOLVED'
                                ? 'badge-emerald'
                                : 'badge-slate'
                          }
                        >
                          {INCIDENT_STATUS_LABELS[incident.status]}
                        </span>
                        <span className="badge-slate">{incident.provenance}</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {route ? `${route.id} — ${route.name}` : 'No route'} ·{' '}
                        {bus ? `${bus.registration} (${bus.status.replace(/_/g, ' ')})` : 'No bus'} ·{' '}
                        {formatDateTime(incident.confirmedAt)}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {incident.description ?? 'No description recorded.'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Illustrative affected passengers: {incident.estimatedAffectedPassengers} · Expected
                        resolution: {incident.expectedResolution ?? 'Not stated'} · Confirmed by:{' '}
                        {incident.confirmedByRole}
                      </p>
                      {incident.relatedReportIds.length > 0 && (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Linked reports: {incident.relatedReportIds.map(id => shortId(id, 16)).join(', ')}
                        </p>
                      )}
                      {incident.busId && (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          <Bus size={11} className="inline mr-1" />
                          Fleet effect:{' '}
                          {bus
                            ? `${bus.registration} is ${bus.status.replace(/_/g, ' ').toLowerCase()}`
                            : 'bus unavailable'}
                          {incidentMarksBusUnavailable(incident.type as IncidentType)
                            ? ' (confirmed bus failure marks the bus unavailable).'
                            : ' (this incident type does not mark the bus unavailable).'}
                        </p>
                      )}

                      {incident.status === 'ACTIVE' ? (
                        <div>
                          <label className="label" htmlFor={`close-${incident.id}`}>
                            Closure reason (required)
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <input
                              id={`close-${incident.id}`}
                              className="input flex-1"
                              value={closeReasons[incident.id] ?? ''}
                              onChange={event =>
                                setCloseReasons(current => ({
                                  ...current,
                                  [incident.id]: event.target.value,
                                }))
                              }
                              placeholder="e.g. Replacement bus operating; route restored"
                            />
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => closeIncident(incident.id)}
                            >
                              CLOSE INCIDENT
                            </button>
                          </div>
                          {closeError && (
                            <p className="text-xs mt-1" style={{ color: 'var(--color-rose)' }} role="alert">
                              {closeError}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          This incident is {incident.status.toLowerCase()} and no longer drives active
                          alerts.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit trail */}
      <div className="card">
        <h2 className="section-title">Recent authority actions (prototype audit trail)</h2>
        {state.auditEvents.length === 0 ? (
          <EmptyState title="No authority actions recorded yet" />
        ) : (
          <ul className="space-y-1">
            {[...state.auditEvents]
              .sort((a, b) => (b.timestamp ?? b.at ?? '').localeCompare(a.timestamp ?? a.at ?? ''))
              .slice(0, 8)
              .map(entry => (
                <li key={entry.id} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-mono" style={{ color: 'var(--color-cyan)' }}>
                    {entry.action}
                  </span>{' '}
                  · {entry.affectedRecordType ?? entry.entityType ?? 'Record'} {shortId(entry.affectedRecordId ?? entry.recordIds?.[0] ?? '', 18)} ·{' '}
                  {entry.performedByRole ?? entry.actor ?? 'AUTHORITY'} · {formatDateTime(entry.timestamp ?? entry.at ?? '')}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </li>
              ))}
          </ul>
        )}
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Audit entries are demo records, not legally certified history. Replacement evaluation is owned
          by the fleet module — see Replacements.
        </p>
      </div>
    </div>
  );
}
