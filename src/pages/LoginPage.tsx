import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { SupabaseSetupNotice } from "../components/SupabaseSetupNotice";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

const inputCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15";

const labelCls = "block text-sm font-medium text-slate-700";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (!authLoading && session) navigate(from, { replace: true });
  }, [authLoading, session, navigate, from]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    navigate(from, { replace: true });
  }

  async function google() {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (err) setError(err.message);
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <AuthShell title="Welcome back" subtitle="Configure Supabase to continue.">
        <SupabaseSetupNotice />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          No account?{" "}
          <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            Sign up for free
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label className={labelCls} htmlFor="email">Email</label>
          <input
            id="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="password">Password</label>
          <input
            id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/40 transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Signing in…
            </span>
          ) : (
            "Log in"
          )}
        </button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium uppercase tracking-widest text-slate-400">
            or
          </span>
        </div>
      </div>

      <GoogleSignInButton disabled={loading} onClick={() => void google()} />
    </AuthShell>
  );
}
