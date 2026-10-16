import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import RescheduleInterviewModal from './RescheduleInterviewModal';
import {
  getInterviewSchedule,
  getAssignableUsers,
  getActiveInterviewTypes,
  rescheduleInterview,
} from '../services/api';
import type { InterviewSchedule } from '../types';

vi.mock('../services/api', () => ({
  getInterviewSchedule: vi.fn(),
  getAssignableUsers: vi.fn(),
  getActiveInterviewTypes: vi.fn(),
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
    vi.mocked(getInterviewSchedule).mockResolvedValue(schedule());
    vi.mocked(getAssignableUsers).mockResolvedValue([
      { id: 11, name: 'Ivy Interviewer', email: 'ivy@test.local' },
    ]);
    vi.mocked(getActiveInterviewTypes).mockResolvedValue([]);
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
