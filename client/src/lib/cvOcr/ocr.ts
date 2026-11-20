import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { normalizeText } from './textLayout';
import { withPdf } from './extractText';

/** Pages OCR'd per PDF. A CV is rarely longer, and each page costs seconds of CPU. */
const MAX_OCR_PAGES = 4;
/** Render scale: 2x of the 72 dpi PDF space is about 144 dpi, enough for body text without a huge canvas. */
const RENDER_SCALE = 2;
/** A worker idle this long is terminated to free its memory (wasm heap plus language data, tens of MB). */
const WORKER_IDLE_MS = 60_000;

export interface OcrProgress {
  page: number;
  pages: number;
  status: string;
  progress: number;
}

export interface OcrResult {
  text: string;
  pageCount: number;
  ms: number;
}

type LogMessage = { status: string; progress: number };

/*
 * One Tesseract worker is shared by every OCR job. Starting a worker loads the wasm core and the language data
 * (about a second even from cache), so a batch of scans pays that once instead of once per file. Jobs run one
 * at a time because a worker holds a single Tesseract instance. The worker is dropped after an error (its state
 * is unknown) and after WORKER_IDLE_MS without work.
 */
let workerPromise: Promise<TesseractWorker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let currentLog: ((m: LogMessage) => void) | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, { logger: (m: LogMessage) => currentLog?.(m) }),
    );
    // A worker that failed to start must not be handed out again.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/** Terminates the shared worker now. Safe to call at any time; the next job starts a new one. */
export async function terminateOcrWorker(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    await (await pending).terminate();
  } catch {
    // It never started or is already gone.
  }
}

/** Runs `job` with exclusive use of the shared worker, routing its progress messages to `onLog`. */
function runExclusive<T>(job: (worker: TesseractWorker) => Promise<T>, onLog?: (m: LogMessage) => void): Promise<T> {
  const run = queue.then(async () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    currentLog = onLog ?? null;
    try {
      return await job(await getWorker());
    } catch (e) {
      await terminateOcrWorker();
      throw e;
    } finally {
      currentLog = null;
      if (workerPromise) idleTimer = setTimeout(() => void terminateOcrWorker(), WORKER_IDLE_MS);
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

function finish(parts: string[], pageCount: number, t0: number): OcrResult {
  return { text: normalizeText(parts.join('\n\n')).trim(), pageCount, ms: Math.round(performance.now() - t0) };
}

/**
 * OCR for CVs with no text layer (scans, photos, "print to image" PDFs). Tesseract.js only reads
 * characters out of an image; it does not know what a name or an employer is, so its output still goes
 * through the same field extraction as any other CV text.
 * The worker, wasm core and language data are fetched from Tesseract.js's default CDN on first use;
 * production would self-host them.
 */
export function ocrPages(images: Array<HTMLCanvasElement | Blob>, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  const t0 = performance.now();
  let page = 0;
  return runExclusive(
    async (worker) => {
      const parts: string[] = [];
      for (let i = 0; i < images.length; i++) {
        page = i + 1;
        parts.push((await worker.recognize(images[i])).data.text);
      }
      return finish(parts, images.length, t0);
    },
    (m) => onProgress?.({ page, pages: images.length, status: m.status, progress: m.progress }),
  );
}

async function renderPage(doc: PDFDocumentProxy, n: number): Promise<HTMLCanvasElement> {
  const pdfPage = await doc.getPage(n);
  const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available in this browser.');
  await pdfPage.render({ canvasContext: context, canvas, viewport }).promise;
  pdfPage.cleanup();
  return canvas;
}

/** Frees a canvas's pixel buffer now instead of waiting for garbage collection (about 8 MB per A4 page at 2x). */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Renders the first pages of an open PDF and OCRs them. Pages are pipelined: page n+1 renders on the main
 * thread while the worker reads page n, and only two canvases are alive at once. The caller owns `doc`.
 */
export function ocrPdfDocument(doc: PDFDocumentProxy, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  const t0 = performance.now();
  const pages = Math.min(doc.numPages, MAX_OCR_PAGES);
  let page = 0;
  return runExclusive(
    async (worker) => {
      const parts: string[] = [];
      let next: Promise<HTMLCanvasElement> | null = renderPage(doc, 1);
      try {
        for (let n = 1; n <= pages; n++) {
          const canvas: HTMLCanvasElement = await next!;
          next = n < pages ? renderPage(doc, n + 1) : null;
          page = n;
          try {
            parts.push((await worker.recognize(canvas)).data.text);
          } finally {
            release(canvas);
          }
        }
      } finally {
        // On an error, still free a page that was rendering ahead.
        if (next) void next.then(release, () => undefined);
      }
      return { ...finish(parts, pages, t0), pageCount: doc.numPages };
    },
    (m) => onProgress?.({ page, pages, status: m.status, progress: m.progress }),
  );
}

/** Opens a PDF, OCRs its first pages, and releases it. */
export function ocrPdf(file: File, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  return withPdf(file, (doc) => ocrPdfDocument(doc, onProgress));
}

/** OCRs a single image file (PNG, JPG). */
export function ocrImage(file: File, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  return ocrPages([file], onProgress);
}
