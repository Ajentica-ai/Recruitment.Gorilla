import { expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { removeDrafts } from './cleanup';
import { openRoleId, requireData } from './helpers';

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
  const draft = await uploadDraft(request, auth, `${label} ${tag}`);

  // The candidate keeps the stored CV; the draft is only the way in. Remove it whether or not the seed
  // succeeds, rather than leave a pending or discarded row behind on every seed (#179).
  try {
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
    return (await created.json()).id as number;
  } finally {
    await removeDrafts(request, auth, [draft.id]);
  }
}

/**
 * Drives a seeded candidate from Uploaded to Recommended through the real status pipeline, so a
 * spec can reach a stage (Recommended, Offer Preparation, Offer Declined) that only Uploaded and a
 * few terminal statuses can be seeded into directly. Mirrors the setup `shared-with-me.spec.ts`
 * does for its own candidate, but with a single interviewer, since one submitted evaluation is all
 * Interview Completed requires.
 */
export async function advanceToRecommended(
  request: APIRequestContext,
  auth: Record<string, string>,
  candidateId: number,
  interviewerEmail: string,
): Promise<void> {
  const usersRes = await request.get('/api/interviews/assignable-users', { headers: auth });
  expect(usersRes.ok(), `assignable-users failed: ${usersRes.status()}`).toBeTruthy();
  const users = (await usersRes.json()) as { id: number; email: string }[];
  const interviewer = users.find((u) => u.email.toLowerCase() === interviewerEmail.toLowerCase());
  expect(interviewer, `${interviewerEmail} is not a valid active interviewer`).toBeTruthy();

  await postStatus(request, auth, candidateId, { status: 'Call for Interview' });
  await postStatus(request, auth, candidateId, {
    status: 'Interview Scheduled',
    interviewAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    interviewerUserIds: [interviewer!.id],
    interviewDurationMinutes: 60,
  });

  const detail = await request.get(`/api/candidates/${candidateId}`, { headers: auth });
  expect(detail.ok(), 'candidate detail failed').toBeTruthy();
  const history = (await detail.json()).statusHistory as { status: string; interviewId?: number }[];
  const interviewId = history.find((h) => h.status === 'Interview Scheduled' && h.interviewId)?.interviewId;
  expect(interviewId, 'no interview id on the Interview Scheduled status entry').toBeTruthy();

  const rubricRes = await request.get(`/api/evaluation-rubrics/for-interview/${interviewId}`, { headers: auth });
  expect(rubricRes.ok(), 'rubric lookup failed').toBeTruthy();
  const keys = ((await rubricRes.json()).criteria as { key: string }[]).map((k) => k.key);

  const evalRes = await request.put(`/api/interviews/${interviewId}/evaluation`, {
    headers: auth,
    data: {
      generalAssessment: 'Seeded by an e2e spec.',
      recommendation: 'Recommended',
      overallRating: 4,
      items: keys.map((key) => ({ criterionKey: key, rating: 4, comment: null })),
      submit: true,
    },
  });
  expect(evalRes.ok(), `evaluation submit failed: ${evalRes.status()} ${await evalRes.text()}`).toBeTruthy();

  await postStatus(request, auth, candidateId, { status: 'Interview Completed', comment: 'Seeded by an e2e spec.' });
  await postStatus(request, auth, candidateId, { status: 'Recommended', comment: 'Seeded by an e2e spec.' });
}

async function postStatus(
  request: APIRequestContext,
  auth: Record<string, string>,
  candidateId: number,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await request.post(`/api/candidates/${candidateId}/status`, { headers: auth, data });
  expect(res.ok(), `status change to '${data.status}' failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** A CV draft as the upload endpoint returns it; only the fields the specs read. */
export interface UploadedDraft {
  id: number;
  storedFileName: string;
  originalFileName: string;
  fileType: string;
  fileSizeBytes: number;
}

/**
 * Uploads a small unique PDF and returns the pending draft it creates, owned by whoever `auth`
 * signs in as. The caller discards it when done.
 *
 * A job opening is now required. Without one given, this resolves the first opening `auth` may
 * use (an Admin+'s first active opening, or a Recruiter's first assigned one) and skips the test
 * if there isn't one, rather than failing on an unrelated 400.
 */
export async function uploadDraft(
  request: APIRequestContext,
  auth: Record<string, string>,
  text = `E2E Probe ${randomUUID()}`,
  roleId?: number,
): Promise<UploadedDraft> {
  const resolvedRoleId = roleId ?? (await openRoleId(request, auth));
  requireData(resolvedRoleId !== undefined, 'an open job opening the signed-in user may use');

  const upload = await request.post('/api/cvupload', {
    headers: auth,
    multipart: {
      file: { name: `probe-${randomUUID()}.pdf`, mimeType: 'application/pdf', buffer: minimalPdf(text) },
      roleAppliedOptionId: String(resolvedRoleId),
    },
  });
  expect(upload.ok(), `CV upload failed: ${upload.status()} ${await upload.text()}`).toBeTruthy();
  return upload.json();
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
