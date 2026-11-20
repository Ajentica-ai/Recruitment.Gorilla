/**
 * Reads the text of a scanned PDF in the browser so the server has something to parse. The server cannot read a
 * scan: it has no text layer, so the draft would come out empty. A PDF with real text returns null at once (the
 * server reads it from the file), and so does anything that goes wrong here, so a failed OCR never blocks an upload.
 */

/** OCR text beyond this is not sent: the server ignores more than 200,000 characters anyway. */
export const MAX_OCR_CHARS = 200_000;

export async function readScanText(file: File, opts: { onOcrStart?: () => void } = {}): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith('.pdf')) return null;
  try {
    const { withPdf, pdfHasTextLayer } = await import('./extractText');
    // The PDF is opened once: the text-layer probe stops at the first page with enough text, and a scan goes
    // straight to OCR from the same document.
    const text = await withPdf(file, async (doc) => {
      if (await pdfHasTextLayer(doc)) return null;
      opts.onOcrStart?.();
      const { ocrPdfDocument } = await import('./ocr');
      return (await ocrPdfDocument(doc)).text;
    });
    const trimmed = text?.trim() ?? '';
    if (trimmed.length === 0) return null;
    return trimmed.length > MAX_OCR_CHARS ? trimmed.slice(0, MAX_OCR_CHARS) : trimmed;
  } catch (e) {
    console.warn('Could not read the scan in the browser; uploading without OCR text.', e);
    return null;
  }
}
