import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { downloadImportTemplate, importJsonCandidate } from '../services/api';
import JsonImporter from './JsonImporter';

vi.mock('../services/api', () => ({
  importJsonCandidate: vi.fn(),
  downloadImportTemplate: vi.fn().mockResolvedValue(undefined),
  getActiveRoleOptions: vi.fn().mockResolvedValue([]),
}));

const manifest = (entries: object[]) =>
  new File([`// instructions\n${JSON.stringify({ candidates: entries })}`], 'candidates.json', { type: 'application/json' });
const cv = (name: string) => new File(['cv'], name, { type: 'application/pdf' });

const drop = async (container: HTMLElement, files: File[]) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, files);
};

describe('JsonImporter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads the template', async () => {
    renderWithProviders(<JsonImporter onDraftsParsed={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Download JSON template/i }));
    expect(downloadImportTemplate).toHaveBeenCalledTimes(1);
  });

  it('pre-checks the entries and imports only the valid ones', async () => {
    vi.mocked(importJsonCandidate).mockResolvedValue({
      draft: { id: 7, fullName: 'Jane Doe' } as never,
      warnings: ["No job opening is named 'Ghost'; pick the role in review."],
    });
    const onParsed = vi.fn();
    const { container } = renderWithProviders(<JsonImporter onDraftsParsed={onParsed} />);

    await drop(container, [
      manifest([
        { cvFileName: 'jane.pdf', fullName: 'Jane Doe', email: 'jane@test.com', role: 'Ghost' },
        { cvFileName: 'missing.pdf', fullName: 'No File', email: 'nofile@test.com' },
      ]),
      cv('jane.pdf'),
    ]);

    const table = await screen.findByRole('table', { name: /Import pre-check/i });
    expect(within(table).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(table).getByText('No CV named "missing.pdf" was added.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Import 1 candidate' }));

    expect(await screen.findByText('Staged')).toBeInTheDocument();
    expect(importJsonCandidate).toHaveBeenCalledTimes(1);
    const [entry, file] = vi.mocked(importJsonCandidate).mock.calls[0];
    expect(entry).toMatchObject({ cvFileName: 'jane.pdf', email: 'jane@test.com' });
    expect(file.name).toBe('jane.pdf');
    expect(screen.getByText(/pick the role in review/)).toBeInTheDocument();
    expect(onParsed).toHaveBeenCalledWith([expect.objectContaining({ id: 7 })], expect.stringMatching(/^batch_/));
  });

  it('shows a 409 as a duplicate', async () => {
    vi.mocked(importJsonCandidate).mockRejectedValueOnce({
      response: { status: 409, data: 'This CV has already been uploaded for an existing candidate.' },
    });
    const onParsed = vi.fn();
    const { container } = renderWithProviders(<JsonImporter onDraftsParsed={onParsed} />);

    await drop(container, [manifest([{ cvFileName: 'jane.pdf', fullName: 'Jane Doe', email: 'jane@test.com' }]), cv('jane.pdf')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Import 1 candidate' }));

    expect(await screen.findByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText(/already been uploaded/)).toBeInTheDocument();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it('refuses two JSON files in one drop', async () => {
    const { container } = renderWithProviders(<JsonImporter onDraftsParsed={vi.fn()} />);
    await drop(container, [manifest([]), new File(['{}'], 'other.json', { type: 'application/json' })]);
    expect(await screen.findByText('Add one JSON file at a time.')).toBeInTheDocument();
  });
});
