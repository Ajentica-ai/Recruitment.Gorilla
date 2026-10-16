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
  provider: 'Smtp',
  host: 'smtp.gmail.com',
  port: 587,
  user: 'smtp_user@recruitmentgorilla.com',
  fromAddress: 'notifications@recruitmentgorilla.com',
  fromName: 'Recruitment Gorilla',
  useStartTls: true,
  apiBaseUrl: 'https://hr-notif-api.example.com',
  allowedRecipientDomains: 'ajentica.ai',
  enabled: false,
  passwordSet: true,
  apiKeySet: false,
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

    expect(await screen.findByText('Email Configuration')).toBeInTheDocument();
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
          provider: 'Smtp',
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

  it('shows the delivery error and message when a test send fails', async () => {
    const user = userEvent.setup();
    vi.mocked(sendTestEmail).mockResolvedValue({ ok: false, error: 'Email delivery error: smtp_auth_failed' });
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('admin@recruitmentgorilla.com');
    await user.click(screen.getByRole('button', { name: /send test email/i }));

    await waitFor(() => {
      expect(screen.getByText('Delivery Error')).toBeInTheDocument();
      expect(screen.getByText('Email delivery error: smtp_auth_failed')).toBeInTheDocument();
    });
  });

  it('switches to the Notification API provider and shows its fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('smtp.gmail.com');
    await user.click(screen.getByRole('radio', { name: /notification api/i }));

    expect(screen.getByDisplayValue('https://hr-notif-api.example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ajentica.ai')).toBeInTheDocument();
    expect(screen.queryByText('Quick Setup Presets')).not.toBeInTheDocument();
  });

  it('saves a blank API key as null (write-only, keeps the stored one)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('smtp.gmail.com');
    await user.click(screen.getByRole('radio', { name: /notification api/i }));
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(saveEmailSettings).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'HttpApi', apiKey: null }),
      );
    });
  });

  it('shows the message id when a test send through the Notification API succeeds', async () => {
    const user = userEvent.setup();
    vi.mocked(sendTestEmail).mockResolvedValue({ ok: true, error: null, messageId: 'msg-abc123' });
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('admin@recruitmentgorilla.com');
    await user.click(screen.getByRole('button', { name: /send test email/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/msg-abc123/).length).toBeGreaterThan(0);
    });
  });

  it('surfaces a save failure message from the server', async () => {
    const user = userEvent.setup();
    // Shaped like the axios error a 400 response produces (see isAxiosError usage in the component).
    vi.mocked(saveEmailSettings).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: "The base URL's host changed. Enter the API key again to confirm sending it to the new host.",
      },
    });
    renderWithProviders(<EmailSettingsTab />);

    await screen.findByDisplayValue('smtp.gmail.com');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Enter the API key again/).length).toBeGreaterThan(0);
    });
  });
});
