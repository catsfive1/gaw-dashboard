import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveTokens } from '../lib/auth';

export function Login() {
  const navigate = useNavigate();
  const [mod, setMod] = useState('');
  const [lead, setLead] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mod.trim()) {
      setError('Mod token is required.');
      return;
    }
    saveTokens({ mod: mod.trim(), lead: lead.trim() || undefined });
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded border border-slate-200 bg-white p-6"
      >
        <h1 className="text-lg font-semibold text-ink">GAW Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Enter your mod token to continue.</p>

        <label className="mt-5 block text-xs font-medium text-ink">Mod token</label>
        <input
          type="password"
          autoComplete="off"
          value={mod}
          onChange={(e) => setMod(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        <label className="mt-4 block text-xs font-medium text-ink">
          Lead token <span className="text-muted">(optional)</span>
        </label>
        <input
          type="password"
          autoComplete="off"
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="mt-5 w-full rounded bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Sign in
        </button>

        <p className="mt-4 text-[11px] text-muted">
          Tokens are stored in your browser&apos;s localStorage and sent only as request headers.
        </p>
      </form>
    </div>
  );
}
