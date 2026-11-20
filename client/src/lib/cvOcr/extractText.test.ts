import { beforeEach, describe, expect, it, vi } from 'vitest';

const ocr = vi.hoisted(() => ({ ocrImage: vi.fn(), ocrPdf: vi.fn() }));
vi.mock('./ocr', () => ocr);

import { extractCvText } from './extractText';

beforeEach(() => vi.clearAllMocks());

describe('extractCvText routing', () => {
  it('sends a PNG or JPG through OCR and marks the result', async () => {
    ocr.ocrImage.mockResolvedValue({ text: 'Jane Doe is a software engineer with many years of experience', pageCount: 1, ms: 700 });
    const cv = await extractCvText(new File(['x'], 'scan.JPG'));
    expect(ocr.ocrImage).toHaveBeenCalledTimes(1);
    expect(cv.ocrUsed).toBe(true);
    expect(cv.ocrMs).toBe(700);
    expect(cv.noTextLayer).toBe(false);
  });

  it('flags an image whose OCR text is nearly empty as having no text', async () => {
    ocr.ocrImage.mockResolvedValue({ text: ' ', pageCount: 1, ms: 300 });
    expect((await extractCvText(new File(['x'], 'blank.png'))).noTextLayer).toBe(true);
  });

  it('does not OCR an image when OCR is switched off', async () => {
    await expect(extractCvText(new File(['x'], 'scan.png'), { ocr: false })).rejects.toThrow(/Only .pdf/);
    expect(ocr.ocrImage).not.toHaveBeenCalled();
  });

  it('rejects unsupported types such as legacy .doc', async () => {
    await expect(extractCvText(new File(['x'], 'cv.doc'))).rejects.toThrow(/Only .pdf, .docx, .png and .jpg/);
  });
});
