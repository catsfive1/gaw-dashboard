// Agent-support module registry client.
//
// Data sources, in priority order:
//   1. Local helper (tools/agent-modules-helper.py @ 127.0.0.1:8791) — reports
//      INSTALLED + LATEST versions and EXECUTES updates. This is the only source
//      that knows what's actually installed and can update from the page.
//   2. Public npm registry (CORS-enabled) — latest-only fallback for npm modules
//      when the helper is offline, so the tab still shows what's current.
//
// The helper echoes a per-run token via /health; we auto-adopt it so writes
// (/update) are gated without the operator ever copy-pasting a secret.

import manifest from '../data/agent-modules.json';

export interface AgentModule {
  id: string;
  name: string;
  description: string;
  kind: 'npm-global' | 'pip' | 'cargo';
  package: string;
  registry: 'npm' | 'pypi';
  updateCmd: string;
  docsUrl: string;
  homepage: string;
}

export interface ModuleState extends AgentModule {
  installed: string | null; // version string, or null if not installed / unknown
  latest: string | null;
  outdated: boolean;
  source: 'helper' | 'registry' | 'none';
}

export const MODULES: AgentModule[] = (manifest.modules as AgentModule[]);

export const HELPER_BASE = 'http://127.0.0.1:8791';

let cachedToken: string | null = null;

interface HelperHealth {
  ok: boolean;
  name: string;
  version: string;
  token: string;
}

export interface HelperModuleRow {
  id: string;
  installed: string | null;
  latest: string | null;
  outdated: boolean;
}

export async function helperHealth(signal?: AbortSignal): Promise<HelperHealth | null> {
  try {
    const res = await fetch(`${HELPER_BASE}/health`, { signal });
    if (!res.ok) return null;
    const h = (await res.json()) as HelperHealth;
    if (h?.token) cachedToken = h.token;
    return h;
  } catch {
    return null;
  }
}

async function helperModules(signal?: AbortSignal): Promise<HelperModuleRow[] | null> {
  if (!cachedToken) {
    const h = await helperHealth(signal);
    if (!h) return null;
  }
  try {
    const res = await fetch(`${HELPER_BASE}/modules`, {
      headers: { 'x-am-token': cachedToken ?? '' },
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as HelperModuleRow[];
  } catch {
    return null;
  }
}

// Compare two dotted version strings. Returns true if `latest` > `installed`.
export function isNewer(installed: string | null, latest: string | null): boolean {
  if (!installed || !latest) return false;
  const norm = (v: string) =>
    v.replace(/^v/, '').split(/[.+-]/).map((p) => parseInt(p, 10) || 0);
  const a = norm(installed);
  const b = norm(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (y > x) return true;
    if (y < x) return false;
  }
  return false;
}

async function npmLatest(pkg: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, { signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { version?: string };
    return j.version ?? null;
  } catch {
    return null;
  }
}

// Build the full module state list. Uses the helper when available; otherwise
// falls back to the public npm registry for latest-only (pip modules show
// "helper offline" since PyPI's JSON API isn't CORS-readable from the browser).
export async function loadModuleStates(signal?: AbortSignal): Promise<{
  states: ModuleState[];
  helperOnline: boolean;
}> {
  const fromHelper = await helperModules(signal);
  const helperOnline = fromHelper != null;
  const byId = new Map<string, HelperModuleRow>();
  if (fromHelper) for (const r of fromHelper) byId.set(r.id, r);

  const states = await Promise.all(
    MODULES.map(async (m): Promise<ModuleState> => {
      const h = byId.get(m.id);
      if (h) {
        return {
          ...m,
          installed: h.installed,
          latest: h.latest,
          outdated: h.outdated,
          source: 'helper',
        };
      }
      // Helper offline / module not reported — try a CORS-safe latest lookup.
      const latest = m.registry === 'npm' ? await npmLatest(m.package, signal) : null;
      return {
        ...m,
        installed: null,
        latest,
        outdated: false,
        source: latest ? 'registry' : 'none',
      };
    }),
  );

  return { states, helperOnline };
}

export interface UpdateResult {
  ok: boolean;
  id: string;
  output: string;
  installed_after: string | null;
  error?: string;
}

// Trigger an actual update via the local helper. The helper runs ONLY the
// manifest's allowlisted updateCmd for this id.
export async function updateModule(id: string, signal?: AbortSignal): Promise<UpdateResult> {
  if (!cachedToken) {
    const h = await helperHealth(signal);
    if (!h) {
      return { ok: false, id, output: '', installed_after: null, error: 'helper_offline' };
    }
  }
  const res = await fetch(`${HELPER_BASE}/update`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-am-token': cachedToken ?? '' },
    body: JSON.stringify({ id }),
    signal,
  });
  if (!res.ok) {
    return {
      ok: false,
      id,
      output: '',
      installed_after: null,
      error: `helper_http_${res.status}`,
    };
  }
  return (await res.json()) as UpdateResult;
}
