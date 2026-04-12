import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type PlaylistTrackInput = {
  title: string;
  artists: string[];
  releaseDate?: string | null;
};

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

// ── Spotify helpers ────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSpotifyToken(): Promise<string> {
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

/** Search Spotify and return the first result. Uses encodeURIComponent to avoid "Invalid limit" issue. */
async function spotifySearchFirst(q: string) {
  const token = await getSpotifyToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const items = (data.tracks?.items ?? []) as SpotifyTrack[];
  return items[0] ? mapTrack(items[0]) : null;
}

// ── Gemini helpers ──────────────────────────────────────────────────────────────

const GEMINI_MODELS = [
  "gemini-1.5-flash",   // Try first — separate free-tier quota
  "gemini-2.0-flash",   // Fallback
  "gemini-1.5-flash-8b", // Lighter model, last LLM attempt
];

interface GeminiResult {
  title: string;
  artist: string;
  explanation: string;
}

async function callGemini(
  key: string,
  model: string,
  prompt: string,
): Promise<GeminiResult | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const status = (err?.error?.code as number | undefined) ?? res.status;
    // 429 = rate limited — caller should try next model
    if (status === 429) return null;
    throw new Error(`Gemini (${model}) failed: ${res.status}`);
  }
  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    json?.candidates?.[0]?.content?.parts?.[0];
  if (typeof text !== "string") return null;
  try {
    const parsed = JSON.parse(text) as Partial<GeminiResult>;
    const title = (parsed.title ?? "").trim();
    const artist = (parsed.artist ?? "").trim();
    const explanation = (parsed.explanation ?? "").trim();
    if (!title || !artist) return null;
    return { title, artist, explanation };
  } catch {
    return null;
  }
}

/** Try each model in order; return first success. Returns null if all are rate-limited. */
async function tryGeminiModels(
  key: string,
  prompt: string,
): Promise<GeminiResult | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const result = await callGemini(key, model, prompt);
      if (result) return result;
      // null = rate limited, try next model
    } catch {
      // unexpected error on this model — continue to next
    }
  }
  return null;
}

// ── Algorithmic fallback ────────────────────────────────────────────────────────
// When all LLM quotas are exhausted, suggest based on playlist signals:
// - Most frequent artist → another track by them
// - Era matching → same decade
// - Mode affects which track to pick (popular vs deep cut)

async function algorithmicSuggestion(
  tracks: PlaylistTrackInput[],
  mode: string,
): Promise<{ title: string; artist: string; explanation: string; spotifyTrack: ReturnType<typeof mapTrack> | null }> {
  const existingTitles = new Set(tracks.map((t) => t.title.toLowerCase()));

  // Count artist frequency
  const artistCounts = new Map<string, number>();
  for (const t of tracks) {
    const primary = t.artists[0];
    if (primary) artistCounts.set(primary, (artistCounts.get(primary) ?? 0) + 1);
  }

  const sorted = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return {
      title: "", artist: "", explanation: "",
      spotifyTrack: null,
    };
  }

  // Pick artist based on mode
  let targetArtist: string;
  let explanationBase: string;
  if ((mode === "deep_cuts" || mode === "adventurous") && sorted.length > 1) {
    targetArtist = sorted[1][0]; // Second most common
    explanationBase = `Based on your playlist, ${targetArtist} sounds like a great next step.`;
  } else {
    targetArtist = sorted[0][0];
    const count = sorted[0][1];
    explanationBase = `${targetArtist} appears ${count} time${count > 1 ? "s" : ""} in your playlist — here is another track you might enjoy.`;
  }

  // Search Spotify for a track by this artist, excluding what's already in the playlist
  const token = await getSpotifyToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:${targetArtist}`)}&type=track`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    return { title: targetArtist, artist: targetArtist, explanation: explanationBase, spotifyTrack: null };
  }

  const data = await res.json();
  const items = (data.tracks?.items ?? []) as SpotifyTrack[];
  const candidates = items.filter((t) => !existingTitles.has(t.name.toLowerCase()));

  if (candidates.length === 0) {
    return { title: targetArtist, artist: targetArtist, explanation: explanationBase, spotifyTrack: null };
  }

  // Deep cuts → pick from the later results (less chart-topping)
  const pick = mode === "deep_cuts" && candidates.length > 2
    ? candidates[candidates.length - 1]
    : candidates[0];

  return {
    title: pick.name,
    artist: pick.artists[0]?.name ?? targetArtist,
    explanation: explanationBase,
    spotifyTrack: mapTrack(pick),
  };
}

// ── Mode hints ──────────────────────────────────────────────────────────────────

const MODE_HINTS: Record<string, string> = {
  balanced: "Balance familiarity with light variety; mainstream but not repetitive.",
  same_genre: "Stay close to the dominant style and era implied by the playlist.",
  adventurous: "Suggest something more surprising but still plausibly enjoyable.",
  deep_cuts: "Prefer less obvious album tracks or artists slightly outside the core list.",
};

// ── Handler ─────────────────────────────────────────────────────────────────────

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

    const body = await req.json() as { tracks?: PlaylistTrackInput[]; mode?: string };
    const tracks = body.tracks ?? [];
    const mode = body.mode ?? "balanced";
    const modeHint = MODE_HINTS[mode] ?? MODE_HINTS.balanced;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    // Build playlist catalog string for the prompt
    const lines = tracks.slice(-25).map((t, i) => {
      const a = (t.artists ?? []).join(", ");
      const y = t.releaseDate ? ` (${t.releaseDate.slice(0, 4)})` : "";
      return `${i + 1}. ${t.title} — ${a}${y}`;
    });
    const catalog = lines.length
      ? lines.join("\n")
      : "(empty playlist — suggest a popular, accessible starter track)";

    const prompt =
      `You are a music recommendation assistant. Given this playlist (most recent at bottom):\n\n${catalog}\n\n` +
      `Steering: ${modeHint}\n\n` +
      `Respond with ONLY valid JSON (no markdown) in this exact shape:\n` +
      `{"title":"Track Title","artist":"Primary Artist","explanation":"1-3 sentences why this fits next."}\n` +
      `Use real, well-known recordings that exist on Spotify. No extra keys.`;

    let suggestion: GeminiResult | null = null;
    let usedFallback = false;

    // ── Try Gemini models ──
    if (geminiKey) {
      suggestion = await tryGeminiModels(geminiKey, prompt);
    }

    // ── Algorithmic fallback ──
    if (!suggestion && tracks.length > 0) {
      usedFallback = true;
      const algoResult = await algorithmicSuggestion(tracks, mode);
      if (algoResult.title && algoResult.spotifyTrack) {
        return new Response(
          JSON.stringify({
            explanation: algoResult.explanation,
            spotifyTrack: algoResult.spotifyTrack,
            usedFallback: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!suggestion) {
      return new Response(
        JSON.stringify({
          error: geminiKey
            ? "All AI models are rate-limited right now. Try again in a few minutes."
            : "GEMINI_API_KEY not configured",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Match suggestion against Spotify ──
    const query = `${suggestion.title} ${suggestion.artist}`;
    const spotifyTrack = await spotifySearchFirst(query);

    if (!spotifyTrack) {
      return new Response(
        JSON.stringify({
          explanation: suggestion.explanation,
          modelTitle: suggestion.title,
          modelArtist: suggestion.artist,
          spotifyTrack: null,
          message: "No Spotify match for the suggested track.",
          usedFallback,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ explanation: suggestion.explanation, spotifyTrack, usedFallback }),
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
