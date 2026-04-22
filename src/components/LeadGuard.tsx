import { ReactNode } from 'react';
import { isLead } from '../lib/auth';

export function LeadGuard({ children }: { children: ReactNode }) {
  if (!isLead()) {
    return (
      <div className="p-8">
        <div className="max-w-md rounded border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-ink">403 - Lead access required</h1>
          <p className="mt-2 text-sm text-muted">
            This page requires a valid lead token. Log out and re-enter both tokens to access.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
