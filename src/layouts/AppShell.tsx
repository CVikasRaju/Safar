import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Bus,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Route as RouteIcon,
  ShieldCheck,
  X,
} from "lucide-react";
import { DEMO_DATA_LABEL, SAFAR_TAGLINE } from "../domain/constants";
import { useSafarState } from "../state/SafarStateContext";
import { Notice, cx } from "../components/ui";
import { useStudentAlerts } from "../features/student/alerts";
import { useAlertReadState } from "../features/student/useStudentHooks";
import { DEMO_SESSION } from "../features/student/session";

const STUDENT_NAV = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/student/planner", label: "Journey Planner", icon: RouteIcon, end: false },
  { to: "/student/submissions", label: "My Travel Plans", icon: ClipboardList, end: false },
  { to: "/student/report", label: "Report a Disruption", icon: AlertTriangle, end: false },
  { to: "/student/alerts", label: "Journey Alerts", icon: Bell, end: false },
];

const CONTROL_CENTRE_NAV = [
  { to: "/control-centre", label: "Control Centre Operations", icon: ShieldCheck, end: true },
];

const PAGE_TITLES: Record<string, string> = {
  "/student": "Student Dashboard",
  "/student/planner": "Journey Planner",
  "/student/submissions": "My Travel Plans",
  "/student/report": "Report a Disruption",
  "/student/alerts": "Journey Alerts",
  "/control-centre": "Government Control Centre",
};

function NavItems({
  isControlCentre,
  onNavigate,
}: {
  isControlCentre: boolean;
  onNavigate?: () => void;
}) {
  const alerts = useStudentAlerts();
  const { isRead } = useAlertReadState();
  const unread = alerts.filter((alert) => !isRead(alert.id)).length;
  const navItems = isControlCentre ? CONTROL_CENTRE_NAV : STUDENT_NAV;

  return (
    <nav aria-label={isControlCentre ? "Control centre sections" : "Student portal sections"} className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-brand/40 bg-brand/10 font-semibold text-brand"
                  : "border-transparent text-ink-dim hover:border-line-strong hover:bg-panel-2 hover:text-ink",
              )
            }
          >
            <Icon size={16} aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {!isControlCentre && item.to === "/student/alerts" && unread > 0 ? (
              <span className="rounded-full bg-red-400/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
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
    <div
      className="mt-4 rounded-lg border border-line bg-abyss/60 p-2"
      role="group"
      aria-label="Workspace"
    >
      <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
        Workspace
      </p>
      <div className="flex flex-col gap-1">
        <NavLink
          to="/student"
          className={({ isActive }) =>
            cx(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
              isActive ? "bg-brand/15 font-semibold text-brand" : "text-ink-dim hover:text-ink",
            )
          }
        >
          <Bus size={14} /> Student Portal
        </NavLink>
        <NavLink
          to="/control-centre"
          className={({ isActive }) =>
            cx(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
              isActive ? "bg-brand/15 font-semibold text-brand" : "text-ink-dim hover:text-ink",
            )
          }
        >
          <ShieldCheck size={14} /> Control Centre
        </NavLink>
      </div>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { storageNotice, dismissStorageNotice } = useSafarState();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isControlCentre = location.pathname.startsWith("/control-centre");
  const title = PAGE_TITLES[location.pathname] ?? (isControlCentre ? "Government Control Centre" : "Student Portal");

  return (
    <div className="min-h-screen bg-abyss text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-abyss"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-navy px-3 py-4 lg:flex">
        <div className="px-1">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/40 bg-brand/10 text-brand">
              {isControlCentre ? <ShieldCheck size={17} /> : <Bus size={17} />}
            </span>
            <div>
              <p className="text-sm font-bold tracking-[0.14em] text-ink">SAFAR</p>
              <p className="text-[10px] text-muted">
                {isControlCentre ? "Government Control Centre" : "Student Portal"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">{SAFAR_TAGLINE}</p>
        </div>
        <div className="mt-5 flex-1 overflow-y-auto">
          <NavItems isControlCentre={isControlCentre} />
        </div>
        <WorkspaceSwitch />
        <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300">
            {DEMO_DATA_LABEL}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            Routes, timetables, delays and reliability values are illustrative prototype data, not
            official or live information.
          </p>
        </div>
        <p className="mt-3 px-1 text-[10px] text-muted">
          {isControlCentre ? "Role: Transport Authority Operator" : DEMO_SESSION.label}
        </p>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-navy/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg border border-line-strong p-2 text-ink-dim"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
        >
          <Menu size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-[10px] text-muted">
            SAFAR · {isControlCentre ? "Control Centre" : "Student Portal"}
          </p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
          Demo data
        </span>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-abyss/80"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto border-r border-line bg-navy px-3 py-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold tracking-[0.14em]">SAFAR</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-line-strong p-1.5 text-ink-dim"
                aria-label="Close navigation"
              >
                <X size={15} />
              </button>
            </div>
            <NavItems isControlCentre={isControlCentre} onNavigate={() => setMobileOpen(false)} />
            <WorkspaceSwitch />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <div className="hidden items-center justify-between border-b border-line bg-navy/60 px-6 py-3 lg:flex">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              {isControlCentre ? "Authority Workspace" : "Student Portal"}
            </p>
            <h1 className="text-base font-semibold tracking-tight text-ink">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="safar-chip border-brand/30 text-brand">
              {isControlCentre ? (
                <>
                  <ShieldCheck size={12} /> Transport Authority Operator
                </>
              ) : (
                <>
                  <Bus size={12} /> {DEMO_SESSION.displayName}
                </>
              )}
            </span>
            <span className="safar-chip border-amber-400/30 text-amber-300">{DEMO_DATA_LABEL}</span>
          </div>
        </div>

        <main id="main-content" className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-4 sm:px-6 lg:px-8 lg:pt-6">
          {storageNotice ? (
            <Notice tone="warning" className="mb-4" onDismiss={dismissStorageNotice} title="Demo data restored">
              {storageNotice}
            </Notice>
          ) : null}
          <Outlet />
        </main>

        <footer className="border-t border-line px-4 py-6 sm:px-6 lg:px-8">
          <p className="mx-auto max-w-[1320px] text-[11px] leading-relaxed text-muted">
            SAFAR is a functional competition prototype. Route, timetable, demand, delay and
            reliability values are illustrative. A student report stays UNVERIFIED until an
            authority reviews it, and only a separately confirmed incident changes operations.
          </p>
        </footer>
      </div>
    </div>
  );
}
