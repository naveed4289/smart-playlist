import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

// Patterns that indicate a translation / annotation page — not the original track
const TRANSLATION_MARKERS = [
  "turkce", "ceviri", "traduccion", "traducao", "traduction",
  "testo", "ubersetzung", "letras", "traduzione", "перевод",
  "cevirisi", "ceviriler", "traduc", "annotated",
];

function isOriginalTrack(result: { url?: string; title?: string }): boolean {
  const url = (result.url ?? "").toLowerCase();
  const title = (result.title ?? "").toLowerCase();
  return !TRANSLATION_MARKERS.some((m) => url.includes(m) || title.includes(m));
}

/** Returns true when the Genius primary_artist name seems to match the expected artist. */
function artistMatches(geniusArtist: string | undefined, expected: string | undefined): boolean {
  if (!expected || !geniusArtist) return true; // can't compare → assume ok
  // normalise: lowercase, strip special chars (handles D!VINE → dvine, DIVINE → divine)
  const normalise = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const g = normalise(geniusArtist);
  const e = normalise(expected);
  if (!g || !e) return true;
  // direct substring match
  if (g.includes(e) || e.includes(g)) return true;
  // word-level overlap: at least one meaningful word in common
  const gWords = new Set(g.split(/\s+/).filter((w) => w.length > 1));
  const eWords = e.split(/\s+/).filter((w) => w.length > 1);
  if (eWords.some((w) => gWords.has(w))) return true;
  // prefix match: first 4 chars in common (catches abbreviations / stagenames)
  const gPrefix = g.replace(/\s+/g, "").slice(0, 4);
  const ePrefix = e.replace(/\s+/g, "").slice(0, 4);
  return gPrefix.length >= 3 && gPrefix === ePrefix;
}

function extractPlainDescription(song: Record<string, unknown>): string | null {
  const plain = (song?.description as Record<string, unknown> | null)?.plain;
  if (typeof plain === "string" && plain.trim() && plain.trim() !== "?") {
    return plain.trim();
  }
  const preview = song?.description_preview;
  if (typeof preview === "string" && preview.trim() && preview.trim() !== "?") {
    return preview.trim();
  }
  return null;
}

function buildMetadataDescription(song: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (typeof song?.artist_names === "string" && song.artist_names) {
    parts.push(`By ${song.artist_names}`);
  }
  const album = song?.album as Record<string, unknown> | null;
  if (typeof album?.name === "string" && album.name) {
    parts.push(`Album: "${album.name}"`);
  }
  const releaseDate = song?.release_date_for_display ?? song?.release_date;
  if (typeof releaseDate === "string" && releaseDate) {
    parts.push(`Released: ${releaseDate}`);
  }
  const pageviews = (song?.stats as Record<string, unknown> | null)?.pageviews;
  if (typeof pageviews === "number" && pageviews > 0) {
    parts.push(`${pageviews.toLocaleString("en-US")} views on Genius`);
  }
  return parts.length > 0 ? parts.join("  ·  ") : null;
}

type Annotation = {
  fragment: string;
  annotation: string;
  votes: number;
};

async function fetchAnnotations(token: string, songId: number): Promise<Annotation[]> {
  try {
    const res = await fetch(
      `https://api.genius.com/referents?song_id=${songId}&text_format=plain&per_page=20`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const referents = (json?.response?.referents ?? []) as Array<{
      fragment?: string;
      annotations?: Array<{
        body?: { plain?: string };
        votes_total?: number;
      }>;
    }>;

    const results: Annotation[] = [];
    for (const ref of referents) {
      const fragment = (ref.fragment ?? "").trim();
      if (!fragment) continue;
      const best = (ref.annotations ?? [])
        .filter((a) => {
          const text = a.body?.plain?.trim() ?? "";
          return text && text !== "?" && text.length > 10;
        })
        .sort((a, b) => (b.votes_total ?? 0) - (a.votes_total ?? 0))[0];
      if (best) {
        results.push({
          fragment,
          annotation: (best.body?.plain ?? "").trim(),
          votes: best.votes_total ?? 0,
        });
      }
    }
    return results.sort((a, b) => b.votes - a.votes).slice(0, 3);
  } catch {
    return [];
  }
}

type GeniusHit = { url?: string; title?: string; id?: number; artist?: string };

/** Search Genius for a query and return ranked hits with artist field included. */
async function searchGenius(token: string, q: string): Promise<GeniusHit[]> {
  const res = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return ((json?.response?.hits ?? []) as Array<{ result?: unknown }>)
    .map((h) => h.result)
    .filter(
      (r): r is { url?: string; title?: string; id?: number; primary_artist?: { name?: string } } =>
        typeof r === "object" && r !== null && "id" in r,
    )
    .map((r) => ({
      url: r.url,
      title: r.title,
      id: r.id,
      artist: r.primary_artist?.name,
    }));
}

/** Pick the single best hit from a list of candidates, preferring original + matching artist. */
function pickBestHit(hits: GeniusHit[], expectedArtist: string | undefined): GeniusHit | null {
  if (!hits.length) return null;
  // Priority order:
  // 1. Original track whose artist matches
  const p1 = hits.find((h) => isOriginalTrack(h) && artistMatches(h.artist, expectedArtist));
  if (p1) return p1;
  // 2. Any hit whose artist matches (even if it looks like a remix page)
  const p2 = hits.find((h) => artistMatches(h.artist, expectedArtist));
  if (p2) return p2;
  // 3. First original track (ignore artist)
  const p3 = hits.find((h) => isOriginalTrack(h));
  if (p3) return p3;
  // 4. First hit at all
  return hits[0];
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

    const { title, artist } = await req.json() as { title?: string; artist?: string };
    if (!title?.trim()) {
      return new Response(JSON.stringify({ error: "Missing title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("GENIUS_ACCESS_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ geniusSongId: null, geniusDescription: null, geniusUrl: null, geniusAnnotations: [], skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Multi-strategy search: try several queries and pick the best result overall ──
    const queries = [
      [artist?.trim(), title.trim()].filter(Boolean).join(" "),  // "artist title"
      title.trim(),                                               // "title" only
    ].filter((q, i, arr) => q && arr.indexOf(q) === i);         // deduplicate

    let allCandidates: GeniusHit[] = [];
    for (const q of queries) {
      const results = await searchGenius(token, q);
      allCandidates = [...allCandidates, ...results];
    }

    const bestHit = pickBestHit(allCandidates, artist);

    if (!bestHit?.id) {
      return new Response(
        JSON.stringify({ geniusSongId: null, geniusDescription: null, geniusUrl: null, geniusAnnotations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const songId = bestHit.id as number;

    // ── Fetch song detail + annotations in parallel ──
    const [songRes, annotations] = await Promise.all([
      fetch(`https://api.genius.com/songs/${songId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetchAnnotations(token, songId),
    ]);

    let description: string | null = null;
    let url: string | null = (bestHit.url as string | null) ?? null;

    if (songRes.ok) {
      const songJson = await songRes.json();
      const song = songJson?.response?.song as Record<string, unknown> | null;
      if (song) {
        url = (song.url as string | null) ?? url;
        description = extractPlainDescription(song) ?? buildMetadataDescription(song);
      }
    }

    return new Response(
      JSON.stringify({
        geniusSongId: String(songId),
        geniusDescription: description,
        geniusUrl: url,
        geniusAnnotations: annotations,
      }),
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
