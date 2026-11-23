import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import NotificationBell from './NotificationBell';
import { getNotifications } from '../services/api';

vi.mock('../services/api', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

// Whether the signed-in user still has to change a temporary password (#264).
const auth = vi.hoisted(() => ({ value: undefined as { mustChangePassword: boolean } | undefined }));
vi.mock('../auth/AuthContext', () => ({ useOptionalAuth: () => auth.value }));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.value = undefined;
    vi.mocked(getNotifications).mockResolvedValue({ items: [], unreadCount: 0 });
  });

  it('polls notifications for a normal user', async () => {
    auth.value = { mustChangePassword: false };
    renderWithProviders(<NotificationBell />);

    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
  });

  it('makes no request while a password change is pending, since the API refuses everything else', async () => {
    auth.value = { mustChangePassword: true };
    renderWithProviders(<NotificationBell />);

    await new Promise((r) => setTimeout(r, 50));
    expect(getNotifications).not.toHaveBeenCalled();
  });
});
