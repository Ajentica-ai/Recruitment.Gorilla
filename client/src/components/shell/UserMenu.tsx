import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';

import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/auth/AuthContext';

/**
 * The signed-in user's avatar in the topbar, expanding to their account menu.
 *
 * This replaces the user card that sat in the sidebar footer. Two reasons it
 * moved: the card was one of the first things the eye hit on a collapsed rail
 * yet held no navigation, and account controls belong with the other chrome
 * (notifications, theme) rather than at the foot of the nav list.
 */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const displayName = user.name ?? user.email ?? '';

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
        aria-label={`Account: ${displayName}`}
        title={displayName}
      >
        <Avatar name={user.name} email={user.email} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-64">
        <div className="flex items-center gap-4 p-2">
          <Avatar name={user.name} email={user.email} size="lg" />
          <div className="flex min-w-0 flex-col">
            <span
              className="truncate text-[length:var(--text-md)] font-semibold text-foreground"
              title={displayName}
            >
              {displayName}
            </span>
            <span className="truncate text-[length:var(--text-xs)] text-muted-foreground" title={user.email}>
              {user.email}
            </span>
          </div>
        </div>

        {user.roles.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2 pb-1">
            {user.roles.map((r) => (
              <Badge key={r} variant="outline">
                {r}
              </Badge>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/change-password">
            <KeyRound strokeWidth={1.75} aria-hidden="true" />
            Change password
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          variant="destructive"
          disabled={loggingOut}
          // Radix closes on select and then restores focus to the trigger.
          // Logging out unmounts the trigger, so the close is prevented and
          // navigation is what dismisses the menu.
          onSelect={(e) => {
            e.preventDefault();
            void handleLogout();
          }}
        >
          {loggingOut ? <Spinner /> : <LogOut strokeWidth={1.75} aria-hidden="true" />}
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
