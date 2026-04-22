// Formatting helpers. Pure functions, no side effects.

export function timeAgo(tsMs: number | null | undefined): string {
  if (tsMs == null || !Number.isFinite(tsMs)) return '-';
  const diff = Date.now() - tsMs;
  if (diff < 0) return 'in the future';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

// Accept either seconds or milliseconds. Heuristic: if value < 1e12 treat as seconds.
export function timeAgoAny(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return '-';
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return timeAgo(ms);
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

export function formatCents(c: number | null | undefined): string {
  const n = Number(c) || 0;
  return `$${(n / 100).toFixed(2)}`;
}
