import { useMemo, useState } from "react";
import { HiOutlineTrash } from "react-icons/hi";
import type { PlaylistTrackRow } from "../../types/models";
import { formatDurationMs, parseYear } from "../../lib/format";

type SortKey = "position" | "title" | "artist" | "year" | "duration";

type Props = {
  tracks: PlaylistTrackRow[];
  onRemove: (id: string) => void;
  onPlayTrack: (track: PlaylistTrackRow) => void;
  onSelectTrack: (track: PlaylistTrackRow) => void;
  nowPlayingId?: string | null;
  selectedTrackId?: string | null;
  busy?: boolean;
  title?: string;
  onSave?: () => void;
  onClearAll?: () => void;
};

export function PlaylistTracksTable({
  tracks,
  onRemove,
  onPlayTrack,
  onSelectTrack,
  nowPlayingId,
  selectedTrackId,
  busy,
  title = "My playlist",
  onSave,
  onClearAll,
}: Props) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("position");
  const [asc, setAsc] = useState(true);

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let list = [...tracks];
    if (f) {
      list = list.filter((t) => {
        const blob = `${t.title} ${(t.artists ?? []).join(" ")} ${t.album ?? ""}`.toLowerCase();
        return blob.includes(f);
      });
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sort) {
        case "title":    cmp = a.title.localeCompare(b.title); break;
        case "artist":   cmp = (a.artists?.[0] ?? "").localeCompare(b.artists?.[0] ?? ""); break;
        case "year": {
          const ya = parseYear(a.release_date) ?? 0;
          const yb = parseYear(b.release_date) ?? 0;
          cmp = ya - yb; break;
        }
        case "duration": cmp = (a.duration_ms ?? 0) - (b.duration_ms ?? 0); break;
        default:         cmp = a.position - b.position;
      }
      return asc ? cmp : -cmp;
    });
    return list;
  }, [tracks, filter, sort, asc]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {tracks.length} track{tracks.length !== 1 ? "s" : ""}
              {tracks.length > 0 ? "  ·  click a track for insights" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button" disabled={busy} onClick={() => onSave?.()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              Save
            </button>
            <button
              type="button" disabled={busy || !tracks.length} onClick={() => onClearAll?.()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter / Sort ── */}
      <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-4 py-2">
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter tracks…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
          >
            <option value="position">Order</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="year">Year</option>
            <option value="duration">Duration</option>
          </select>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
            onClick={() => setAsc((v) => !v)}
          >{asc ? "↑" : "↓"}</button>
        </div>
      </div>

      {/* ── Track list ── */}
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl text-indigo-300">♫</div>
            <p className="text-sm font-semibold text-slate-500">Your playlist is empty</p>
            <p className="mt-1 text-xs text-slate-400">Search Spotify in the top bar and click "+ Add".</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No tracks match your filter.</p>
        ) : (
          <ul>
            {rows.map((t, idx) => {
              const isPlaying = nowPlayingId === t.id;
              const isSelected = selectedTrackId === t.id;
              const hasGenius = Boolean(t.genius_description || t.genius_url || t.genius_song_id);

              return (
                <li
                  key={t.id}
                  onClick={() => onSelectTrack(t)}
                  className={`group flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-2.5 transition-colors last:border-0 ${
                    isSelected
                      ? "bg-indigo-50"
                      : isPlaying
                      ? "bg-emerald-50/60"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {/* Number / Play toggle */}
                  <div className="relative flex h-8 w-6 shrink-0 items-center justify-center">
                    {isPlaying ? (
                      <span className="flex items-end gap-px text-emerald-500 group-hover:hidden">
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                        <span className="wave-bar" />
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 group-hover:invisible">
                        {idx + 1}
                      </span>
                    )}
                    {/* Play/Stop icon on row hover */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onPlayTrack(t); }}
                      title={isPlaying ? "Playing — click to reopen" : "Play on Spotify"}
                      className={`absolute inset-0 hidden items-center justify-center rounded transition group-hover:flex ${
                        isPlaying ? "text-emerald-600 hover:text-emerald-700" : "text-slate-400 hover:text-indigo-600"
                      }`}
                    >
                      {isPlaying ? (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="5" y="5" width="14" height="14" rx="2" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Album art */}
                  {t.image_url ? (
                    <img src={t.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300 text-sm">♫</div>
                  )}

                  {/* Track info */}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold leading-tight ${
                      isPlaying ? "text-emerald-700" : isSelected ? "text-indigo-700" : "text-slate-800"
                    }`}>
                      {t.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 mt-0.5">
                      {(t.artists ?? []).join(", ")}
                      {t.release_date ? ` · ${t.release_date.slice(0, 4)}` : ""}
                    </p>
                  </div>

                  {/* Genius badge */}
                  {hasGenius && (
                    <span className="hidden shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-600 sm:block">
                      ✦
                    </span>
                  )}

                  {/* Duration */}
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    {formatDurationMs(t.duration_ms)}
                  </span>

                  {/* Delete — only on hover */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
                    className="shrink-0 rounded-md p-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                    title="Remove"
                  >
                    <HiOutlineTrash className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
