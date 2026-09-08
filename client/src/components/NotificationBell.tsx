import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/api';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types';

const relativeTime = (iso: string): string => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** Topbar notification bell: unread dot + a panel of recent notifications. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  const readOne = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const openItem = (n: AppNotification) => {
    setOpen(false);
    if (!n.isRead) readOne.mutate(n.id);
    if (n.linkUrl) navigate(n.linkUrl);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell strokeWidth={1.75} aria-hidden="true" />
          {/* A count, not a number in a red circle: the count IS the
              information, and the ring matches the rail behind it so the badge
              reads as sitting on the bell rather than floating over it. */}
          {unread > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1',
                'bg-destructive text-[10px] leading-4 font-bold text-white',
                'ring-2 ring-rail',
              )}
              aria-hidden="true"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <span className="text-[length:var(--text-md)] font-semibold">Notifications</span>
          {unread > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => readAll.mutate()}
              disabled={readAll.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-muted-foreground">
            No notifications.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={cn(
                  'flex w-full flex-col gap-0.5 rounded-[var(--radius-md)] px-2 py-2 text-left',
                  'transition-colors duration-[var(--dur-fast)] hover:bg-accent',
                  'focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] outline-none',
                  // Unread is carried by weight and a dot, not by a tinted
                  // row — a list where half the rows are tinted reads as a
                  // selection, not as a read state.
                  !n.isRead && 'font-medium',
                )}
                onClick={() => openItem(n)}
              >
                <span className="flex items-center gap-2">
                  {!n.isRead && (
                    <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[length:var(--text-md)] text-foreground">
                    {n.title}
                  </span>
                  <span className="shrink-0 text-[length:var(--text-2xs)] text-muted-foreground">
                    {relativeTime(n.createdAt)}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-[length:var(--text-sm)] font-normal text-muted-foreground',
                    !n.isRead && 'ps-3.5',
                  )}
                >
                  {n.message}
                </span>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
