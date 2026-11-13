// SAFAR — Intelligence Dashboard (Member 3)
// Operational overview derived from shared state: regional events, affected
// routes, demand/capacity, reliability and active incidents.


import {
  Activity,
  AlertTriangle,
  Bus,
  CalendarDays,
  Shield,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react';
import { useAppState } from '../../state/store';
import { analyseStudentDemand } from '../../domain/calculations/demand';
import { getRelevantEventImpacts } from '../../domain/calculations/eventImpact';
import { calculateAllRouteReliability } from '../../domain/calculations/reliability';
import { ChartCard, GroupedBarChart, RankedBarChart } from '../../components/charts';
import {
  EmptyState,
  Metric,
  ReliabilityDisclaimer,
  ReliabilityPill,
  RiskBadge,
  SeverityBadge,
} from '../../components/intelligence/Badges';
import {
  EVENT_CATEGORY_LABELS,
  INCIDENT_TYPE_LABELS,
  formatDateTime,
} from '../../components/intelligence/labels';
import type { IncidentSeverity, IncidentType, RiskLevel } from '../../domain/types';

const RISK_ORDER: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

function reliabilityColor(score: number): string {
  if (score >= 80) return '#047857';
  if (score >= 60) return '#b45309';
  if (score >= 40) return '#c2410c';
  return '#b91c1c';
}

export default function IntelligenceDashboard() {
  const { state } = useAppState();

  const analysis = analyseStudentDemand(
    state.travelRequests,
    state.demandSeed,
    state.routes,
    state.stops,
    state.villages,
  );
  const totals = analysis.totals;

  const relevantImpacts = getRelevantEventImpacts(state);
  const activeIncidents = state.incidents.filter(incident => incident.status === 'ACTIVE');
  const unverifiedReports = state.disruptionReports.filter(
    report => report.status === 'UNVERIFIED',
  );
  const verifiedReports = state.disruptionReports.filter(
    report => report.status === 'VERIFIED' && !report.relatedIncidentId,
  );

  const routeReliability = calculateAllRouteReliability(state).filter(result =>
    state.demandSeed.some(seed => seed.routeId === result.routeId),
  );
  const averageReliability =
    routeReliability.length > 0
      ? Math.round(
          routeReliability.reduce((sum, result) => sum + result.score, 0) /
            routeReliability.length,
        )
      : 0;

  // Strongest impact per route (overlapping events are not summed).
  const impactByRoute = new Map<string, { score: number; risk: RiskLevel; eventId: string }>();
  for (const impact of relevantImpacts) {
    const existing = impactByRoute.get(impact.routeId);
    if (!existing || impact.impactScore > existing.score) {
      impactByRoute.set(impact.routeId, {
        score: impact.impactScore,
        risk: impact.riskLevel,
        eventId: impact.eventId,
      });
    }
  }
  const routesWithSevereImpact = [...impactByRoute.values()].filter(
    entry => entry.risk === 'HIGH' || entry.risk === 'CRITICAL',
  ).length;

  const demandChartData = analysis.rows.map(row => ({
    route: row.routeId,
    'Expected students': row.expectedStudents,
    'Seats provided': row.availableSeats,
  }));

  const impactChartData = [...impactByRoute.entries()]
    .map(([routeId, entry]) => ({ route: routeId, score: entry.score }))
    .sort((a, b) => b.score - a.score);

  const reliabilityChartData = routeReliability
    .map(result => ({ route: result.routeId, score: result.score }))
    .sort((a, b) => a.score - b.score);

  const upcomingEvents = [...state.events]
    .filter(event => event.verificationStatus !== 'REJECTED')
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
    .slice(0, 3);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Events, disruption, demand and reliability for the Puttur region ·{' '}
            <span className="demo-label">DEMO DATA</span>
          </p>
        </div>
        <span className="badge-slate text-xs">
          Recalculated from shared state · {state.schemaVersion ? `schema v${state.schemaVersion}` : ''}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Metric
          label="Event-impacted routes"
          value={impactChartData.length}
          sub={`${routesWithSevereImpact} at HIGH/CRITICAL risk`}
          icon={<CalendarDays size={14} />}
          color="var(--color-amber)"
        />
        <Metric
          label="Active incidents"
          value={activeIncidents.length}
          sub={`${verifiedReports.length} verified report(s) awaiting confirmation`}
          icon={<AlertTriangle size={14} />}
          color="var(--color-rose)"
        />
        <Metric
          label="Unverified student reports"
          value={unverifiedReports.length}
          sub="Require authority review"
          icon={<Zap size={14} />}
          color="var(--color-amber)"
        />
        <Metric
          label="Seat shortage"
          value={totals.totalShortage}
          sub={`${totals.totalExpected} expected · ${totals.totalSeats} seats`}
          icon={<TrendingDown size={14} />}
          color={totals.totalShortage > 0 ? 'var(--color-rose)' : 'var(--color-emerald)'}
        />
        <Metric
          label="Average route reliability"
          value={`${averageReliability}/100`}
          sub="Illustrative prototype score"
          icon={<Shield size={14} />}
          color={reliabilityColor(averageReliability)}
        />
      </div>

      <ReliabilityDisclaimer />

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartCard
          title="Student demand vs seats provided"
          description="Illustrative route demand against the seats recorded in the shared demand seed."
          summary={
            analysis.rows.length === 0
              ? 'No route demand data is available.'
              : analysis.rows
                  .map(
                    row =>
                      `${row.routeId}: ${row.expectedStudents} expected students, ${row.availableSeats} seats, shortage ${row.shortage}.`,
                  )
                  .join(' ')
          }
        >
          {analysis.rows.length === 0 ? (
            <EmptyState title="No demand seed data" />
          ) : (
            <GroupedBarChart
              data={demandChartData}
              xKey="route"
              bars={[
                { key: 'Expected students', name: 'Expected students', color: '#0b5394' },
                { key: 'Seats provided', name: 'Seats provided', color: '#64748b' },
              ]}
              ariaLabel="Bar chart comparing expected students with seats provided per route"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Event impact by route"
          description="Strongest predicted event impact score per route (0–100). Overlapping events are not summed."
          summary={
            impactChartData.length === 0
              ? 'No relevant event impact is recorded.'
              : impactChartData
                  .map(entry => `${entry.route}: impact score ${entry.score} of 100.`)
                  .join(' ')
          }
        >
          {impactChartData.length === 0 ? (
            <EmptyState
              title="No predicted event impact"
              detail="Add or recalculate an event in Event Intelligence."
            />
          ) : (
            <RankedBarChart
              data={impactChartData}
              labelKey="route"
              valueKey="score"
              ariaLabel="Bar chart of predicted event impact score per route"
              valueName="Impact score"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Route reliability"
          description="Penalty-based illustrative score for the seeded demand routes. Updated after event, incident or fleet changes."
          summary={
            reliabilityChartData.length === 0
              ? 'No route reliability data is available.'
              : reliabilityChartData
                  .map(entry => `${entry.route}: reliability ${entry.score} of 100.`)
                  .join(' ')
          }
        >
          {reliabilityChartData.length === 0 ? (
            <EmptyState title="No reliability data" />
          ) : (
            <RankedBarChart
              data={reliabilityChartData}
              labelKey="route"
              valueKey="score"
              ariaLabel="Bar chart of illustrative route reliability scores"
              valueName="Reliability score"
              colorForValue={reliabilityColor}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Active confirmed incidents"
          description="Only authority-confirmed incidents appear here. Student reports remain unverified until reviewed."
          summary={
            activeIncidents.length === 0
              ? 'There are no active confirmed incidents.'
              : activeIncidents
                  .map(
                    incident =>
                      `${INCIDENT_TYPE_LABELS[incident.type as IncidentType] ?? incident.type} on ${incident.routeId ?? 'unspecified route'}, ${incident.severity} severity.`,
                  )
                  .join(' ')
          }
        >
          {activeIncidents.length === 0 ? (
            <EmptyState title="No active confirmed incidents" detail="Fleet status is unchanged by unverified reports." />
          ) : (
            <div className="space-y-2">
              {activeIncidents.map(incident => {
                const bus = state.buses.find(item => item.id === incident.busId);
                return (
                  <div
                    key={incident.id}
                    className="card"
                    style={{ background: 'rgba(5,13,26,0.5)', padding: '0.65rem' }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge-rose">CONFIRMED INCIDENT</span>
                      <span className="text-xs font-semibold">
                        {INCIDENT_TYPE_LABELS[incident.type as IncidentType] ?? incident.type}
                      </span>
                      <SeverityBadge severity={(incident.severity ?? 'MEDIUM') as IncidentSeverity} />
                      <span className="badge-slate">{incident.routeId ?? 'No route'}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {bus ? `Bus ${bus.registration} · ` : ''}
                      ≈{incident.estimatedAffectedPassengers ?? 0} passenger(s) affected (illustrative) ·{' '}
                      {formatDateTime(incident.confirmedAt ?? incident.occurredAt)} · Provenance: {incident.provenance}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Attention table + upcoming events */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="card xl:col-span-2">
          <h3 className="section-title">Routes requiring attention</h3>
          <div className="table-wrapper">
            <table className="table">
              <caption className="sr-only">
                Route demand, shortage, predicted event risk, illustrative reliability and active
                incidents.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Seats</th>
                  <th scope="col">Shortage</th>
                  <th scope="col">Event risk</th>
                  <th scope="col">Reliability</th>
                  <th scope="col">Incidents</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map(row => {
                  const impact = impactByRoute.get(row.routeId);
                  const reliability = routeReliability.find(
                    result => result.routeId === row.routeId,
                  );
                  const incidents = activeIncidents.filter(
                    incident => incident.routeId === row.routeId,
                  ).length;
                  return (
                    <tr key={row.routeId}>
                      <td>
                        <span className="font-mono font-bold" style={{ color: 'var(--color-cyan)' }}>
                          {row.routeId}
                        </span>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {row.routeName}
                        </div>
                      </td>
                      <td>{row.expectedStudents}</td>
                      <td>{row.availableSeats}</td>
                      <td style={{ color: row.shortage > 0 ? 'var(--color-rose)' : undefined }}>
                        {row.shortage > 0 ? `−${row.shortage}` : '0'}
                      </td>
                      <td>{impact ? <RiskBadge risk={impact.risk} /> : '—'}</td>
                      <td>
                        {reliability ? (
                          <ReliabilityPill score={reliability.score} label={reliability.label} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{incidents}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Demand is illustrative; event impact is a deterministic prototype estimate. Seat
            shortage = max(0, expected − seats).
          </p>
        </div>

        <div className="card">
          <h3 className="section-title flex items-center gap-1.5">
            <CalendarDays size={13} /> Upcoming events
          </h3>
          {upcomingEvents.length === 0 ? (
            <EmptyState title="No events recorded" />
          ) : (
            <ul className="space-y-2">
              {upcomingEvents.map(event => {
                const impacts = relevantImpacts.filter(impact => impact.eventId === event.id);
                const strongest = impacts.reduce<RiskLevel | null>((max, impact) => {
                  if (!max) return impact.riskLevel;
                  return RISK_ORDER.indexOf(impact.riskLevel) > RISK_ORDER.indexOf(max)
                    ? impact.riskLevel
                    : max;
                }, null);
                return (
                  <li key={event.id} className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{event.name}</span>
                      {strongest ? <RiskBadge risk={strongest} /> : <span className="badge-slate">No impact</span>}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {EVENT_CATEGORY_LABELS[event.category]} · {event.date} · {event.startTime}–
                      {event.endTime}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {event.location}
                    </p>
                    {impacts.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Affected: {impacts.map(impact => impact.routeId).join(', ')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Compact alert strip derived from state */}
      <div className="card">
        <h3 className="section-title flex items-center gap-1.5">
          <Activity size={13} /> Operational signals
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="alert-bar info">
            <Users size={12} className="mt-0.5 flex-shrink-0" />
            <span>
              {totals.totalShortage > 0
                ? `Capacity deficit of ${totals.totalShortage} seats across ${totals.overcrowdedRoutes} route(s).`
                : 'Recorded capacity covers expected demand on the seeded routes.'}
            </span>
          </div>
          <div className={`alert-bar ${activeIncidents.length > 0 ? 'critical' : 'info'}`}>
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>
              {activeIncidents.length > 0
                ? `${activeIncidents.length} confirmed incident(s) may affect journey reliability.`
                : 'No confirmed incident is currently active.'}
            </span>
          </div>
          <div className={`alert-bar ${unverifiedReports.length > 0 ? 'warning' : 'info'}`}>
            <Bus size={12} className="mt-0.5 flex-shrink-0" />
            <span>
              {unverifiedReports.length > 0
                ? `${unverifiedReports.length} unverified student report(s) await review — fleet unchanged.`
                : 'No unverified student reports in the queue.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
