import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { StudentDashboard } from "./features/student/pages/StudentDashboard";
import { JourneyPlannerPage } from "./features/student/pages/JourneyPlannerPage";
import { TravelSubmissionsPage } from "./features/student/pages/TravelSubmissionsPage";
import { ReportDisruptionPage } from "./features/student/pages/ReportDisruptionPage";
import { JourneyAlertsPage } from "./features/student/pages/JourneyAlertsPage";
import { GovernmentControlCentrePage } from "./features/fleet/pages/GovernmentControlCentrePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/student" replace />} />
        <Route path="student" element={<StudentDashboard />} />
        <Route path="student/planner" element={<JourneyPlannerPage />} />
        <Route path="student/submissions" element={<TravelSubmissionsPage />} />
        <Route path="student/report" element={<ReportDisruptionPage />} />
        <Route path="student/alerts" element={<JourneyAlertsPage />} />
        <Route path="control-centre" element={<GovernmentControlCentrePage />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Route>
    </Routes>
  );
}
