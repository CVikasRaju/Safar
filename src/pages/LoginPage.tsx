import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bus,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  DEMO_CREDENTIALS,
  ROLE_HOME,
  canAccessArea,
  type DemoRole,
} from "../auth/demoUsers";
import { cx } from "../components/ui";

const ROLE_ICON: Record<DemoRole, typeof Bus> = {
  STUDENT: GraduationCap,
  OPERATOR: ShieldCheck,
  ADMIN: UserRound,
};

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const requestedPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from;
  }, [location.state]);

  if (user) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  const completeSignIn = (event: FormEvent) => {
    event.preventDefault();
    const result = login(username, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const account = DEMO_CREDENTIALS.find(
      (entry) => entry.username.toLowerCase() === username.trim().toLowerCase(),
    );
    if (!account) return;
    const target =
      requestedPath &&
      canAccessArea(account.role, requestedPath.startsWith("/control-centre") ? "control" : "student")
        ? requestedPath
        : ROLE_HOME[account.role];
    navigate(target, { replace: true });
  };

  const useAccount = (entryUsername: string, entryPassword: string) => {
    setUsername(entryUsername);
    setPassword(entryPassword);
    setError(undefined);
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] text-ink">
      <div className="border-b border-[#d7dee6] bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 px-5 py-2 text-[11px] text-[#54657a] sm:px-8">
          <p>Government of Karnataka · Department of Transport</p>
          <p className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Demonstration environment · illustrative data
          </p>
        </div>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-37px)] max-w-[1280px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#0c2d4a] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-white/10 ring-1 ring-white/20">
                <Bus size={22} />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-[0.18em]">SAFAR</p>
                <p className="text-[11px] text-white/70">Rural student transport intelligence</p>
              </div>
            </div>

            <h1 className="mt-14 max-w-[15ch] text-4xl font-semibold leading-[1.15] tracking-tight xl:text-[2.75rem]">
              Plan the journey. Protect the school day.
            </h1>
            <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-white/75">
              A working demonstration of how village students, bus operators and the district
              control room can share one view of routes, disruptions and replacement capacity.
            </p>

            <ul className="mt-9 space-y-4 text-sm text-white/85">
              <li className="flex gap-3">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#7dd3c7]" />
                Timetable-based journey options with reliability and walking estimates.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#7dd3c7]" />
                Student reports stay unverified until an operator confirms an incident.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#7dd3c7]" />
                Fleet breakdowns produce ranked replacement recommendations, never automatic
                allocation.
              </li>
            </ul>
          </div>

          <div className="mt-10 border-t border-white/15 pt-5 text-[11px] leading-relaxed text-white/55">
            <p className="flex items-center gap-1.5">
              <MapPinned size={12} /> Puttur taluk demo network · 5 villages · routes R101–R104
            </p>
            <p className="mt-1">
              No live GPS, official timetable or personal data is used anywhere in this prototype.
            </p>
          </div>
        </section>

        <section className="flex items-start justify-center px-5 py-10 sm:px-8 lg:items-center lg:py-12">
          <div className="w-full max-w-[430px]">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#0c2d4a] text-white">
                <Bus size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[0.16em]">SAFAR</p>
                <p className="text-[11px] text-muted">Rural student transport intelligence</p>
              </div>
            </div>

            <div className="rounded-lg border border-[#d7dee6] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.06)] sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0b5394]">
                Secure demo sign-in
              </p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#14212e]">
                Sign in to SAFAR
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5a6b7b]">
                Use one of the demonstration accounts below. Choose a student account for the
                portal, or an authority account for the control centre.
              </p>

              <form className="mt-6 space-y-4" onSubmit={completeSignIn}>
                <div>
                  <label className="safar-label" htmlFor="username">
                    Username
                  </label>
                  <div className="relative">
                    <UserRound
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718296]"
                    />
                    <input
                      id="username"
                      name="username"
                      autoComplete="username"
                      className="safar-input pl-9"
                      placeholder="e.g. student"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setError(undefined);
                      }}
                      aria-invalid={Boolean(error)}
                    />
                  </div>
                </div>

                <div>
                  <label className="safar-label" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#718296]"
                    />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="safar-input pl-9 pr-10"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError(undefined);
                      }}
                      aria-invalid={Boolean(error)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#718296] hover:text-[#14212e]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-[#0b5394] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#083f71] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b5394]"
                >
                  Sign in <ArrowRight size={15} />
                </button>
              </form>

              <p className="mt-4 text-[11px] leading-relaxed text-[#6b7c8f]">
                This is a demonstration login. Authentication runs in the browser and protects no
                real data.
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-[#d7dee6] bg-white">
              <div className="border-b border-[#e3e8ee] px-4 py-3">
                <p className="text-xs font-semibold text-[#14212e]">Demonstration accounts</p>
                <p className="mt-0.5 text-[11px] text-[#6b7c8f]">
                  Select an account to fill the form, then sign in.
                </p>
              </div>
              <ul className="divide-y divide-[#e8edf2]">
                {DEMO_CREDENTIALS.map((account) => {
                  const Icon = ROLE_ICON[account.role];
                  return (
                    <li key={account.username}>
                      <button
                        type="button"
                        onClick={() => useAccount(account.username, account.password)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f6f8fa]"
                      >
                        <span
                          className={cx(
                            "grid h-8 w-8 shrink-0 place-items-center rounded",
                            account.role === "STUDENT"
                              ? "bg-[#e8f1fa] text-[#0b5394]"
                              : account.role === "OPERATOR"
                                ? "bg-[#e7f5f1] text-[#0f6b5c]"
                                : "bg-[#f1edf9] text-[#5b3f96]",
                          )}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-[#1d2b3a]">
                            {account.displayName}
                            <span className="ml-1.5 font-normal text-[#6b7c8f]">
                              · {account.roleLabel}
                            </span>
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-[#54657a]">
                            {account.username} / {account.password}
                          </span>
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0b5394]">
                          Use
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="mt-5 text-center text-[10px] leading-relaxed text-[#7a8a9b]">
              SAFAR competition prototype · All routes, timings and demand figures are illustrative.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
