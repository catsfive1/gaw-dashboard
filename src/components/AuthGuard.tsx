import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getModToken } from '../lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
  const loc = useLocation();
  if (!getModToken()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}
