import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

  it('does not invent a 3-5 Years default when nothing was parsed', async () => {
    const group = await openPending(null);
    expect(within(group).getByRole('radio', { name: '3-5 Years' })).not.toBeChecked();
    expect(screen.getByLabelText('Relevant experience, free text')).toHaveValue('');
  });
});
