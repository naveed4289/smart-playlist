import { useEffect, useRef, useState } from "react";
import { HiOutlineRefresh, HiOutlineX } from "react-icons/hi";
import type { GeniusAnnotation, PlaylistTrackRow } from "../../types/models";
import { formatDurationMs } from "../../lib/format";

type Props = {
  track: PlaylistTrackRow | null;
  onClose: () => void;
  onReEnrich?: (id: string, title: string, artist: string) => void;
};

export function TrackDetailPanel({ track, onClose, onReEnrich }: Props) {
  const [enriching, setEnriching] = useState(false);
  const lastFetchedId = useRef<string | null>(null);

  useEffect(() => {
    if (!track || !onReEnrich) return;
    if (lastFetchedId.current === track.id) return;
    if (track.genius_song_id || track.genius_description || track.genius_url) return;
    lastFetchedId.current = track.id;
    setEnriching(true);
    Promise.resolve(onReEnrich(track.id, track.title, track.artists?.[0] ?? "")).finally(() => {
      setEnriching(false);
    });
  }, [track, onReEnrich]);

  function handleRefresh() {
    if (!track || !onReEnrich) return;
    setEnriching(true);
    Promise.resolve(onReEnrich(track.id, track.title, track.artists?.[0] ?? "")).finally(() => {
      setEnriching(false);
    });
  }

  const desc = track?.genius_description;
  const annotations = (track?.genius_annotations as GeniusAnnotation[] | null) ?? [];

  return (
    <>
      {/* Backdrop */}
      {track && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-[57px] bottom-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          track ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {track && (
          <>
            {/* ── Panel Header ── */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Track Details</p>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <HiOutlineX className="h-4 w-4" />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* Hero: album art + info */}
              <div className="bg-linear-to-b from-indigo-50 to-white px-5 pt-5 pb-4">
                <div className="flex gap-4">
                  {track.image_url ? (
                    <img
                      src={track.image_url}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-xl object-cover shadow-lg"
                    />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-300 text-3xl shadow">
                      ♫
                    </div>
                  )}
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-base font-bold text-slate-900 leading-tight line-clamp-2">
                      {track.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 truncate">
                      {(track.artists ?? []).join(", ")}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {track.release_date?.slice(0, 4)}
                      {track.duration_ms ? ` · ${formatDurationMs(track.duration_ms)}` : ""}
                    </p>
                    <a
                      href={`https://open.spotify.com/track/${track.spotify_track_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1DB954] px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-[#1aa34a] transition"
                    >
                      {/* Spotify icon */}
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                      Open in Spotify
                    </a>
                  </div>
                </div>
              </div>

              {/* Genius section */}
              <div className="px-5 py-4 space-y-4">

                {/* Section header with refresh */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-white">G</span>
                    <p className="text-xs font-bold text-slate-700">Genius Insights</p>
                    {enriching && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    )}
                  </div>
                  {onReEnrich && (
                    <button
                      type="button"
                      disabled={enriching}
                      onClick={handleRefresh}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 transition"
                    >
                      <HiOutlineRefresh className={`h-3 w-3 ${enriching ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  )}
                </div>

                {/* Description */}
                {desc && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">About this song</p>
                    <p className="text-sm leading-relaxed text-slate-600">{desc}</p>
                  </div>
                )}

                {/* Annotations */}
                {annotations.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Lyric Highlights</p>
                    <div className="space-y-3">
                      {annotations.slice(0, 4).map((ann, i) => (
                        <div key={i} className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                          <div className="border-l-[3px] border-amber-400 bg-amber-50/60 px-3 py-2">
                            <p className="text-xs font-semibold italic text-slate-700">"{ann.fragment}"</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed text-slate-500">
                              {ann.annotation.slice(0, 260)}{ann.annotation.length > 260 ? "…" : ""}
                            </p>
                            {ann.votes > 0 && (
                              <p className="mt-1 text-[10px] font-semibold text-amber-500">
                                ▲ {ann.votes.toLocaleString()} upvotes
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!enriching && !desc && annotations.length === 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-slate-400">No Genius data available.</p>
                    <p className="mt-0.5 text-xs text-slate-400">Try clicking Refresh above.</p>
                  </div>
                )}

                {/* Full lyrics link */}
                {track.genius_url && (
                  <a
                    href={track.genius_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-center text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                  >
                    View full lyrics on Genius →
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
