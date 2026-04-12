import type { PlaylistTrackRow } from "../../types/models";
import { formatDurationHuman, formatDurationMs, parseYear, decadeLabel } from "../../lib/format";

function aggregate(tracks: PlaylistTrackRow[]) {
  let totalMs = 0;
  const artistCounts = new Map<string, number>();
  const decadeCounts = new Map<string, number>();

  for (const t of tracks) {
    totalMs += t.duration_ms ?? 0;
    const primary = t.artists?.[0] ?? "Unknown";
    artistCounts.set(primary, (artistCounts.get(primary) ?? 0) + 1);
    const y = parseYear(t.release_date);
    if (y != null) {
      const d = decadeLabel(y);
      decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1);
    }
  }

  const sorted = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]);
  const decades = [...decadeCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([decade]) => decade);

  return {
    totalMs,
    uniqueArtists: artistCounts.size,
    topArtists: sorted.slice(0, 4).map(([n]) => n),
    eras: decades,
  };
}

type Props = { tracks: PlaylistTrackRow[] };

export function PlaylistStatsCharts({ tracks }: Props) {
  if (!tracks.length) {
    return (
      <div className="px-4 py-4">
        <SectionLabel>Playlist Insights</SectionLabel>
        <p className="mt-3 text-xs text-slate-400">Add tracks to see insights.</p>
      </div>
    );
  }

  const { totalMs, uniqueArtists, topArtists, eras } = aggregate(tracks);

  return (
    <div className="px-4 py-4">
      <SectionLabel>Playlist Insights</SectionLabel>

      <div className="mt-3 space-y-3">
        {/* Duration + Tracks */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Duration"
            value={formatDurationHuman(totalMs)}
            sub={formatDurationMs(totalMs)}
            accent="indigo"
          />
          <StatCard
            label="Tracks"
            value={String(tracks.length)}
            sub={`${uniqueArtists} artist${uniqueArtists !== 1 ? "s" : ""}`}
            accent="violet"
          />
        </div>

        {/* Top Artists */}
        {topArtists.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Top Artists</p>
            <div className="flex flex-wrap gap-1.5">
              {topArtists.map((artist, i) => (
                <span
                  key={i}
                  className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm"
                >
                  {artist}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Eras */}
        {eras.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Eras</p>
            <div className="flex flex-wrap gap-1.5">
              {eras.map((era, i) => (
                <span
                  key={i}
                  className="rounded-full bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                >
                  {era}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-1 rounded-full bg-indigo-400" />
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{children}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "indigo" | "violet";
}) {
  const colors = {
    indigo: {
      bg: "from-indigo-50 to-indigo-100/50",
      dot: "bg-indigo-400",
      label: "text-indigo-500",
      value: "text-indigo-900",
      sub: "text-indigo-400/80",
    },
    violet: {
      bg: "from-violet-50 to-violet-100/50",
      dot: "bg-violet-400",
      label: "text-violet-500",
      value: "text-violet-900",
      sub: "text-violet-400/80",
    },
  }[accent];

  return (
    <div className={`rounded-2xl bg-linear-to-br ${colors.bg} border border-white p-3.5 shadow-sm`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        <p className={`text-[9px] font-bold uppercase tracking-widest ${colors.label}`}>{label}</p>
      </div>
      <p className={`mt-1.5 text-base font-extrabold ${colors.value}`}>{value}</p>
      <p className={`text-[10px] font-medium ${colors.sub}`}>{sub}</p>
    </div>
  );
}
