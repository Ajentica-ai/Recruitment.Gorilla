import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import UsersPage from './UsersPage';
import type { UserListItem } from '../types';

vi.mock('../services/api', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  resetUserPassword: vi.fn(),
}));
import { getUsers, updateUser, resetUserPassword } from '../services/api';

const user: UserListItem = {
  id: 1, name: 'Ada Lovelace', email: 'ada@test.com', roles: ['Admin'], isActive: true,
  mustChangePassword: false, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null,
};

describe('UsersPage dialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUsers).mockResolvedValue([user]);
  });

  const openRowAction = async (action: string) => {
    const ue = userEvent.setup();
    renderWithProviders(<UsersPage />);
    await ue.click(await screen.findByRole('button', { name: 'Actions for Ada Lovelace' }));
    await ue.click(await screen.findByRole('menuitem', { name: action }));
    return ue;
  };

  it('Cancel on the Edit user form closes it without saving or toasting', async () => {
    const ue = await openRowAction('Edit user');
    await screen.findByText('Edit user', { selector: '[data-slot="dialog-title"], h2' });

    await ue.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.queryByText('User updated.')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Cancel on the Reset password form closes it without resetting', async () => {
    const ue = await openRowAction('Reset password');
    await screen.findByText('Reset password', { selector: '[data-slot="dialog-title"], h2' });
    await ue.keyboard('longenough1'); // the password field is auto-focused
    // Cancel must not submit the form. The API call itself is not a reliable signal here, because
    // closing the dialog clears the reset target before the mutation function runs.
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    document.addEventListener('submit', onSubmit);

    await ue.click(screen.getByRole('button', { name: 'Cancel' }));
    document.removeEventListener('submit', onSubmit);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(resetUserPassword).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('UsersPage table', () => {
  it('left-aligns every data column header so it lines up with its cells', async () => {
    vi.mocked(getUsers).mockResolvedValue([user]);
    renderWithProviders(<UsersPage />);
    await screen.findByText('Ada Lovelace');

    for (const name of ['Name', 'Email', 'Roles', 'Status', 'Last login']) {
      expect(screen.getByRole('columnheader', { name })).toHaveClass('text-left');
    }
  });
});
