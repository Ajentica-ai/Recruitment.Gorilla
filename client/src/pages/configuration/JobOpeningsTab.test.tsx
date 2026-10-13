import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import JobOpeningsTab from './JobOpeningsTab';
import type { RoleAppliedOption } from '../../types';

vi.mock('../../services/api', () => ({
  getRoleOptions: vi.fn(),
  getRecruiterOptions: vi.fn(),
  createRoleOption: vi.fn(),
  updateRoleOption: vi.fn(),
  deleteRoleOption: vi.fn(),
  getEvaluationRubrics: vi.fn().mockResolvedValue([]),
  getJobOpeningOptions: vi.fn(),
}));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ isSuperAdmin: true }) }));
import { getRoleOptions, getRecruiterOptions, getJobOpeningOptions } from '../../services/api';

const opening = (over: Partial<RoleAppliedOption> = {}): RoleAppliedOption => ({
  id: 5, name: 'Backend Engineer', sortOrder: 1, isActive: true,
  location: null, department: null, priority: null,
  createdAt: '2026-01-01T00:00:00Z', endDate: '2027-12-31T00:00:00Z', title: 'Backend Engineer',
  recruiters: [], ...over,
});

/** Opens the edit modal for the first listed opening. */
const openEditModal = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit Backend Engineer' }));
  await screen.findByPlaceholderText('Search by name or email…');
  return user;
};

describe('JobOpeningsTab recruiter picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRoleOptions).mockResolvedValue([opening()]);
    vi.mocked(getJobOpeningOptions).mockResolvedValue([]);
    vi.mocked(getRecruiterOptions).mockResolvedValue([
      { id: 1, name: 'Rita Recruiter', email: 'rita@rg.local' },
    ]);
  });

  it('offers only the recruiter-eligible users the endpoint returns', async () => {
    renderWithProviders(<JobOpeningsTab />);
    const user = await openEditModal();

    // The picker must come from the recruiter-scoped endpoint, not the interviewer one.
    expect(getRecruiterOptions).toHaveBeenCalled();

    await user.click(screen.getByPlaceholderText('Search by name or email…'));
    expect(await screen.findByText(/Rita Recruiter/)).toBeInTheDocument();
  });

  it('keeps an already-assigned ineligible recruiter visible so it can be removed', async () => {
    // Saved before the list was restricted: assigned, but not returned as eligible.
    vi.mocked(getRoleOptions).mockResolvedValue([
      opening({ recruiters: [{ userId: 99, name: 'Ivy Interviewer' }] }),
    ]);

    renderWithProviders(<JobOpeningsTab />);
    await openEditModal();

    // Without the union it would vanish from the chips yet still be submitted on save.
    await waitFor(() =>
      expect(screen.getByText(/Ivy Interviewer — no candidate access/)).toBeInTheDocument(),
    );
  });
});

describe('JobOpeningsTab field lists', () => {
  const opt = (id: number, name: string) => ({ id, kind: '', name, sortOrder: id, isActive: true });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRecruiterOptions).mockResolvedValue([]);
    vi.mocked(getJobOpeningOptions).mockImplementation(async (kind) =>
      kind === 'location'
        ? [opt(1, 'Remote'), opt(2, 'Berlin HQ')]
        : kind === 'priority'
          ? [opt(3, 'Urgent')]
          : [opt(4, 'Legal')],
    );
  });

  it('offers the admin-managed values and keeps a deactivated current value selectable', async () => {
    vi.mocked(getRoleOptions).mockResolvedValue([opening({ location: 'Old Office', priority: 'Urgent' })]);

    renderWithProviders(<JobOpeningsTab />);
    await openEditModal();

    const option = (name: string) => screen.findByRole('option', { name });
    expect(await option('Berlin HQ')).toBeInTheDocument();
    expect(await option('Legal')).toBeInTheDocument();
    expect(await option('Urgent')).toBeInTheDocument();
    // Not in the active list, but this opening still has it, so it must not vanish.
    expect(await option('Old Office')).toBeInTheDocument();
    // The old hard-coded lists are gone.
    expect(screen.queryByRole('option', { name: 'Hybrid' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Medium' })).not.toBeInTheDocument();
  });
});