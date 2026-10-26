import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import EvaluationReportBody from './EvaluationReportBody';
import type { CandidateEvaluationReport } from '../types';

const report = (over: Partial<CandidateEvaluationReport> = {}): CandidateEvaluationReport => ({
  candidateId: 42,
  fullName: 'Jane Doe',
  roleApplied: 'QA Engineer',
  summary: {
    interviewerCount: 1,
    averageOverall: 4,
    recommendationCounts: [{ recommendation: 'Recommended', count: 1 }],
    criterionAverages: [],
  },
  evaluations: [
    {
      interviewId: 7,
      scheduledAt: '2026-10-20T10:00:00Z',
      interviewTags: [],
      evaluation: {
        id: 1,
        interviewerUserId: 5,
        interviewerName: 'Ivy Interviewer',
        generalAssessment: null,
        recommendation: 'Recommended',
        recommendationOther: null,
        overallRating: 4,
        isSubmitted: true,
        submittedAt: '2026-10-20T10:00:00Z',
        items: [],
      },
    },
  ],
  ...over,
});

describe('EvaluationReportBody: ratings given on a custom rubric (#190)', () => {
  it('shows each interviewer card on the report\'s criteria, with labels, sections and comments', () => {
    const data = report({
      criteria: [
        { key: 'AutomationSkills', label: 'Test Automation', section: 'Testing' },
        { key: 'Collaboration', label: 'Collaboration', section: 'Process' },
      ],
    });
    data.evaluations[0].evaluation.items = [
      { criterionKey: 'AutomationSkills', rating: 5, comment: 'Strong framework work' },
      { criterionKey: 'Collaboration', rating: 4, comment: null },
    ];

    render(<EvaluationReportBody data={data} />);

    expect(screen.getByRole('heading', { name: 'Ivy Interviewer' })).toBeInTheDocument();
    expect(screen.getByText('Strong framework work')).toBeInTheDocument();
    expect(screen.getAllByText('Test Automation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing').length).toBeGreaterThan(0);
    // None of the 12 built-in criteria are drawn as empty rows.
    expect(screen.queryByText('Relevance of Experience')).not.toBeInTheDocument();
  });

  it('labels the averages table from the report\'s criteria, in the order it gives', () => {
    const data = report({
      criteria: [
        { key: 'AutomationSkills', label: 'Test Automation', section: 'Testing' },
        { key: 'Collaboration', label: 'Collaboration', section: 'Process' },
        { key: 'OldKey', label: 'OldKey', section: 'Other criteria' },
      ],
    });
    data.summary.criterionAverages = [
      { criterionKey: 'AutomationSkills', average: 5, count: 1 },
      { criterionKey: 'Collaboration', average: 4, count: 1 },
      { criterionKey: 'OldKey', average: 2, count: 1 },
    ];

    render(<EvaluationReportBody data={data} />);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').map((r) => r.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Test Automation');
    expect(rows[1]).toContain('Collaboration');
    expect(rows[2]).toContain('OldKey');
  });

  it('still reads a report with no criteria (an older server) against the built-in ones', () => {
    const data = report();
    data.evaluations[0].evaluation.items = [{ criterionKey: 'RelevanceOfExperience', rating: 4, comment: 'Good fit' }];
    data.summary.criterionAverages = [{ criterionKey: 'RelevanceOfExperience', average: 4, count: 1 }];

    render(<EvaluationReportBody data={data} />);

    expect(screen.getAllByText('Relevance of Experience').length).toBeGreaterThan(0);
    expect(screen.getByText('Good fit')).toBeInTheDocument();
    expect(screen.queryByText('Other criteria')).not.toBeInTheDocument();
  });
});
