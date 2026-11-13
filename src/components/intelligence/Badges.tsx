// SAFAR — Shared intelligence UI atoms (Member 3)
// Reusable status language, score bars and the mandatory reliability disclaimer.

import React from 'react';
import type {
  IncidentSeverity,
  ReportStatus,
  RiskLevel,
} from '../../domain/types';
import { RELIABILITY_DISCLAIMER } from '../../domain/calculations/reliability';
import {
  INCIDENT_SEVERITY_LABELS,
  REPORT_STATUS_BADGE_CLASS,
  REPORT_STATUS_LABELS,
  RISK_BADGE_CLASS,
  SEVERITY_BADGE_CLASS,
} from './labels';

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={RISK_BADGE_CLASS[risk]}>{risk} RISK</span>;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`${REPORT_STATUS_BADGE_CLASS[status]} whitespace-nowrap`}>
      {REPORT_STATUS_LABELS[status]}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <span className={SEVERITY_BADGE_CLASS[severity]}>
      {INCIDENT_SEVERITY_LABELS[severity].toUpperCase()} SEVERITY
    </span>
  );
}

export function ReliabilityPill({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 80
      ? 'badge-emerald'
      : score >= 60
        ? 'badge-amber'
        : score >= 40
          ? 'badge-orange'
          : 'badge-rose';
  return (
    <span className={tone}>
      {score}/100{label ? ` · ${label}` : ''}
    </span>
  );
}

export function ScoreBar({
  value,
  max = 100,
  tone = 'cyan',
  label,
}: {
  value: number;
  max?: number;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose';
  label?: string;
}) {
  const safeMax = max > 0 ? max : 100;
  const percent = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));
  const colors: Record<string, string> = {
    cyan: 'var(--color-cyan)',
    emerald: 'var(--color-emerald)',
    amber: 'var(--color-amber)',
    rose: 'var(--color-rose)',
  };

  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
          <span>{label}</span>
          <span>{value}</span>
        </div>
      )}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(100,116,139,0.2)' }}
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label ?? 'Score'}
      >
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${percent}%`, background: colors[tone] }}
        />
      </div>
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="kpi-tile"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) onClick();
      }}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && <span style={{ color: color ?? 'var(--color-cyan)' }}>{icon}</span>}
      </div>
      <div className="kpi-value" style={{ color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function ReliabilityDisclaimer({ className }: { className?: string }) {
  return (
    <p className={`reliability-disclaimer ${className ?? ''}`} role="note">
      {RELIABILITY_DISCLAIMER}
    </p>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {title}
      </p>
      {detail && <p className="text-xs mt-1">{detail}</p>}
    </div>
  );
}
