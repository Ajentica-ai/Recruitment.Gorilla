import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import DraftReviewWorkspace from './DraftReviewWorkspace';
import type { CandidateDraft, CandidateDraftListItem, PagedDraftsResult } from '../../types';

vi.mock('../../services/api', () => ({
  getCandidateDrafts: vi.fn(),
  getCandidateDraft: vi.fn(),
  getDraftBatches: vi.fn().mockResolvedValue([]),
  getActiveRoleOptions: vi.fn().mockResolvedValue([]),
  getActiveSourceOptions: vi.fn().mockResolvedValue([]),
  updateCandidateDraft: vi.fn(),
  estimateDraftExperience: vi.fn().mockResolvedValue({ relevantExperience: null }),
  approveCandidateDraft: vi.fn(),
  bulkApproveCandidateDrafts: vi.fn(),
  discardCandidateDraft: vi.fn(),
  bulkDiscardCandidateDrafts: vi.fn(),
  deleteCandidateDraft: vi.fn(),
  bulkDeleteCandidateDrafts: vi.fn(),
}));
import {
  getCandidateDrafts,
  getCandidateDraft,
  deleteCandidateDraft,
  bulkDeleteCandidateDrafts,
  approveCandidateDraft,
  estimateDraftExperience,
  getActiveRoleOptions,
  getActiveSourceOptions,
} from '../../services/api';

const item = (id: number, status: string): CandidateDraftListItem => ({
  id, fullName: `Person ${id}`, email: `p${id}@test.com`, phone: null, currentTitle: null,
  relevantExperience: null, skills: null, roleAppliedOptionId: null, roleAppliedOptionName: null,
  originalFileName: `cv${id}.pdf`, storedFileName: `s${id}.pdf`, fileType: 'PDF', fileSizeBytes: 100,
  status, batchId: null, batchName: null, createdAt: '2026-01-01T00:00:00Z',
});

const page = (items: CandidateDraftListItem[]): PagedDraftsResult => ({
  items, totalCount: items.length, page: 1, pageSize: 50, totalPages: 1,
  totalPending: 0, totalApproved: 0, totalDiscarded: items.length, nextCursor: null,
});

const detail = (i: CandidateDraftListItem): CandidateDraft => ({
  ...i, linkedInUrl: null, githubUrl: null, portfolioUrl: null, summary: null, sourceOptionId: null,
  sourceOptionName: null, sourceDetail: null, uploadedByUserId: null, uploadedByUserName: null,
  updatedAt: i.createdAt,
}) as unknown as CandidateDraft;

describe('DraftReviewWorkspace deleting discarded drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pending tab is empty; the Discarded tab holds two drafts.
    vi.mocked(getCandidateDrafts).mockImplementation(async (params) =>
      params?.status === 'Discarded' ? page([item(1, 'Discarded'), item(2, 'Discarded')]) : page([]),
    );
    vi.mocked(getCandidateDraft).mockImplementation(async (id) => detail(item(id, 'Discarded')));
    vi.mocked(deleteCandidateDraft).mockResolvedValue(undefined);
    vi.mocked(bulkDeleteCandidateDrafts).mockResolvedValue({ deletedCount: 2 });
  });

  const openDiscardedTab = async () => {
    const user = userEvent.setup();
    renderWithProviders(<DraftReviewWorkspace />);
    await user.click(await screen.findByRole('radio', { name: /Discarded/ }));
    return user;
  };

  it('offers Delete Draft (not Discard) for a discarded draft and deletes only after confirming', async () => {
    const user = await openDiscardedTab();

    const del = await screen.findByTitle('Delete Draft permanently');
    expect(screen.queryByTitle('Discard Draft')).not.toBeInTheDocument();

    await user.click(del);
    expect(deleteCandidateDraft).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(deleteCandidateDraft).toHaveBeenCalledWith(1));
  });

  it('bulk deletes the selected discarded drafts after confirming', async () => {
    const user = await openDiscardedTab();

    await user.click(await screen.findByRole('checkbox', { name: 'Select Person 1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Person 2' }));
    await user.click(await screen.findByRole('button', { name: /Delete Selected/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(bulkDeleteCandidateDrafts).toHaveBeenCalledWith({ draftIds: [1, 2] }));
  });

  it('keeps Discard (and no Delete) for a pending draft', async () => {
    vi.mocked(getCandidateDrafts).mockImplementation(async () => page([item(3, 'Pending')]));
    vi.mocked(getCandidateDraft).mockImplementation(async (id) => detail(item(id, 'Pending')));
    renderWithProviders(<DraftReviewWorkspace />);

    expect(await screen.findByTitle('Discard Draft')).toBeInTheDocument();
    expect(screen.queryByTitle('Delete Draft permanently')).not.toBeInTheDocument();
  });
});

