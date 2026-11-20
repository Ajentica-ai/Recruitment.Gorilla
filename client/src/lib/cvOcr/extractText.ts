import type { PDFDocumentProxy } from 'pdfjs-dist';
import { normalizeText, pageToLines, type PositionedText } from './textLayout';

export interface ExtractedCv {
  text: string;
  /** Hyperlink targets found in PDF annotations; they are also appended to `text`. */
  links: string[];
  pageCount: number;
  /** True when the file has no usable text layer (a scan). The reviewer should be told, not given an empty parse. */
  noTextLayer: boolean;
  /** True when the text came from OCR (a scan or photo) rather than a text layer. Expect more recognition errors. */
  ocrUsed?: boolean;
  /** OCR time in ms, when OCR ran. */
  ocrMs?: number;
}

/** Below this many non-space characters a PDF is treated as a scan. Same as the server's MinTextLayerChars. */
export const MIN_TEXT_CHARS = 40;

const nonSpaceLength = (s: string) => s.replace(/\s/g, '').length;

/**
 * Opens a PDF with pdf.js. Heavy imports are dynamic so the main bundle stays small. Every document owns a
 * pdf.js worker, so the caller must release it with `closePdf` (or use `withPdf`), or the worker leaks.
 */
export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Releases a document and its pdf.js worker. Never throws. */
export async function closePdf(doc: PDFDocumentProxy | null | undefined): Promise<void> {
  try {
    await doc?.loadingTask.destroy();
  } catch {
    // Already destroyed or never fully opened: nothing left to free.
  }
}

/** Opens a PDF, runs `fn`, and always releases the document. */
export async function withPdf<T>(file: File, fn: (doc: PDFDocumentProxy) => Promise<T>): Promise<T> {
  const doc = await openPdf(file);
  try {
    return await fn(doc);
  } finally {
    await closePdf(doc);
  }
}

/**
 * True when the PDF has a real text layer. Stops at the first page that brings the count to MIN_TEXT_CHARS, so a
 * text PDF costs one page of work and only a scan is read to the end.
 */
export async function pdfHasTextLayer(doc: PDFDocumentProxy): Promise<boolean> {
  let chars = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    for (const it of content.items) {
      if (!('str' in it)) continue;
      chars += nonSpaceLength(normalizeText(it.str));
      if (chars >= MIN_TEXT_CHARS) return true;
    }
  }
  return false;
}

/** Extracts the text layer of an open PDF: column-aware lines plus link annotations. */
export async function extractPdfDocument(doc: PDFDocumentProxy): Promise<ExtractedCv> {
  const pages: string[] = [];
  const links = new Set<string>();

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PositionedText[] = [];
    for (const it of content.items) {
      if (!('str' in it)) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width });
    }
    pages.push(pageToLines(items, viewport.width).join('\n'));

    for (const a of await page.getAnnotations()) {
      const url: unknown = a.url ?? a.unsafeUrl;
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) links.add(url);
    }
  }

  const body = normalizeText(pages.join('\n\n'));
  const linkBlock = links.size > 0 ? `\n\n${[...links].join('\n')}` : '';
  return {
    text: body + linkBlock,
    links: [...links],
    pageCount: doc.numPages,
    noTextLayer: nonSpaceLength(body) < MIN_TEXT_CHARS,
  };
}

/** Extracts the text layer of a PDF in the browser with pdf.js. A scan has none: see extractCvText. */
export function extractPdf(file: File): Promise<ExtractedCv> {
  return withPdf(file, extractPdfDocument);
}

/** Extracts raw text from a .docx with mammoth (includes table cell text, unlike the server parser). */
export async function extractDocx(file: File): Promise<ExtractedCv> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = normalizeText(value);
  return {
    text,
    links: [],
    pageCount: 1,
    noTextLayer: nonSpaceLength(text) < MIN_TEXT_CHARS,
  };
}

const IMAGE_EXT = /\.(png|jpe?g)$/i;

/**
 * Picks the extractor by file type. A PDF with no text layer, or a PNG/JPG, goes through OCR
 * (Tesseract.js); everything else uses its own text. Legacy .doc is not accepted by server intake,
 * so it is not accepted here either.
 */
export async function extractCvText(file: File, opts: { ocr?: boolean } = {}): Promise<ExtractedCv> {
  const name = file.name.toLowerCase();
  const useOcr = opts.ocr !== false;
  if (name.endsWith('.docx')) return extractDocx(file);
  if (name.endsWith('.pdf')) {
    // One open document serves both the text-layer read and, for a scan, the OCR render.
    return withPdf(file, async (doc) => {
      const cv = await extractPdfDocument(doc);
      if (!cv.noTextLayer || !useOcr) return cv;
      const { ocrPdfDocument } = await import('./ocr');
      const ocr = await ocrPdfDocument(doc);
      return { text: ocr.text, links: cv.links, pageCount: ocr.pageCount, noTextLayer: nonSpaceLength(ocr.text) < MIN_TEXT_CHARS, ocrUsed: true, ocrMs: ocr.ms };
    });
  }
  if (IMAGE_EXT.test(name) && useOcr) {
    const { ocrImage } = await import('./ocr');
    const ocr = await ocrImage(file);
    return { text: ocr.text, links: [], pageCount: 1, noTextLayer: nonSpaceLength(ocr.text) < MIN_TEXT_CHARS, ocrUsed: true, ocrMs: ocr.ms };
  }
  throw new Error('Only .pdf, .docx, .png and .jpg files are supported.');
}
