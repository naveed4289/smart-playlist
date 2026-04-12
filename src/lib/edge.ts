import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type SpotifyTrackDTO = {
  id: string;
  name: string;
  artists: string[];
  album: string;
  imageUrl: string | null;
  durationMs: number;
  releaseDate: string | null;
  previewUrl: string | null;
};

async function parseFunctionsFailure(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response | undefined;
    if (res && typeof res.text === "function") {
      try {
        const text = await res.clone().text();
        if (text) {
          try {
            const j = JSON.parse(text) as { error?: string; message?: string };
            const detail = j.error ?? j.message;
            if (detail) return `${res.status}: ${detail}`;
          } catch {
            /* not JSON */
          }
          return `${res.status}: ${text.slice(0, 280)}`;
        }
        return `${res.status} (empty body)`;
      } catch {
        return `${res.status}: ${error.message}`;
      }
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Invokes Edge Function with current user JWT (avoids stale / missing Authorization). */
async function invokeEdge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionErr || !token) {
    throw new Error("Please log in again — session missing or expired.");
  }

  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    throw new Error(await parseFunctionsFailure(error));
  }
  return data as T;
}

export async function searchSpotifyTracks(q: string): Promise<SpotifyTrackDTO[]> {
  const data = await invokeEdge<{ tracks?: SpotifyTrackDTO[]; error?: string }>(
    "spotify-search",
    { q },
  );
  if (data?.error) throw new Error(data.error);
  return data?.tracks ?? [];
}

/** Fetch a single Spotify track by its ID (used to patch missing preview_url). */
export async function fetchSpotifyTrackById(id: string): Promise<SpotifyTrackDTO | null> {
  try {
    const data = await invokeEdge<{ track?: SpotifyTrackDTO | null }>(
      "spotify-search",
      { id },
    );
    return data?.track ?? null;
  } catch {
    return null;
  }
}

/** Parse a Spotify playlist ID from a full URL or bare ID. */
export function parseSpotifyPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  // Already a bare ID (22 alphanumeric chars)
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  // URL: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?...
  const match = trimmed.match(/playlist\/([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

/** Fetch all tracks from a Spotify playlist by its ID. */
export async function fetchSpotifyPlaylistTracks(playlistId: string): Promise<SpotifyTrackDTO[]> {
  const data = await invokeEdge<{ tracks?: SpotifyTrackDTO[]; error?: string }>(
    "spotify-search",
    { playlistId },
  );
  if (data?.error) throw new Error(data.error);
  return data?.tracks ?? [];
}

export type GeniusAnnotation = {
  fragment: string;
  annotation: string;
  votes: number;
};

export type GeniusEnrichResult = {
  geniusSongId: string | null;
  geniusDescription: string | null;
  geniusUrl: string | null;
  geniusAnnotations?: GeniusAnnotation[];
  skipped?: boolean;
};

export async function enrichGenius(
  title: string,
  artist: string,
): Promise<GeniusEnrichResult> {
  return invokeEdge<GeniusEnrichResult>("genius-enrich", { title, artist });
}

export type SuggestionMode =
  | "balanced"
  | "same_genre"
  | "adventurous"
  | "deep_cuts";

export type SuggestTrackResponse = {
  explanation: string;
  spotifyTrack: SpotifyTrackDTO | null;
  modelTitle?: string;
  modelArtist?: string;
  message?: string;
  error?: string;
  usedFallback?: boolean;
};

export async function suggestNextTrack(
  tracks: {
    title: string;
    artists: string[];
    releaseDate?: string | null;
  }[],
  mode: SuggestionMode,
): Promise<SuggestTrackResponse> {
  const data = await invokeEdge<SuggestTrackResponse>("suggest-track", {
    tracks,
    mode,
  });
  if (data?.error) throw new Error(data.error);
  return data ?? { explanation: "", spotifyTrack: null };
}
