import { useAuth } from "../../auth/AuthContext";

/**
 * Demo student session.
 *
 * Authentication is a browser-only demonstration (see src/auth). Reports and
 * travel requests are tagged with the signed-in student's demo identifier so
 * each account sees its own records without collecting personal information.
 */
export interface DemoStudentSession {
  id: string;
  displayName: string;
  homeVillageId: string;
  label: string;
}

export const DEMO_SESSION: DemoStudentSession = {
  id: "student-demo-01",
  displayName: "Demo Student",
  homeVillageId: "v-vittal",
  label: "Demo session · no sign-in",
};

export function useStudentSession(): DemoStudentSession {
  const { user } = useAuth();
  if (user?.role === "STUDENT") {
    return {
      id: user.id,
      displayName: user.displayName,
      homeVillageId: user.homeVillageId ?? DEMO_SESSION.homeVillageId,
      label: user.roleLabel,
    };
  }
  return DEMO_SESSION;
}
