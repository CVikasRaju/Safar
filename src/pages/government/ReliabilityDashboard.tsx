// SAFAR — Route & Journey Reliability Dashboard (Member 3)
// Displays the documented illustrative reliability model and recalculates from
// shared state whenever events, incidents or fleet data change.

import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, Clock, Info, Shield } from 'lucide-react';
import { useAppState } from '../../state/store';
import {
  RELIABILITY_DISCLAIMER,
  calculateAllRouteReliability,
  calculateJourneyReliability,
  buildReliabilityContext,
} from '../../domain/calculations/reliability';
import { generateJourneyOptions } from '../../domain/calculations/journey';
import { ChartCard, RankedBarChart } from '../../components/charts';
import {
  EmptyState,
  ReliabilityDisclaimer,
  ReliabilityPill,
  ScoreBar,
} from '../../components/intelligence/Badges';
import type { JourneyOption } from '../../domain/types';
import type { ReliabilityPenalties as Penalties } from '../../domain/calculations/reliability';

const PENALTY_CAPS: Array<{ key: keyof Penalties; label: string; cap: number }> = [
  { key: 'delay', label: 'Expected delay', cap: 25 },
  { key: 'eventImpact', label: 'Event impact', cap: 20 },
  { key: 'transferWaiting', label: 'Transfer waiting', cap: 15 },
  { key: 'connectionBuffer', label: 'Connection buffer', cap: 15 },
  { key: 'busAvailability', label: 'Bus availability', cap: 15 },
  { key: 'transferCount', label: 'Transfer count', cap: 10 },
];

function reliabilityColor(score: number): string {
  if (score >= 80) return '#047857';
  if (score >= 60) return '#b45309';
  if (score >= 40) return '#c2410c';
  return '#b91c1c';
}

function PenaltyList({ penalties }: { penalties: Penalties }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {PENALTY_CAPS.map(entry => (
        <ScoreBar
          key={entry.key}
          value={penalties[entry.key]}
          max={entry.cap}
          tone={penalties[entry.key] > 0 ? 'rose' : 'emerald'}
          label={`${entry.label} · max ${entry.cap}`}
        />
      ))}
    </div>
  );
}

interface JourneyRow {
  villageId: string;
  villageName: string;
  destinationName: string;
  best?: JourneyOption;
  alternative?: JourneyOption;
}

