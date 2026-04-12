import { useEffect, useRef, useState } from "react";
import { suggestNextTrack, type SpotifyTrackDTO, type SuggestionMode } from "../../lib/edge";
import type { PlaylistTrackRow } from "../../types/models";
import { formatDurationMs } from "../../lib/format";

type Props = {
  tracks: PlaylistTrackRow[];
  onAddSuggested: (track: SpotifyTrackDTO) => void;
  existingIds: Set<string>;
  disabled?: boolean;
};

const MODES: { key: SuggestionMode; label: string }[] = [
  { key: "balanced",    label: "Balanced"    },
  { key: "same_genre",  label: "Stay in vibe" },
  { key: "adventurous", label: "Adventurous"  },
  { key: "deep_cuts",   label: "Deep cuts"    },
];

const MODE_DESC: Record<SuggestionMode, string> = {
  balanced:    "Familiar but fresh",
  same_genre:  "Close to current style",
  adventurous: "Something surprising",
  deep_cuts:   "Less obvious tracks",
};

export function SuggestionPanel({ tracks, onAddSuggested, existingIds, disabled }: Props) {
  const [mode, setMode] = useState<SuggestionMode>("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SpotifyTrackDTO | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function refresh() {
    setError(null);
    setLoading(true);
    setSuggested(null);
    setExplanation(null);
    setPreviewOn(false);
    try {
      const payload = tracks.map((t) => ({
        title: t.title,
        artists: t.artists ?? [],
        releaseDate: t.release_date,
      }));
      const res = await suggestNextTrack(payload, mode);
      setExplanation(res.explanation || null);
      setSuggested(res.spotifyTrack ?? null);
      if (!res.spotifyTrack && res.message) setError(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setLoading(false);
    }
  }

  const inList = suggested ? existingIds.has(suggested.id) : false;

  useEffect(() => {
    if (!previewOn || !suggested?.previewUrl) return;
    const el = audioRef.current;
    if (!el) return;
    void el.play().catch(() => {});
  }, [previewOn, suggested?.previewUrl]);

  function togglePreview() {
    if (!suggested?.previewUrl) return;
    setPreviewOn((v) => { if (v) audioRef.current?.pause(); return !v; });
  }

  return (
    <div className="flex flex-col border-b border-slate-100">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-100">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">AI Suggestions</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          Analyzes your playlist and recommends the perfect next track.
        </p>
      </div>

      {/* Mode selector */}
      <div className="px-4 py-2.5 border-b border-slate-100">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
          Suggestion mode
        </p>
        <div className="grid grid-cols-2 gap-1">
          {MODES.map(({ key, label }) => (
            <button
              key={key} type="button"
              disabled={loading || disabled}
              onClick={() => setMode(key)}
              className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                mode === key
                  ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-400 italic">{MODE_DESC[mode]}</p>

        <button
          type="button"
          disabled={disabled || loading || tracks.length === 0}
          onClick={() => void refresh()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Thinking…
            </>
          ) : (
            "✦ Suggest next track"
          )}
        </button>

        {tracks.length === 0 && !loading && (
          <p className="mt-1.5 text-center text-[10px] text-slate-400">Add tracks first.</p>
        )}
      </div>

      {/* Result area */}
      <div className="px-4 py-3">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 mb-2">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {explanation && (
          <div className="mb-2.5 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">Why this track</p>
            <p className="text-[11px] leading-relaxed text-indigo-900/80">{explanation}</p>
          </div>
        )}

        {suggested ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Compact horizontal card: art + info side by side */}
            <div className="flex gap-3 p-3">
              {/* Album art */}
              <div className="relative shrink-0">
                {suggested.imageUrl ? (
                  <img src={suggested.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover shadow-sm" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-2xl text-slate-300">♫</div>
                )}
                {suggested.previewUrl && (
                  <button
                    type="button" onClick={togglePreview}
                    className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-transform hover:scale-110"
                  >
                    <span className="text-[10px]">{previewOn ? "⏸" : "▶"}</span>
                  </button>
                )}
              </div>

              {/* Track info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 leading-tight">{suggested.name}</p>
                <p className="truncate mt-0.5 text-[11px] text-slate-500">{suggested.artists.join(", ")}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {formatDurationMs(suggested.durationMs)}
                  {suggested.releaseDate ? ` · ${suggested.releaseDate.slice(0, 4)}` : ""}
                </p>
                {!suggested.previewUrl && (
                  <p className="mt-0.5 text-[9px] text-slate-400">No preview</p>
                )}
              </div>
            </div>

            {/* Preview audio player */}
            {previewOn && suggested.previewUrl && (
              <div className="border-t border-slate-100 px-3 py-2">
                <audio ref={audioRef} controls className="h-8 w-full rounded-lg" src={suggested.previewUrl}>
                  <track kind="captions" />
                </audio>
              </div>
            )}

            {/* Add button */}
            <div className="border-t border-slate-100 p-3">
              <button
                type="button"
                disabled={disabled || inList}
                onClick={() => onAddSuggested(suggested)}
                className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition"
              >
                {inList ? "Already in playlist ✓" : "+ Add to playlist"}
              </button>
            </div>
          </div>
        ) : !loading && !error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-lg text-indigo-400">✦</div>
            <p className="mt-2.5 text-xs font-medium text-slate-500">No suggestion yet</p>
            <p className="mt-0.5 text-[10px] text-slate-400">Click "Suggest next track" above.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
