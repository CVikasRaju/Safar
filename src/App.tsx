import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { RequireAuth, useAuth } from "./auth/AuthContext";
import { ROLE_HOME } from "./auth/demoUsers";
import { LoginPage } from "./pages/LoginPage";

const StudentDashboard = lazy(() =>
  import("./features/student/pages/StudentDashboard").then((module) => ({
    default: module.StudentDashboard,
  })),
);
const JourneyPlannerPage = lazy(() =>
  import("./features/student/pages/JourneyPlannerPage").then((module) => ({
    default: module.JourneyPlannerPage,
  })),
);
const TravelSubmissionsPage = lazy(() =>
  import("./features/student/pages/TravelSubmissionsPage").then((module) => ({
    default: module.TravelSubmissionsPage,
  })),
);
const ReportDisruptionPage = lazy(() =>
  import("./features/student/pages/ReportDisruptionPage").then((module) => ({
    default: module.ReportDisruptionPage,
  })),
);
const JourneyAlertsPage = lazy(() =>
  import("./features/student/pages/JourneyAlertsPage").then((module) => ({
    default: module.JourneyAlertsPage,
  })),
);
const ControlCentreStatusPage = lazy(() =>
  import("./features/student/pages/ControlCentreStatusPage").then((module) => ({
    default: module.ControlCentreStatusPage,
  })),
);
const ControlCentreDashboard = lazy(() =>
  import("./features/control-centre/pages/ControlCentreDashboard").then((module) => ({
    default: module.ControlCentreDashboard,
  })),
);
const ControlCentreEmergencyPage = lazy(() =>
  import("./features/control-centre/pages/ControlCentreEmergencyPage").then((module) => ({
    default: module.ControlCentreEmergencyPage,
  })),
);
const ControlCentrePredictionPage = lazy(() =>
  import("./features/control-centre/pages/ControlCentrePredictionPage").then((module) => ({
    default: module.ControlCentrePredictionPage,
  })),
);
const GovernmentControlCentrePage = lazy(() =>
  import("./features/fleet/pages/GovernmentControlCentrePage").then((module) => ({
    default: module.GovernmentControlCentrePage,
  })),
);
const EventIntelligence = lazy(() => import("./pages/government/EventIntelligence"));
const DisruptionReports = lazy(() => import("./pages/government/DisruptionReports"));
const DemandAnalytics = lazy(() => import("./pages/government/DemandAnalytics"));
const ReliabilityDashboard = lazy(() => import("./pages/government/ReliabilityDashboard"));
const IntelligenceDashboard = lazy(() => import("./pages/government/IntelligenceDashboard"));

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}

function RouteLoading() {
  return (
    <div className="flex min-h-[240px] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
        Loading…
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomeRedirect />} />

            {/* Student Portal */}
            <Route path="student" element={<StudentDashboard />} />
            <Route path="student/planner" element={<JourneyPlannerPage />} />
            <Route path="student/submissions" element={<TravelSubmissionsPage />} />
            <Route path="student/report" element={<ReportDisruptionPage />} />
            <Route path="student/alerts" element={<JourneyAlertsPage />} />

            {/* Control Centre - Fleet Operations */}
            <Route path="control-centre" element={<GovernmentControlCentrePage />} />

            {/* Control Centre - Regional Intelligence */}
            <Route path="control-centre/intelligence" element={<IntelligenceDashboard />} />
            <Route path="control-centre/events" element={<EventIntelligence />} />
            <Route path="control-centre/disruptions" element={<DisruptionReports />} />
            <Route path="control-centre/demand" element={<DemandAnalytics />} />
            <Route path="control-centre/reliability" element={<ReliabilityDashboard />} />

            {/* Control Centre - Emergency Engine */}
            <Route path="control-centre/emergency" element={<ControlCentreEmergencyPage />} />
            <Route path="control-centre/scenario" element={<ControlCentreDashboard />} />
            <Route path="control-centre/prediction" element={<ControlCentrePredictionPage />} />

            {/* Control Centre - Shared State */}
            <Route path="control-centre/integration" element={<ControlCentreStatusPage />} />

            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
