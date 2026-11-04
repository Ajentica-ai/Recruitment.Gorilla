<!-- phase: DONE | branch: fix/RG-236/Damaged-pdf-upload-500 | tasks: 3/3
     base: fdeeec2 | updated: 2026-10-28
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-236 a damaged CV upload is a 400, not a 500 (bug, standard)
## Tasks
- [x] Repro tests first (HTTP, ApiFixture): a %PDF- file with garbage content is a 400 with the
      message, no new file in Uploads, no draft row for the batch; same for a PK-signed but corrupt
      "docx"; a valid PDF (MinimalPdf) still succeeds
- [x] CVUploadController.Upload: try/catch(Exception) around parser.Parse; on catch, intake.Delete,
      log a warning with the exception, notify "error" progress, return BadRequest(message)
- [x] Full dotnet test; verify once via the real API with a hand-made broken.pdf
## Tests
- Standard: failing tests first, kept as regression tests.
## Files
- Controllers/CVUploadController.cs, Tests/Infrastructure/ApiFixture.cs (+2 small helpers: list
  Uploads dir, count drafts by batchId), a new CVUploadTests.cs (or similar)
