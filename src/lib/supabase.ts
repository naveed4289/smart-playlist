import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** True when real project URL and anon key are set in `.env.local`. */
export const isSupabaseConfigured = Boolean(url && anon);

/**
 * When env is missing, `@supabase/supabase-js` still requires non-empty URL/key
 * or it throws on import. We use inert placeholders and disable auth persistence;
 * `AuthProvider` and login/signup pages avoid calling the network until configured.
 */
const clientUrl = isSupabaseConfigured ? url! : "https://placeholder.supabase.co";
const clientKey = isSupabaseConfigured
  ? anon!
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.not-configured";

if (!isSupabaseConfigured) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — add `.env.local` (see README). Auth and persistence stay offline until then.",
  );
}

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
  },
});
