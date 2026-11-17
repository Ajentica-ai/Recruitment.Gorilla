import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ extractPdf: vi.fn(), ocrPdf: vi.fn() }));
vi.mock('./extractText', () => ({ extractPdf: mocks.extractPdf }));
vi.mock('./ocr', () => ({ ocrPdf: mocks.ocrPdf }));

import { MAX_OCR_CHARS, readScanText } from './scanText';

const pdf = (name = 'cv.pdf') => new File(['x'], name, { type: 'application/pdf' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('readScanText', () => {
  it('skips anything that is not a PDF', async () => {
    expect(await readScanText(new File(['x'], 'cv.docx'))).toBeNull();
    expect(mocks.extractPdf).not.toHaveBeenCalled();
  });

  it('returns null at once for a PDF that has its own text, without running OCR', async () => {
    mocks.extractPdf.mockResolvedValue({ text: 'lots of text', noTextLayer: false });
    expect(await readScanText(pdf())).toBeNull();
    expect(mocks.ocrPdf).not.toHaveBeenCalled();
  });

  it('runs OCR for a scan, tells the caller it started, and returns the trimmed text', async () => {
    mocks.extractPdf.mockResolvedValue({ text: '', noTextLayer: true });
    mocks.ocrPdf.mockResolvedValue({ text: '  Jane Doe\njane@example.com  ', pageCount: 1, ms: 700 });
    const onOcrStart = vi.fn();
    expect(await readScanText(pdf(), { onOcrStart })).toBe('Jane Doe\njane@example.com');
    expect(onOcrStart).toHaveBeenCalledTimes(1);
  });

  it('returns null when OCR finds nothing', async () => {
    mocks.extractPdf.mockResolvedValue({ text: '', noTextLayer: true });
    mocks.ocrPdf.mockResolvedValue({ text: '   ', pageCount: 1, ms: 300 });
    expect(await readScanText(pdf())).toBeNull();
  });

  it('caps the text it sends', async () => {
    mocks.extractPdf.mockResolvedValue({ text: '', noTextLayer: true });
    mocks.ocrPdf.mockResolvedValue({ text: 'x'.repeat(MAX_OCR_CHARS + 500), pageCount: 1, ms: 1 });
    expect((await readScanText(pdf()))?.length).toBe(MAX_OCR_CHARS);
  });

  it('never blocks an upload: any failure returns null', async () => {
    mocks.extractPdf.mockResolvedValue({ text: '', noTextLayer: true });
    mocks.ocrPdf.mockRejectedValue(new Error('worker failed to load'));
    expect(await readScanText(pdf())).toBeNull();
    mocks.extractPdf.mockRejectedValue(new Error('not a pdf'));
    expect(await readScanText(pdf())).toBeNull();
  });
});
