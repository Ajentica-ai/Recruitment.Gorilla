import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import RescheduleInterviewModal from './RescheduleInterviewModal';
import {
  getInterviewSchedule,
  getAssignableUsers,
  getActiveInterviewTypes,
  getEvaluationShareOptions,
  rescheduleInterview,
} from '../services/api';
import type { InterviewSchedule } from '../types';

// Who is signed in decides whether a past time is allowed (#263). No provider means a plain Admin-like user.
const auth = vi.hoisted(() => ({ roles: [] as string[] | null }));
vi.mock('../auth/AuthContext', () => ({
  useOptionalAuth: () =>
    auth.roles === null ? undefined : { hasAnyRole: (...want: string[]) => want.some((r) => auth.roles!.includes(r)) },
}));

vi.mock('../services/api', () => ({
  getInterviewSchedule: vi.fn(),
  getAssignableUsers: vi.fn(),
  getActiveInterviewTypes: vi.fn(),
  getEvaluationShareOptions: vi.fn(),
  rescheduleInterview: vi.fn(),
}));

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setSeconds(0, 0);
  return d;
};

const schedule = (over: Partial<InterviewSchedule> = {}): InterviewSchedule => ({
  id: 7,
  candidateId: 42,
  candidateName: 'Jane Doe',
  status: 'Scheduled',
  scheduledAt: inDays(3).toISOString(),
  durationMinutes: 60,
  notes: null,
  interviewerUserIds: [11],
  interviewTypeOptionIds: [],
  hasSubmittedEvaluation: false,
  events: [],
  shareEarlierRoundsWithPanel: false,
  ...over,
});

const renderModal = () =>
  renderWithProviders(
    <RescheduleInterviewModal
      interviewId={7}
      candidateId={42}
      candidateName="Jane Doe"
      show
      onHide={vi.fn()}
    />,
  );

