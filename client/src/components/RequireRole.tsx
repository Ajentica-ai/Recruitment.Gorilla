import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';

/**
 * Gates a route's children behind one or more roles. Users who lack every listed
 * role are redirected to the Dashboard, the one page every role can open.
 */
export default function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { hasAnyRole } = useAuth();
  if (!hasAnyRole(...roles)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
