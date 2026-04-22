import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { timeAgoAny, truncate, formatCents } from '../lib/format';
import { StatusPill } from './Home';

const STATUS_OPTIONS = [
  'all',
  'draft',
  'polling',
  'commander_review',
  'approved',
  'amended',
  'finalized',
  'rejected',
] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

interface FeatureRow {
  id: number;
  proposer_name: string | null;
  summary_raw?: string | null;
  summary_refined: string | null;
  status: string;
  iteration_count: number | null;
  created_at: number | null;
}

interface FeaturesResponse {
  rows: FeatureRow[];
  total: number;
  limit: number;
  offset: number;
}

interface PollRow {
  id: number;
  feature_id: number;
  options_json: string | null;
  status: string | null;
  expires_at: number | null;
}

interface PollVoteRow {
  id: number;
  poll_id: number;
  voter_id: string;
  option_index: number;
}

interface DecisionRow {
  id: number;
  feature_id: number;
  ts: number;
  decision: string;
  iteration: number | null;
  comments: string | null;
}

interface FeatureDetail {
  feature: FeatureRow & {
    tech_spec?: string | null;
    acceptance?: string | null;
    commander_comments?: string | null;
    final_prompt?: string | null;
  };
  polls: PollRow[];
  votes: PollVoteRow[];
  decisions: DecisionRow[];
  ai_audit: { total_cost_cents: number; call_count: number };
}

const PAGE_SIZE = 50;

export function Features() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [offset, setOffset] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const qs = new URLSearchParams();
  qs.set('limit', String(PAGE_SIZE));
  qs.set('offset', String(offset));
  if (status !== 'all') qs.set('status', status);

  const listQuery = useQuery<FeaturesResponse>({
    queryKey: ['dashboard', 'features', status, offset],
    queryFn: () => apiFetch<FeaturesResponse>(`/dashboard/features?${qs.toString()}`),
  });

  const detailQuery = useQuery<FeatureDetail>({
    queryKey: ['dashboard', 'features', 'detail', selectedId],
    queryFn: () =>
      apiFetch<FeatureDetail>(`/dashboard/features/${selectedId ?? 0}`),
    enabled: selectedId != null,
  });

  const filteredRows = useMemo(() => {
    const rows = listQuery.data?.rows ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (r.summary_refined ?? '').toLowerCase().includes(term));
  }, [listQuery.data, search]);

  const total = listQuery.data?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  function onStatusChange(v: string) {
    setStatus(v as StatusFilter);
    setOffset(0);
  }

  return (
    <section>
      <header>
        <h1 className="text-xl font-semibold text-ink">Features</h1>
        <p className="mt-1 text-sm text-muted">
          Feature-request pipeline from the Discord bot.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-ink">
          Status
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <input
          type="search"
          placeholder="Search summary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />

        <div className="text-xs text-muted">
          {listQuery.isFetching ? 'Loading…' : `${total.toLocaleString()} total`}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border border-slate-200 bg-white">
        {listQuery.isLoading ? (
          <div className="px-3 py-6 text-center text-sm text-muted">Loading…</div>
        ) : listQuery.isError ? (
          <div className="px-3 py-6 text-center text-sm text-red-700">
            Failed to load features: {(listQuery.error as Error)?.message ?? 'unknown error'}
            <button
              type="button"
              onClick={() => listQuery.refetch()}
              className="ml-3 rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted">
            No features match your filter.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Proposer</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Iter</th>
                <th className="px-3 py-2 font-medium">Summary</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 tabular-nums text-muted">#{r.id}</td>
                  <td className="px-3 py-2">{r.proposer_name ?? '-'}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.iteration_count ?? 0}</td>
                  <td className="px-3 py-2 text-ink">
                    {truncate(r.summary_refined ?? r.summary_raw ?? '', 80) || (
                      <span className="text-muted">(no summary)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{timeAgoAny(r.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(r.id);
                      }}
                      className="rounded border border-slate-300 px-2 py-0.5 text-xs text-ink hover:bg-slate-100"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(hasPrev || hasNext) && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-ink hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-ink hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedId != null && (
        <FeatureDrawer
          featureId={selectedId}
          detail={detailQuery.data}
          loading={detailQuery.isLoading}
          error={detailQuery.isError ? (detailQuery.error as Error)?.message : null}
          onClose={() => setSelectedId(null)}
          onRetry={() => detailQuery.refetch()}
        />
      )}
    </section>
  );
}

function FeatureDrawer({
  featureId,
  detail,
  loading,
  error,
  onClose,
  onRetry,
}: {
  featureId: number;
  detail: FeatureDetail | undefined;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40">
      {/* Static backdrop — no transition, per calm-design spec */}
      <div
        className="absolute inset-0 bg-slate-900/30"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={`Feature #${featureId}`}
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-lg"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <div className="text-xs text-muted">Feature</div>
            <div className="text-sm font-semibold text-ink">#{featureId}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-ink hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Failed to load: {error}
              <button
                type="button"
                onClick={onRetry}
                className="ml-3 rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          ) : !detail ? (
            <p className="text-sm text-muted">No data.</p>
          ) : (
            <FeatureDetailBody detail={detail} />
          )}
        </div>
      </aside>
    </div>
  );
}

