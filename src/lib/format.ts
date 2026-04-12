export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** e.g. "32 mins" for insights panel */
export function formatDurationHuman(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function parseYear(
  releaseDate: string | null | undefined,
): number | null {
  if (!releaseDate) return null;
  const y = parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function decadeLabel(year: number): string {
  const d = Math.floor(year / 10) * 10;
  return `${d}s`;
}
