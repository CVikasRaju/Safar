import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet } from "react-router-dom";
import { accountByUsername, authenticate, type DemoAccount } from "./demoUsers";

const SESSION_KEY = "safar-demo-auth-v1";

interface AuthValue {
  user: DemoAccount | null;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function restoreSession(): DemoAccount | null {
  try {
    const username = window.sessionStorage.getItem(SESSION_KEY);
    return username ? accountByUsername(username) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoAccount | null>(restoreSession);

  const login = useCallback((username: string, password: string) => {
    if (!username.trim() || !password) {
      return { ok: false, error: "Enter both your username and password." };
    }
    const account = authenticate(username, password);
    if (!account) {
      return { ok: false, error: "Those credentials do not match a demo account." };
    }
    setUser(account);
    try {
      window.sessionStorage.setItem(SESSION_KEY, account.username);
    } catch {
      // Session storage can be blocked; the in-memory session still works.
    }
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore.
    }
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}

/** Blocks unauthenticated access and returns the user to the sign-in screen. */
export function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
