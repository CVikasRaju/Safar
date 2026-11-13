/**
 * Demo-only accounts.
 *
 * SAFAR has no server, so these credentials are intentionally public and are
 * printed on the sign-in screen. They grant access to illustrated demo data
 * only and must never be treated as real authentication. A production system
 * would replace this file with a server-verified identity provider.
 */

export type DemoRole = "STUDENT" | "OPERATOR" | "ADMIN";

export interface DemoAccount {
  id: string;
  username: string;
  displayName: string;
  role: DemoRole;
  roleLabel: string;
  /** Only students have a home village used to prefill journey searches. */
  homeVillageId?: string;
  description: string;
}

interface DemoCredential extends DemoAccount {
  password: string;
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    id: "student-demo-01",
    username: "student",
    password: "student123",
    displayName: "Ananya Rao",
    role: "STUDENT",
    roleLabel: "Student · Vittal",
    homeVillageId: "v-vittal",
    description: "Student portal, journey planning, reports and alerts.",
  },
  {
    id: "student-demo-02",
    username: "student2",
    password: "student123",
    displayName: "Rahul Shetty",
    role: "STUDENT",
    roleLabel: "Student · Sullia",
    homeVillageId: "v-sullia",
    description: "A second student account with its own reports and travel plans.",
  },
  {
    id: "operator-demo-01",
    username: "operator",
    password: "control123",
    displayName: "Priya Nair",
    role: "OPERATOR",
    roleLabel: "Control room operator",
    description: "Fleet operations, reports, events, demand, reliability and allocation.",
  },
  {
    id: "admin-demo-01",
    username: "admin",
    password: "admin123",
    displayName: "Vikram Raju",
    role: "ADMIN",
    roleLabel: "Administrator",
    description: "Full access to both the student portal and the control centre.",
  },
];

export const ROLE_HOME: Record<DemoRole, string> = {
  STUDENT: "/student",
  OPERATOR: "/control-centre",
  ADMIN: "/control-centre",
};

export function accountByUsername(username: string): DemoAccount | null {
  const match = DEMO_CREDENTIALS.find(
    (account) => account.username.toLowerCase() === username.trim().toLowerCase(),
  );
  if (!match) return null;
  const { password: _password, ...account } = match;
  return account;
}

export function authenticate(username: string, password: string): DemoAccount | null {
  const match = DEMO_CREDENTIALS.find(
    (account) =>
      account.username.toLowerCase() === username.trim().toLowerCase() &&
      account.password === password,
  );
  if (!match) return null;
  const { password: _password, ...account } = match;
  return account;
}

export function canAccessArea(role: DemoRole, area: "student" | "control"): boolean {
  if (role === "ADMIN") return true;
  return area === "student" ? role === "STUDENT" : role === "OPERATOR";
}