export default function ReliabilityDashboard() {
  const { state } = useAppState();

  const travelDate = state.scenario.scenarioDate;
  const requiredArrival = '09:00';
  const destination =
    state.destinations.find(
      item => item.type === 'COLLEGE' && item.villageId === 'V001',
    ) ?? state.destinations.find(item => item.type === 'COLLEGE');

  const routeReliability = calculateAllRouteReliability(state);
  const reliabilityChartData = routeReliability
    .map(result => ({ route: result.routeId, score: result.score }))
    .sort((a, b) => a.score - b.score);

  const journeyRows = useMemo<JourneyRow[]>(() => {
    if (!destination) return [];
    return state.villages.map(village => {
      const result = generateJourneyOptions(
        {
          originVillageId: village.id,
          destinationId: destination.id,
          travelDate,
          requiredArrivalTime: requiredArrival,
        },
        state,
      );

      const feasible = result.all.filter((journey: JourneyOption) => journey.meetsArrivalDeadline);
      const pool = feasible.length > 0 ? feasible : result.all;
      const sorted = [...pool].sort((a, b) => {
        if (b.reliabilityScore !== a.reliabilityScore) {
          return b.reliabilityScore - a.reliabilityScore;
        }
        return a.expectedArrivalTime.localeCompare(b.expectedArrivalTime);
      });
      const best = sorted[0];
      const alternative = sorted.find((journey: JourneyOption) => journey.id !== best?.id);

      return {
        villageId: village.id,
        villageName: village.name,
        destinationName: destination.name,
        best,
        alternative,
      };
    });
  }, [state, destination, travelDate]);

  const context = buildReliabilityContext(state);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Illustrative penalty model for {travelDate} · required arrival {requiredArrival} ·{' '}
            <span className="demo-label">DEMO DATA</span>
          </p>
        </div>
        <span className="badge-slate">Recalculated from events, incidents and fleet status</span>
      </div>

      <div className="alert-bar warning" role="note">
        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
        <span className="font-semibold">{RELIABILITY_DISCLAIMER}</span>
      </div>

      <details className="card">
        <summary className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
          How the illustrative score is calculated
        </summary>
        <div className="mt-2 text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
          <p>
            Score = clamp(100 − sum of normalised penalties, 0, 100). Penalty caps: delay 25, event
            impact 20, transfer waiting 15, connection-buffer risk 15, bus availability 15, transfer
            count 10.
          </p>
          <p>
            Event-attributable delay is represented by the capped event penalty, so it is not counted
            again in the delay penalty. Route-level estimates do not apply journey-specific transfer
            factors, which are shown as zero and labelled not applicable.
          </p>
          <p>
            Labels: 80–100 High, 60–79 Moderate, 40–59 Low, 0–39 Very Low. These are prototype
            categories, not transport standards or probabilities.
          </p>
        </div>
      </details>

      {/* Route-level reliability */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ChartCard
          title="Route reliability comparison"
          description="Penalty-based illustrative score per seeded corridor."
          summary={reliabilityChartData
            .map(entry => `${entry.route}: ${entry.score} of 100.`)
            .join(' ')}
        >
          <RankedBarChart
            data={reliabilityChartData}
            labelKey="route"
            valueKey="score"
            ariaLabel="Bar chart of illustrative route reliability scores"
            valueName="Reliability score"
            colorForValue={reliabilityColor}
          />
        </ChartCard>

        <div className="xl:col-span-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {routeReliability.map(result => (
              <div key={result.routeId} className="card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-cyan)' }}>
                      {result.routeId}
                    </span>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {result.routeName}
                    </p>
                  </div>
                  <ReliabilityPill score={result.score} label={result.label} />
                </div>
                <div className="mt-2">
                  <PenaltyList penalties={result.penalties} />
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {result.explanation}
                </p>
              </div>
            ))}
          </div>
          <ReliabilityDisclaimer />
        </div>
      </div>

      {/* Journey-level reliability */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Shield size={14} /> Recommended departures by village
        </h2>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Generated from shared timetables for {requiredArrival} arrival ·{' '}
          {destination?.name ?? 'college destination unavailable'}
        </span>
      </div>

      <div className="space-y-3">
        {journeyRows.length === 0 && (
          <div className="card">
            <EmptyState
              title="No destination available"
              detail="A college destination is required to calculate journeys."
            />
          </div>
        )}

        {journeyRows.map(row => {
          if (!row.best) {
            return (
              <div key={row.villageId} className="card">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold">
                    {row.villageName} <ArrowRight size={12} className="inline" /> {row.destinationName}
                  </span>
                  <span className="badge-slate">NO FEASIBLE JOURNEY</span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  No timetable-feasible service was found for this date and origin. SAFAR does not
                  invent a connection.
                </p>
              </div>
            );
          }

          const reliability = calculateJourneyReliability(row.best, context);
          const alternativeReliability = row.alternative
            ? calculateJourneyReliability(row.alternative, context)
            : undefined;
          const firstBus = row.best.segments.find(segment => segment.type === 'BUS');
          const risks = [
            ...row.best.warnings,
            ...Object.entries(reliability.penalties)
              .filter(([, value]) => value > 0)
              .map(([key, value]) => {
                const label = PENALTY_CAPS.find(entry => entry.key === key)?.label ?? key;
                return `${label} penalty: ${value} points`;
              }),
          ];

          return (
            <div key={row.villageId} className="card">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-sm font-semibold">
                    {row.villageName} <ArrowRight size={12} className="inline" /> {row.destinationName}
                  </span>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Service {firstBus?.serviceId ?? '—'} · bus{' '}
                    {state.buses.find(bus => bus.id === firstBus?.busId)?.registration ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {row.best.meetsArrivalDeadline ? (
                    <span className="badge-emerald">MEETS {requiredArrival} REQUIREMENT</span>
                  ) : (
                    <span className="badge-rose">LATE — DOES NOT MEET {requiredArrival}</span>
                  )}
                  <ReliabilityPill score={reliability.score} label={reliability.label} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mt-3 text-xs">
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Expected departure</p>
                  <p className="font-semibold">{firstBus?.departureTime ?? '—'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Recommended departure</p>
                  <p className="font-semibold">{row.best.departureTime}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Expected arrival</p>
                  <p className="font-semibold">{row.best.expectedArrivalTime}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Required arrival</p>
                  <p className="font-semibold">{row.best.requiredArrivalTime}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Estimated delay</p>
                  <p className="font-semibold" style={{ color: row.best.estimatedDelayMinutes > 0 ? 'var(--color-amber)' : undefined }}>
                    {row.best.estimatedDelayMinutes > 0 ? `~${row.best.estimatedDelayMinutes} min` : 'None estimated'}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Transfers</p>
                  <p className="font-semibold">{row.best.transferCount}</p>
                </div>
              </div>

              <div className="mt-3">
                <PenaltyList penalties={reliability.penalties} />
              </div>

              <div className="mt-2">
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Relevant risks
                </p>
                {risks.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    No event, incident or fleet penalty is currently applied.
                  </p>
                ) : (
                  <ul className="list-disc ml-4 text-xs space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {risks.map((risk, index) => (
                      <li key={index}>{risk}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-2 alert-bar info">
                <Info size={12} className="mt-0.5 flex-shrink-0" />
                <span>
                  {row.alternative && alternativeReliability ? (
                    <>
                      <strong>Alternative recommendation:</strong> depart{' '}
                      {row.alternative.departureTime}, arrive {row.alternative.expectedArrivalTime} ·
                      reliability {alternativeReliability.score}/100 ({alternativeReliability.label})
                      {row.alternative.meetsArrivalDeadline ? ' · meets the requirement' : ' · also late'}.
                    </>
                  ) : (
                    'No other timetable-feasible alternative exists for this origin and deadline.'
                  )}
                </span>
              </div>

              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                <Clock size={10} className="inline mr-1" />
                Walking times are illustrative estimates from the journey planner, not measured road
                distances.
              </p>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3 className="section-title">Data currently driving reliability</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
            <p className="font-semibold mb-1">Relevant event impacts</p>
            {context.eventImpacts.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>None</p>
            ) : (
              <ul className="space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {context.eventImpacts.map(impact => (
                  <li key={`${impact.eventId}-${impact.routeId}`}>
                    {impact.routeId}: {impact.impactScore}/100 {impact.riskLevel}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
            <p className="font-semibold mb-1">Active incidents</p>
            {state.incidents.filter(incident => incident.status === 'ACTIVE').length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>None</p>
            ) : (
              <ul className="space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {state.incidents
                  .filter(incident => incident.status === 'ACTIVE')
                  .map(incident => (
                    <li key={incident.id}>
                      {incident.routeId ?? 'Network'} · {incident.type.replace(/_/g, ' ').toLowerCase()}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <div className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
            <p className="font-semibold mb-1">Fleet availability</p>
            <p style={{ color: 'var(--color-text-muted)' }}>
              {state.buses.filter(bus => bus.status === 'UNAVAILABLE' || bus.status === 'MAINTENANCE').length}{' '}
              bus(es) unavailable or in maintenance · response times are illustrative, not GPS-derived.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
