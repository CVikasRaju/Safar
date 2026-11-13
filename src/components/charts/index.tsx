// SAFAR — Shared chart components (Member 3)
// Thin, reusable Recharts wrappers so intelligence pages render consistently
// from shared state instead of duplicating chart configuration.

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BarSeries {
  key: string;
  name: string;
  color: string;
  stackId?: string;
}

const AXIS_STYLE = { fill: '#94a3b8', fontSize: 10 };
const TOOLTIP_STYLE = {
  backgroundColor: '#0a1628',
  border: '1px solid rgba(34,211,238,0.25)',
  borderRadius: 6,
  fontSize: 11,
  color: '#e2e8f0',
};

export function ChartCard({
  title,
  description,
  summary,
  actions,
  children,
}: {
  title: string;
  description?: string;
  summary: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card" aria-label={title}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="section-title mb-0.5">{title}</h3>
          {description && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
      <p className="sr-only">{summary}</p>
    </section>
  );
}

export function GroupedBarChart({
  data,
  xKey,
  bars,
  height = 220,
  ariaLabel,
  maxValue,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  bars: BarSeries[];
  height?: number;
  ariaLabel: string;
  maxValue?: number;
}) {
  return (
    <div style={{ width: '100%', height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" />
          <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            domain={maxValue != null ? [0, maxValue] : undefined}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#e2e8f0' }}
            cursor={{ fill: 'rgba(34,211,238,0.06)' }}
          />
          <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
          {bars.map(bar => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              stackId={bar.stackId}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankedBarChart({
  data,
  labelKey,
  valueKey,
  height = 200,
  ariaLabel,
  maxValue = 100,
  colorForValue,
  valueName,
}: {
  data: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  height?: number;
  ariaLabel: string;
  maxValue?: number;
  colorForValue?: (value: number) => string;
  valueName?: string;
}) {
  const fallbackColor = (value: number) =>
    value >= 75
      ? '#fb7185'
      : value >= 50
        ? '#fb923c'
        : value >= 25
          ? '#fbbf24'
          : '#34d399';

  return (
    <div style={{ width: '100%', height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, maxValue]}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey={labelKey}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#e2e8f0' }}
            cursor={{ fill: 'rgba(34,211,238,0.06)' }}
          />
          <Bar dataKey={valueKey} name={valueName ?? 'Score'} radius={[0, 3, 3, 0]}>
            {data.map((entry, index) => {
              const value = Number(entry[valueKey]) || 0;
              return (
                <Cell
                  key={`${String(entry[labelKey])}-${index}`}
                  fill={(colorForValue ?? fallbackColor)(value)}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
