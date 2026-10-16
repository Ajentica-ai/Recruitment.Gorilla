import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import EmailDeliveryTab from './EmailDeliveryTab';
import { getEmailOutbox, resendEmail } from '../../services/api';
import type { OutboundEmail, PagedResult } from '../../types';

vi.mock('../../services/api', () => ({
  getEmailOutbox: vi.fn(),
  resendEmail: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: true, user: { email: 'admin@recruitmentgorilla.com' } }),
}));

const makeEmail = (overrides: Partial<OutboundEmail> = {}): OutboundEmail => ({
  id: 1,
  toEmail: 'jane@example.com',
  toName: 'Jane Doe',
  subject: 'Interview assigned: Jane Doe',
  status: 'Sent',
  provider: 'Smtp',
  attempts: 1,
  lastError: null,
  providerMessageId: null,
  nextAttemptAt: '2026-09-01T10:00:00Z',
  createdAt: '2026-09-01T09:59:00Z',
  sentAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
  ...overrides,
});

const paged = (items: OutboundEmail[]): PagedResult<OutboundEmail> => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 50,
});

describe('EmailDeliveryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the delivery log with a status badge', async () => {
    vi.mocked(getEmailOutbox).mockResolvedValue(paged([makeEmail()]));

    renderWithProviders(<EmailDeliveryTab />);

    const recipientCell = await screen.findByText('jane@example.com');
    const row = recipientCell.closest('tr')!;
    expect(within(row).getByText('Interview assigned: Jane Doe')).toBeInTheDocument();
    expect(within(row).getByText('Sent')).toBeInTheDocument();
  });

  it('shows an empty state when nothing has been sent', async () => {
    vi.mocked(getEmailOutbox).mockResolvedValue(paged([]));

    renderWithProviders(<EmailDeliveryTab />);

    expect(await screen.findByText('No emails match')).toBeInTheDocument();
  });

  it('offers Resend only for a Failed or Unknown email', async () => {
    vi.mocked(getEmailOutbox).mockResolvedValue(
      paged([
        makeEmail({ id: 1, toEmail: 'sent@example.com', status: 'Sent' }),
        makeEmail({ id: 2, toEmail: 'failed@example.com', status: 'Failed', lastError: 'smtp_auth_failed' }),
      ])
    );

    renderWithProviders(<EmailDeliveryTab />);
    await screen.findByText('sent@example.com');

    expect(screen.queryByRole('button', { name: /actions for email to sent@example.com/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions for email to failed@example.com/i })).toBeInTheDocument();
  });

  it('resends a failed email after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(getEmailOutbox).mockResolvedValue(
      paged([makeEmail({ id: 2, toEmail: 'failed@example.com', status: 'Failed', lastError: 'smtp_auth_failed' })])
    );
    vi.mocked(resendEmail).mockResolvedValue({ ok: true, error: null });

    renderWithProviders(<EmailDeliveryTab />);
    await screen.findByText('failed@example.com');

    await user.click(screen.getByRole('button', { name: /actions for email to failed@example.com/i }));
    await user.click(await screen.findByText('Resend'));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(resendEmail).toHaveBeenCalledWith(2));
  });

  it('surfaces a resend failure', async () => {
    const user = userEvent.setup();
    vi.mocked(getEmailOutbox).mockResolvedValue(
      paged([makeEmail({ id: 2, toEmail: 'failed@example.com', status: 'Failed' })])
    );
    vi.mocked(resendEmail).mockResolvedValue({ ok: false, error: 'Email is not configured.' });

    renderWithProviders(<EmailDeliveryTab />);
    await screen.findByText('failed@example.com');

    await user.click(screen.getByRole('button', { name: /actions for email to failed@example.com/i }));
    await user.click(await screen.findByText('Resend'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(resendEmail).toHaveBeenCalled());
  });
});
