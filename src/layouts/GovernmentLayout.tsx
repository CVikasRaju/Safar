// SAFAR — Government Control Centre Layout
// Persistent sidebar + content area.

import React, { useState } from 'react';
import {
  LayoutDashboard, Bus, CalendarDays, Users, Wrench,
  Map, AlertTriangle, BellRing, ChevronRight, ChevronLeft,
  BarChart3, Shield
} from 'lucide-react';
import { useAppState } from '../state/store';

// Government pages
import Dashboard from '../pages/government/Dashboard';
import FleetOverview from '../pages/government/FleetOverview';
import EventIntelligence from '../pages/government/EventIntelligence';
import DemandAnalytics from '../pages/government/DemandAnalytics';
import ReplacementRecommendations from '../pages/government/ReplacementRecommendations';
import RouteMonitoring from '../pages/government/RouteMonitoring';
import DisruptionReports from '../pages/government/DisruptionReports';
import AlertsPage from '../pages/government/AlertsPage';
import IntelligenceDashboard from '../pages/government/IntelligenceDashboard';
import ReliabilityDashboard from '../pages/government/ReliabilityDashboard';

type GovPage =
  | 'dashboard'
  | 'fleet'
  | 'events'
  | 'demand'
  | 'replacement'
  | 'routes'
  | 'reports'
  | 'alerts'
  | 'intelligence'
  | 'reliability';

interface NavItem {
  id: GovPage;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  owner?: string; // which member owns this page
}

export default function GovernmentLayout() {
  const [activePage, setActivePage] = useState<GovPage>('intelligence');
  const [collapsed, setCollapsed] = useState(false);
  const { state } = useAppState();

  const unverifiedReports = state.disruptionReports.filter(r => r.status === 'UNVERIFIED').length;
  const activeIncidents   = state.incidents.filter(i => i.status === 'ACTIVE').length;
  const unreadAlerts      = state.alerts.filter(a => !a.read).length;
  const pendingRecs       = state.replacementRecommendations.filter(r => r.status === 'PENDING').length;

  const navItems: NavItem[] = [
    { id: 'dashboard',     label: 'Dashboard',           icon: <LayoutDashboard size={14} /> },
    { id: 'intelligence',  label: 'Intelligence',         icon: <BarChart3 size={14} />, owner: 'M3' },
    { id: 'events',        label: 'Event Intelligence',   icon: <CalendarDays size={14} />, owner: 'M3' },
    { id: 'demand',        label: 'Demand Analytics',     icon: <Users size={14} />, owner: 'M3' },
    { id: 'reliability',   label: 'Reliability',          icon: <Shield size={14} />, owner: 'M3' },
    { id: 'reports',       label: 'Disruption Reports',   icon: <AlertTriangle size={14} />, badgeCount: unverifiedReports + activeIncidents, owner: 'M3' },
    { id: 'fleet',         label: 'Fleet Overview',       icon: <Bus size={14} />, owner: 'M4' },
    { id: 'replacement',   label: 'Replacements',         icon: <Wrench size={14} />, badgeCount: pendingRecs, owner: 'M4' },
    { id: 'routes',        label: 'Route Monitoring',     icon: <Map size={14} /> },
    { id: 'alerts',        label: 'Alerts',               icon: <BellRing size={14} />, badgeCount: unreadAlerts },
  ];

  const pageComponents: Record<GovPage, React.ReactNode> = {
    dashboard:    <Dashboard onNavigate={page => setActivePage(page as GovPage)} />,
    intelligence: <IntelligenceDashboard />,
    events:       <EventIntelligence />,
    demand:       <DemandAnalytics />,
    reliability:  <ReliabilityDashboard />,
    reports:      <DisruptionReports />,
    fleet:        <FleetOverview />,
    replacement:  <ReplacementRecommendations />,
    routes:       <RouteMonitoring />,
    alerts:       <AlertsPage />,
  };

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 45px)' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col border-r transition-all duration-200 flex-shrink-0"
        style={{
          width: collapsed ? '48px' : '200px',
          background: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-end p-2 border-b btn-ghost w-full"
          style={{ borderColor: 'var(--color-border)' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5" aria-label="Government navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`nav-item ${activePage === item.id ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.label : undefined}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.owner === 'M3' && (
                    <span className="text-xs" style={{ color: 'var(--color-cyan)', opacity: 0.6 }}>M3</span>
                  )}
                  {item.badgeCount != null && item.badgeCount > 0 && (
                    <span className="badge-rose text-xs px-1.5 py-0.5 ml-auto">{item.badgeCount}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="p-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
              Control Centre v0.1
            </p>
          </div>
        )}
      </aside>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {pageComponents[activePage]}
      </div>
    </div>
  );
}
