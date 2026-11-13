import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { StudentDashboard } from "./features/student/pages/StudentDashboard";
import { JourneyPlannerPage } from "./features/student/pages/JourneyPlannerPage";
import { TravelSubmissionsPage } from "./features/student/pages/TravelSubmissionsPage";
import { ReportDisruptionPage } from "./features/student/pages/ReportDisruptionPage";
import { JourneyAlertsPage } from "./features/student/pages/JourneyAlertsPage";
import { ControlCentreStatusPage } from "./features/student/pages/ControlCentreStatusPage";
import { ControlCentreDashboard } from "./features/control-centre/pages/ControlCentreDashboard";
import { ControlCentreEmergencyPage } from "./features/control-centre/pages/ControlCentreEmergencyPage";
import { ControlCentrePredictionPage } from "./features/control-centre/pages/ControlCentrePredictionPage";
import { GovernmentControlCentrePage } from "./features/fleet/pages/GovernmentControlCentrePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/student" replace />} />
        {/* Student Portal (Member 2) */}
        <Route path="student" element={<StudentDashboard />} />
        <Route path="student/planner" element={<JourneyPlannerPage />} />
        <Route path="student/submissions" element={<TravelSubmissionsPage />} />
        <Route path="student/report" element={<ReportDisruptionPage />} />
        <Route path="student/alerts" element={<JourneyAlertsPage />} />

        {/* Control Centre - Fleet Operations (Member 4) */}
        <Route path="control-centre" element={<GovernmentControlCentrePage />} />
        
        {/* Control Centre - Emergency Engine & Allocation (Member 2) */}
        <Route path="control-centre/emergency" element={<ControlCentreEmergencyPage />} />
        <Route path="control-centre/scenario" element={<ControlCentreDashboard />} />
        <Route path="control-centre/prediction" element={<ControlCentrePredictionPage />} />
        
        {/* Control Centre - Shared State & Integration (Member 1) */}
        <Route path="control-centre/integration" element={<ControlCentreStatusPage />} />

        <Route path="*" element={<Navigate to="/student" replace />} />
      </Route>
    </Routes>
  );
}
