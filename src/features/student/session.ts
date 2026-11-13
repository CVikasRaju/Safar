/**
 * Demo student session.
 *
 * The prototype has no authentication (docs/01). Reports and travel requests
 * are tagged with a clearly labelled demo session identifier so the Student
 * Portal can show "my" records without collecting personal information.
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
  return DEMO_SESSION;
}
