import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChangePasswordPage from './ChangePasswordPage';

vi.mock('../services/api', () => ({ changePassword: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ mustChangePassword: true, refresh: vi.fn().mockResolvedValue(undefined) }),
}));

describe('ChangePasswordPage', () => {
  it('lands on the Dashboard after a successful change', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/change-password']}>
        <Routes>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/" element={<p>Dashboard</p>} />
          <Route path="/candidates" element={<p>Candidates list</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(container.querySelector('#current-password')!, 'old-password');
    await user.type(container.querySelector('#new-password')!, 'new-password-1');
    await user.type(container.querySelector('#confirm-password')!, 'new-password-1');
    await user.click(screen.getByRole('button', { name: /change password|update password|save/i }));

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});
