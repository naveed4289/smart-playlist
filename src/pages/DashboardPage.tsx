import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../components/AppLayout";
import { PlaylistSwitcher } from "../components/dashboard/PlaylistSwitcher";
import { TrackSearchPanel } from "../components/dashboard/TrackSearchPanel";
import { PlaylistStatsCharts } from "../components/dashboard/PlaylistStatsCharts";
import { PlaylistTracksTable } from "../components/dashboard/PlaylistTracksTable";
import { SuggestionPanel } from "../components/dashboard/SuggestionPanel";
import { BulkImportPanel } from "../components/dashboard/BulkImportPanel";
import { NowPlayingBar } from "../components/dashboard/NowPlayingBar";
import { TrackDetailView } from "../components/dashboard/TrackDetailView";
import { SupabaseSetupNotice } from "../components/SupabaseSetupNotice";
import { enrichGenius, fetchSpotifyTrackById, type SpotifyTrackDTO } from "../lib/edge";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { PlaylistRow, PlaylistTrackRow } from "../types/models";

async function touchPlaylist(playlistId: string) {
  await supabase
    .from("playlists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", playlistId);
}

export function DashboardPage() {
  const configured = isSupabaseConfigured;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "info" | "error" } | null>(null);
  const [mobileTab, setMobileTab] = useState<"tracks" | "playlists" | "ai">("tracks");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<PlaylistTrackRow | null>(null);
  const [detailTrack, setDetailTrack] = useState<PlaylistTrackRow | null>(null);

  function showToast(msg: string, type: "info" | "error" = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── Queries ── */
  type PlaylistWithCount = PlaylistRow & { playlist_tracks: { count: number }[] };

  const playlistsQuery = useQuery({
    queryKey: ["playlists"],
    enabled: configured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*, playlist_tracks(count)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as PlaylistWithCount[];
    },
  });

  useEffect(() => {
    async function ensureDefault() {
      if (!configured || !playlistsQuery.isSuccess) return;
      const list = playlistsQuery.data ?? [];
      if (list.length) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("playlists").insert({ user_id: user.id, name: "My Playlist" });
      if (!error) await queryClient.invalidateQueries({ queryKey: ["playlists"] });
    }
    void ensureDefault();
  }, [configured, playlistsQuery.isSuccess, playlistsQuery.data, queryClient]);

  useEffect(() => {
    const list = playlistsQuery.data ?? [];
    if (!list.length) { setSelectedId(null); return; }
    if (selectedId && list.some((p) => p.id === selectedId)) return;
    // Default: open the playlist with the most tracks
    const sorted = [...list].sort(
      (a, b) => (b.playlist_tracks?.[0]?.count ?? 0) - (a.playlist_tracks?.[0]?.count ?? 0),
    );
    setSelectedId(sorted[0].id);
  }, [playlistsQuery.data, selectedId]);

  const tracksQuery = useQuery({
    queryKey: ["playlist_tracks", selectedId],
    enabled: configured && !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_tracks").select("*")
        .eq("playlist_id", selectedId as string)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as PlaylistTrackRow[];
    },
  });

  const tracks = useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);
  const existingIds = useMemo(() => new Set(tracks.map((t) => t.spotify_track_id)), [tracks]);
  // Sort by track count descending so the most-populated playlist appears first
  const playlists = useMemo(() => {
    type PWC = PlaylistRow & { playlist_tracks: { count: number }[] };
    const raw = (playlistsQuery.data ?? []) as PWC[];
    return [...raw].sort(
      (a, b) => (b.playlist_tracks?.[0]?.count ?? 0) - (a.playlist_tracks?.[0]?.count ?? 0),
    ) as PlaylistRow[];
  }, [playlistsQuery.data]);
  const currentPlaylistName = playlists.find((p) => p.id === selectedId)?.name ?? "My playlist";

  // Clear detail view and player when the user switches to a different playlist
  useEffect(() => {
    setDetailTrack(null);
    setNowPlayingTrack(null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep detail & now-playing in sync when fresh data arrives
  useEffect(() => {
    if (!detailTrack) return;
    const fresh = tracks.find((t) => t.id === detailTrack.id);
    if (fresh) setDetailTrack(fresh);
  }, [tracks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nowPlayingTrack) return;
    const fresh = tracks.find((t) => t.id === nowPlayingTrack.id);
    if (fresh) setNowPlayingTrack(fresh);
  }, [tracks]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidateTracks = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["playlist_tracks", selectedId] });
    void queryClient.invalidateQueries({ queryKey: ["playlists"] });
  }, [queryClient, selectedId]);

  /* ── Enrich ── */
  const enrichRow = useCallback(
    async (rowId: string, title: string, artist: string, playlistId: string) => {
      try {
        const { data: existing } = await supabase
          .from("playlist_tracks").select("preview_url, spotify_track_id").eq("id", rowId).single();
        const [g, spotifyTrack] = await Promise.all([
          enrichGenius(title, artist),
          (!existing?.preview_url && existing?.spotify_track_id)
            ? fetchSpotifyTrackById(existing.spotify_track_id) : Promise.resolve(null),
        ]);
        const patch: Record<string, unknown> = {
          genius_song_id: g.geniusSongId,
          genius_description: g.geniusDescription,
          genius_url: g.geniusUrl,
          genius_annotations: g.geniusAnnotations ?? [],
        };
        if (spotifyTrack?.previewUrl) patch.preview_url = spotifyTrack.previewUrl;
        await supabase.from("playlist_tracks").update(patch).eq("id", rowId);
        await queryClient.invalidateQueries({ queryKey: ["playlist_tracks", playlistId] });
      } catch { /* best-effort */ }
    },
    [queryClient],
  );

  const reEnrichTrack = useCallback(
    async (rowId: string, title: string, artist: string) => {
      if (!selectedId) return;
      await enrichRow(rowId, title, artist, selectedId);
    },
    [selectedId, enrichRow],
  );

  /* ── Track CRUD ── */
  const insertTrack = useCallback(
    async (t: SpotifyTrackDTO, playlistId: string) => {
      const { data: maxRow } = await supabase
        .from("playlist_tracks").select("position").eq("playlist_id", playlistId)
        .order("position", { ascending: false }).limit(1).maybeSingle();
      const nextPos = (maxRow?.position ?? -1) + 1;
      const { data: row, error } = await supabase
        .from("playlist_tracks")
        .insert({
          playlist_id: playlistId, position: nextPos,
          spotify_track_id: t.id, title: t.name, artists: t.artists,
          album: t.album, image_url: t.imageUrl, duration_ms: t.durationMs,
          release_date: t.releaseDate, preview_url: t.previewUrl,
        })
        .select().single();
      if (error) {
        showToast(error.code === "23505" ? "Track already in playlist." : error.message, "info");
        return false;
      }
      await touchPlaylist(playlistId);
      invalidateTracks();
      void enrichRow(row.id, t.name, t.artists[0] ?? "", playlistId);
      return true;
    },
    [enrichRow, invalidateTracks],
  );

  const addTrackFromSpotify = useCallback(async (t: SpotifyTrackDTO) => {
    if (!selectedId) return;
    setBusy(true);
    try { await insertTrack(t, selectedId); }
    finally { setBusy(false); }
  }, [selectedId, insertTrack]);

  const addManyTracks = useCallback(async (trackList: SpotifyTrackDTO[]) => {
    if (!selectedId || !trackList.length) return;
    setBusy(true);
    try {
      for (const t of trackList) await insertTrack(t, selectedId);
      showToast(`${trackList.length} track${trackList.length !== 1 ? "s" : ""} added!`);
    } finally { setBusy(false); }
  }, [selectedId, insertTrack]);

  const removeTrack = useCallback(async (id: string) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await supabase.from("playlist_tracks").delete().eq("id", id);
      await touchPlaylist(selectedId);
      invalidateTracks();
      if (detailTrack?.id === id) setDetailTrack(null);
      if (nowPlayingTrack?.id === id) setNowPlayingTrack(null);
    } finally { setBusy(false); }
  }, [selectedId, invalidateTracks, detailTrack, nowPlayingTrack]);

  const clearPlaylist = useCallback(async () => {
    if (!selectedId || !tracks.length) return;
    if (!confirm("Remove all tracks from this playlist?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("playlist_tracks").delete().eq("playlist_id", selectedId);
      if (error) showToast(error.message, "error");
      await touchPlaylist(selectedId);
      invalidateTracks();
      setDetailTrack(null);
      setNowPlayingTrack(null);
      showToast("Playlist cleared.");
    } finally { setBusy(false); }
  }, [selectedId, tracks, invalidateTracks]);

  const createPlaylist = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("playlists").insert({ user_id: user.id, name }).select().single();
      if (error) { showToast(error.message, "error"); return; }
      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
      if (data?.id) setSelectedId(data.id);
      showToast(`"${name}" created!`);
    } finally { setBusy(false); }
  }, [queryClient]);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("playlists").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) showToast(error.message, "error");
      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
    } finally { setBusy(false); }
  }, [queryClient]);

  const deletePlaylist = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) showToast(error.message, "error");
      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
      if (selectedId === id) setSelectedId(null);
    } finally { setBusy(false); }
  }, [queryClient, selectedId]);

  /* ── Early returns ── */
  if (!configured) return <AppLayout><SupabaseSetupNotice /></AppLayout>;
  if (playlistsQuery.isError) return (
    <AppLayout><p className="p-4 text-red-600">{(playlistsQuery.error as Error).message}</p></AppLayout>
  );
  if (playlistsQuery.isLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    </AppLayout>
  );

  const searchSlot = (
    <TrackSearchPanel
      onAdd={(t) => void addTrackFromSpotify(t)}
      existingIds={existingIds}
      disabled={busy || !selectedId}
      onOpenBulkImport={() => setBulkImportOpen(true)}
    />
  );

  return (
    <AppLayout fluid searchSlot={searchSlot}>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-100 -translate-x-1/2 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg backdrop-blur ${
          toast.type === "error"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-slate-200 bg-white/95 text-slate-800"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ════ MAIN LAYOUT ════ */}
      <div className="flex min-h-0 flex-1 w-full overflow-hidden">

        {/* ── LEFT: Playlist sidebar ── */}
        <aside className={`hidden w-52 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white md:flex xl:w-56 ${mobileTab === "playlists" ? "flex" : ""}`}>
          <PlaylistSwitcher
            playlists={playlists}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={(name) => void createPlaylist(name)}
            onRename={(id, name) => void renamePlaylist(id, name)}
            onDelete={(id) => void deletePlaylist(id)}
            busy={busy || playlistsQuery.isLoading}
          />
        </aside>

        {/* ── CENTER: Tracks / Detail + bottom player ── */}
        <div className={`min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 ${mobileTab === "tracks" ? "flex" : "hidden md:flex"}`}>
          {/* Main content area (track list OR detail view) */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {tracksQuery.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : tracksQuery.isError ? (
              <p className="p-4 text-sm text-red-600">{(tracksQuery.error as Error).message}</p>
            ) : detailTrack ? (
              /* ── Track Detail Page ── */
              <TrackDetailView
                track={detailTrack}
                onBack={() => setDetailTrack(null)}
                onPlayTrack={(t) => setNowPlayingTrack((prev) => prev?.id === t.id ? null : t)}
                nowPlayingId={nowPlayingTrack?.id}
                onReEnrich={reEnrichTrack}
              />
            ) : (
              /* ── Playlist Track Table ── */
              <PlaylistTracksTable
                tracks={tracks}
                title={currentPlaylistName}
                onRemove={(id) => void removeTrack(id)}
                onPlayTrack={(t) => setNowPlayingTrack((prev) => prev?.id === t.id ? null : t)}
                onSelectTrack={(t) => setDetailTrack(t)}
                nowPlayingId={nowPlayingTrack?.id}
                selectedTrackId={null}
                onSave={() => showToast("Playlist saved! ✓")}
                onClearAll={() => void clearPlaylist()}
                busy={busy}
              />
            )}
          </div>

          {/* ── Now Playing Bar (bottom of center column) ── */}
          {nowPlayingTrack && (
            <NowPlayingBar
              track={nowPlayingTrack}
              onClose={() => setNowPlayingTrack(null)}
            />
          )}
        </div>

        {/* ── RIGHT: AI Suggestions + Playlist Insights ── */}
        <aside className={`w-full flex-col overflow-y-auto border-l border-slate-200 bg-white md:flex md:w-64 xl:w-72 ${mobileTab === "ai" ? "flex" : "hidden md:flex"}`}>
          {/* AI Suggestions - top */}
          <SuggestionPanel
            tracks={tracks}
            onAddSuggested={(t) => void addTrackFromSpotify(t)}
            existingIds={existingIds}
            disabled={busy || !selectedId}
          />
          {/* Playlist Insights - below (text only, no charts) */}
          <div className="shrink-0 border-t border-slate-100">
            <PlaylistStatsCharts tracks={tracks} />
          </div>
        </aside>

        {/* ── Mobile: Playlists panel ── */}
        {mobileTab === "playlists" && (
          <div className="flex w-full flex-col overflow-hidden md:hidden">
            <PlaylistSwitcher
              playlists={playlists}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setMobileTab("tracks"); }}
              onCreate={(name) => void createPlaylist(name)}
              onRename={(id, name) => void renamePlaylist(id, name)}
              onDelete={(id) => void deletePlaylist(id)}
              busy={busy || playlistsQuery.isLoading}
            />
          </div>
        )}

      </div>

      {/* ════ BULK IMPORT MODAL ════ */}
      <BulkImportPanel
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onAddMany={(t) => void addManyTracks(t)}
        existingIds={existingIds}
        disabled={busy || !selectedId}
      />

      {/* ════ MOBILE BOTTOM TAB BAR ════ */}
      <nav className="md:hidden shrink-0 flex border-t border-slate-200 bg-white">
        {(
          [
            { key: "playlists", label: "Playlists", icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
              </svg>
            )},
            { key: "tracks", label: "Tracks", icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            )},
            { key: "ai", label: "AI", icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )},
          ] as { key: "playlists" | "tracks" | "ai"; label: string; icon: React.ReactNode }[]
        ).map(({ key, label, icon }) => (
          <button
            key={key} type="button"
            onClick={() => setMobileTab(key)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition ${
              mobileTab === key ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            {icon}{label}
            {mobileTab === key && (
              <span className="absolute bottom-0 h-0.5 w-10 rounded-full bg-indigo-600" />
            )}
          </button>
        ))}
      </nav>

    </AppLayout>
  );
}
