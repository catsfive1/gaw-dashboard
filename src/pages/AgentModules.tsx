import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  HELPER_BASE,
  loadModuleStates,
  updateModule,
  type ModuleState,
} from '../lib/agentModules';

interface UpdatingState {
  [id: string]: 'idle' | 'running' | 'done' | 'error';
}

export function AgentModules() {
  const [states, setStates] = useState<ModuleState[]>([]);
  const [helperOnline, setHelperOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<UpdatingState>({});
  const [log, setLog] = useState<{ id: string; text: string } | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const { states: s, helperOnline: online } = await loadModuleStates(signal);
      setStates(s);
      setHelperOnline(online);
    } catch (e) {
      setError((e as Error)?.message ?? 'failed to load modules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    refresh(ac.signal);
    return () => ac.abort();
  }, [refresh]);

  async function onUpdate(id: string) {
    setUpdating((u) => ({ ...u, [id]: 'running' }));
    setLog(null);
    const r = await updateModule(id);
    setUpdating((u) => ({ ...u, [id]: r.ok ? 'done' : 'error' }));
    setLog({ id, text: r.error ? `${r.error}\n${r.output}`.trim() : r.output || '(no output)' });
    if (r.ok) await refresh();
  }

  const outdatedCount = states.filter((s) => s.outdated).length;

  return (
    <section>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Agent Modules</h1>
          <p className="mt-1 text-sm text-muted">
            External packages that power the C5 / Hermes agent swarm. Live versions
            and one-click updates via the local helper.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-ink hover:bg-slate-100"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </header>

      {/* Helper status banner */}
      <div
        className={clsx(
          'mt-4 rounded border px-3 py-2 text-sm',
          helperOnline
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-800',
        )}
      >
        {helperOnline ? (
          <span>
            <span className="font-medium">Local helper connected.</span> Installed
            versions are live and updates run on this machine.
            {outdatedCount > 0 && (
              <span className="ml-1 font-medium">
                {outdatedCount} update{outdatedCount === 1 ? '' : 's'} available.
              </span>
            )}
          </span>
        ) : (
          <span>
            <span className="font-medium">Local helper offline.</span> Showing latest
            published versions only — start the helper to see installed versions and
            update from here:{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
              pwsh -NoProfile -ExecutionPolicy Bypass -File
              "D:\AI\_PROJECTS\gaw-dashboard\tools\agent-modules-helper.ps1"
            </code>{' '}
            (expects {HELPER_BASE}).
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Module</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Installed</th>
              <th className="px-3 py-2 font-medium">Latest</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {states.map((m) => {
              const u = updating[m.id] ?? 'idle';
              return (
                <tr key={m.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{m.name}</div>
                    <code className="text-[11px] text-muted">{m.package}</code>
                    <p className="mt-0.5 max-w-md text-xs text-muted">{m.description}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {m.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink">
                    {m.installed ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink">
                    {m.latest ?? <span className="text-muted">?</span>}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge m={m} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={m.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs text-ink hover:bg-slate-100"
                      >
                        Docs
                      </a>
                      <button
                        type="button"
                        disabled={!helperOnline || u === 'running' || !m.outdated}
                        onClick={() => onUpdate(m.id)}
                        title={
                          !helperOnline
                            ? 'Start the local helper to update'
                            : !m.outdated
                              ? 'Up to date'
                              : `Run: ${m.updateCmd}`
                        }
                        className={clsx(
                          'rounded px-2 py-0.5 text-xs',
                          m.outdated && helperOnline
                            ? 'border border-sky-500 bg-sky-500 text-white hover:bg-sky-600'
                            : 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed',
                        )}
                      >
                        {u === 'running' ? 'Updating…' : u === 'done' ? 'Updated' : 'Update'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {states.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">
                  No modules registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {log && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Update output — {log.id}
          </h3>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-snug text-slate-100">
            {log.text}
          </pre>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Registry is defined in{' '}
        <code className="text-[11px]">src/data/agent-modules.json</code> (single
        source of truth, read by both this tab and the helper). Add a package by
        appending an entry there.
      </p>
    </section>
  );
}

function StatusBadge({ m }: { m: ModuleState }) {
  if (m.source === 'none') {
    return <span className="text-xs text-muted">unknown</span>;
  }
  if (!m.installed) {
    return (
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
        not installed
      </span>
    );
  }
  if (m.outdated) {
    return (
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
        update available
      </span>
    );
  }
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
      up to date
    </span>
  );
}
