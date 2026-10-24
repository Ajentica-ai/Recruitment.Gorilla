import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluationReadOnly } from './EvaluationForm';
import type { InterviewEvaluation } from '../types';

const evaluation = (items: InterviewEvaluation['items']): InterviewEvaluation => ({
  id: 1,
  interviewerUserId: 5,
  interviewerName: 'Ivy Interviewer',
  generalAssessment: 'Solid.',
  recommendation: 'Recommended',
  recommendationOther: null,
  overallRating: 4,
  isSubmitted: true,
  submittedAt: '2026-10-20T10:00:00Z',
  items,
});

const customRubric = {
  criteria: [
    { key: 'AutomationSkills', label: 'Test Automation', sectionName: 'Testing', hint: null },
    { key: 'Collaboration', label: 'Collaboration', sectionName: 'Process', hint: null },
  ],
};

describe('EvaluationReadOnly: custom rubric ratings are never hidden (#190)', () => {
  it('draws every criterion of the rubric it is given, with its section', () => {
    render(
      <EvaluationReadOnly
        evaluation={evaluation([
          { criterionKey: 'AutomationSkills', rating: 5, comment: 'Strong framework work' },
          { criterionKey: 'Collaboration', rating: 4, comment: null },
        ])}
        rubric={customRubric as never}
      />,
    );

    expect(screen.getByText('Test Automation')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Process')).toBeInTheDocument();
    expect(screen.getByText('Strong framework work')).toBeInTheDocument();
    expect(screen.queryByText('Other criteria')).not.toBeInTheDocument();
  });

  it('shows a rated key the sections do not know under "Other criteria", labelled by its key', () => {
    // No rubric given: the built-in sections apply, and these keys are not in them.
    render(
      <EvaluationReadOnly
        evaluation={evaluation([
          { criterionKey: 'AutomationSkills', rating: 5, comment: 'Strong framework work' },
          { criterionKey: 'RetiredCriterion', rating: 2, comment: null },
        ])}
      />,
    );

    expect(screen.getByText('Other criteria')).toBeInTheDocument();
    expect(screen.getByText('AutomationSkills')).toBeInTheDocument();
    expect(screen.getByText('RetiredCriterion')).toBeInTheDocument();
    expect(screen.getByText('Strong framework work')).toBeInTheDocument();
  });

  it('shows rated keys outside a custom rubric under "Other criteria" too', () => {
    render(
      <EvaluationReadOnly
        evaluation={evaluation([{ criterionKey: 'OldKey', rating: 3, comment: 'From before the rubric changed' }])}
        rubric={customRubric as never}
      />,
    );

    expect(screen.getByText('Other criteria')).toBeInTheDocument();
    expect(screen.getByText('OldKey')).toBeInTheDocument();
    expect(screen.getByText('From before the rubric changed')).toBeInTheDocument();
  });

  it('does not list an unrated, uncommented key, and adds nothing for a built-in-only evaluation', () => {
    render(
      <EvaluationReadOnly
        evaluation={evaluation([
          { criterionKey: 'RelevanceOfExperience', rating: 4, comment: null },
          { criterionKey: 'EmptyKey', rating: null, comment: null },
        ])}
      />,
    );

    expect(screen.queryByText('Other criteria')).not.toBeInTheDocument();
    expect(screen.queryByText('EmptyKey')).not.toBeInTheDocument();
  });
});
