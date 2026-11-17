import { normalizeText } from './textLayout';
import { openPdf } from './extractText';

/** Pages OCR'd per PDF. A CV is rarely longer, and each page costs seconds of CPU. */
const MAX_OCR_PAGES = 4;
/** Render scale: 2x of the 72 dpi PDF space is about 144 dpi, enough for body text without a huge canvas. */
const RENDER_SCALE = 2;

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

/**
 * OCR for CVs with no text layer (scans, photos, "print to image" PDFs). Tesseract.js only reads
 * characters out of an image; it does not know what a name or an employer is, so its output still goes
 * through the same field extraction as any other CV text. A PDF page is rendered to a canvas first.
 * The worker, wasm core and language data are fetched from Tesseract.js's default CDN on first use;
 * production would self-host them.
 */
export async function ocrPages(images: Array<HTMLCanvasElement | Blob>, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  const t0 = performance.now();
  const { createWorker } = await import('tesseract.js');
  let page = 0;
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) =>
      onProgress?.({ page, pages: images.length, status: m.status, progress: m.progress }),
  });
  try {
    const parts: string[] = [];
    for (let i = 0; i < images.length; i++) {
      page = i + 1;
      const { data } = await worker.recognize(images[i]);
      parts.push(data.text);
    }
    return { text: normalizeText(parts.join('\n\n')).trim(), pageCount: images.length, ms: Math.round(performance.now() - t0) };
  } finally {
    await worker.terminate();
  }
}

/** Renders the first pages of a PDF to canvases and OCRs them. */
export async function ocrPdf(file: File, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  const doc = await openPdf(file);
  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, MAX_OCR_PAGES); n++) {
    const pdfPage = await doc.getPage(n);
    const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available in this browser.');
    await pdfPage.render({ canvasContext: context, canvas, viewport }).promise;
    canvases.push(canvas);
  }
  const result = await ocrPages(canvases, onProgress);
  return { ...result, pageCount: doc.numPages };
}

/** OCRs a single image file (PNG, JPG). */
export function ocrImage(file: File, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  return ocrPages([file], onProgress);
}
