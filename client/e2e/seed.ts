import { expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/**
 * Seeds a throwaway candidate the way the app itself does: upload a CV, then create the candidate
 * from that upload.
 *
 * Specs used to POST a candidate with a made-up stored file name. The API now accepts only a stored
 * name it issued, belonging to a draft the caller uploaded, so a seed has to go through a real
 * upload. Each call uploads different bytes, since the API also refuses a CV whose content it already
 * holds (#93), and the draft is discarded straight away so seeds do not pile up in the review queue.
 * Deleting the candidate afterwards removes the stored file with it.
 */
export async function seedCandidate(
  request: APIRequestContext,
  auth: Record<string, string>,
  label = 'E2E Probe',
): Promise<number> {
  const tag = randomUUID();
  const upload = await request.post('/api/cvupload', {
    headers: auth,
    multipart: {
      file: { name: `probe-${tag}.pdf`, mimeType: 'application/pdf', buffer: minimalPdf(`${label} ${tag}`) },
    },
  });
  expect(upload.ok(), `CV upload failed: ${upload.status()} ${await upload.text()}`).toBeTruthy();
  const draft = await upload.json();

  const initial = await (await request.get('/api/status-options/initial', { headers: auth })).json();
  const created = await request.post('/api/candidates', {
    headers: auth,
    data: {
      fullName: label,
      email: `probe-${tag}@example.invalid`,
      relevantExperience: '5 years',
      isReferred: false,
      storedFileName: draft.storedFileName,
      originalFileName: draft.originalFileName,
      fileType: draft.fileType,
      fileSizeBytes: draft.fileSizeBytes,
      initialStatus: initial[0].name,
      initialStatusComment: 'Seeded by an e2e spec.',
      allowDuplicate: true,
    },
  });
  expect(created.ok(), `seed failed: ${created.status()} ${await created.text()}`).toBeTruthy();

  await request.post(`/api/candidate-drafts/${draft.id}/discard`, { headers: auth }).catch(() => {});
  return (await created.json()).id as number;
}

/** A one-page PDF carrying a single line of text, unique per call so its hash is too. */
function minimalPdf(text: string): Buffer {
  const safe = text.replace(/[\\()]/g, '');
  const content = `BT /F1 12 Tf 56 760 Td (${safe}) Tj ET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
