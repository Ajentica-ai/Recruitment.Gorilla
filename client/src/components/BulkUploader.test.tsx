import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { uploadCV } from '../services/api';
import BulkUploader from './BulkUploader';

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
  it('renders dropzone prompt correctly', () => {
    const handleParsed = vi.fn();
    renderWithProviders(<BulkUploader onDraftsParsed={handleParsed} />);

    expect(screen.getByText(/Drag & drop CVs here/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF or Word \(\.docx\)/i)).toBeInTheDocument();
  });

  it('reports a 409 response as a skipped duplicate, not a parse failure', async () => {
    vi.mocked(uploadCV).mockRejectedValueOnce({
      response: { status: 409, data: 'This CV has already been uploaded for an existing candidate.' },
    });
    const handleParsed = vi.fn();
    const { container } = renderWithProviders(<BulkUploader onDraftsParsed={handleParsed} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['cv'], 'jane.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText(/Skipped 1 duplicate CV that has already been uploaded: jane\.pdf/i)).toBeInTheDocument();
    expect(screen.queryByText(/Could not parse/i)).not.toBeInTheDocument();
    expect(handleParsed).not.toHaveBeenCalled();
  });
});