describe('DraftReviewWorkspace relevant experience', () => {
  const openPending = async (relevantExperience: string | null) => {
    vi.mocked(getCandidateDrafts).mockImplementation(async () => page([item(7, 'Pending')]));
    vi.mocked(getCandidateDraft).mockImplementation(
      async (id) => ({ ...detail(item(id, 'Pending')), relevantExperience }) as CandidateDraft,
    );
    renderWithProviders(<DraftReviewWorkspace />);
    return screen.findByLabelText('Relevant experience');
  };

  it('shows the parsed value as selected', async () => {
    const group = await openPending('8+ Years');
    expect(within(group).getByRole('radio', { name: '8+ Years' })).toBeChecked();
  });

  it('offers the 2-3 Years band and shows it as selected', async () => {
    const group = await openPending('2-3 Years');
    expect(within(group).getByRole('radio', { name: '2-3 Years' })).toBeChecked();
  });

  it('does not invent a 3-5 Years default when nothing was parsed', async () => {
    const group = await openPending(null);
    expect(within(group).getByRole('radio', { name: '3-5 Years' })).not.toBeChecked();
    expect(screen.getByLabelText('Relevant experience, free text')).toHaveValue('');
  });

  it('explains why the role field is empty when no opening is available (#169)', async () => {
    // Approving a draft files the candidate against an opening, so the same dead end applies.
    // The module-level mock returns no openings.
    await openPending('3-5 Years');

    expect(await screen.findByText(/You are not assigned to a job opening/i)).toBeInTheDocument();
  });
});

describe('DraftReviewWorkspace relevant experience follows the roles', () => {
  const role = {
    jobTitle: 'Engineer',
    company: 'Alpha',
    duration: 'Jan 2010 - Dec 2011',
    startMonth: '2010-01',
    endMonth: '2011-12',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCandidateDrafts).mockImplementation(async () => page([item(7, 'Pending')]));
    vi.mocked(getCandidateDraft).mockImplementation(
      async (id) =>
        ({ ...detail(item(id, 'Pending')), relevantExperience: '1-2 Years', experiences: [role] }) as CandidateDraft,
    );
    // Stands in for the server: one role is 1-2 Years, two or more is 3-5 Years.
    vi.mocked(estimateDraftExperience).mockImplementation(async (roles) => ({
      relevantExperience: roles.length >= 2 ? '3-5 Years' : '1-2 Years',
    }));
  });

  const addSecondRole = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Add Experience/ }));
    const dates = await screen.findAllByLabelText('Duration / Dates');
    fireEvent.change(dates[1], { target: { value: 'Jan 2020 - Dec 2021' } });
  };

  const lastEstimateSettled = () =>
    act(async () => {
      await vi.mocked(estimateDraftExperience).mock.results.at(-1)?.value;
    });

  it('refreshes the value when a role is added and the field still follows the estimate', async () => {
    renderWithProviders(<DraftReviewWorkspace />);
    const group = await screen.findByLabelText('Relevant experience');
    await waitFor(() => expect(estimateDraftExperience).toHaveBeenCalled());
    await lastEstimateSettled();
    expect(within(group).getByRole('radio', { name: '1-2 Years' })).toBeChecked();

    await addSecondRole();

    await waitFor(
      () => expect(within(group).getByRole('radio', { name: '3-5 Years' })).toBeChecked(),
      { timeout: 3000 },
    );
  });

  it('leaves a value the reviewer picked by hand alone', async () => {
    renderWithProviders(<DraftReviewWorkspace />);
    const group = await screen.findByLabelText('Relevant experience');
    await waitFor(() => expect(estimateDraftExperience).toHaveBeenCalled());
    await lastEstimateSettled();

    fireEvent.click(within(group).getByRole('radio', { name: '8+ Years' }));
    await addSecondRole();

    await waitFor(
      () =>
        expect(estimateDraftExperience).toHaveBeenLastCalledWith(
          expect.arrayContaining([expect.objectContaining({ duration: 'Jan 2020 - Dec 2021' })]),
        ),
      { timeout: 3000 },
    );
    await lastEstimateSettled();
    expect(within(group).getByRole('radio', { name: '8+ Years' })).toBeChecked();
  });

  it('sends retyped dates as text so the server does not read the months parsed earlier', async () => {
    renderWithProviders(<DraftReviewWorkspace />);
    await screen.findByLabelText('Relevant experience');
    const dates = await screen.findAllByLabelText('Duration / Dates');

    fireEvent.change(dates[0], { target: { value: 'Jan 2012 - Dec 2013' } });

    await waitFor(
      () =>
        expect(estimateDraftExperience).toHaveBeenLastCalledWith([
          { duration: 'Jan 2012 - Dec 2013', startMonth: null, endMonth: null },
        ]),
      { timeout: 3000 },
    );
  });
});

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
