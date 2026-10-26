import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useToast } from './ToastStack';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';

/**
 * Gates a route's children behind one or more roles. Users who lack every listed
 * role are redirected to the Dashboard, the one page every role can open, and told why: without the message a
 * deep link to a page they cannot open just dropped them on the Dashboard unexplained (#198).
 */
export default function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { hasAnyRole } = useAuth();
  const { addToast } = useToast();
  const allowed = hasAnyRole(...roles);

  useEffect(() => {
    if (!allowed) addToast("You don't have access to that page.", 'warning');
  }, [allowed, addToast]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
