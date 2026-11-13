// SAFAR — Root App Component
// Handles workspace switching (Student / Government) and routing.

import React, { useState } from 'react';
import { Bus, GraduationCap, Shield, Bell } from 'lucide-react';
import GovernmentLayout from './layouts/GovernmentLayout';
import StudentLayout from './layouts/StudentLayout';
import { useAppState } from './state/store';

export type Workspace = 'STUDENT' | 'GOVERNMENT';

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>('GOVERNMENT');
  const { state } = useAppState();

  const unreadAlerts = state.alerts.filter(a => !a.read).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Top bar — workspace switcher */}
      <header
        className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-7 h-7 rounded"
            style={{ background: 'rgba(34,211,238,0.15)' }}
          >
            <Bus size={14} className="text-cyan-400" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--color-cyan)' }}>
              SAFAR
            </span>
            <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
              Rural Student Transport Intelligence
            </span>
          </div>
          <span className="demo-label ml-3">DEMO DATA</span>
        </div>

        {/* Workspace switcher */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWorkspace('STUDENT')}
            className={`btn flex items-center gap-1.5 ${workspace === 'STUDENT' ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={workspace === 'STUDENT'}
          >
            <GraduationCap size={12} />
            Student Portal
          </button>
          <button
            onClick={() => setWorkspace('GOVERNMENT')}
            className={`btn flex items-center gap-1.5 ${workspace === 'GOVERNMENT' ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={workspace === 'GOVERNMENT'}
          >
            <Shield size={12} />
            Control Centre
          </button>
        </div>

        {/* Alert indicator */}
        <div className="flex items-center gap-2">
          {unreadAlerts > 0 && (
            <div className="flex items-center gap-1.5 badge-rose px-2 py-1">
              <Bell size={11} />
              <span className="text-xs font-bold">{unreadAlerts} alert{unreadAlerts !== 1 ? 's' : ''}</span>
            </div>
          )}
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {workspace === 'GOVERNMENT' ? <GovernmentLayout /> : <StudentLayout />}
      </main>
    </div>
  );
}
