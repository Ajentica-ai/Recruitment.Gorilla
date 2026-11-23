import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import SidebarNav from './SidebarNav';
import { getCandidateDrafts } from '../../services/api';

vi.mock('../../services/api', () => ({ getCandidateDrafts: vi.fn() }));

// The signed-in user; a pending password change must stop the badge request (#264).
const auth = vi.hoisted(() => ({ mustChangePassword: false }));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { roles: ['Recruiter'] },
    mustChangePassword: auth.mustChangePassword,
  }),
}));

const renderNav = () =>
  renderWithProviders(
    <SidebarNav isVisible isCollapsed={false} onToggleCollapse={vi.fn()} onHide={vi.fn()} />,
  );

describe('SidebarNav pending-drafts badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mustChangePassword = false;
    vi.mocked(getCandidateDrafts).mockResolvedValue({ items: [], totalPending: 2 } as never);
  });

  it('asks for the pending-draft count for a normal user', async () => {
    renderNav();
    await waitFor(() => expect(getCandidateDrafts).toHaveBeenCalled());
  });

  it('makes no request while a password change is pending', async () => {
    auth.mustChangePassword = true;
    renderNav();

    await new Promise((r) => setTimeout(r, 50));
    expect(getCandidateDrafts).not.toHaveBeenCalled();
  });
});
