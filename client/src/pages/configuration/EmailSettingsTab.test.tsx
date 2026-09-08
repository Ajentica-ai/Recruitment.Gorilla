import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import EmailSettingsTab from './EmailSettingsTab';
import { getEmailSettings, saveEmailSettings, sendTestEmail } from '../../services/api';
import type { EmailSettings } from '../../types';

vi.mock('../../services/api', () => ({
  getEmailSettings: vi.fn(),
  saveEmailSettings: vi.fn(),
  sendTestEmail: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: true, user: { email: 'admin@recruitmentgorilla.com' } }),
}));

const mockEmailSettings: EmailSettings = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'smtp_user@recruitmentgorilla.com',
  fromAddress: 'notifications@recruitmentgorilla.com',
  fromName: 'Recruitment Gorilla',
  useStartTls: true,
  enabled: false,
  passwordSet: true,
  updatedAt: '2026-09-01T10:00:00Z',
};

describe('EmailSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmailSettings).mockResolvedValue(mockEmailSettings);
    vi.mocked(saveEmailSettings).mockResolvedValue({
      ...mockEmailSettings,
      enabled: true,
    });
    vi.mocked(sendTestEmail).mockResolvedValue({ ok: true, error: null });
  });

  it('renders 2-column configuration layout and initial values correctly', async () => {
    renderWithProviders(<EmailSettingsTab />);

    expect(await screen.findByText('SMTP Server Configuration')).toBeInTheDocument();
    expect(screen.getByText('Quick Setup Presets')).toBeInTheDocument();
    expect(screen.getByText('Delivery Control')).toBeInTheDocument();
    expect(screen.getByText('Send Test Email')).toBeInTheDocument();

    expect(screen.getByDisplayValue('smtp.gmail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('587')).toBeInTheDocument();
    expect(screen.getByDisplayValue('smtp_user@recruitmentgorilla.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('notifications@recruitmentgorilla.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('admin@recruitmentgorilla.com')).toBeInTheDocument();
  });

  it('applies quick setup presets when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('smtp.gmail.com');

    const m365Btn = screen.getByRole('button', { name: /Microsoft 365 \/ Outlook/i });
    await user.click(m365Btn);

    expect(screen.getByDisplayValue('smtp.office365.com')).toBeInTheDocument();
  });

  it('submits updated settings when save button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('smtp.gmail.com');

    const hostInput = screen.getByDisplayValue('smtp.gmail.com');
    await user.clear(hostInput);
    await user.type(hostInput, 'smtp.sendgrid.net');

    const saveButton = screen.getByRole('button', { name: /save settings/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(saveEmailSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.sendgrid.net',
          port: 587,
          fromAddress: 'notifications@recruitmentgorilla.com',
        }),
      );
    });
  });

  it('sends a test email and displays success feedback', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('admin@recruitmentgorilla.com');

    const sendTestBtn = screen.getByRole('button', { name: /send test email/i });
    await user.click(sendTestBtn);

    await waitFor(() => {
      expect(sendTestEmail).toHaveBeenCalledWith('admin@recruitmentgorilla.com');
      expect(screen.getByText('Test Successful')).toBeInTheDocument();
    });
  });
});
