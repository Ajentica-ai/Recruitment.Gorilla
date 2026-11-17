import { beforeEach, describe, expect, it, vi } from 'vitest';

const tess = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
  createWorker: vi.fn(),
}));

vi.mock('tesseract.js', () => ({ createWorker: tess.createWorker }));
vi.mock('./extractText', () => ({ openPdf: vi.fn() }));

import { ocrImage, ocrPages } from './ocr';

beforeEach(() => {
  vi.clearAllMocks();
  tess.terminate.mockResolvedValue(undefined);
  tess.createWorker.mockResolvedValue({ recognize: tess.recognize, terminate: tess.terminate });
});

describe('ocrPages', () => {
  it('recognises each image, joins the pages and cleans the text', async () => {
    tess.recognize
      .mockResolvedValueOnce({ data: { text: 'Jane Doe\nEngineer\n' } })
      .mockResolvedValueOnce({ data: { text: `Page two ${String.fromCharCode(0xfb01)}nance` } });
    const result = await ocrPages([new Blob(['a']), new Blob(['b'])]);
    expect(result.text).toBe('Jane Doe\nEngineer\n\n\nPage two finance');
    expect(result.pageCount).toBe(2);
    expect(tess.createWorker).toHaveBeenCalledWith('eng', 1, expect.objectContaining({ logger: expect.any(Function) }));
  });

  it('terminates the worker even when recognition fails', async () => {
    tess.recognize.mockRejectedValue(new Error('bad image'));
    await expect(ocrPages([new Blob(['a'])])).rejects.toThrow('bad image');
    expect(tess.terminate).toHaveBeenCalledTimes(1);
  });

  it('reports progress with the page being read', async () => {
    tess.createWorker.mockImplementation(async (_lang: string, _n: number, opts: { logger: (m: unknown) => void }) => ({
      recognize: async () => {
        opts.logger({ status: 'recognizing text', progress: 0.5 });
        return { data: { text: 'x' } };
      },
      terminate: tess.terminate,
    }));
    const seen: Array<{ page: number; pages: number; progress: number }> = [];
    await ocrPages([new Blob(['a'])], (p) => seen.push({ page: p.page, pages: p.pages, progress: p.progress }));
    expect(seen).toEqual([{ page: 1, pages: 1, progress: 0.5 }]);
  });
});

describe('ocrImage', () => {
  it('runs OCR on a single image file', async () => {
    tess.recognize.mockResolvedValue({ data: { text: 'Scanned CV text' } });
    const r = await ocrImage(new File(['x'], 'scan.png'));
    expect(r.text).toBe('Scanned CV text');
    expect(r.pageCount).toBe(1);
  });
});
