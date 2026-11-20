import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { getActiveRoleOptions, uploadCV } from '../services/api';
import type { RoleAppliedOption } from '../types';
import { readScanText } from '../lib/cvOcr/scanText';
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

vi.mock('../lib/cvOcr/scanText', () => ({ readScanText: vi.fn().mockResolvedValue(null) }));

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

  it('explains the dead end when no job opening is available (issue #169)', async () => {
    // The reported bug: a recruiter with no assigned opening got an inert dropzone above an
    // empty dropdown, with nothing saying why or what to do.
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([]);
    renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    expect(await screen.findByText(/You are not assigned to a job opening/i)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a job opening first/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Drag & drop CVs here/i)).not.toBeInTheDocument();
  });

  it('does not flash the notice while the openings are still loading', async () => {
    // An empty list mid-flight is not evidence of anything. Asserted before the query settles.
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([openRole]);
    renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    expect(screen.queryByText(/You are not assigned to a job opening/i)).not.toBeInTheDocument();
    await screen.findByRole('option', { name: 'Backend Engineer' });
    expect(screen.queryByText(/You are not assigned to a job opening/i)).not.toBeInTheDocument();
  });

  it('says the opening has ended, not that none is assigned, when the deadline passed', async () => {
    // The recruiter IS assigned; the server returns the opening because it filters on IsActive
    // only. Telling them to ask for an assignment would send them after the wrong remedy.
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([closedRole]);
    renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    expect(await screen.findByText(/Your job openings have ended/i)).toBeInTheDocument();
    expect(screen.getByText(/extend the end date/i)).toBeInTheDocument();
    expect(screen.queryByText(/You are not assigned to a job opening/i)).not.toBeInTheDocument();
  });

  it('says so when the openings could not be loaded at all', async () => {
    // A failed request used to leave exactly the dead end this notice exists to remove.
    vi.mocked(getActiveRoleOptions).mockRejectedValueOnce(new Error('boom'));
    renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    expect(await screen.findByText(/Job openings could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a job opening first/i)).not.toBeInTheDocument();
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

  it('sends the OCR text of a scanned PDF with the upload and shows the OCR status', async () => {
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([openRole]);
    let release: (v: unknown) => void = () => {};
    vi.mocked(readScanText).mockImplementationOnce(async (_file, opts) => {
      opts?.onOcrStart?.();
      await new Promise((r) => (release = r));
      return 'Jane Doe jane@example.com';
    });
    vi.mocked(uploadCV).mockResolvedValueOnce({ id: 1, fullName: 'Jane Doe', readFromScan: true } as never);
    const callsBefore = vi.mocked(uploadCV).mock.calls.length;
    const { container } = renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    await screen.findByRole('option', { name: 'Backend Engineer' });
    await userEvent.selectOptions(screen.getByLabelText(/Target Job Opening/i), 'Backend Engineer');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['cv'], 'scan.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText(/Reading scan \(OCR\)/i)).toBeInTheDocument();
    release(undefined);
    await vi.waitFor(() => expect(uploadCV).toHaveBeenCalledTimes(callsBefore + 1));
    expect(vi.mocked(uploadCV).mock.calls.at(-1)?.[6]).toBe('Jane Doe jane@example.com');
  });

  it('uploads normally with no OCR text when the PDF already has text or OCR fails', async () => {
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([openRole]);
    vi.mocked(readScanText).mockResolvedValueOnce(null);
    vi.mocked(uploadCV).mockResolvedValueOnce({ id: 2, fullName: 'Sam' } as never);
    const callsBefore = vi.mocked(uploadCV).mock.calls.length;
    const { container } = renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    await screen.findByRole('option', { name: 'Backend Engineer' });
    await userEvent.selectOptions(screen.getByLabelText(/Target Job Opening/i), 'Backend Engineer');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['cv'], 'text.pdf', { type: 'application/pdf' }));

    await vi.waitFor(() => expect(uploadCV).toHaveBeenCalledTimes(callsBefore + 1));
    expect(vi.mocked(uploadCV).mock.calls.at(-1)?.[6]).toBeUndefined();
  });

  it('reads the next file while the current one uploads', async () => {
    vi.mocked(getActiveRoleOptions).mockResolvedValueOnce([openRole]);
    let finishUpload: (v: unknown) => void = () => {};
    vi.mocked(uploadCV).mockImplementationOnce(() => new Promise((r) => (finishUpload = r)) as never);
    vi.mocked(uploadCV).mockResolvedValueOnce({ id: 4, fullName: 'B' } as never);
    const scansBefore = vi.mocked(readScanText).mock.calls.length;
    const uploadsBefore = vi.mocked(uploadCV).mock.calls.length;
    const { container } = renderWithProviders(<BulkUploader onDraftsParsed={vi.fn()} />);

    await screen.findByRole('option', { name: 'Backend Engineer' });
    await userEvent.selectOptions(screen.getByLabelText(/Target Job Opening/i), 'Backend Engineer');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, [
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.pdf', { type: 'application/pdf' }),
    ]);

    // The first upload is still in flight, yet the second file has already been checked for a scan.
    await vi.waitFor(() => expect(vi.mocked(readScanText).mock.calls.length).toBe(scansBefore + 2));
    expect(vi.mocked(readScanText).mock.calls.at(-1)?.[0].name).toBe('b.pdf');
    finishUpload({ id: 3, fullName: 'A' });
    await vi.waitFor(() => expect(uploadCV).toHaveBeenCalledTimes(uploadsBefore + 2));
  });
});
