import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import EvaluationForm from './EvaluationForm';

vi.mock('../services/api', () => ({
  saveEvaluation: vi.fn(),
  getInterviewEvaluationRubric: vi.fn().mockResolvedValue(null),
}));
import { saveEvaluation, getInterviewEvaluationRubric } from '../services/api';

describe('EvaluationForm submit gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveEvaluation).mockResolvedValue({} as never);
    vi.mocked(getInterviewEvaluationRubric).mockResolvedValue(null as never);
  });

  it('blocks Submit until the rubric is complete', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EvaluationForm interviewId={1} evaluation={null} />);

    await user.click(await screen.findByRole('button', { name: /Submit evaluation/i }));

    // The confirm modal must NOT open, a specific toast appears, and nothing is saved.
    expect(screen.queryByRole('button', { name: /Yes, submit/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Please rate all/i)).toBeInTheDocument();
    expect(saveEvaluation).not.toHaveBeenCalled();
  });

  it('opens the confirm modal and saves once all 12 ratings + recommendation + overall are set', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EvaluationForm interviewId={1} evaluation={null} />);

    // Click rating "4" on all 12 criteria
    const ratingButtons = await screen.findAllByTitle(/^4 .+ Exceeds Expectations$/);
    expect(ratingButtons).toHaveLength(12);
    for (const btn of ratingButtons) {
      await user.click(btn);
    }

    await user.selectOptions(screen.getByLabelText(/Final recommendation/i), 'Recommended');
    await user.selectOptions(screen.getByLabelText(/Overall rating/i), '4');

    await user.click(screen.getByRole('button', { name: /Submit evaluation/i }));

    const confirm = await screen.findByRole('button', { name: /Yes, submit/i });
    await user.click(confirm);

    await waitFor(() => expect(saveEvaluation).toHaveBeenCalledTimes(1));
    const [interviewId, payload] = vi.mocked(saveEvaluation).mock.calls[0];
    expect(interviewId).toBe(1);
    expect(payload.submit).toBe(true);
    expect(payload.recommendation).toBe('Recommended');
    expect(payload.overallRating).toBe(4);
    expect(payload.items.filter((i: any) => i.rating != null)).toHaveLength(12);
  });
});

describe('EvaluationForm: a draft can always be saved (#191)', () => {
  const customRubric = {
    id: 9, name: 'QA rubric', description: null, isDefault: false, isActive: true, criteriaCount: 1, assignedRolesCount: 1,
    criteria: [{ id: 1, evaluationRubricId: 9, sectionName: 'Testing', key: 'CustomA', label: 'Custom A', hint: null, weight: 1, sortOrder: 1 }],
    createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
  };
  const draft = (items: { criterionKey: string; rating: number | null; comment: string | null }[]) => ({
    id: 1, interviewerUserId: 5, interviewerName: 'Ivy', generalAssessment: null, recommendation: null,
    recommendationOther: null, overallRating: null, isSubmitted: false, submittedAt: null, items,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveEvaluation).mockResolvedValue({} as never);
  });

  it('sends only the keys of the rubric on screen, dropping a stale one nobody can see', async () => {
    vi.mocked(getInterviewEvaluationRubric).mockResolvedValue(customRubric as never);
    const user = userEvent.setup();
    renderWithProviders(
      <EvaluationForm
        interviewId={1}
        evaluation={draft([
          { criterionKey: 'StaleKey', rating: 3, comment: 'from an older rubric' },
          { criterionKey: 'CustomA', rating: 4, comment: null },
        ])}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /Save draft/i }));

    await waitFor(() => expect(saveEvaluation).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(saveEvaluation).mock.calls[0][1];
    expect(payload.items.map((i: { criterionKey: string }) => i.criterionKey)).toEqual(['CustomA']);
  });

  it.each([
    ['a 400 with a message', { response: { status: 400, data: { message: "Unknown criterion 'OldKey'." } } }, "Unknown criterion 'OldKey'."],
    ['a 409 with a message', { response: { status: 409, data: { message: 'This interview was cancelled.' } } }, 'This interview was cancelled.'],
    ['a plain-text body', { response: { status: 400, data: 'Please rate every criterion.' } }, 'Please rate every criterion.'],
  ])('shows the server message for %s, not the generic toast', async (_label, rejection, message) => {
    vi.mocked(getInterviewEvaluationRubric).mockResolvedValue(customRubric as never);
    vi.mocked(saveEvaluation).mockRejectedValue(rejection);
    const user = userEvent.setup();
    renderWithProviders(<EvaluationForm interviewId={1} evaluation={draft([])} />);

    await user.click(await screen.findByRole('button', { name: /Save draft/i }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('Could not save the evaluation.')).not.toBeInTheDocument();
  });

  it('still says so plainly when the failure carries no message', async () => {
    vi.mocked(getInterviewEvaluationRubric).mockResolvedValue(customRubric as never);
    vi.mocked(saveEvaluation).mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderWithProviders(<EvaluationForm interviewId={1} evaluation={draft([])} />);

    await user.click(await screen.findByRole('button', { name: /Save draft/i }));

    expect(await screen.findByText('Could not save the evaluation.')).toBeInTheDocument();
  });

  it('shows no form, not the built-in criteria, until the rubric has loaded', async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.mocked(getInterviewEvaluationRubric).mockReturnValue(new Promise((r) => { resolve = r; }) as never);
    renderWithProviders(<EvaluationForm interviewId={1} evaluation={null} />);

    expect(screen.getByText(/Loading the evaluation form/)).toBeInTheDocument();
    expect(screen.queryByText(/Rated 0 of 12/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save draft/i })).not.toBeInTheDocument();

    resolve(customRubric);
    expect(await screen.findByText('Custom A')).toBeInTheDocument();
    expect(screen.getByText(/Rated 0 of 1/)).toBeInTheDocument();
  });

  it('falls back to the built-in criteria only when no rubric exists at all (a 404)', async () => {
    vi.mocked(getInterviewEvaluationRubric).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    renderWithProviders(<EvaluationForm interviewId={1} evaluation={null} />);

    expect(await screen.findByText(/Rated 0 of 12/)).toBeInTheDocument();
  });

  it('shows an error panel with Retry, never the built-in form, when the rubric cannot be loaded', async () => {
    vi.mocked(getInterviewEvaluationRubric)
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } })
      .mockResolvedValue(customRubric as never);
    const user = userEvent.setup();
    renderWithProviders(<EvaluationForm interviewId={1} evaluation={null} />);

    expect(await screen.findByText(/Couldn't load the evaluation form/)).toBeInTheDocument();
    expect(screen.queryByText(/Rated 0 of 12/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByText('Custom A')).toBeInTheDocument();
  });
});
