import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { clearTokens, isLead } from '../lib/auth';

// v0.3.0 CWS review fix (cat-choir CRIT-03): only surface nav links that
// resolve to real pages. Audit, Firehose, Modmail, and Mods are tracked
// in Phase 2B and will come back once their routes return real data.
// Routes remain registered in App.tsx so direct URLs still work during
// development; they're just hidden from the primary nav.
const LINKS: { to: string; label: string; leadOnly?: boolean }[] = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
];

export function Layout() {
  const navigate = useNavigate();
  const lead = isLead();

  function onLogout() {
    clearTokens();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-full">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <div className="text-sm font-semibold tracking-tight text-ink">GAW Dashboard</div>
          <ul className="flex flex-1 gap-1">
            {LINKS.filter((l) => !l.leadOnly || lead).map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'rounded px-3 py-1.5 text-sm',
                      isActive
                        ? 'bg-slate-100 text-ink'
                        : 'text-muted hover:bg-slate-50 hover:text-ink',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-muted hover:text-ink"
          >
            Log out
          </button>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
