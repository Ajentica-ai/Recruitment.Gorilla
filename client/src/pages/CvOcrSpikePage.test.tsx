import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CvOcrSpikePage from './CvOcrSpikePage';

const mocks = vi.hoisted(() => ({ extractCvText: vi.fn() }));
vi.mock('../lib/cvOcr/extractText', () => ({ extractCvText: mocks.extractCvText }));

beforeEach(() => vi.clearAllMocks());

const upload = async (file: File) => {
  const user = userEvent.setup();
  render(<CvOcrSpikePage />);
  await user.upload(screen.getByTestId('cv-files'), file);
};

describe('CvOcrSpikePage', () => {
  it('shows the text of a CV read from its text layer', async () => {
    mocks.extractCvText.mockResolvedValue({ text: 'Jane Doe\nEngineer', links: [], pageCount: 1, noTextLayer: false });
    await upload(new File(['x'], 'jane.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('jane.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Text layer/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });

  it('marks a scan as read with OCR and shows how long it took', async () => {
    mocks.extractCvText.mockResolvedValue({ text: 'Scanned text', links: [], pageCount: 1, noTextLayer: false, ocrUsed: true, ocrMs: 700 });
    await upload(new File(['x'], 'scan.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/OCR, 700 ms/)).toBeInTheDocument();
  });

  it('says so when no text was found', async () => {
    mocks.extractCvText.mockResolvedValue({ text: '', links: [], pageCount: 1, noTextLayer: true, ocrUsed: true, ocrMs: 300 });
    await upload(new File(['x'], 'blank.png'));
    expect(await screen.findByText(/no text found/)).toBeInTheDocument();
  });

  it('shows the error for an unsupported file', async () => {
    mocks.extractCvText.mockRejectedValue(new Error('Only .pdf, .docx, .png and .jpg files are supported.'));
    await upload(new File(['x'], 'cv.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/Only .pdf, .docx, .png and .jpg/)).toBeInTheDocument();
  });
});
