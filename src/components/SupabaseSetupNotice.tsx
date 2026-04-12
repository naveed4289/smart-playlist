/**
 * Shown when the app loads without Vite env vars for Supabase.
 */
export function SupabaseSetupNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-base font-semibold text-amber-900">Supabase is not configured</h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
        Copy <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">.env.example</code> to{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">.env.local</code> in the{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">playlist</code> folder and set{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>{" "}
        from Supabase → Settings → API. Restart{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">npm run dev</code>.
      </p>
      <p className="mt-2 text-sm text-amber-900/85">
        Edge Function secrets (Spotify, Genius, Gemini) go in the Supabase Dashboard — see{" "}
        <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">README.md</code>.
      </p>
    </div>
  );
}