describe('RescheduleInterviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.roles = null;
    vi.mocked(getInterviewSchedule).mockResolvedValue(schedule());
    vi.mocked(getAssignableUsers).mockResolvedValue([
      { id: 11, name: 'Ivy Interviewer', email: 'ivy@test.local' },
    ]);
    vi.mocked(getActiveInterviewTypes).mockResolvedValue([]);
    vi.mocked(getEvaluationShareOptions).mockResolvedValue({ interviews: [], users: [], earlierRoundsWithEvaluations: 0 });
    vi.mocked(rescheduleInterview).mockResolvedValue(schedule());
  });

  it('prefills from the booking as it stands today', async () => {
    renderModal();

    // The form opens on what is currently booked, so a small change does not mean retyping it all.
    await waitFor(() => expect(getInterviewSchedule).toHaveBeenCalledWith(7));
    await screen.findByLabelText('Interview duration');
    expect(await screen.findByText(/Ivy Interviewer/)).toBeInTheDocument();
  });

  it('sends the new time, duration and interviewers', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByLabelText('Interview duration');

    await user.click(screen.getByRole('button', { name: /save new time/i }));

    await waitFor(() => expect(rescheduleInterview).toHaveBeenCalled());
    const [id, payload] = vi.mocked(rescheduleInterview).mock.calls[0];
    expect(id).toBe(7);
    expect(payload.durationMinutes).toBe(60);
    expect(payload.interviewerUserIds).toEqual([11]);
    expect(new Date(payload.scheduledAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('offers sharing earlier rounds only when there is something to share, unchecked by default', async () => {
    const user = userEvent.setup();
    vi.mocked(getEvaluationShareOptions).mockResolvedValue({ interviews: [], users: [], earlierRoundsWithEvaluations: 0 });
    const { unmount } = renderModal();
    await screen.findByLabelText('Interview duration');
    expect(screen.queryByRole('checkbox', { name: /Share earlier rounds/ })).not.toBeInTheDocument();
    unmount();

    vi.mocked(getEvaluationShareOptions).mockResolvedValue({ interviews: [], users: [], earlierRoundsWithEvaluations: 1 });
    renderModal();
    const box = await screen.findByRole('checkbox', { name: /Share earlier rounds/ });
    expect(box).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /save new time/i }));
    await waitFor(() => expect(rescheduleInterview).toHaveBeenCalled());
    expect(vi.mocked(rescheduleInterview).mock.calls[0][1].shareEarlierRoundsWithPanel).toBe(false);
  });

  it('opens on what is booked and sends the choice', async () => {
    const user = userEvent.setup();
    vi.mocked(getEvaluationShareOptions).mockResolvedValue({ interviews: [], users: [], earlierRoundsWithEvaluations: 1 });
    vi.mocked(getInterviewSchedule).mockResolvedValue(schedule({ shareEarlierRoundsWithPanel: true }));
    renderModal();

    const box = await screen.findByRole('checkbox', { name: /Share earlier rounds/ });
    await waitFor(() => expect(box).toBeChecked());
    await user.click(box); // turn it off
    await user.click(screen.getByRole('button', { name: /save new time/i }));

    await waitFor(() => expect(rescheduleInterview).toHaveBeenCalled());
    expect(vi.mocked(rescheduleInterview).mock.calls[0][1].shareEarlierRoundsWithPanel).toBe(false);
  });

  it('refuses a time in the past without calling the API', async () => {
    const user = userEvent.setup();
    vi.mocked(getInterviewSchedule).mockResolvedValue(
      schedule({ scheduledAt: inDays(-2).toISOString() }),
    );
    renderModal();
    await screen.findByLabelText('Interview duration');

    await user.click(screen.getByRole('button', { name: /save new time/i }));

    expect(await screen.findByText(/pick a time in the future/i)).toBeInTheDocument();
    expect(rescheduleInterview).not.toHaveBeenCalled();
  });

  describe('a time in the past (#263)', () => {
    const openOnPast = async () => {
      vi.mocked(getInterviewSchedule).mockResolvedValue(schedule({ scheduledAt: inDays(-2).toISOString() }));
      renderModal();
      await screen.findByLabelText('Interview duration');
    };

    it.each([['Recruiter'], ['SuperAdmin']])('lets a %s pick it, shows the note and requires a reason', async (role) => {
      auth.roles = [role];
      const user = userEvent.setup();
      await openOnPast();

      expect(screen.getByText('This time is in the past. Invites will not be sent.')).toBeInTheDocument();
      // The intro must not promise an email that will not be sent.
      expect(screen.queryByText(/everyone affected is emailed/)).not.toBeInTheDocument();
      expect(screen.getByText(/Nothing is emailed for a time in the past/)).toBeInTheDocument();
      expect(screen.getByText(/Reason for the change/).textContent).toContain('*');

      await user.click(screen.getByRole('button', { name: /save new time/i }));
      expect(await screen.findByText('A reason is required when the time is in the past.')).toBeInTheDocument();
      expect(rescheduleInterview).not.toHaveBeenCalled();

      await user.type(screen.getByPlaceholderText(/why is this time in the past/i), 'It took place on Monday');
      await user.click(screen.getByRole('button', { name: /save new time/i }));

      await waitFor(() => expect(rescheduleInterview).toHaveBeenCalled());
      const payload = vi.mocked(rescheduleInterview).mock.calls[0][1];
      expect(new Date(payload.scheduledAt).getTime()).toBeLessThan(Date.now());
      expect(payload.reason).toBe('It took place on Monday');
    });

    it('keeps the future-only rule, with no note, for an Admin', async () => {
      auth.roles = ['Admin'];
      const user = userEvent.setup();
      await openOnPast();

      expect(screen.queryByText(/Invites will not be sent/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /save new time/i }));

      expect(await screen.findByText(/pick a time in the future/i)).toBeInTheDocument();
      expect(rescheduleInterview).not.toHaveBeenCalled();
    });

    it('does not show the note for a future time', async () => {
      auth.roles = ['Recruiter'];
      renderModal();
      await screen.findByLabelText('Interview duration');

      expect(screen.queryByText(/Invites will not be sent/)).not.toBeInTheDocument();
    });
  });

  it('blocks the form when an evaluation has already been submitted', async () => {
    vi.mocked(getInterviewSchedule).mockResolvedValue(
      schedule({ hasSubmittedEvaluation: true }),
    );
    renderModal();

    // The interview happened: the route to a new date is another round, not a move.
    expect(await screen.findByText(/Interview Completed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save new time/i })).toBeDisabled();
  });

  it('invalidates the candidate and interview queries, but not the status options', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderModal();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await screen.findByLabelText('Interview duration');

    await user.click(screen.getByRole('button', { name: /save new time/i }));
    await waitFor(() => expect(rescheduleInterview).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['candidate', 42] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['my-interviews'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['interview-schedule', 7] });
    // Moving a booking is not a status change, so the candidate's next statuses are unchanged.
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['status-options', 'next', 42],
    });
  });

  it('warns before dropping an interviewer, because their draft notes go with them', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByLabelText('Interview duration');

    // Deselect the only assigned interviewer via its chip's remove button.
    await user.click(await screen.findByRole('button', { name: 'Remove Ivy Interviewer' }));

    await waitFor(() =>
      expect(screen.getByText(/deletes any evaluation notes they have drafted/i)).toBeInTheDocument(),
    );
  });
});
