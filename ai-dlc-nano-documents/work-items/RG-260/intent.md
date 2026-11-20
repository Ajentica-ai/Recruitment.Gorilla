# Explore in-browser LLM extraction for CV upload (regex parser as fallback)
- Source: issue #260 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/260
- Type: feature (label: enhancement; also frontend, backend, cv-parsing)
## Request
- Regex CV parser misses or invents fields; the issue proposed a small in-browser LLM (WebLLM) with the regex parser as fallback.
## Decisions
- Spike first, localhost only, WebLLM default model host -> confirmed
- 2026-11-12 spike result: 0.6B ran (83% fields, ~30 s/CV), 1.7B lost the GPU, 4B hit a storage quota; best AI did not beat the regex parser.
- 2026-11-12 DIRECTION CHANGE (user): no AI model. Use Tesseract.js OCR for scans. All AI code removed (engine, schemas, WebLLM dep).
- 2026-11-17 OCR-in-upload plan approved incl. migration; built: server ocrText + OcrTextRepair + ReadFromScan, client scan OCR in BulkUploader, review badge.
## Out of scope
- Any in-browser or server AI model; gateway TLS; model hosting
## Follow-ups
- Real-browser e2e (scratch DB): degraded scan filled name/email/phone/links, OCR status and review badge shown; text PDF took the old path.
- Branch is off develop: merging PR #302 (RG-259) will conflict in CVParserService, CandidateDraftService and the draft DTOs; merge develop in first.
- OCR spike (6 scanned CVs): ~0.7-2 s/page, word recall 99% clean / 96% blurry. Server regex on OCR text: 92% / 83% fields (RG-259 parser), 86% / 77% (develop).
- OCR damages URLs and emails on blurry scans (slash read as a letter, spaces in emails): a cleanup step is the obvious next piece.
