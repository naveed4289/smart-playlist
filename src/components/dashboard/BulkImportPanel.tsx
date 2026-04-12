import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineX, HiOutlineUpload } from "react-icons/hi";
import {
  fetchSpotifyPlaylistTracks,
  parseSpotifyPlaylistId,
  searchSpotifyTracks,
  type SpotifyTrackDTO,
} from "../../lib/edge";

type Tab = "names" | "playlist";

type ImportState =
  | { phase: "idle" }
  | { phase: "importing"; done: number; total: number }
  | { phase: "done"; imported: number; failed: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  onAddMany: (tracks: SpotifyTrackDTO[]) => void;
  existingIds: Set<string>;
  disabled?: boolean;
};

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function BulkImportPanel({ open, onClose, onAddMany, existingIds, disabled }: Props) {
  const [tab, setTab] = useState<Tab>("names");
  const [namesText, setNamesText] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const backdropRef = useRef<HTMLDivElement>(null);

  const isImporting = importState.phase === "importing";

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isImporting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isImporting, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setImportState({ phase: "idle" });
      setNamesText("");
      setPlaylistUrl("");
      setTab("names");
    }
  }, [open]);

  async function importByNames() {
    const lines = parseLines(namesText);
    if (!lines.length || disabled) return;

    setImportState({ phase: "importing", done: 0, total: lines.length });
    const found: SpotifyTrackDTO[] = [];
    const failed: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      setImportState({ phase: "importing", done: i, total: lines.length });
      try {
        const results = await searchSpotifyTracks(lines[i]);
        const best = results.find((r) => !existingIds.has(r.id) && !found.some((f) => f.id === r.id));
        if (best) {
          found.push(best);
        } else {
          failed.push(lines[i]);
        }
      } catch {
        failed.push(lines[i]);
      }
    }

    if (found.length) onAddMany(found);
    setImportState({ phase: "done", imported: found.length, failed });
  }

  async function importByPlaylist() {
    const id = parseSpotifyPlaylistId(playlistUrl);
    if (!id || disabled) {
      setImportState({ phase: "done", imported: 0, failed: ["Could not parse a valid playlist ID from the URL."] });
      return;
    }

    setImportState({ phase: "importing", done: 0, total: 0 });
    try {
      const allTracks = await fetchSpotifyPlaylistTracks(id);
      const total = allTracks.length;
      setImportState({ phase: "importing", done: 0, total });

      const toAdd = allTracks.filter((t) => !existingIds.has(t.id));
      // Simulate per-track progress for large playlists
      setImportState({ phase: "importing", done: total, total });

      if (toAdd.length) onAddMany(toAdd);
      const skipped = allTracks.length - toAdd.length;
      setImportState({
        phase: "done",
        imported: toAdd.length,
        failed: skipped > 0 ? [`${skipped} track(s) already in playlist — skipped.`] : [],
      });
    } catch (err) {
      setImportState({
        phase: "done",
        imported: 0,
        failed: [err instanceof Error ? err.message : "Failed to fetch playlist."],
      });
    }
  }

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (!isImporting) onClose(); }}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <HiOutlineUpload className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Bulk Import</h2>
              <p className="text-[11px] text-slate-400">Add multiple tracks at once</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isImporting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 transition"
          >
            <HiOutlineX className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/60">
          {(["names", "playlist"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={isImporting}
              onClick={() => { setTab(t); setImportState({ phase: "idle" }); }}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition disabled:opacity-40 ${
                tab === t
                  ? "border-b-2 border-indigo-500 text-indigo-600 bg-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "names" ? "📋  Track Names" : "🔗  Spotify Playlist URL"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {tab === "names" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Paste one track query per line. The best Spotify match for each line will be added.
              </p>
              <textarea
                value={namesText}
                onChange={(e) => setNamesText(e.target.value)}
                disabled={isImporting}
                rows={6}
                placeholder={"The Beatles Yesterday\nDaft Punk Around the World\nBohemian Rhapsody Queen"}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Paste a Spotify playlist URL or bare playlist ID. All tracks will be imported.
              </p>
              <input
                type="url"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                disabled={isImporting}
                placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              />
            </div>
          )}

          {/* Progress / Results */}
          {importState.phase === "importing" && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-sm font-medium text-indigo-700">
                {importState.total > 0
                  ? `Importing ${importState.done} / ${importState.total} tracks…`
                  : "Fetching playlist tracks…"}
              </p>
            </div>
          )}

          {importState.phase === "done" && (
            <div className="mt-4 space-y-2">
              <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 ${
                importState.imported > 0 ? "bg-emerald-50" : "bg-slate-50"
              }`}>
                <span className="text-lg">{importState.imported > 0 ? "✅" : "ℹ️"}</span>
                <p className="text-sm font-semibold text-slate-800">
                  {importState.imported > 0
                    ? `${importState.imported} track${importState.imported !== 1 ? "s" : ""} imported successfully!`
                    : "No tracks were imported."}
                </p>
              </div>

              {importState.failed.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-red-500">
                    Not found / skipped ({importState.failed.length})
                  </p>
                  <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                    {importState.failed.map((name, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                        <span className="mt-0.5 shrink-0 text-red-400">✕</span>
                        <span className="truncate">{name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-3.5">
          {importState.phase === "done" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isImporting}
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isImporting ||
                  disabled ||
                  (tab === "names" ? !namesText.trim() : !playlistUrl.trim())
                }
                onClick={() => void (tab === "names" ? importByNames() : importByPlaylist())}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition"
              >
                {isImporting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Importing…
                  </>
                ) : (
                  <>
                    <HiOutlineUpload className="h-3.5 w-3.5" />
                    Import
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
