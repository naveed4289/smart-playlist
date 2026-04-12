import { useEffect, useRef, useState } from "react";
import { HiOutlineSearch, HiOutlineX } from "react-icons/hi";
import { searchSpotifyTracks, type SpotifyTrackDTO } from "../../lib/edge";
import { formatDurationMs } from "../../lib/format";

type Props = {
  onAdd: (track: SpotifyTrackDTO) => void;
  existingIds: Set<string>;
  disabled?: boolean;
  onOpenBulkImport?: () => void;
};

export function TrackSearchPanel({ onAdd, existingIds, disabled }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SpotifyTrackDTO[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-search with 500ms debounce
  useEffect(() => {
    if (!q.trim()) {
      setOpen(false);
      setResults([]);
      setError(null);
      return;
    }
    if (disabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(q.trim());
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runSearch(query: string) {
    setError(null);
    setLoading(true);
    setOpen(true);
    try {
      const tracks = await searchSpotifyTracks(query);
      setResults(tracks);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setResults([]);
    setError(null);
    setQ("");
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search input */}
      <div className="relative">
        <HiOutlineSearch
          className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
            loading ? "text-indigo-500" : "text-slate-400"
          }`}
          aria-hidden
        />
        {loading && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search songs, artists, albums…"
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition"
        />
        {q && (
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-slate-400 hover:text-slate-600 transition"
          >
            <HiOutlineX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {loading
                ? "Searching…"
                : error
                ? "Error"
                : `${results.length} result${results.length !== 1 ? "s" : ""}`}
            </p>
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <HiOutlineX className="h-4 w-4" />
            </button>
          </div>

          {error ? (
            <p className="px-4 py-3 text-sm text-red-600">{error}</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No tracks found — try a different search.</p>
          ) : (
            <ul className="max-h-[min(22rem,55vh)] overflow-y-auto divide-y divide-slate-50">
              {results.map((t) => {
                const inList = existingIds.has(t.id);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                    {/* Album art */}
                    <div className="relative shrink-0">
                      {t.imageUrl ? (
                        <img src={t.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-400 text-xs">♫</div>
                      )}
                      {t.previewUrl && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] text-white shadow">▶</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{t.name}</p>
                      <p className="truncate text-xs text-slate-500">{t.artists.join(", ")}</p>
                      <p className="text-xs text-slate-400">
                        {t.album}{t.releaseDate ? ` · ${t.releaseDate.slice(0, 4)}` : ""}
                        {" · "}{formatDurationMs(t.durationMs)}
                      </p>
                    </div>

                    {/* Add button */}
                    <button
                      type="button"
                      disabled={disabled || inList}
                      onClick={() => { onAdd(t); close(); }}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                        inList
                          ? "bg-slate-100 text-slate-400 cursor-default"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {inList ? "Added ✓" : "+ Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
