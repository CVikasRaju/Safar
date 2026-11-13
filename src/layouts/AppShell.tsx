import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bus,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Route as RouteIcon,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useSafarState } from "../state/SafarStateContext";
import { Notice, cx } from "../components/ui";
import { useStudentAlerts } from "../features/student/alerts";
import { useAlertReadState } from "../features/student/useStudentHooks";
import { useAuth } from "../auth/AuthContext";
import { ROLE_HOME, canAccessArea } from "../auth/demoUsers";

const STUDENT_NAV = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/student/planner", label: "Journey planner", icon: RouteIcon, end: false },
  { to: "/student/submissions", label: "My travel plans", icon: ClipboardList, end: false },
  { to: "/student/report", label: "Report a disruption", icon: AlertTriangle, end: false },
  { to: "/student/alerts", label: "Journey alerts", icon: Bell, end: false },
];

const CONTROL_NAV = [
  { to: "/control-centre", label: "Fleet & operations", icon: ShieldCheck, end: true },
  { to: "/control-centre/intelligence", label: "Intelligence overview", icon: LayoutDashboard, end: false },
  { to: "/control-centre/events", label: "Regional events", icon: CalendarDays, end: false },
  { to: "/control-centre/disruptions", label: "Disruption reports", icon: AlertTriangle, end: false },
  { to: "/control-centre/demand", label: "Demand analytics", icon: Users, end: false },
  { to: "/control-centre/reliability", label: "Route reliability", icon: Activity, end: false },
  { to: "/control-centre/emergency", label: "Allocation & routes", icon: Bus, end: false },
  { to: "/control-centre/scenario", label: "Emergency scenario", icon: AlertTriangle, end: false },
  { to: "/control-centre/prediction", label: "Event prediction", icon: Radar, end: false },
  { to: "/control-centre/integration", label: "Shared state & logs", icon: ClipboardList, end: false },
];

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/student": {
    title: "Student dashboard",
    description: "Your next journey, service status and reports in one place.",
  },
  "/student/planner": {
    title: "Journey planner",
    description: "Compare timetable-feasible options for your arrival deadline.",
  },
  "/student/submissions": {
    title: "My travel plans",
    description: "Submit intended journeys so demand and alerts stay current.",
  },
  "/student/report": {
    title: "Report a disruption",
    description: "Tell the control room what you are seeing. Reports are unverified until reviewed.",
  },
  "/student/alerts": {
    title: "Journey alerts",
    description: "Updates derived from the shared demonstration state.",
  },
  "/control-centre": {
    title: "Fleet & operations",
    description: "Bus status, breakdown simulation and replacement approval.",
  },
  "/control-centre/intelligence": {
    title: "Regional intelligence",
    description: "Events, disruption, demand and reliability for the Puttur region.",
  },
  "/control-centre/events": {
    title: "Regional event intelligence",
    description: "Events, expected impact and affected routes.",
  },
  "/control-centre/disruptions": {
    title: "Disruption reports",
    description: "Review student reports and confirm operational incidents.",
  },
  "/control-centre/demand": {
    title: "Demand & capacity",
    description: "Student demand against seats by route, village and arrival window.",
  },
  "/control-centre/reliability": {
    title: "Route reliability",
    description: "Illustrative reliability factors for routes and journeys.",
  },
  "/control-centre/emergency": {
    title: "Emergency allocation",
    description: "Seat allocation, detours, pickups and unserved groups.",
  },
  "/control-centre/scenario": {
    title: "Emergency scenario",
    description: "Run and reset the four-condition demonstration scenario.",
  },
  "/control-centre/prediction": {
    title: "Event prediction",
    description: "Advance warnings with provenance and affected network.",
  },
  "/control-centre/integration": {
    title: "Shared state & logs",
    description: "What each workspace publishes, plus the audit trail.",
  },
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NavItems({
  items,
  onNavigate,
  ariaLabel,
  showUnread,
}: {
  items: typeof STUDENT_NAV;
  onNavigate?: () => void;
  ariaLabel: string;
  showUnread: boolean;
}) {
  const alerts = useStudentAlerts();
  const { isRead } = useAlertReadState();
  const unread = alerts.filter((alert) => !isRead(alert.id)).length;

  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-2.5 rounded-r border-l-[3px] px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "border-[#0b5394] bg-[#eaf2fa] font-semibold text-[#0b5394]"
                  : "border-transparent text-[#3f5163] hover:bg-[#f3f6f9] hover:text-[#14212e]",
              )
            }
          >
            <Icon size={15} aria-hidden="true" className="shrink-0" />
            <span className="flex-1">{item.label}</span>
            {showUnread && item.to === "/student/alerts" && unread > 0 ? (
              <span className="rounded bg-[#0b5394] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}

function WorkspaceSwitch() {
  return (
    <div className="mt-4 border-t border-line pt-3" role="group" aria-label="Workspace">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#718296]">
        Switch workspace
      </p>
      <div className="flex flex-col gap-0.5">
        <NavLink
          to="/student"
          className={({ isActive }) =>
            cx(
              "flex items-center gap-2 rounded px-3 py-2 text-xs transition-colors",
              isActive ? "bg-[#eaf2fa] font-semibold text-[#0b5394]" : "text-[#3f5163] hover:bg-[#f3f6f9]",
            )
          }
        >
          <Bus size={14} /> Student portal
        </NavLink>
        <NavLink
          to="/control-centre"
          className={({ isActive }) =>
            cx(
              "flex items-center gap-2 rounded px-3 py-2 text-xs transition-colors",
              isActive ? "bg-[#eaf2fa] font-semibold text-[#0b5394]" : "text-[#3f5163] hover:bg-[#f3f6f9]",
            )
          }
        >
          <ShieldCheck size={14} /> Control centre
        </NavLink>
      </div>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { storageNotice, dismissStorageNotice } = useSafarState();
  const { user, logout } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isControlCentre = location.pathname.startsWith("/control-centre");
  const area = isControlCentre ? "control" : "student";
  const workspaceLabel = isControlCentre ? "Control centre" : "Student portal";
  const navItems = isControlCentre ? CONTROL_NAV : STUDENT_NAV;
  const meta = PAGE_META[location.pathname] ?? {
    title: workspaceLabel,
    description: "SAFAR rural student transport demonstration.",
  };

  if (!user) return null;
  if (!canAccessArea(user.role, area)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return (
    <div className="min-h-screen bg-abyss text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-[#0b5394] focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40">
        <div className="bg-[#0c2d4a] text-white">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-1 px-4 py-1.5 text-[10px] sm:px-6">
            <p className="tracking-[0.02em]">Government of Karnataka · Department of Transport</p>
            <p className="flex items-center gap-1.5 text-white/70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              Demonstration portal · illustrative data
            </p>
          </div>
        </div>

        <div className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded border border-line-strong p-1.5 text-[#3f5163] lg:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
            >
              <Menu size={17} />
            </button>

            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-[#0c2d4a] text-white">
                {isControlCentre ? <ShieldCheck size={19} /> : <Bus size={19} />}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-tight tracking-[0.16em] text-[#14212e]">
                  SAFAR
                </p>
                <p className="hidden truncate text-[10px] leading-tight text-[#6b7c8f] sm:block">
                  Rural student transport intelligence
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <span className="hidden rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 sm:inline">
                Demo data
              </span>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold leading-tight text-[#1d2b3a]">{user.displayName}</p>
                <p className="text-[10px] leading-tight text-[#6b7c8f]">{user.roleLabel}</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eaf2fa] text-[11px] font-bold text-[#0b5394]">
                {initials(user.displayName)}
              </span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1.5 text-[11px] font-medium text-[#3f5163] transition-colors hover:border-[#0b5394] hover:text-[#0b5394]"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] items-start">
        <aside className="sticky top-[89px] hidden h-[calc(100vh-89px)] w-[248px] shrink-0 overflow-y-auto border-r border-line bg-white px-3 py-5 lg:block">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#718296]">
            {isControlCentre ? "Control centre" : "Student services"}
          </p>
          <NavItems
            items={navItems}
            ariaLabel={isControlCentre ? "Control centre sections" : "Student portal sections"}
            showUnread={!isControlCentre}
          />

          {user.role === "ADMIN" ? <WorkspaceSwitch /> : null}

          <div className="mt-5 border-l-2 border-amber-400 bg-amber-50/70 px-3 py-2.5">
            <p className="text-[10px] font-semibold text-amber-800">
              Illustrative data
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-[#6b5b3e]">
              Routes, timetables, demand and reliability values are illustrative. No live GPS or
              official schedule is used.
            </p>
          </div>

          <p className="mt-4 px-3 text-[10px] leading-relaxed text-[#7a8a9b]">
            Signed in as <span className="font-semibold text-[#54657a]">{user.username}</span>
            <br />
            {user.roleLabel}
          </p>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-line bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1180px]">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[10px] text-[#718296]">
                <span>SAFAR</span>
                <span aria-hidden="true">/</span>
                <span>{workspaceLabel}</span>
                <span aria-hidden="true">/</span>
                <span className="font-medium text-[#3f5163]">{meta.title}</span>
              </nav>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-[#14212e]">{meta.title}</h1>
                  <p className="mt-0.5 text-xs text-[#5a6b7b]">{meta.description}</p>
                </div>
                <span className="hidden rounded border border-line bg-[#f6f8fa] px-2 py-1 text-[10px] text-[#5a6b7b] md:inline">
                  {workspaceLabel}
                </span>
              </div>
            </div>
          </div>

          <main id="main-content" className="px-4 pb-14 pt-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1180px]">
              {storageNotice ? (
                <Notice
                  tone="warning"
                  className="mb-4"
                  onDismiss={dismissStorageNotice}
                  title="Demo data restored"
                >
                  {storageNotice}
                </Notice>
              ) : null}
              <Outlet />
            </div>
          </main>

          <footer className="border-t border-line bg-white px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 text-[10px] leading-relaxed text-[#718296]">
              <p>
                SAFAR competition prototype · Student reports remain unverified until an authority
                reviews them.
              </p>
              <p>Illustrative data only · no live services</p>
            </div>
          </footer>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[286px] overflow-y-auto bg-white px-3 py-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-bold tracking-[0.16em]">SAFAR</p>
                <p className="text-[10px] text-[#6b7c8f]">{workspaceLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded border border-line-strong p-1.5 text-[#3f5163]"
                aria-label="Close navigation"
              >
                <X size={15} />
              </button>
            </div>
            <NavItems
              items={navItems}
              onNavigate={() => setMobileOpen(false)}
              ariaLabel={isControlCentre ? "Control centre sections" : "Student portal sections"}
              showUnread={!isControlCentre}
            />
            {user.role === "ADMIN" ? <WorkspaceSwitch /> : null}
            <div className="mt-4 border-t border-line px-1 pt-3">
              <p className="text-xs font-semibold text-[#1d2b3a]">{user.displayName}</p>
              <p className="text-[10px] text-[#6b7c8f]">{user.roleLabel}</p>
              <button
                type="button"
                onClick={logout}
                className="mt-2 inline-flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1.5 text-[11px] text-[#3f5163]"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
