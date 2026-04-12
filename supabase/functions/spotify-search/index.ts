import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[]; release_date?: string };
  duration_ms: number;
  preview_url: string | null;
};

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null as null, error: "Missing Authorization" };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null as null, error: "Unauthorized" };
  return { user, error: null as null };
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getClientCredentialsToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30_000) return cachedToken;
  const id = Deno.env.get("SPOTIFY_CLIENT_ID");
  const secret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Spotify credentials not configured");
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const basic = btoa(`${id}:${secret}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify token failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  return cachedToken!;
}

function mapTrack(t: SpotifyTrack) {
  const img =
    t.album?.images?.find((i) => i.url)?.url ??
    t.album?.images?.[0]?.url ??
    null;
  return {
    id: t.id,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name),
    album: t.album?.name ?? "",
    imageUrl: img,
    durationMs: t.duration_ms,
    releaseDate: t.album?.release_date ?? null,
    previewUrl: t.preview_url,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { user, error: authErr } = await requireUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: authErr }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { q?: string; id?: string; playlistId?: string };
    const token = await getClientCredentialsToken();

    // ── Fetch all tracks from a Spotify playlist ──
    if (body.playlistId) {
      const playlistId = body.playlistId.trim();
      const tracks: ReturnType<typeof mapTrack>[] = [];
      let offset = 0;
      const limit = 100;
      // Fetch up to 500 tracks (5 pages)
      while (offset < 500) {
        const res = await fetch(
          `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists,album,duration_ms,preview_url)),next`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const t = await res.text();
          return new Response(JSON.stringify({ error: `Spotify playlist fetch failed: ${t}` }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const page = await res.json() as { items: { track: SpotifyTrack | null }[]; next: string | null };
        for (const item of page.items ?? []) {
          if (item.track?.id) tracks.push(mapTrack(item.track));
        }
        if (!page.next) break;
        offset += limit;
      }
      return new Response(
        JSON.stringify({ tracks }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Single track lookup by Spotify ID ──
    if (body.id) {
      const res = await fetch(
        `https://api.spotify.com/v1/tracks/${encodeURIComponent(body.id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        return new Response(JSON.stringify({ track: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const track = await res.json() as SpotifyTrack;
      return new Response(
        JSON.stringify({ track: mapTrack(track) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Search by query ──
    const { q } = body;
    if (!q || typeof q !== "string" || !q.trim()) {
      return new Response(JSON.stringify({ error: "Missing q or id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q.trim())}&type=track`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `Spotify search failed: ${t}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const items = (data.tracks?.items ?? []) as SpotifyTrack[];
    return new Response(
      JSON.stringify({ tracks: items.map(mapTrack) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
