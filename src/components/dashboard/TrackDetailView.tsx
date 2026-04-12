import { useEffect, useRef, useState } from "react";
import { HiOutlineRefresh, HiOutlineChevronLeft } from "react-icons/hi";
import type { GeniusAnnotation, PlaylistTrackRow } from "../../types/models";
import { formatDurationMs } from "../../lib/format";

type Props = {
  track: PlaylistTrackRow;
  onBack: () => void;
  onPlayTrack: (track: PlaylistTrackRow) => void;
  nowPlayingId?: string | null;
  onReEnrich?: (id: string, title: string, artist: string) => void;
};

export function TrackDetailView({ track, onBack, onPlayTrack, nowPlayingId, onReEnrich }: Props) {
  const [enriching, setEnriching] = useState(false);
  const lastFetchedId = useRef<string | null>(null);

  // Auto-fetch Genius on first open if no data
  useEffect(() => {
    if (!onReEnrich) return;
    if (lastFetchedId.current === track.id) return;
    if (track.genius_song_id || track.genius_description || track.genius_url) return;
    lastFetchedId.current = track.id;
    setEnriching(true);
    Promise.resolve(onReEnrich(track.id, track.title, track.artists?.[0] ?? "")).finally(() =>
      setEnriching(false),
    );
  }, [track, onReEnrich]);

  function handleRefresh() {
    if (!onReEnrich) return;
    setEnriching(true);
    Promise.resolve(onReEnrich(track.id, track.title, track.artists?.[0] ?? "")).finally(() =>
      setEnriching(false),
    );
  }

  const desc = track.genius_description;
  const annotations = (track.genius_annotations as GeniusAnnotation[] | null) ?? [];
  const isPlaying = nowPlayingId === track.id;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">

      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
        >
          <HiOutlineChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-slate-200">|</span>
        <p className="truncate text-sm font-bold text-slate-700">{track.title}</p>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Hero section */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-6">
          <div className="flex gap-5">
            {/* Album art */}
            {track.image_url ? (
              <img
                src={track.image_url}
                alt=""
                className="h-32 w-32 shrink-0 rounded-2xl object-cover shadow-lg ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-300 text-4xl shadow">
                ♫
              </div>
            )}

            {/* Info */}
            <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
              <p className="text-xl font-bold text-slate-900 leading-tight line-clamp-2">{track.title}</p>
              <p className="text-base text-slate-500 font-medium truncate">
                {(track.artists ?? []).join(", ")}
              </p>
              <p className="text-sm text-slate-400">
                {track.album && <span>{track.album}</span>}
                {track.release_date && <span>{track.album ? " · " : ""}{track.release_date.slice(0, 4)}</span>}
                {track.duration_ms && <span> · {formatDurationMs(track.duration_ms)}</span>}
              </p>

              {/* Action buttons */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onPlayTrack(track)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition shadow-sm ${
                    isPlaying
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="5" y="4" width="4" height="16" rx="1" />
                        <rect x="15" y="4" width="4" height="16" rx="1" />
                      </svg>
                      Now playing
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Play
                    </>
                  )}
                </button>

              </div>
            </div>
          </div>
        </div>

        {/* Genius section */}
        <div className="px-6 py-5 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">G</span>
              <p className="text-sm font-bold text-slate-800">Genius Insights</p>
              {enriching && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              )}
            </div>
            {onReEnrich && (
              <button
                type="button"
                disabled={enriching}
                onClick={handleRefresh}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 transition"
              >
                <HiOutlineRefresh className={`h-3.5 w-3.5 ${enriching ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {/* About */}
          {desc && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">About this song</p>
              <p className="text-sm leading-relaxed text-slate-600">{desc}</p>
            </div>
          )}

          {/* Lyric annotations */}
          {annotations.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Lyric Highlights</p>
              <div className="space-y-3">
                {annotations.map((ann, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                    <div className="border-l-[3px] border-amber-400 bg-amber-50/60 px-4 py-2.5">
                      <p className="text-sm font-semibold italic text-slate-700">"{ann.fragment}"</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm leading-relaxed text-slate-500">
                        {ann.annotation.slice(0, 300)}{ann.annotation.length > 300 ? "…" : ""}
                      </p>
                      {ann.votes > 0 && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-500">▲ {ann.votes.toLocaleString()} upvotes</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!enriching && !desc && annotations.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-400">No Genius data found.</p>
              <p className="mt-0.5 text-xs text-slate-400">Click Refresh to try again.</p>
            </div>
          )}

          {/* Full lyrics */}
          {track.genius_url && (
            <a
              href={track.genius_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-white">G</span>
              View full lyrics on Genius
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
