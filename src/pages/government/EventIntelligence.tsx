// SAFAR — Regional Event Intelligence (Member 3)
// Event CRUD, deterministic impact recalculation and advance-warning evidence.

import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { useAppState, useAppDispatch } from '../../state/store';
import type {
  CrowdIntensity,
  EventCategory,
  RiskLevel,
  SafarEvent,
} from '../../domain/types';
import {
  eventImpactWindow,
  identifyAffectedRoutes,
  riskFromScore,
} from '../../domain/calculations/eventImpact';
import { calculateRouteDemandBreakdown } from '../../domain/calculations/demand';
import {
  CROWD_LABELS,
  EVENT_CATEGORY_LABELS,
  RISK_BADGE_CLASS,
} from '../../components/intelligence/labels';
import { RiskBadge } from '../../components/intelligence/Badges';

type EventFormState = Omit<SafarEvent, 'id' | 'createdAt' | 'updatedAt'>;

const DEFAULT_FORM: EventFormState = {
  name: '',
  category: 'TEMPLE_FESTIVAL',
  location: '',
  date: new Date().toISOString().split('T')[0],
  startTime: '08:00',
  endTime: '18:00',
  crowdIntensity: 'HIGH',
  nearbyVillageIds: [],
  affectedRoadLabels: [],
  affectedRouteIds: [],
  impactWindowMinutes: 60,
  description: '',
  source: 'User Entered (Demo)',
  provenance: 'USER_ENTERED',
  verificationStatus: 'UNVERIFIED',
};

const VERIFICATION_OPTIONS: Array<{
  value: SafarEvent['verificationStatus'];
  label: string;
  detail: string;
}> = [
  { value: 'UNVERIFIED', label: 'Unverified record', detail: 'Default for user-entered demo events' },
  { value: 'VERIFIED', label: 'Verified data record', detail: 'Authority confirmed the event record (demo)' },
  { value: 'REJECTED', label: 'Rejected record', detail: 'Excluded from operational calculations' },
];

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function riskOrder(risk: RiskLevel): number {
  return ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].indexOf(risk);
}

