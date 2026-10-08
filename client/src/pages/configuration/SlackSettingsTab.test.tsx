import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import SlackSettingsTab from './SlackSettingsTab';
import { getSlackSettings, saveSlackSettings, sendTestSlack } from '../../services/api';
import type { SlackSettings } from '../../types';

vi.mock('../../services/api', () => ({
  getSlackSettings: vi.fn(),
  saveSlackSettings: vi.fn(),
  sendTestSlack: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: true, user: { email: 'admin@recruitmentgorilla.com' } }),
}));

const mockSlackSettings: SlackSettings = {
  enabled: false,
  botTokenSet: true,
  configFallback: false,
  updatedAt: '2026-09-01T10:00:00Z',
  categories: [
    { key: 'InterviewAssigned', label: 'Interview assigned', slackEnabled: false },
    { key: 'EvaluationSubmitted', label: 'Evaluation submitted', slackEnabled: true },
    { key: 'RecruiterAssigned', label: 'Assigned to job opening', slackEnabled: false },
  ],
};

describe('SlackSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSlackSettings).mockResolvedValue(mockSlackSettings);
    vi.mocked(saveSlackSettings).mockResolvedValue({
      ...mockSlackSettings,
      enabled: true,
    });
    vi.mocked(sendTestSlack).mockResolvedValue({ ok: true, error: null });
  });

  it('renders the configuration layout and the saved categories', async () => {
    renderWithProviders(<SlackSettingsTab />);

    expect(await screen.findByText('Slack Bot Configuration')).toBeInTheDocument();
    expect(screen.getByText('Delivery Control')).toBeInTheDocument();
    expect(screen.getByText('Send Test Message')).toBeInTheDocument();

    expect(screen.getByText('Interview assigned')).toBeInTheDocument();
    expect(screen.getByText('Evaluation submitted')).toBeInTheDocument();
    expect(screen.getByText('Assigned to job opening')).toBeInTheDocument();
    expect(screen.getByDisplayValue('admin@recruitmentgorilla.com')).toBeInTheDocument();
  });

  it('submits the enabled flag and category toggles when save is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SlackSettingsTab />);

    await screen.findByText('Interview assigned');

    // Turn the master switch on and flip one category.
    await user.click(screen.getByText('Slack Delivery is Disabled'));
    await user.click(screen.getByText('Interview assigned'));

    const saveButton = screen.getByRole('button', { name: /save settings/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(saveSlackSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          botToken: null, // left blank — keeps the stored token
          enabled: true,
          categories: expect.arrayContaining([
            { key: 'InterviewAssigned', slackEnabled: true },
            { key: 'EvaluationSubmitted', slackEnabled: true },
            { key: 'RecruiterAssigned', slackEnabled: false },
          ]),
        }),
      );
    });
  });

  it('sends a test Slack message and displays success feedback', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SlackSettingsTab />);

    await screen.findByDisplayValue('admin@recruitmentgorilla.com');

    const sendTestBtn = screen.getByRole('button', { name: /send test message/i });
    await user.click(sendTestBtn);

    await waitFor(() => {
      expect(sendTestSlack).toHaveBeenCalledWith('admin@recruitmentgorilla.com');
      expect(screen.getByText('Test Successful')).toBeInTheDocument();
    });
  });

  it('shows the delivery error message when the test send fails', async () => {
    vi.mocked(sendTestSlack).mockResolvedValue({ ok: false, error: 'users_not_found' });
    const user = userEvent.setup();
    renderWithProviders(<SlackSettingsTab />);

    await screen.findByDisplayValue('admin@recruitmentgorilla.com');
    await user.click(screen.getByRole('button', { name: /send test message/i }));

    await waitFor(() => {
      expect(screen.getByText('Delivery Error')).toBeInTheDocument();
      expect(screen.getByText('users_not_found')).toBeInTheDocument();
    });
  });
});
