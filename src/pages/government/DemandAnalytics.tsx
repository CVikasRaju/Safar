// SAFAR — Student Demand & Capacity Analytics (Member 3)
// Aggregated, privacy-preserving demand analytics derived from shared state.

import { useMemo } from 'react';
import { AlertTriangle, Bus, GraduationCap, Info, Users } from 'lucide-react';
import { useAppState } from '../../state/store';
import {
  DEMAND_METHOD_NOTE,
  DEMAND_PRIVACY_NOTE,
  analyseStudentDemand,
} from '../../domain/calculations/demand';
import { DEMAND_TOTAL_EXPECTED, DEMAND_TOTAL_SEATS, DEMAND_TOTAL_SHORTAGE } from '../../data/seed/demand';
import { ChartCard, GroupedBarChart, RankedBarChart } from '../../components/charts';
import { EmptyState, Metric, ScoreBar } from '../../components/intelligence/Badges';
import { formatDateTime } from '../../components/intelligence/labels';

export default function DemandAnalytics() {
  const { state } = useAppState();

  const analysis = useMemo(
    () =>
      analyseStudentDemand(
        state.travelRequests,
        state.demandSeed,
        state.routes,
        state.stops,
        state.villages,
      ),
    [state.travelRequests, state.demandSeed, state.routes, state.stops, state.villages],
  );

  const { rows, totals, allocation, villages, timeWindows } = analysis;

  const baselineExpected = rows.reduce((sum, row) => sum + row.baselineExpectedStudents, 0);
  const baselineSeats = rows.reduce((sum, row) => sum + row.availableSeats, 0);
  const baselineShortage = Math.max(0, baselineExpected - baselineSeats);
  const baselineMatches =
    baselineExpected === DEMAND_TOTAL_EXPECTED &&
    baselineSeats === DEMAND_TOTAL_SEATS &&
    baselineShortage === DEMAND_TOTAL_SHORTAGE;

  const demandChartData = rows.map(row => ({
    route: row.routeId,
    'Expected students': row.expectedStudents,
    'Seats provided': row.availableSeats,
  }));

  const shortageChartData = rows
    .filter(row => row.shortage > 0)
    .map(row => ({ route: row.routeId, shortage: row.shortage }));

  const villageChartData = villages.map(row => ({
    village: row.villageName,
    students: row.submittedStudents,
  }));
  const maxVillageStudents = Math.max(1, ...villageChartData.map(row => row.students));

  const timeChartData = timeWindows.map(row => ({
    window: row.window,
    students: row.submittedStudents,
    requests: row.requests,
  }));

  // Aggregated travel intent (no student identity).
  const intentRows = useMemo(() => {
    const map = new Map<
      string,
      {
        origin: string;
        destination: string;
        date: string;
        arrival: string;
        requests: number;
        students: number;
      }
    >();
    for (const request of state.travelRequests) {
      const origin =
        state.villages.find(village => village.id === request.originVillageId)?.name ??
        request.originVillageId;
      const destination =
        state.destinations.find(item => item.id === request.destinationId)?.name ??
        request.destinationId;
      const key = `${origin}|${destination}|${request.travelDate}|${request.requiredArrivalTime}`;
      const existing = map.get(key) ?? {
        origin,
        destination,
        date: request.travelDate,
        arrival: request.requiredArrivalTime,
        requests: 0,
        students: 0,
      };
      existing.requests += 1;
      existing.students += Math.max(0, request.groupSize);
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.students - a.students);
  }, [state.travelRequests, state.villages, state.destinations]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Expected demand, seat availability and shortages by route, village and time ·{' '}
            <span className="demo-label">DEMO DATA</span>
          </p>
        </div>
        <span className={baselineMatches ? 'badge-emerald' : 'badge-rose'}>
          {baselineMatches ? 'Seed totals verified: 420 / 350 / 70' : 'Seed totals do not match documentation'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="alert-bar info">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          <span>{DEMAND_METHOD_NOTE}</span>
        </div>
        <div className="alert-bar warning">
          <Users size={12} className="mt-0.5 flex-shrink-0" />
          <span>{DEMAND_PRIVACY_NOTE}</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Metric
          label="Expected students"
          value={totals.totalExpected}
          sub={`Baseline ${baselineExpected} + submitted ${totals.totalExpected - baselineExpected}`}
          icon={<Users size={14} />}
          color="var(--color-cyan)"
        />
        <Metric
          label="Seats provided"
          value={totals.totalSeats}
          sub="Illustrative route capacity"
          icon={<Bus size={14} />}
          color="var(--color-emerald)"
        />
        <Metric
          label="Occupied seats"
          value={totals.totalOccupied}
          sub="Filled up to route capacity"
          icon={<GraduationCap size={14} />}
          color="var(--color-text-primary)"
        />
        <Metric
          label="Remaining seats"
          value={totals.totalRemaining}
          sub="Available on the seeded routes"
          icon={<Bus size={14} />}
          color="var(--color-emerald)"
        />
        <Metric
          label="Seat shortage"
          value={totals.totalShortage}
          sub={`${totals.overcrowdedRoutes} overcrowded route(s)`}
          icon={<AlertTriangle size={14} />}
          color={totals.totalShortage > 0 ? 'var(--color-rose)' : 'var(--color-emerald)'}
        />
        <Metric
          label="Seat surplus"
          value={totals.totalSurplus}
          sub="Spare capacity on balanced routes"
          icon={<Bus size={14} />}
          color="var(--color-cyan)"
        />
      </div>

      {/* Route table */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="section-title mb-0">Route-wise demand and capacity</h3>
          <span className="badge-slate">
            Shortage = max(0, expected − seats) · Occupied = min(expected, seats)
          </span>
        </div>
        <div className="table-wrapper mt-2">
          <table className="table">
            <caption className="sr-only">
              Illustrative demand, seats, occupied seats, remaining seats and shortage per route.
            </caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Baseline</th>
                <th scope="col">Submitted</th>
                <th scope="col">Expected</th>
                <th scope="col">Seats</th>
                <th scope="col">Occupied</th>
                <th scope="col">Remaining</th>
                <th scope="col">Shortage</th>
                <th scope="col">Occupancy</th>
                <th scope="col">Overcrowding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.routeId}>
                  <td>
                    <span className="font-mono font-bold" style={{ color: 'var(--color-cyan)' }}>
                      {row.routeId}
                    </span>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {row.routeName}
                    </div>
                  </td>
                  <td>{row.baselineExpectedStudents}</td>
                  <td style={{ color: row.submittedStudents > 0 ? 'var(--color-emerald)' : undefined }}>
                    {row.submittedStudents > 0 ? `+${row.submittedStudents}` : '0'}
                  </td>
                  <td>{row.expectedStudents}</td>
                  <td>{row.availableSeats}</td>
                  <td>{row.occupiedSeats}</td>
                  <td>{row.remainingSeats}</td>
                  <td style={{ color: row.shortage > 0 ? 'var(--color-rose)' : undefined }}>
                    {row.shortage > 0 ? `−${row.shortage}` : '0'}
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <ScoreBar
                      value={row.utilisationPct}
                      tone={row.shortage > 0 ? 'rose' : row.utilisationPct >= 85 ? 'amber' : 'emerald'}
                      label={`${row.utilisationPct}%`}
                    />
                  </td>
                  <td>
                    {row.overcrowdingRisk ? (
                      <span className="badge-rose">SHORTAGE</span>
                    ) : row.utilisationPct >= 85 ? (
                      <span className="badge-amber">WATCH</span>
                    ) : (
                      <span className="badge-emerald">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          R104 is a seeded express corridor without an initial demand row; it is therefore excluded
          from the documented 420/350 baseline. Documentation baseline check:{' '}
          {DEMAND_TOTAL_EXPECTED} expected / {DEMAND_TOTAL_SEATS} seats / {DEMAND_TOTAL_SHORTAGE}{' '}
          shortage.
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartCard
          title="Demand vs capacity by route"
          description="Including any allocated student travel-intent submissions."
          summary={rows
            .map(
              row =>
                `${row.routeId}: ${row.expectedStudents} expected students and ${row.availableSeats} seats.`,
            )
            .join(' ')}
        >
          <GroupedBarChart
            data={demandChartData}
            xKey="route"
            bars={[
              { key: 'Expected students', name: 'Expected students', color: '#0b5394' },
              { key: 'Seats provided', name: 'Seats provided', color: '#64748b' },
            ]}
            ariaLabel="Grouped bar chart of expected students and seats provided per route"
          />
        </ChartCard>

        <ChartCard
          title="Seat shortages by route"
          description="Routes where expected students exceed seats provided."
          summary={
            shortageChartData.length === 0
              ? 'No route currently has a seat shortage.'
              : shortageChartData
                  .map(row => `${row.route}: ${row.shortage} seat shortage.`)
                  .join(' ')
          }
        >
          {shortageChartData.length === 0 ? (
            <EmptyState title="No seat shortage" detail="Every seeded route has enough recorded capacity." />
          ) : (
            <GroupedBarChart
              data={shortageChartData}
              xKey="route"
              bars={[{ key: 'shortage', name: 'Seat shortage', color: '#b91c1c' }]}
              ariaLabel="Bar chart of seat shortage by route"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Village-wise submitted demand"
          description="Aggregated travel intent by origin village — no individual student data."
          summary={
            villageChartData.length === 0
              ? 'No student travel-intent submissions have been recorded.'
              : villageChartData
                  .map(row => `${row.village}: ${row.students} student(s).`)
                  .join(' ')
          }
        >
          {villageChartData.length === 0 ? (
            <EmptyState
              title="No submitted travel intent"
              detail="Demand shown here will update when students submit travel intent."
            />
          ) : (
            <RankedBarChart
              data={villageChartData}
              labelKey="village"
              valueKey="students"
              maxValue={maxVillageStudents}
              ariaLabel="Bar chart of submitted student demand by origin village"
              valueName="Students"
              colorForValue={() => '#0b5394'}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Time-based demand"
          description="Aggregated travel intent by required arrival window."
          summary={timeWindows
            .map(
              row =>
                `${row.window}: ${row.submittedStudents} student(s) from ${row.requests} request(s).`,
            )
            .join(' ')}
        >
          <GroupedBarChart
            data={timeChartData}
            xKey="window"
            bars={[
              { key: 'students', name: 'Students', color: '#047857' },
              { key: 'requests', name: 'Requests', color: '#64748b' },
            ]}
            ariaLabel="Bar chart of submitted demand by required arrival window"
          />
        </ChartCard>
      </div>

      {/* Allocation summary + aggregated intent */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="card">
          <h3 className="section-title">Travel-intent allocation</h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt style={{ color: 'var(--color-text-muted)' }}>Submissions</dt>
              <dd>{allocation.totalRequests}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--color-text-muted)' }}>Allocated to a seeded route</dt>
              <dd>{allocation.allocatedRequests}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--color-text-muted)' }}>Unallocated</dt>
              <dd style={{ color: allocation.unallocatedRequests > 0 ? 'var(--color-amber)' : undefined }}>
                {allocation.unallocatedRequests}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: 'var(--color-text-muted)' }}>Students allocated</dt>
              <dd>{allocation.allocatedStudents}</dd>
            </div>
          </dl>
          {allocation.unallocatedStudents > 0 && (
            <div className="alert-bar warning mt-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              <span>
                {allocation.unallocatedStudents} student(s) could not be matched to a seeded route
                and are excluded from route demand — they are not silently added elsewhere.
              </span>
            </div>
          )}
        </div>

        <div className="card xl:col-span-2">
          <h3 className="section-title">Aggregated travel intent</h3>
          {intentRows.length === 0 ? (
            <EmptyState
              title="No travel-intent submissions"
              detail="Student submissions from the Student Portal appear here as aggregates only."
            />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <caption className="sr-only">Aggregated student travel intent without identities.</caption>
                <thead>
                  <tr>
                    <th scope="col">Origin</th>
                    <th scope="col">Destination</th>
                    <th scope="col">Date</th>
                    <th scope="col">Required by</th>
                    <th scope="col">Requests</th>
                    <th scope="col">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {intentRows.map(row => (
                    <tr key={`${row.origin}-${row.destination}-${row.date}-${row.arrival}`}>
                      <td>{row.origin}</td>
                      <td>{row.destination}</td>
                      <td>{row.date}</td>
                      <td>{row.arrival}</td>
                      <td>{row.requests}</td>
                      <td>{row.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Demonstration records only · no personal identifiers are stored in analytics ·{' '}
            {formatDateTime(state.lastSavedAt)} is the last local save time.
          </p>
        </div>
      </div>
    </div>
  );
}
