import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/context/auth";
import { authenticate } from "@/services/workspace";
import { errorMessage } from "@/utils/api";
import { Brand, ErrorState, Loading } from "@/components/common";
import { Button } from "@/components/ui/button";

export default function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("admin");
  if (auth.loading)
    return (
      <main className="boot-screen">
        <Loading />
      </main>
    );
  if (auth.user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const body = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    if (register && body.password !== body.confirmPassword) {
      setError("Your passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const session = await authenticate(register ? "register" : "login", {
        ...body,
        ...(register ? { role: mode } : {}),
      });
      auth.accept(session);
      navigate(auth.notice ? "/" : location.state?.from || "/", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div className="auth-statement">
          <span className="eyebrow">FROM INTENT TO DONE</span>
          <h1>
            Good work deserves
            <br />a clear finish.
          </h1>
          <p>
            One shared place to plan, execute, and verify.
            <br />
            Less chasing. More moving forward.
          </p>
          <div className="auth-workflow">
            <span>
              <i />
              Plan
            </span>
            <b>—</b>
            <span>
              <i />
              Execute
            </span>
            <b>—</b>
            <span>
              <Check size={13} />
              Verify
            </span>
          </div>
        </div>
        <div className="auth-footnote">
          Built around accountability. Designed for focus.
        </div>
      </aside>
      <main className="auth-form-pane">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h2>{register ? "Make room for great work." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create a workspace or join your team."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit} className="form-stack">
            {!register && auth.notice && <p className="success-notice" role="status">{auth.notice}</p>}
            {register && (
              <>
                <div className="segmented" aria-label="Registration type">
                  <button
                    type="button"
                    aria-pressed={mode === "admin"}
                    onClick={() => setMode("admin")}
                  >
                    Create workspace
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === "teammate"}
                    onClick={() => setMode("teammate")}
                  >
                    Join team
                  </button>
                </div>
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={80}
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@company.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                aria-label="Password"
                name="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 10 : undefined}
                maxLength={72}
              />
              {register && <small>At least 10 characters.</small>}
            </label>
            {register && (
              <>
                <label>
                  Confirm password
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    maxLength={72}
                  />
                </label>
                {mode === "admin" ? (
                  <label>
                    Workspace name
                    <input
                      name="orgName"
                      required
                      maxLength={100}
                      placeholder="Your team or company"
                    />
                  </label>
                ) : (
                  <label>
                    Invite code
                    <input
                      name="inviteCode"
                      required
                      maxLength={100}
                      placeholder="Ask your workspace admin"
                    />
                    <small>
                      You’ll join as a teammate. Your admin manages roles.
                    </small>
                  </label>
                )}
              </>
            )}
            {error && <ErrorState message={error} />}
            <Button type="submit" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              <ArrowRight size={15} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to StackFlow?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
        <div className="auth-bottom">STACKFLOW / WORK, FOLLOWED THROUGH.</div>
      </main>
    </div>
  );
}
