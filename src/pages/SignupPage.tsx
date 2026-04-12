import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { SupabaseSetupNotice } from "../components/SupabaseSetupNotice";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

const inputCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15";

const labelCls = "block text-sm font-medium text-slate-700";

export function SignupPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && session) navigate("/", { replace: true });
  }, [authLoading, session, navigate]);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() || undefined } },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (data.session) { navigate("/", { replace: true }); return; }
    setMessage("Check your email to confirm your account, then log in.");
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
      <AuthShell title="Create an account" subtitle="Configure Supabase to continue.">
        <SupabaseSetupNotice />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label className={labelCls} htmlFor="username">Username</label>
          <input
            id="username" type="text" autoComplete="username" required
            value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="yourname"
            className={inputCls}
          />
        </div>
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
            id="password" type="password" autoComplete="new-password" required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className={inputCls}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-700">{message}</p>
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
              Creating account…
            </span>
          ) : (
            "Create account"
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
