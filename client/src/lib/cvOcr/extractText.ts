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

/** Below this many characters a PDF is treated as a scan. */
const MIN_TEXT_CHARS = 40;

/** Opens a PDF with pdf.js. Heavy imports are dynamic so the main bundle stays small. */
export async function openPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Extracts the text layer of a PDF in the browser with pdf.js. A scan has none: see extractCvText. */
export async function extractPdf(file: File): Promise<ExtractedCv> {
  const doc = await openPdf(file);
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
    noTextLayer: body.replace(/\s/g, '').length < MIN_TEXT_CHARS,
  };
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
    noTextLayer: text.replace(/\s/g, '').length < MIN_TEXT_CHARS,
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
    const cv = await extractPdf(file);
    if (!cv.noTextLayer || !useOcr) return cv;
    const { ocrPdf } = await import('./ocr');
    const ocr = await ocrPdf(file);
    return { text: ocr.text, links: [], pageCount: ocr.pageCount, noTextLayer: ocr.text.replace(/\s/g, '').length < MIN_TEXT_CHARS, ocrUsed: true, ocrMs: ocr.ms };
  }
  if (IMAGE_EXT.test(name) && useOcr) {
    const { ocrImage } = await import('./ocr');
    const ocr = await ocrImage(file);
    return { text: ocr.text, links: [], pageCount: 1, noTextLayer: ocr.text.replace(/\s/g, '').length < MIN_TEXT_CHARS, ocrUsed: true, ocrMs: ocr.ms };
  }
  throw new Error('Only .pdf, .docx, .png and .jpg files are supported.');
}
