import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pdfHasTextLayer: vi.fn(),
  ocrPdfDocument: vi.fn(),
  openPdf: vi.fn(),
  closePdf: vi.fn(),
}));
const doc = { numPages: 1 };
vi.mock('./extractText', () => ({
  pdfHasTextLayer: mocks.pdfHasTextLayer,
  // Same contract as the real withPdf: open, run, always close.
  withPdf: async (file: File, fn: (d: unknown) => Promise<unknown>) => {
    const d = await mocks.openPdf(file);
    try {
      return await fn(d);
    } finally {
      mocks.closePdf(d);
    }
  },
}));
vi.mock('./ocr', () => ({ ocrPdfDocument: mocks.ocrPdfDocument }));

import { MAX_OCR_CHARS, readScanText } from './scanText';

const pdf = (name = 'cv.pdf') => new File(['x'], name, { type: 'application/pdf' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.openPdf.mockResolvedValue(doc);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('readScanText', () => {
  it('skips anything that is not a PDF', async () => {
    expect(await readScanText(new File(['x'], 'cv.docx'))).toBeNull();
    expect(mocks.openPdf).not.toHaveBeenCalled();
  });

  it('returns null at once for a PDF that has its own text, without running OCR', async () => {
    mocks.pdfHasTextLayer.mockResolvedValue(true);
    expect(await readScanText(pdf())).toBeNull();
    expect(mocks.ocrPdfDocument).not.toHaveBeenCalled();
    expect(mocks.closePdf).toHaveBeenCalledWith(doc);
  });

  it('OCRs a scan from the same open document, tells the caller it started, and returns the trimmed text', async () => {
    mocks.pdfHasTextLayer.mockResolvedValue(false);
    mocks.ocrPdfDocument.mockResolvedValue({ text: '  Jane Doe\njane@example.com  ', pageCount: 1, ms: 700 });
    const onOcrStart = vi.fn();
    expect(await readScanText(pdf(), { onOcrStart })).toBe('Jane Doe\njane@example.com');
    expect(onOcrStart).toHaveBeenCalledTimes(1);
    expect(mocks.openPdf).toHaveBeenCalledTimes(1);
    expect(mocks.ocrPdfDocument).toHaveBeenCalledWith(doc);
    expect(mocks.closePdf).toHaveBeenCalledTimes(1);
  });

  it('returns null when OCR finds nothing', async () => {
    mocks.pdfHasTextLayer.mockResolvedValue(false);
    mocks.ocrPdfDocument.mockResolvedValue({ text: '   ', pageCount: 1, ms: 300 });
    expect(await readScanText(pdf())).toBeNull();
  });

  it('caps the text it sends', async () => {
    mocks.pdfHasTextLayer.mockResolvedValue(false);
    mocks.ocrPdfDocument.mockResolvedValue({ text: 'x'.repeat(MAX_OCR_CHARS + 500), pageCount: 1, ms: 1 });
    expect((await readScanText(pdf()))?.length).toBe(MAX_OCR_CHARS);
  });

  it('never blocks an upload: any failure returns null and the document is still released', async () => {
    mocks.pdfHasTextLayer.mockResolvedValue(false);
    mocks.ocrPdfDocument.mockRejectedValue(new Error('worker failed to load'));
    expect(await readScanText(pdf())).toBeNull();
    expect(mocks.closePdf).toHaveBeenCalledTimes(1);
    mocks.openPdf.mockRejectedValue(new Error('not a pdf'));
    expect(await readScanText(pdf())).toBeNull();
  });
});
