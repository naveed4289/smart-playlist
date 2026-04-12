import type { PlaylistTrackRow } from "../../types/models";
import { formatDurationMs } from "../../lib/format";

type Props = {
  track: PlaylistTrackRow;
  onClose: () => void;
};

export function NowPlayingBar({ track, onClose }: Props) {
  return (
    <div className="shrink-0 overflow-hidden rounded-t-2xl border border-b-0 border-indigo-100/80 bg-white shadow-[0_-8px_32px_rgba(99,102,241,0.14)]">

      {/* Gradient accent line at the very top */}
      <div className="h-[3px] bg-linear-to-r from-indigo-500 via-violet-500 to-indigo-400" />

      {/* Track info strip */}
      <div className="flex items-center gap-3 px-4 py-2.5">

        {/* Album art with soft ring */}
        <div className="relative shrink-0">
          {track.image_url ? (
            <img
              src={track.image_url}
              alt=""
              className="h-10 w-10 rounded-xl object-cover shadow-md shadow-indigo-200/50 ring-2 ring-indigo-100"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-400 text-base shadow-md">
              ♫
            </div>
          )}
          {/* Pulse dot */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white">
            <span className="h-2 w-2 animate-ping rounded-full bg-indigo-400 opacity-75" />
          </span>
        </div>

        {/* Track name + artist + duration */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-slate-900">{track.title}</p>
          <p className="truncate text-[11px] text-slate-400">
            {(track.artists ?? []).join(", ")}
            {track.duration_ms ? <span className="text-slate-300"> · {formatDurationMs(track.duration_ms)}</span> : null}
          </p>
        </div>

        {/* Animated waveform */}
        <span className="flex shrink-0 items-end gap-px text-indigo-500 mr-1">
          <span className="wave-bar" style={{ animationDelay: "0s" }} />
          <span className="wave-bar" style={{ animationDelay: "0.15s" }} />
          <span className="wave-bar" style={{ animationDelay: "0.3s" }} />
          <span className="wave-bar" style={{ animationDelay: "0.15s" }} />
          <span className="wave-bar" style={{ animationDelay: "0s" }} />
        </span>

        {/* Volume icon (decorative — volume is controlled inside Spotify embed) */}
        <span className="shrink-0 text-slate-300" title="Adjust volume inside the player below">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        </span>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          title="Close player"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Spotify embed — autoplay=1 starts playing immediately on open */}
      <div className="relative" style={{ height: 80 }}>
        <iframe
          key={track.spotify_track_id}
          title="Now playing"
          src={`https://open.spotify.com/embed/track/${track.spotify_track_id}?utm_source=generator&autoplay=1`}
          width="100%"
          height="80"
          style={{ border: 0, display: "block" }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
        {/* Soft right-edge fade to visually blend with the bar */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-10"
          style={{ background: "linear-gradient(to left, rgba(255,255,255,0.08), transparent)" }}
        />
      </div>
    </div>
  );
}
