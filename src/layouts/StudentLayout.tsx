// SAFAR — Student Portal Layout

import React, { useState } from 'react';
import { Map, Send, AlertTriangle, Bell, GraduationCap } from 'lucide-react';
import { useAppState } from '../state/store';
import JourneyPlanner from '../pages/student/JourneyPlanner';
import TravelSubmissions from '../pages/student/TravelSubmissions';
import ReportDisruption from '../pages/student/ReportDisruption';
import StudentAlerts from '../pages/student/StudentAlerts';

type StudentPage = 'planner' | 'submissions' | 'report' | 'alerts';

export default function StudentLayout() {
  const [activePage, setActivePage] = useState<StudentPage>('planner');
  const { state } = useAppState();

  const unreadAlerts = state.alerts.filter(a => !a.read).length;
  const myReports = state.disruptionReports.filter(r => r.provenance === 'USER_ENTERED').length;

  const navItems = [
    { id: 'planner'     as StudentPage, label: 'Journey Planner',     icon: <Map size={14} /> },
    { id: 'submissions' as StudentPage, label: 'My Submissions',       icon: <GraduationCap size={14} /> },
    { id: 'report'      as StudentPage, label: 'Report Disruption',    icon: <AlertTriangle size={14} />, badge: myReports > 0 ? myReports : undefined },
    { id: 'alerts'      as StudentPage, label: 'Journey Alerts',       icon: <Bell size={14} />, badge: unreadAlerts > 0 ? unreadAlerts : undefined },
  ];

  const pageComponents: Record<StudentPage, React.ReactNode> = {
    planner:     <JourneyPlanner />,
    submissions: <TravelSubmissions />,
    report:      <ReportDisruption />,
    alerts:      <StudentAlerts />,
  };

  return (
    <div className="flex h-full flex-col" style={{ height: 'calc(100vh - 45px)' }}>
      {/* Tab nav */}
      <nav
        className="flex gap-1 px-4 py-2 border-b flex-shrink-0"
        style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
        aria-label="Student navigation"
      >
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 relative ${
              activePage === item.id ? 'btn-primary' : 'btn-ghost'
            }`}
            aria-current={activePage === item.id ? 'page' : undefined}
          >
            {item.icon}
            {item.label}
            {item.badge != null && (
              <span className="badge-rose text-xs px-1 py-0.5 ml-0.5">{item.badge}</span>
            )}
          </button>
        ))}

        {/* CTA — prominent report button */}
        <button
          onClick={() => setActivePage('report')}
          className="ml-auto btn-danger flex items-center gap-1.5"
        >
          <AlertTriangle size={12} />
          REPORT BUS NOT ARRIVED / DISRUPTION
        </button>
      </nav>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {pageComponents[activePage]}
      </div>
    </div>
  );
}
