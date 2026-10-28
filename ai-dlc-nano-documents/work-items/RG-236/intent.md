# A damaged PDF upload returns 500 instead of a clear error
- Source: issue #236 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/236
- Type: bug
## Request
POST /api/cvupload: a file starting with the PDF signature but damaged inside throws
UglyToad.PdfPig.Core.PdfDocumentFormatException from CVParserService.Parse, uncaught -> 500.
Other bad files already get a 400. Fix: a 400 with a plain message, no draft row, no file left on disk.
## Decisions
- Wrap the parser.Parse call in the controller in try/catch(Exception); on failure: delete the stored
  file (intake.Delete, already used for this by CandidateImportController), log a warning with the
  exception, notify progress "error" like other rejections, return 400 with a message by file type
  ("This PDF/Word document could not be read. It may be damaged or password-protected.") -> go with recommendation
- Catch-all (not PdfPig/OpenXml-specific types) so an encrypted PDF gets the same treatment by
  construction; not separately tested (no local tooling to craft a valid encrypted-PDF fixture,
  no network access) -> go with recommendation
- Only CVUploadController is affected; CandidateImportController never calls the parser directly
  (checked, no sibling) -> go with recommendation
## Out of scope
- Encrypted-PDF-specific test fixture; the unrelated backlog items RG-83 (institution name truncation)
  and RG-93 (duplicate-upload race) in the same controller/area.
## Follow-ups
