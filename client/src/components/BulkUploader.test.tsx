import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { getActiveRoleOptions, uploadCV } from '../services/api';
import type { RoleAppliedOption } from '../types';
import BulkUploader from './BulkUploader';

const openRole: RoleAppliedOption = {
  id: 1,
  name: 'Backend Engineer',
  sortOrder: 1,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  title: 'Backend Engineer',
  recruiters: [],
};

const closedRole: RoleAppliedOption = {
  ...openRole,
  id: 2,
  name: 'Closed Opening',
  endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
};

vi.mock('../services/api', () => ({
  uploadCV: vi.fn(),
  getActiveRoleOptions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/signalr', () => ({
  startCVUploadHub: vi.fn().mockResolvedValue({
    on: vi.fn(),
    off: vi.fn(),
    invoke: vi.fn(),
    state: 'Connected',
  }),
  getCVUploadHubConnection: vi.fn().mockReturnValue({
    state: 'Connected',
    invoke: vi.fn(),
  }),
}));

describe('BulkUploader', () => {
  it('requires a job opening before the dropzone is usable, and hides closed openings', async () => {
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([openRole, closedRole]);
    renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    expect(screen.getByText(/Choose a job opening first/i)).toBeInTheDocument();

    const select = screen.getByLabelText(/Target Job Opening/i);
    await screen.findByRole('option', { name: 'Backend Engineer' });
    expect(screen.queryByText('Closed Opening')).not.toBeInTheDocument();

    await userEvent.selectOptions(select, 'Backend Engineer');

    expect(screen.getByText(/Drag & drop CVs here/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF or Word \(\.docx\)/i)).toBeInTheDocument();
  });

  it('reports a 409 response as a skipped duplicate, not a parse failure', async () => {
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([openRole]);
    vi.mocked(uploadCV).mockRejectedValueOnce({
      response: { status: 409, data: 'This CV has already been uploaded for an existing candidate.' },
    });
    const handleParsed = vi.fn();
    const { container } = renderWithProviders(<BulkUploader onDraftsParsed={handleParsed} />);

    await screen.findByRole('option', { name: 'Backend Engineer' });
    await userEvent.selectOptions(screen.getByLabelText(/Target Job Opening/i), 'Backend Engineer');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['cv'], 'jane.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText(/Skipped 1 duplicate CV that has already been uploaded: jane\.pdf/i)).toBeInTheDocument();
    expect(screen.queryByText(/Could not parse/i)).not.toBeInTheDocument();
    expect(handleParsed).not.toHaveBeenCalled();
  });
});
