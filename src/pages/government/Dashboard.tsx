// SAFAR — Government Dashboard (top-level KPI tiles + navigation)

import React from 'react';
import { Bus, Users, AlertTriangle, Bell, TrendingDown, Activity, Shield, Zap } from 'lucide-react';
import { useAppState } from '../../state/store';
import ScenarioControl from '../../components/scenario/ScenarioControl';

type GovPage = string;

interface Props { onNavigate: (page: GovPage) => void; }

function KpiTile({ label, value, sub, icon, color, onClick }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; onClick?: () => void;
}) {
  return (
    <div
      className={`kpi-tile cursor-pointer card-hover ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(); }}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard({ onNavigate }: Props) {
  const { state } = useAppState();

  const totalBuses      = state.buses.length;
  const operating       = state.buses.filter(b => b.status === 'OPERATING').length;
  const available       = state.buses.filter(b => b.status === 'AVAILABLE').length;
  const unavailable     = state.buses.filter(b => b.status === 'UNAVAILABLE' || b.status === 'MAINTENANCE').length;
  const totalExpected   = state.demandSeed.reduce((s, d) => s + d.expectedStudents, 0);
  const totalSeats      = state.demandSeed.reduce((s, d) => s + d.availableSeats, 0);
  const shortage        = Math.max(0, totalExpected - totalSeats);
  const activeIncidents = state.incidents.filter(i => i.status === 'ACTIVE').length;
  const unverified      = state.disruptionReports.filter(r => r.status === 'UNVERIFIED').length;
  const affectedRoutes  = [...new Set(state.incidents.filter(i => i.status === 'ACTIVE').map(i => i.routeId).filter(Boolean))].length;
  const highImpactEvents = state.eventImpacts.filter(i => i.riskLevel === 'HIGH' || i.riskLevel === 'CRITICAL').length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Government Control Centre
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Puttur Region — Rural Student Transport Operations · <span className="demo-label">DEMO DATA</span>
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Total Buses"     value={totalBuses}   icon={<Bus size={14} />}          color="var(--color-cyan)"    onClick={() => onNavigate('fleet')} />
        <KpiTile label="Operating"       value={operating}    icon={<Activity size={14} />}      color="var(--color-emerald)" onClick={() => onNavigate('fleet')} />
        <KpiTile label="Available"       value={available}    icon={<Zap size={14} />}           color="#22d3ee"              onClick={() => onNavigate('fleet')} />
        <KpiTile label="Unavailable"     value={unavailable}  icon={<AlertTriangle size={14} />} color="var(--color-rose)"    onClick={() => onNavigate('fleet')} />
        <KpiTile label="Expected Students" value={totalExpected} sub="Illustrative demand" icon={<Users size={14} />} color="var(--color-cyan)" onClick={() => onNavigate('demand')} />
        <KpiTile label="Available Seats" value={totalSeats}   icon={<Bus size={14} />}          color="var(--color-emerald)" onClick={() => onNavigate('demand')} />
        <KpiTile label="Potential Shortage" value={shortage}  sub="Illustrative figure" icon={<TrendingDown size={14} />} color={shortage > 0 ? 'var(--color-rose)' : 'var(--color-emerald)'} onClick={() => onNavigate('demand')} />
        <KpiTile label="Active Disruptions" value={activeIncidents} icon={<AlertTriangle size={14} />} color={activeIncidents > 0 ? 'var(--color-rose)' : 'var(--color-emerald)'} onClick={() => onNavigate('reports')} />
        <KpiTile label="Unverified Reports" value={unverified} icon={<Bell size={14} />} color={unverified > 0 ? 'var(--color-amber)' : 'var(--color-text-muted)'} onClick={() => onNavigate('reports')} />
        <KpiTile label="Routes Affected" value={affectedRoutes} icon={<Shield size={14} />} color={affectedRoutes > 0 ? 'var(--color-amber)' : 'var(--color-text-muted)'} onClick={() => onNavigate('routes')} />
        <KpiTile label="High Impact Events" value={highImpactEvents} icon={<Zap size={14} />} color={highImpactEvents > 0 ? 'var(--color-amber)' : 'var(--color-text-muted)'} onClick={() => onNavigate('events')} />
      </div>

      {/* Scenario Control */}
      <ScenarioControl />

      {/* Quick links */}
      <div className="card">
        <p className="section-title">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Event Intelligence', page: 'events' },
            { label: 'Disruption Reports', page: 'reports' },
            { label: 'Demand Analytics',   page: 'demand' },
            { label: 'Reliability',        page: 'reliability' },
            { label: 'Intelligence',       page: 'intelligence' },
          ].map(link => (
            <button key={link.page} onClick={() => onNavigate(link.page)} className="btn-secondary text-xs">
              {link.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent alerts */}
      {state.alerts.slice(-3).reverse().map(alert => (
        <div key={alert.id} className={`alert-bar ${alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'WARNING' ? 'warning' : 'info'}`}>
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{alert.title}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