function FeatureDetailBody({ detail }: { detail: FeatureDetail }) {
  const f = detail.feature;
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={f.status} />
          <span className="text-xs text-muted">
            iter {f.iteration_count ?? 0} · {timeAgoAny(f.created_at)} · by{' '}
            {f.proposer_name ?? 'unknown'}
          </span>
        </div>
        {f.summary_refined && (
          <p className="mt-2 text-sm text-ink">{f.summary_refined}</p>
        )}
      </div>

      <Section title="Tech spec">
        {f.tech_spec ? (
          <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs text-ink">
            {f.tech_spec}
          </pre>
        ) : (
          <p className="text-xs text-muted">(none)</p>
        )}
      </Section>

      <Section title="Acceptance">
        {f.acceptance ? (
          <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs text-ink">
            {f.acceptance}
          </pre>
        ) : (
          <p className="text-xs text-muted">(none)</p>
        )}
      </Section>

      <Section title="Commander comments (accumulated)">
        {f.commander_comments ? (
          <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs text-ink">
            {f.commander_comments}
          </pre>
        ) : (
          <p className="text-xs text-muted">(none)</p>
        )}
      </Section>

      <Section title="Commander decisions">
        {detail.decisions.length === 0 ? (
          <p className="text-xs text-muted">No decisions yet.</p>
        ) : (
          <ul className="space-y-2">
            {detail.decisions.map((d) => (
              <li
                key={d.id}
                className="rounded border border-slate-200 bg-white p-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{d.decision}</span>
                  <span className="text-muted">
                    iter {d.iteration ?? 0} · {timeAgoAny(d.ts)}
                  </span>
                </div>
                {d.comments && (
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{d.comments}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Polls">
        {detail.polls.length === 0 ? (
          <p className="text-xs text-muted">No polls.</p>
        ) : (
          <div className="space-y-3">
            {detail.polls.map((p) => (
              <PollBlock key={p.id} poll={p} votes={detail.votes.filter((v) => v.poll_id === p.id)} />
            ))}
          </div>
        )}
      </Section>

      <Section title="AI cost">
        <p className="text-xs text-muted">
          {detail.ai_audit.call_count.toLocaleString()} call
          {detail.ai_audit.call_count === 1 ? '' : 's'} ·{' '}
          {formatCents(detail.ai_audit.total_cost_cents)} total
        </p>
      </Section>

      <Section title="Final prompt">
        {f.final_prompt ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-snug text-slate-100">
            {f.final_prompt}
          </pre>
        ) : (
          <p className="text-xs text-muted">(not generated)</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function parseOptions(optionsJson: string | null): string[] {
  if (!optionsJson) return [];
  try {
    const v = JSON.parse(optionsJson);
    if (Array.isArray(v)) {
      return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
    }
    return [];
  } catch {
    return [];
  }
}

function PollBlock({ poll, votes }: { poll: PollRow; votes: PollVoteRow[] }) {
  const options = parseOptions(poll.options_json);
  const counts = new Array<number>(Math.max(options.length, 1)).fill(0);
  for (const v of votes) {
    if (v.option_index >= 0 && v.option_index < counts.length) counts[v.option_index] += 1;
  }
  const max = counts.reduce((a, b) => Math.max(a, b), 0);

  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink">Poll #{poll.id}</span>
        <span className="text-muted">
          {poll.status ?? 'unknown'}
          {poll.expires_at ? ` · expires ${timeAgoAny(poll.expires_at)}` : ''}
        </span>
      </div>
      {options.length === 0 ? (
        <p className="mt-2 text-xs text-muted">(no options)</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {options.map((label, i) => {
            const n = counts[i] ?? 0;
            const pct = max > 0 ? Math.round((n / max) * 100) : 0;
            return (
              <li key={i} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink">{label || `option ${i + 1}`}</span>
                  <span className="tabular-nums text-muted">
                    {n} vote{n === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded bg-slate-100">
                  <div
                    className="h-1.5 rounded bg-sky-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
