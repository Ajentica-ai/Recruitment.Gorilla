import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import DraftReviewWorkspace from './DraftReviewWorkspace';
import type { CandidateDraft, CandidateDraftListItem } from '../../types';

vi.mock('../../services/api', () => ({
  getCandidateDrafts: vi.fn(),
  getCandidateDraft: vi.fn(),
  getDraftBatches: vi.fn(),
  updateCandidateDraft: vi.fn(),
  approveCandidateDraft: vi.fn(),
  bulkApproveCandidateDrafts: vi.fn(),
  discardCandidateDraft: vi.fn(),
  bulkDiscardCandidateDrafts: vi.fn(),
  getActiveRoleOptions: vi.fn(),
  getActiveSourceOptions: vi.fn(),
}));
import {
  getCandidateDrafts,
  getCandidateDraft,
  getDraftBatches,
  approveCandidateDraft,
  getActiveRoleOptions,
  getActiveSourceOptions,
} from '../../services/api';

const listItem: CandidateDraftListItem = {
  id: 7,
  fullName: 'Arif Hossain',
  email: 'arif.hossain@example.com',
  phone: null,
  currentTitle: 'Backend Engineer',
  relevantExperience: '3-5 Years',
  skills: null,
  roleAppliedOptionId: 5,
  roleAppliedOptionName: 'Backend Engineer',
  originalFileName: 'arif.pdf',
  storedFileName: 'stored-arif.pdf',
  fileType: 'PDF',
  fileSizeBytes: 1024,
  status: 'Pending',
  batchId: null,
  batchName: null,
  createdAt: '2026-10-01T00:00:00Z',
};

const draft: CandidateDraft = {
  ...listItem,
  summary: null,
  linkedInUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  sourceOptionId: null,
  sourceOptionName: null,
  sourceDetail: null,
  uploadedByUserId: null,
  uploadedByUserName: null,
  updatedAt: '2026-10-01T00:00:00Z',
  educations: [],
  experiences: [],
};

const setupUser = () => userEvent.setup({ delay: null });

/**
 * Fields are filled with a single change event rather than `user.type`. This workspace is a very
 * large component, and a per-character re-render of it blew past Vitest's 5s default timeout
 * whenever the suite ran in parallel. These tests assert the approve payload and the validation
 * rules, not keystroke handling, so one event per field loses no coverage.
 */
function setField(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Ticks the referral checkbox and fills the referrer fields it reveals. */
async function fillReferral(
  user: ReturnType<typeof userEvent.setup>,
  over: { name?: string; email?: string; employeeId?: string } = {},
) {
  await user.click(await screen.findByLabelText('Referred by an employee'));
  const { name = 'Nusrat Jahan', email = 'nusrat@ajentica.ai', employeeId = 'AJ-412' } = over;
  if (name) setField(/Referrer Name/i, name);
  if (email) setField(/Referrer Email/i, email);
  if (employeeId) setField(/Employee ID/i, employeeId);
}

const approve = () => screen.getByRole('button', { name: /Approve/i });

describe('DraftReviewWorkspace referral capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCandidateDrafts).mockResolvedValue({
      items: [listItem],
      totalCount: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      totalPending: 1,
      totalApproved: 0,
      totalDiscarded: 0,
      nextCursor: null,
    });
    vi.mocked(getCandidateDraft).mockResolvedValue(draft);
    vi.mocked(getDraftBatches).mockResolvedValue([]);
    vi.mocked(getActiveRoleOptions).mockResolvedValue([
      {
        id: 5,
        name: 'Backend Engineer',
        sortOrder: 1,
        isActive: true,
        location: null,
        department: null,
        priority: null,
        createdAt: '2026-01-01T00:00:00Z',
        endDate: '2027-12-31T00:00:00Z',
        title: 'Backend Engineer',
        recruiters: [],
      },
    ]);
    vi.mocked(getActiveSourceOptions).mockResolvedValue([
      { id: 1, name: 'Employee referral', sortOrder: 1, isActive: true },
    ]);
    vi.mocked(approveCandidateDraft).mockResolvedValue({
      message: 'Candidate approved & created successfully!',
      candidateId: 99,
    } as Awaited<ReturnType<typeof approveCandidateDraft>>);
  });

  it('hides the referrer fields until the box is ticked', async () => {
    renderWithProviders(<DraftReviewWorkspace />);

    expect(await screen.findByLabelText('Referred by an employee')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Referrer Name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Referrer Email/i)).not.toBeInTheDocument();
  });

  it('sends the referral on the approve payload', async () => {
    const user = setupUser();
    renderWithProviders(<DraftReviewWorkspace />);

    await fillReferral(user);
    await user.click(approve());

    await waitFor(() => expect(approveCandidateDraft).toHaveBeenCalled());
    expect(vi.mocked(approveCandidateDraft).mock.calls[0][0]).toBe(7);
    expect(vi.mocked(approveCandidateDraft).mock.calls[0][1]).toMatchObject({
      isReferred: true,
      referenceName: 'Nusrat Jahan',
      referenceEmail: 'nusrat@ajentica.ai',
      referenceEmployeeId: 'AJ-412',
    });
  });

  it('nulls the referrer sub-fields when the box is left unticked', async () => {
    const user = setupUser();
    renderWithProviders(<DraftReviewWorkspace />);

    await user.click(await screen.findByRole('button', { name: /Approve/i }));

    await waitFor(() => expect(approveCandidateDraft).toHaveBeenCalled());
    expect(vi.mocked(approveCandidateDraft).mock.calls[0][1]).toMatchObject({
      isReferred: false,
      referenceName: null,
      referenceEmail: null,
      referenceEmployeeId: null,
    });
  });

  it('blocks approval when the referrer name is missing', async () => {
    const user = setupUser();
    renderWithProviders(<DraftReviewWorkspace />);

    await fillReferral(user, { name: '' });
    await user.click(approve());

    expect(await screen.findByText(/Reference name is required/i)).toBeInTheDocument();
    expect(approveCandidateDraft).not.toHaveBeenCalled();
  });

  it('blocks approval when the referrer email is malformed', async () => {
    const user = setupUser();
    renderWithProviders(<DraftReviewWorkspace />);

    await fillReferral(user, { email: 'not-an-email' });
    await user.click(approve());

    expect(await screen.findByText(/valid reference email is required/i)).toBeInTheDocument();
    expect(approveCandidateDraft).not.toHaveBeenCalled();
  });

  it('clears a referrer field error as soon as the field is corrected', async () => {
    const user = setupUser();
    renderWithProviders(<DraftReviewWorkspace />);

    await fillReferral(user, { name: '' });
    await user.click(approve());
    expect(await screen.findByText(/Reference name is required/i)).toBeInTheDocument();

    setField(/Referrer Name/i, 'Nusrat Jahan');
    await waitFor(() =>
      expect(screen.queryByText(/Reference name is required/i)).not.toBeInTheDocument(),
    );
  });
});
