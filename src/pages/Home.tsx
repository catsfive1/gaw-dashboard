import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { timeAgoAny } from '../lib/format';

interface CrawlStateRow {
  community: string;
  last_cursor_ts: number | null;
  last_run_at: number | null;
}

interface FeaturesByStatus {
  [status: string]: number;
}

interface SummaryResponse {
  health: { bindings: { D1: boolean; KV: boolean; R2: boolean; AI: boolean } };
  actions_24h: number;
  actions_sparkline: Array<{ d: string; n: number }>;
  firehose: {
    posts_24h: number;
    comments_24h: number;
    crawl_state: CrawlStateRow[];
  };
  modmail: {
    open_threads: number;
    pending_enrichment: number;
  };
  bot: {
    by_status: FeaturesByStatus;
    open_polls: number;
  };
  deathrow_armed: number;
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {sublabel != null && <div className="mt-1 text-xs text-muted">{sublabel}</div>}
    </div>
  );
}

function HealthDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        'inline-block h-2 w-2 rounded-full ' + (ok ? 'bg-emerald-500' : 'bg-red-500')
      }
      aria-label={ok ? 'ok' : 'down'}
    />
  );
}

function latestCrawlTs(rows: CrawlStateRow[]): number | null {
  let best: number | null = null;
  for (const r of rows) {
    const t = r.last_run_at;
    if (typeof t === 'number' && Number.isFinite(t)) {
      if (best == null || t > best) best = t;
    }
  }
  return best;
}

export function Home() {
  const q = useQuery<SummaryResponse>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiFetch<SummaryResponse>('/dashboard/summary'),
    refetchInterval: 60_000,
  });

  if (q.isLoading) {
    return (
      <section>
        <h1 className="text-xl font-semibold text-ink">Overview</h1>
        <p className="mt-2 text-sm text-muted">Loading…</p>
      </section>
    );
  }

  if (q.isError) {
    return (
      <section>
        <h1 className="text-xl font-semibold text-ink">Overview</h1>
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load dashboard summary: {(q.error as Error)?.message ?? 'unknown error'}
          <button
            type="button"
            onClick={() => q.refetch()}
            className="ml-3 rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  const data = q.data;
  if (!data) return null;

  const byStatus = data.bot.by_status || {};
  const features_total = Object.values(byStatus).reduce((a, b) => a + (Number(b) || 0), 0);
  const commander_review = Number(byStatus['commander_review']) || 0;
  const polling = Number(byStatus['polling']) || 0;

  const lastCrawl = latestCrawlTs(data.firehose.crawl_state || []);

  const bindings = data.health?.bindings ?? { D1: false, KV: false, R2: false, AI: false };

  return (
    <section>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Overview</h1>
          <p className="mt-1 text-sm text-muted">
            Worker bindings:{' '}
            <span className="inline-flex items-center gap-1">
              <HealthDot ok={bindings.D1} /> D1
            </span>
            <span className="mx-2 text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <HealthDot ok={bindings.KV} /> KV
            </span>
            <span className="mx-2 text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <HealthDot ok={bindings.R2} /> R2
            </span>
            <span className="mx-2 text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <HealthDot ok={bindings.AI} /> AI
            </span>
          </p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Actions (24h)"
          value={data.actions_24h.toLocaleString()}
          sublabel="Moderator audit events in the last day"
        />
        <StatCard
          label="Active polls"
          value={data.bot.open_polls.toLocaleString()}
          sublabel={`${commander_review} awaiting commander review`}
        />
        <StatCard
          label="Features in-flight"
          value={features_total.toLocaleString()}
          sublabel={`${polling} polling · ${commander_review} review`}
        />
        <StatCard
          label="Firehose captured (24h)"
          value={
            <span className="tabular-nums">
              {data.firehose.posts_24h.toLocaleString()}
              <span className="mx-1 text-sm font-normal text-muted">posts</span>
              <span className="text-slate-300">/</span>
              <span className="ml-1">{data.firehose.comments_24h.toLocaleString()}</span>
              <span className="ml-1 text-sm font-normal text-muted">comments</span>
            </span>
          }
        />
        <StatCard
          label="Modmail queue"
          value={
            <span className="flex items-baseline gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
                {data.modmail.open_threads} open
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-700">
                {data.modmail.pending_enrichment} pending enrich
              </span>
            </span>
          }
        />
        <StatCard
          label="Death Row armed"
          value={data.deathrow_armed.toLocaleString()}
          sublabel="Sniper entries currently active"
        />
      </div>

      <p className="mt-3 text-xs text-muted">
        Last crawl tick: {lastCrawl != null ? timeAgoAny(lastCrawl) : 'never'}
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Feature pipeline</h2>
        <p className="mt-1 text-xs text-muted">
          Commander decisions detail lives on the Features page.
        </p>
        <div className="mt-3 overflow-hidden rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(byStatus).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted">
                    No feature requests yet.
                  </td>
                </tr>
              ) : (
                Object.entries(byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, n]) => (
                    <tr key={status} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <StatusPill status={status} />
                      </td>
                      <td className="px-3 py-2 tabular-nums">{n}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

// Shared status pill (also used on Features page). Keep in this file to avoid a new component file
// for a single-purpose widget; extracted to its own file would be premature abstraction.
export function StatusPill({ status }: { status: string }) {
  const { dot, label, bg, fg } = statusStyle(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${fg}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function statusStyle(status: string): { dot: string; label: string; bg: string; fg: string } {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'approved':
    case 'finalized':
      return { dot: 'bg-emerald-500', label: s, bg: 'bg-emerald-50', fg: 'text-emerald-800' };
    case 'commander_review':
      return { dot: 'bg-amber-500', label: s, bg: 'bg-amber-50', fg: 'text-amber-800' };
    case 'polling':
      return { dot: 'bg-sky-500', label: s, bg: 'bg-sky-50', fg: 'text-sky-800' };
    case 'amended':
      return { dot: 'bg-indigo-500', label: s, bg: 'bg-indigo-50', fg: 'text-indigo-800' };
    case 'rejected':
      return { dot: 'bg-red-500', label: s, bg: 'bg-red-50', fg: 'text-red-800' };
    case 'draft':
      return { dot: 'bg-slate-400', label: s, bg: 'bg-slate-100', fg: 'text-slate-700' };
    default:
      return { dot: 'bg-slate-400', label: s || 'unknown', bg: 'bg-slate-100', fg: 'text-slate-700' };
  }
}
