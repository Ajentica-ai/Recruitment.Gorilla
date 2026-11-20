import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tess = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
  createWorker: vi.fn(),
}));

vi.mock('tesseract.js', () => ({ createWorker: tess.createWorker }));
vi.mock('./extractText', () => ({ withPdf: vi.fn() }));

import { ocrImage, ocrPages, terminateOcrWorker } from './ocr';

beforeEach(() => {
  vi.clearAllMocks();
  tess.terminate.mockResolvedValue(undefined);
  tess.createWorker.mockResolvedValue({ recognize: tess.recognize, terminate: tess.terminate });
});

afterEach(async () => {
  await terminateOcrWorker();
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

  it('reuses one worker across jobs instead of starting one per file', async () => {
    tess.recognize.mockResolvedValue({ data: { text: 'x' } });
    await ocrPages([new Blob(['a'])]);
    await ocrPages([new Blob(['b'])]);
    expect(tess.createWorker).toHaveBeenCalledTimes(1);
    expect(tess.terminate).not.toHaveBeenCalled();
  });

  it('runs concurrent jobs one at a time on the shared worker', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    tess.recognize.mockImplementation(async () => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { data: { text: 'x' } };
    });
    await Promise.all([ocrPages([new Blob(['a'])]), ocrPages([new Blob(['b'])]), ocrPages([new Blob(['c'])])]);
    expect(maxInFlight).toBe(1);
  });

  it('terminates the worker when recognition fails, and the next job starts a fresh one', async () => {
    tess.recognize.mockRejectedValueOnce(new Error('bad image'));
    await expect(ocrPages([new Blob(['a'])])).rejects.toThrow('bad image');
    expect(tess.terminate).toHaveBeenCalledTimes(1);

    tess.recognize.mockResolvedValueOnce({ data: { text: 'ok' } });
    expect((await ocrPages([new Blob(['b'])])).text).toBe('ok');
    expect(tess.createWorker).toHaveBeenCalledTimes(2);
  });

  it('terminates an idle worker after a minute', async () => {
    vi.useFakeTimers();
    try {
      tess.recognize.mockResolvedValue({ data: { text: 'x' } });
      await ocrPages([new Blob(['a'])]);
      expect(tess.terminate).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(tess.terminate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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
