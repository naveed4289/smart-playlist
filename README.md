# Smart Playlist Builder

React 19 + TypeScript + Tailwind + Vite. Playlists and auth live in **Supabase**. Track search uses the **Spotify Web API** via a **Supabase Edge Function** (client credentials stay server-side). **Genius** enriches tracks when added. **Google Gemini** suggests the next track with a short explanation; the same pipeline resolves a **Spotify** track id so the user can add in one click.

**Security:** Never commit Spotify, Genius, or Gemini keys to git, and never paste them in public chats or tickets. If they leak, **rotate** them in each provider’s dashboard and update Supabase secrets.

## Time & scope (fill in before submit)

- Approximate hours: ___  
- Trade-offs / cuts: ___

For the Syncopate challenge, record a **Loom** (or MP4) walkthrough after everything works, then email it per their instructions.

## Manual setup (you must do this)

1. **Supabase** — Create a project at [supabase.com](https://supabase.com).  
   - **API**: copy `Project URL` and `anon` `public` key into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.  
   - **Database tables (required — they are not created automatically):**  
     1. Supabase Dashboard → **SQL Editor** → **New query**.  
     2. Open this file in your repo: [`supabase/migrations/20250411000000_init.sql`](supabase/migrations/20250411000000_init.sql), copy **all** SQL, paste into the editor, click **Run**.  
     3. **Table Editor** should show `profiles`, `playlists`, `playlist_tracks`. If the last line errors on your Postgres version, change `execute function` to `execute procedure` on the trigger and run only that block again.  
   - **CLI (optional):** from the `playlist` folder with [Supabase CLI](https://supabase.com/docs/guides/cli) linked: `supabase db push` or run the same SQL file against the linked project.  
   - **Auth → Providers**: enable **Email**; enable **Google** and add the Client ID/Secret from Google Cloud Console; set redirect URL per [Supabase Google login docs](https://supabase.com/docs/guides/auth/social-login/auth-google).  
   - **Edge Function secrets (so functions can call Spotify / Genius / Gemini):**  
     - Dashboard: **Project Settings** (gear) → **Edge Functions** → **Secrets** (UI label may be “Manage secrets” / “Secrets”).  
     - Add each **name** exactly (case-sensitive): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `GENIUS_ACCESS_TOKEN`, `GEMINI_API_KEY` (not `GEMINI_API_KE`). Values are your provider credentials.  
     - These are **not** put in `.env.local` — only `VITE_SUPABASE_*` belongs there. Edge runtime reads secrets from Supabase automatically as `Deno.env.get('...')`.  
     - **CLI:** from a linked project: `supabase secrets set SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy ...`  
   - Deploy functions (with [Supabase CLI](https://supabase.com/docs/guides/cli)) from the machine where the repo lives, **project ref** from Supabase → Settings → General:  
     `supabase functions deploy spotify-search --project-ref YOUR_REF`  
     `supabase functions deploy genius-enrich --project-ref YOUR_REF`  
     `supabase functions deploy suggest-track --project-ref YOUR_REF`

2. **Spotify** — [developer.spotify.com](https://developer.spotify.com/dashboard): create an app; copy **Client ID** and **Client Secret** into Edge Function secrets (not the browser).

3. **Genius** — [Genius API](https://docs.genius.com): create an API client and get an **access token**; put it in `GENIUS_ACCESS_TOKEN` for the `genius-enrich` function.

4. **Gemini** — [Google AI Studio](https://aistudio.google.com/apikey): create an API key; set `GEMINI_API_KEY` for `suggest-track`. The Edge Function calls `gemini-2.0-flash`; if your key or region does not support it, change the model string in [`supabase/functions/suggest-track/index.ts`](supabase/functions/suggest-track/index.ts) (for example to `gemini-1.5-flash`).

5. **Local dev** — After functions are deployed to your project, `supabase functions invoke` is not needed locally if you use the hosted URL: the app calls `https://<ref>.supabase.co/functions/v1/...` via the JS client (same as production). For fully offline Edge dev, use `supabase start` and link the project.

6. **Submission (challenge)** — Record a short **Loom** (or MP4) walkthrough, note hours and decisions in this README, and email per the challenge instructions.

## Scripts

```bash
cd playlist
npm install
npm run dev
npm run build
```

## Architecture notes

- **No API keys in the repo** — Spotify, Genius, and Gemini secrets exist only in Supabase Edge Function environment.  
- The browser uses the **anon** key + user session; **RLS** restricts rows to `auth.uid()`.  
- **Genius** may not return full lyrics via the public API; we store description / metadata when available and show a graceful empty state.  
- Many Spotify tracks have **no `preview_url`**; preview controls disable when missing.
