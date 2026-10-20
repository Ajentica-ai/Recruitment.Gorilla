import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import ShareEvaluationsDrawer from './ShareEvaluationsDrawer';
import {
  createEvaluationShares,
  getEvaluationShareOptions,
  getEvaluationShares,
  revokeEvaluationShare,
} from '../services/api';
import type { EvaluationShare, ShareOptions } from '../types';

vi.mock('../services/api', () => ({
  getEvaluationShareOptions: vi.fn(),
  getEvaluationShares: vi.fn(),
  createEvaluationShares: vi.fn(),
  revokeEvaluationShare: vi.fn(),
}));

const options: ShareOptions = {
  interviews: [
    {
      interviewId: 301,
      scheduledAt: '2026-11-03T09:00:00Z',
      status: 'Scheduled',
      tags: ['Technical'],
      panel: ['Pat Panel'],
    },
    {
      interviewId: 302,
      scheduledAt: '2026-11-10T09:00:00Z',
      status: 'Scheduled',
      tags: [],
      panel: [],
    },
  ],
  users: [
    { userId: 5, name: 'Ivy Interviewer', email: 'ivy@test.local', alreadyHasAccess: false, reason: null },
    { userId: 6, name: 'Ada Admin', email: 'ada@test.local', alreadyHasAccess: true, reason: 'Already has access (Admin).' },
  ],
};

const share = (over: Partial<EvaluationShare> = {}): EvaluationShare => ({
  id: 1,
  candidateId: 42,
  interviewId: null,
  interviewScheduledAt: null,
  granteeUserId: 5,
  granteeName: 'Ivy Interviewer',
  granteeEmail: 'ivy@test.local',
  source: 'Manual',
  note: null,
  expiresAt: null,
  isActive: true,
  grantedByUserId: 1,
  grantedByName: 'Rita Recruiter',
  createdAt: '2026-10-20T08:00:00Z',
  revokedAt: null,
  revokedByUserId: null,
  revokedByName: null,
  ...over,
});

const renderDrawer = () =>
  renderWithProviders(
    <ShareEvaluationsDrawer candidateId={42} candidateName="Jane Doe" open onOpenChange={vi.fn()} />,
  );

/** Opens the people list and picks one person by name. */
const pickPerson = async (name: string) => {
  const people = await screen.findByRole('combobox');
  fireEvent.focus(people);
  fireEvent.mouseDown(await screen.findByRole('option', { name: new RegExp(name) }));
};

describe('ShareEvaluationsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEvaluationShareOptions).mockResolvedValue(options);
    vi.mocked(getEvaluationShares).mockResolvedValue([]);
    vi.mocked(createEvaluationShares).mockResolvedValue({ shares: [share()], skipped: [] });
    vi.mocked(revokeEvaluationShare).mockResolvedValue();
  });

  it('lists the interviews only when "Specific interviews" is chosen', async () => {
    renderDrawer();
    await screen.findByRole('combobox');

    expect(screen.queryByLabelText('Interviews to share')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Specific interviews'));

    const list = await screen.findByLabelText('Interviews to share');
    expect(list).toHaveTextContent('Technical');
    expect(list).toHaveTextContent('Panel: Pat Panel');
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);

    await userEvent.click(screen.getByLabelText(/All rounds/));
    expect(screen.queryByLabelText('Interviews to share')).not.toBeInTheDocument();
  });

  it('shows people who already have access as disabled', async () => {
    renderDrawer();
    fireEvent.focus(await screen.findByRole('combobox'));

    const admin = await screen.findByRole('option', { name: /Ada Admin/ });
    expect(admin).toBeDisabled();
    expect(admin).toHaveTextContent('Already has access');
    expect(screen.getByRole('option', { name: /Ivy Interviewer/ })).toBeEnabled();
  });

  it('sends all rounds as an empty interview list, with the trimmed note', async () => {
    renderDrawer();
    await pickPerson('Ivy Interviewer');
    await userEvent.type(screen.getByLabelText(/Note/), '  prep for round 2  ');
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() =>
      expect(createEvaluationShares).toHaveBeenCalledWith(42, {
        granteeUserIds: [5],
        interviewIds: [],
        expiresAt: null,
        note: 'prep for round 2',
      }),
    );
  });

  it('sends only the chosen interviews for "Specific interviews"', async () => {
    renderDrawer();
    await pickPerson('Ivy Interviewer');
    await userEvent.click(screen.getByLabelText('Specific interviews'));
    const boxes = await screen.findAllByRole('checkbox');
    await userEvent.click(boxes[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() =>
      expect(createEvaluationShares).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ granteeUserIds: [5], interviewIds: [302] }),
      ),
    );
  });

  it('does not call the API without a person, or with "Specific interviews" and none ticked', async () => {
    renderDrawer();
    await screen.findByRole('combobox');

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one person');

    await pickPerson('Ivy Interviewer');
    await userEvent.click(screen.getByLabelText('Specific interviews'));
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one interview');

    expect(createEvaluationShares).not.toHaveBeenCalled();
  });

  it('reports who the server skipped', async () => {
    vi.mocked(createEvaluationShares).mockResolvedValue({
      shares: [share()],
      skipped: [{ userId: 6, name: 'Ada Admin', reason: 'Already has access to every evaluation (Admin).' }],
    });
    renderDrawer();
    await pickPerson('Ivy Interviewer');
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    const toast = await screen.findByText(/Shared with 1 person\./);
    expect(toast).toHaveTextContent('Skipped: Ada Admin (Already has access to every evaluation (Admin).)');
  });

  it("shows the server's own message when it answers 400", async () => {
    vi.mocked(createEvaluationShares).mockRejectedValue({
      response: { status: 400, data: 'Every person must be an existing, active user.' },
    });
    renderDrawer();
    await pickPerson('Ivy Interviewer');
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    // Inline in the drawer and in the toast, never a generic "something went wrong".
    const messages = await screen.findAllByText('Every person must be an existing, active user.');
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Failed to share/)).not.toBeInTheDocument();
  });
});
