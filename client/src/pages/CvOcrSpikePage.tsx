import { useState } from 'react';
import Page from '../components/common/Page';
import { extractCvText, type ExtractedCv } from '../lib/cvOcr/extractText';

interface Run {
  fileName: string;
  ms: number;
  cv: ExtractedCv;
  error?: string;
}

const EMPTY_CV: ExtractedCv = { text: '', links: [], pageCount: 0, noTextLayer: false };

/**
 * Dev-only page (RG-260): reads the text of a CV in the browser. A PDF with a text layer or a DOCX is read
 * directly; a scanned PDF or a PNG/JPG goes through OCR (Tesseract.js). Nothing is uploaded and the server
 * is not involved. Used to check text and OCR quality by hand.
 */
export default function CvOcrSpikePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const t0 = performance.now();
      try {
        const cv = await extractCvText(file);
        setRuns((r) => [{ fileName: file.name, ms: Math.round(performance.now() - t0), cv }, ...r]);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        setRuns((r) => [{ fileName: file.name, ms: Math.round(performance.now() - t0), cv: EMPTY_CV, error }, ...r]);
      }
    }
    setBusy(false);
  }

  return (
    <Page>
      <div>
        <h1 className="text-xl font-semibold">CV text and OCR (dev only)</h1>
        <p className="text-sm text-muted-foreground">
          A PDF with a text layer or a DOCX is read directly. A scanned PDF or a PNG/JPG is read with OCR (Tesseract.js),
          which downloads a few MB the first time. Nothing is uploaded and the server is not involved.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        CV files (.pdf, .docx, .png, .jpg)
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          disabled={busy}
          data-testid="cv-files"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </label>
      {busy && <p className="text-sm text-muted-foreground">Reading...</p>}

      {runs.map((run, i) => (
        <article key={`${run.fileName}-${i}`} className="flex flex-col gap-2 rounded-md border p-3">
          <h2 className="font-medium">{run.fileName}</h2>
          {run.error ? (
            <p className="text-sm text-destructive">{run.error}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {run.cv.ocrUsed ? `OCR, ${run.cv.ocrMs} ms` : 'Text layer'} - {run.ms} ms total, {run.cv.pageCount} page(s),{' '}
                {run.cv.text.length} chars{run.cv.noTextLayer ? ' - no text found' : ''}
              </p>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{run.cv.text}</pre>
            </>
          )}
        </article>
      ))}
    </Page>
  );
}