export default function EventIntelligence() {
  const { state } = useAppState();
  const dispatch = useAppDispatch();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>({ ...DEFAULT_FORM });
  const [roadsInput, setRoadsInput] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const routes = state.routes;
  const villages = state.villages;
  const today = todayIso();

  const demandRows = calculateRouteDemandBreakdown(
    state.travelRequests,
    state.demandSeed,
    state.routes,
    state.stops,
  );

  const sortedEvents = [...state.events].sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
  );

  function resetForm() {
    setForm({ ...DEFAULT_FORM });
    setRoadsInput('');
    setFormErrors([]);
    setShowForm(false);
    setEditId(null);
  }

  function openCreate() {
    setForm({ ...DEFAULT_FORM, date: state.scenario.scenarioDate });
    setRoadsInput('');
    setFormErrors([]);
    setShowForm(true);
    setEditId(null);
  }

  function openEdit(event: SafarEvent) {
    setForm({
      name: event.name,
      category: event.category,
      location: event.location,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      crowdIntensity: event.crowdIntensity,
      nearbyVillageIds: [...event.nearbyVillageIds],
      affectedRoadLabels: [...event.affectedRoadLabels],
      affectedRouteIds: [...event.affectedRouteIds],
      impactWindowMinutes: event.impactWindowMinutes,
      description: event.description ?? '',
      source: event.source,
      provenance: event.provenance,
      verificationStatus: event.verificationStatus,
    });
    setRoadsInput(event.affectedRoadLabels.join(', '));
    setFormErrors([]);
    setEditId(event.id);
    setShowForm(true);
  }

  function validate(): string[] {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push('Event name is required.');
    if (!form.location.trim()) errors.push('Location is required.');
    if (!form.date) errors.push('Event date is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.push('Event date must be a valid date.');
    if (!form.startTime || !form.endTime) errors.push('Start and end time are required.');
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      errors.push('End time must be after the start time.');
    }
    if (
      !Number.isFinite(form.impactWindowMinutes) ||
      form.impactWindowMinutes < 0 ||
      form.impactWindowMinutes > 240
    ) {
      errors.push('Impact window must be between 0 and 240 minutes.');
    }
    if (form.affectedRouteIds.length === 0) {
      errors.push('Select at least one affected route, or the event will have no calculated impact.');
    }
    return errors;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validate();
    if (state.routes.length === 0) {
      errors.push('No seeded routes are available to associate with this event.');
    }
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);

    const payload: EventFormState = {
      ...form,
      name: form.name.trim(),
      location: form.location.trim(),
      description: form.description?.trim() || undefined,
      source: form.source.trim() || 'User Entered (Demo)',
      affectedRoadLabels: roadsInput
        .split(',')
        .map(label => label.trim())
        .filter(Boolean),
    };

    if (editId) {
      dispatch({ type: 'UPDATE_EVENT', payload: { id: editId, ...payload } });
    } else {
      dispatch({ type: 'ADD_EVENT', payload });
    }
    resetForm();
  }

  function handleDelete(eventId: string) {
    if (deleteConfirm !== eventId) {
      setDeleteConfirm(eventId);
      return;
    }
    dispatch({ type: 'DELETE_EVENT', payload: { eventId } });
    setDeleteConfirm(null);
    if (expandedEvent === eventId) setExpandedEvent(null);
  }

  function handleRecalculate() {
    dispatch({ type: 'RECALCULATE_EVENT_IMPACTS', payload: {} });
  }

  function toggleRouteAffected(routeId: string) {
    setForm(current => ({
      ...current,
      affectedRouteIds: current.affectedRouteIds.includes(routeId)
        ? current.affectedRouteIds.filter(id => id !== routeId)
        : [...current.affectedRouteIds, routeId],
    }));
  }

  function toggleVillage(villageId: string) {
    setForm(current => ({
      ...current,
      nearbyVillageIds: current.nearbyVillageIds.includes(villageId)
        ? current.nearbyVillageIds.filter(id => id !== villageId)
        : [...current.nearbyVillageIds, villageId],
    }));
  }

  function maxRisk(eventId: string): RiskLevel | null {
    const impacts = state.eventImpacts.filter(impact => impact.eventId === eventId);
    return impacts.reduce<RiskLevel | null>((maximum, impact) => {
      if (!maximum) return impact.riskLevel;
      return riskOrder(impact.riskLevel) > riskOrder(maximum) ? impact.riskLevel : maximum;
    }, null);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-bold">Regional Event Intelligence</h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Manage events and calculate predicted transport impact ·{' '}
            <span className="demo-label">DEMO DATA</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleRecalculate} className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={12} />
            Recalculate All Impacts
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
            <Plus size={12} />
            Add Event
          </button>
        </div>
      </div>

      <div className="alert-bar warning" role="note">
        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
        <span>
          Impact scores are deterministic prototype estimates using documented weights (crowd 25%,
          proximity 25%, overlap 20%, importance 15%, duration 15%). They are not validated traffic
          forecasts or verified road closures.
        </span>
      </div>

      {/* Add / edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ borderColor: 'rgba(34,211,238,0.3)' }}
          noValidate
        >
          <p className="section-title">{editId ? 'Edit Regional Event' : 'New Regional Event'}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ev-name">
                Event name *
              </label>
              <input
                id="ev-name"
                className="input"
                value={form.name}
                maxLength={120}
                onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Kombettu Brahmakalashotsava"
              />
            </div>
            <div>
              <label className="label" htmlFor="ev-category">
                Category *
              </label>
              <select
                id="ev-category"
                className="select"
                value={form.category}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    category: event.target.value as EventCategory,
                  }))
                }
              >
                {Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ev-location">
                Location *
              </label>
              <input
                id="ev-location"
                className="input"
                value={form.location}
                maxLength={160}
                onChange={event =>
                  setForm(current => ({ ...current, location: event.target.value }))
                }
                placeholder="e.g. Kombettu Cross, Puttur–Sullia Highway"
              />
            </div>
            <div>
              <label className="label" htmlFor="ev-crowd">
                Expected crowd intensity
              </label>
              <select
                id="ev-crowd"
                className="select"
                value={form.crowdIntensity}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    crowdIntensity: event.target.value as CrowdIntensity,
                  }))
                }
              >
                {Object.entries(CROWD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ev-date">
                Date *
              </label>
              <input
                id="ev-date"
                type="date"
                className="input"
                value={form.date}
                onChange={event => setForm(current => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="ev-start">
                  Start time *
                </label>
                <input
                  id="ev-start"
                  type="time"
                  className="input"
                  value={form.startTime}
                  onChange={event =>
                    setForm(current => ({ ...current, startTime: event.target.value }))
                  }
                />
              </div>
              <div className="flex-1">
                <label className="label" htmlFor="ev-end">
                  End time *
                </label>
                <input
                  id="ev-end"
                  type="time"
                  className="input"
                  value={form.endTime}
                  onChange={event =>
                    setForm(current => ({ ...current, endTime: event.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="ev-window">
                Preparation buffer (minutes before start)
              </label>
              <input
                id="ev-window"
                type="number"
                className="input"
                min={0}
                max={240}
                value={form.impactWindowMinutes}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    impactWindowMinutes: Number(event.target.value),
                  }))
                }
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                The impact window starts early only because this record supplies a buffer. No early
                start is invented.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="ev-verification">
                Data-source status (demo review)
              </label>
              <select
                id="ev-verification"
                className="select"
                value={form.verificationStatus}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    verificationStatus: event.target.value as SafarEvent['verificationStatus'],
                  }))
                }
              >
                {VERIFICATION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {
                  VERIFICATION_OPTIONS.find(option => option.value === form.verificationStatus)
                    ?.detail
                }{' '}
                Rejected records do not drive operational calculations.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="ev-source">
                Source / provenance note
              </label>
              <input
                id="ev-source"
                className="input"
                value={form.source}
                maxLength={120}
                onChange={event => setForm(current => ({ ...current, source: event.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="ev-roads">
                Affected roads (comma separated)
              </label>
              <input
                id="ev-roads"
                className="input"
                value={roadsInput}
                onChange={event => setRoadsInput(event.target.value)}
                placeholder="e.g. Puttur–Sullia Highway, Kombettu Cross Junction"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="label">Affected routes * (explicit association)</label>
            <div className="flex flex-wrap gap-2">
              {routes.map(route => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => toggleRouteAffected(route.id)}
                  className={form.affectedRouteIds.includes(route.id) ? 'btn-primary' : 'btn-ghost'}
                  aria-pressed={form.affectedRouteIds.includes(route.id)}
                >
                  {route.id}
                </button>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Impact is calculated only for explicitly associated routes. Proximity estimates are
              labelled separately and are never saved automatically.
            </p>
          </div>

          <div className="mt-3">
            <label className="label">Nearby villages</label>
            <div className="flex flex-wrap gap-2">
              {villages.map(village => (
                <button
                  key={village.id}
                  type="button"
                  onClick={() => toggleVillage(village.id)}
                  className={
                    form.nearbyVillageIds.includes(village.id) ? 'btn-primary' : 'btn-ghost'
                  }
                  aria-pressed={form.nearbyVillageIds.includes(village.id)}
                >
                  {village.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="ev-description">
              Description (optional)
            </label>
            <textarea
              id="ev-description"
              className="input"
              rows={2}
              maxLength={500}
              value={form.description ?? ''}
              onChange={event =>
                setForm(current => ({ ...current, description: event.target.value }))
              }
            />
          </div>

          {formErrors.length > 0 && (
            <ul className="mt-2 text-xs space-y-0.5" style={{ color: 'var(--color-rose)' }} role="alert">
              {formErrors.map(error => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 mt-3">
            <button type="submit" className="btn-primary">
              {editId ? 'Save Changes & Recalculate' : 'Add Event & Calculate Impact'}
            </button>
            <button type="button" className="btn-ghost" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Event register */}
      <div className="space-y-3">
        {sortedEvents.length === 0 && (
          <div className="card text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
            No events recorded. Add an event to calculate predicted transport impact.
          </div>
        )}

        {sortedEvents.map(event => {
          const impacts = state.eventImpacts.filter(impact => impact.eventId === event.id);
          const summaryRisk = maxRisk(event.id);
          const isExpanded = expandedEvent === event.id;
          const isPast = event.date < today;
          const window = eventImpactWindow(event);
          const proximitySuggestions = identifyAffectedRoutes(event, routes, state.stops).filter(
            suggestion => suggestion.basis === 'ESTIMATED_PROXIMITY',
          );

          return (
            <div key={event.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{event.name}</span>
                    <span className="badge-slate">{EVENT_CATEGORY_LABELS[event.category]}</span>
                    {summaryRisk && <RiskBadge risk={summaryRisk} />}
                    {event.verificationStatus === 'VERIFIED' ? (
                      <span className="badge-emerald">VERIFIED RECORD</span>
                    ) : event.verificationStatus === 'REJECTED' ? (
                      <span className="badge-rose">REJECTED RECORD</span>
                    ) : (
                      <span className="badge-amber">UNVERIFIED RECORD</span>
                    )}
                    {isPast && <span className="badge-slate">PAST</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <MapPin size={10} />
                      {event.location}
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Calendar size={10} />
                      {event.date}
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Clock size={10} />
                      {event.startTime}–{event.endTime}
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Users size={10} />
                      Crowd: {CROWD_LABELS[event.crowdIntensity]}
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(event)}
                    className="btn-ghost p-1"
                    aria-label={`Edit ${event.name}`}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className={deleteConfirm === event.id ? 'btn-danger p-1' : 'btn-ghost p-1'}
                    aria-label={
                      deleteConfirm === event.id
                        ? `Confirm delete ${event.name}`
                        : `Delete ${event.name}`
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </div>
              </div>

              {deleteConfirm === event.id && (
                <div className="alert-bar critical mt-2" role="alert">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Click the delete button again to confirm. Deleting this event removes its future
                    calculated impact.
                  </span>
                </div>
              )}

              {isExpanded && (
                <div
                  className="mt-3 pt-3 border-t space-y-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Zap size={12} style={{ color: 'var(--color-cyan)' }} />
                    <span className="text-xs font-semibold">Route impact analysis</span>
                    {impacts.length === 0 && (
                      <span className="badge-slate">No calculated impact</span>
                    )}
                  </div>

                  <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                    <p>
                      Impact window: {window.startTime}–{window.endTime} ({window.bufferSource}).
                    </p>
                    {event.affectedRoadLabels.length > 0 && (
                      <p>Affected roads (recorded): {event.affectedRoadLabels.join('; ')}</p>
                    )}
                    {event.nearbyVillageIds.length > 0 && (
                      <p>
                        Nearby villages:{' '}
                        {event.nearbyVillageIds
                          .map(id => villages.find(village => village.id === id)?.name ?? id)
                          .join(', ')}
                      </p>
                    )}
                    <p>
                      Source: {event.source} · Record provenance: {event.provenance}
                    </p>
                  </div>

                  {impacts.length === 0 && (
                    <button
                      onClick={handleRecalculate}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      <RefreshCw size={10} />
                      Recalculate impacts
                    </button>
                  )}

                  {impacts.map(impact => {
                    const demand = demandRows.find(row => row.routeId === impact.routeId);
                    return (
                      <div
                        key={`${impact.eventId}-${impact.routeId}`}
                        className="card"
                        style={{ background: 'rgba(5,13,26,0.6)' }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: 'var(--color-cyan)' }}
                          >
                            {impact.routeId}
                          </span>
                          <RiskBadge risk={impact.riskLevel} />
                          <span className="badge-slate">Score: {impact.impactScore}/100</span>
                          {impact.estimatedDelayMinutes != null && (
                            <span className="badge-amber">
                              ~{impact.estimatedDelayMinutes} min illustrative delay
                            </span>
                          )}
                          <span className={RISK_BADGE_CLASS[riskFromScore(impact.impactScore)]}>
                            {riskFromScore(impact.impactScore)} band
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 mb-2">
                          {[
                            { label: 'Crowd (25%)', value: impact.crowdScore },
                            { label: 'Proximity (25%)', value: impact.proximityScore },
                            { label: 'Overlap (20%)', value: impact.overlapScore },
                            { label: 'Importance (15%)', value: impact.routeImportanceScore },
                            { label: 'Duration (15%)', value: impact.durationScore },
                          ].map(item => (
                            <div key={item.label} className="text-center">
                              <div
                                className="text-xs font-bold"
                                style={{
                                  color:
                                    item.value >= 75
                                      ? 'var(--color-rose)'
                                      : item.value >= 50
                                        ? 'var(--color-amber)'
                                        : 'var(--color-emerald)',
                                }}
                              >
                                {item.value}
                              </div>
                              <div
                                className="text-xs"
                                style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}
                              >
                                {item.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        <p
                          className="text-xs"
                          style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}
                        >
                          {impact.explanation}
                        </p>

                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                          Illustrative affected student demand on {impact.routeId}:{' '}
                          {demand?.expectedStudents ?? '—'} expected students (route demand, not event
                          attendance). Estimated affected journeys are route services:{' '}
                          {state.timetables.filter(service => service.routeId === impact.routeId).length}{' '}
                          scheduled service(s) on this corridor.
                        </p>

                        {window.valid && (
                          <div className="mt-2 alert-bar warning">
                            <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>PREDICTED EVENT IMPACT</strong> — advance warning begins at{' '}
                              {window.startTime}, {window.bufferMinutes} min before the official start.
                              Source: {window.bufferSource}. This is not a verified road closure.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {proximitySuggestions.length > 0 && (
                    <div className="card" style={{ background: 'rgba(5,13,26,0.4)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                        Suggested route associations (estimated proximity)
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {proximitySuggestions.map(suggestion => (
                          <li
                            key={suggestion.routeId}
                            className="text-xs"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {suggestion.routeId}: {suggestion.detail}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        These are proposals only. Add a route under Affected Routes to make the
                        association explicit and calculated.
                      </p>
                    </div>
                  )}

                  {event.description && (
                    <div
                      className="text-xs p-2 rounded"
                      style={{ background: 'rgba(5,13,26,0.4)', color: 'var(--color-text-muted)' }}
                    >
                      {event.description}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
