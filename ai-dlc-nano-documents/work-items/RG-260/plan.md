<!-- phase: DONE | branch: feature/RG-260/In-browser-CV-extraction-spike | tasks: 6/6 (OCR spike done, uncommitted)
     base: d63670d | updated: 2026-11-17
     next: user decides commit + push + PR (nothing committed); migration auto-applies on next API start -->
# Plan (DONE): Tesseract.js OCR for scanned CVs in the upload flow, no AI model
Done so far: lib/cvOcr (pdf.js, mammoth, Tesseract.js) and a dev-only test page. All AI code removed.
## Tasks
- [x] Server: optional ocrText on POST /api/cvupload (size capped); when the file has no text layer, parse that text with the existing parser
- [x] Server: cleanup of OCR damage before parsing (slash read as a letter in URLs, spaces inside emails)
- [x] Server: keep a flag on the draft that it was read from a scan (migration) so the reviewer is warned
- [x] Client: BulkUploader detects a scan, runs OCR with progress, sends ocrText; falls back to the normal upload on any failure
- [x] Client: review screen notice for scan-sourced drafts; tests (xUnit + Vitest), docs
- [x] Verify with the 12 generated scans end to end; full dotnet and npm suites
## Tests (standard, upload path)
- xUnit: ocrText ignored when the file has text, size cap, cleanup rules, [Authorize] gate; Vitest: fallback path
## Files
- server: CVUploadController, CVParserService, Models, Migrations, DTOs, Tests; client: BulkUploader, DraftReviewWorkspace, api.ts, types
