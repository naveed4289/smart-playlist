import { useState } from "react";
import { HiOutlinePencil, HiOutlineTrash, HiOutlineMusicNote } from "react-icons/hi";
import type { PlaylistRow } from "../../types/models";

type Props = {
  playlists: PlaylistRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
};

export function PlaylistSwitcher({
  playlists, selectedId, onSelect, onCreate, onRename, onDelete, busy,
}: Props) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function commitCreate() {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName("");
      setCreating(false);
    }
  }

  function startEdit(id: string, currentName: string) {
    setEditingId(id);
    setEditValue(currentName);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim());
    setEditingId(null);
  }

  return (
    <div className="flex h-full flex-col">

      {/* ── Create playlist ── */}
      <div className="shrink-0 border-b border-slate-100 p-3">
        {creating ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              placeholder="Playlist name…"
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button" disabled={busy || !newName.trim()} onClick={commitCreate}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition text-sm font-bold"
            >
              ✓
            </button>
            <button
              type="button" onClick={() => { setCreating(false); setNewName(""); }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 py-2 text-xs font-semibold text-indigo-500 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Playlist
          </button>
        )}
      </div>

      {/* ── Playlist label ── */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">My Playlists</p>
      </div>

      {/* ── Playlist list ── */}
      <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
        {playlists.length === 0 && (
          <li className="px-4 py-3 text-xs text-slate-400">No playlists yet — create one above!</li>
        )}
        {playlists.map((p) => {
          const active = p.id === selectedId;
          return (
            <li key={p.id} className="group px-2">
              {editingId === p.id ? (
                <div className="flex items-center gap-1 px-1 py-1">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button type="button" onClick={commitEdit}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-700">✓</button>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="rounded-md px-1.5 py-1 text-[10px] text-slate-400 hover:text-slate-700">✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(p.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <HiOutlineMusicNote className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-slate-300"}`} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                  {active && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <span
                        role="button" tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); startEdit(p.id, p.name); }}
                        onKeyDown={(e) => e.key === "Enter" && startEdit(p.id, p.name)}
                        className="rounded p-0.5 text-white/60 hover:text-white cursor-pointer"
                        title="Rename"
                      >
                        <HiOutlinePencil className="h-3 w-3" />
                      </span>
                      {playlists.length > 1 && (
                        <span
                          role="button" tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${p.name}"?`)) onDelete(p.id);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && confirm(`Delete "${p.name}"?`) && onDelete(p.id)}
                          className="rounded p-0.5 text-white/60 hover:text-red-300 cursor-pointer"
                          title="Delete"
                        >
                          <HiOutlineTrash className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
