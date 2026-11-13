// SAFAR — Scenario Control Component
// RUN SAFAR LIVE SCENARIO / RESET / Scenario B (immediate breakdown)

import React, { useState } from 'react';
import { Play, RotateCcw, Zap, ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAppState, useAppDispatch } from '../../state/store';

export default function ScenarioControl() {
  const { state } = useAppState();
  const dispatch  = useAppDispatch();
  const [expanded, setExpanded] = useState(false);
  const [selectedBus, setSelectedBus] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const scenario      = state.scenario;
  const operatingBuses = state.buses.filter(b => b.status === 'OPERATING');

  function handleRunScenarioA() {
    dispatch({ type: 'RUN_SCENARIO', payload: { scenarioType: 'A' } });
  }

  function handleRunScenarioB() {
    if (!selectedBus) return;
    dispatch({ type: 'RUN_SCENARIO', payload: { scenarioType: 'B', busId: selectedBus } });
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    dispatch({ type: 'RESET_SCENARIO' });
    setConfirmReset(false);
    setSelectedBus('');
  }

  function handleDateChange(date: string) {
    dispatch({ type: 'SET_SCENARIO_DATE', payload: { date } });
  }

  return (
    <div className="card border" style={{ borderColor: 'rgba(34,211,238,0.2)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: 'var(--color-cyan)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-cyan)' }}>
            Scenario Controls
          </span>
          <span className={`badge ${
            scenario.status === 'RUNNING'  ? 'badge-amber' :
            scenario.status === 'COMPLETE' ? 'badge-emerald' : 'badge-slate'
          }`}>
            {scenario.status}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Scenario date */}
          <div>
            <label className="label">Scenario Date (configurable)</label>
            <input
              type="date"
              className="input w-48"
              value={scenario.scenarioDate}
              onChange={e => handleDateChange(e.target.value)}
            />
          </div>

          {/* Scenario A */}
          <div className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Scenario A — Festival + Breakdown (Full SAFAR Demo)
            </p>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Kombettu Festival impacts R101/R104 → KA-21-AB-102 breaks down → replacement ranked.
            </p>
            <button onClick={handleRunScenarioA} className="btn-primary flex items-center gap-1.5">
              <Play size={12} />
              RUN SAFAR LIVE SCENARIO
            </button>
          </div>

          {/* Scenario B */}
          <div className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Scenario B — Immediate Breakdown (Standalone)
            </p>
            <div className="flex items-center gap-2">
              <select
                className="select flex-1"
                value={selectedBus}
                onChange={e => setSelectedBus(e.target.value)}
              >
                <option value="">Select operating bus…</option>
                {operatingBuses.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.registration} ({b.assignedRouteId ?? 'no route'})
                  </option>
                ))}
              </select>
              <button
                onClick={handleRunScenarioB}
                disabled={!selectedBus}
                className="btn-warning flex items-center gap-1.5"
              >
                <AlertTriangle size={12} />
                SIMULATE BREAKDOWN
              </button>
            </div>
          </div>

          {/* Scenario steps */}
          {scenario.steps.length > 0 && (
            <div className="card" style={{ background: 'rgba(5,13,26,0.5)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Completed Steps
              </p>
              <ul className="space-y-1">
                {scenario.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <CheckCircle size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-emerald)' }} />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className={confirmReset ? 'btn-danger' : 'btn-ghost'}
            >
              <RotateCcw size={12} />
              {confirmReset ? 'CONFIRM RESET — This clears all state' : 'RESET SCENARIO'}
            </button>
            {confirmReset && (
              <button onClick={() => setConfirmReset(false)} className="btn-ghost text-xs">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
