// SAFAR — Integration placeholder for modules owned by other team members.
// This file intentionally contains NO business logic. It keeps the integrated
// app shell runnable on the feature/intelligence branch until the owning
// member's page lands. Replace the importing page, not this notice.

import React from 'react';
import { Construction } from 'lucide-react';

export default function PendingModule({
  title,
  owner,
  detail,
}: {
  title: string;
  owner: string;
  detail?: string;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="card" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <Construction size={16} style={{ color: 'var(--color-amber)' }} />
          <h1 className="text-base font-bold">{title}</h1>
          <span className="badge-amber">MODULE PENDING</span>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          This page belongs to {owner} and is not implemented on the{' '}
          <code>feature/intelligence</code> branch. The shared state, domain types and navigation
          entry already exist so the integrated application stays buildable.
        </p>
        {detail && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {detail}
          </p>
        )}
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          No mock data or placeholder results are shown here, so nothing on this page can be mistaken
          for a working module.
        </p>
      </div>
    </div>
  );
}
