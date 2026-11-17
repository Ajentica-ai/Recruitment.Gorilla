import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReadOnlyCandidateProfile from './ReadOnlyCandidateProfile';
import type { CandidateDetail } from '../types';

function candidate(over: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    id: 1,
    fullName: 'Arif Hossain',
    email: 'arif@example.invalid',
    phone: null,
    currentTitle: 'Engineer',
    relevantExperience: '5',
    skills: null,
    summary: null,
    linkedInUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    appliedRole: null,
    isReferred: false,
    referenceName: null,
    referenceEmail: null,
    referenceEmployeeId: null,
    roleAppliedOptionId: null,
    roleApplied: null,
    skillOptions: [],
    currentStatus: 'New',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    cvFiles: [],
    statusHistory: [],
    roleEndDate: null,
    roleClosed: false,
    sourceOptionId: null,
    source: null,
    sourceDetail: null,
    educations: [],
    experiences: [],
    ...over,
  };
}

function renderProfile(c: CandidateDetail) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ReadOnlyCandidateProfile candidate={c} />
    </QueryClientProvider>,
  );
}

const experience = (description: string | null, jobTitle = 'Senior Engineer') => ({
  experiences: [{ id: 1, jobTitle, company: 'Acme', duration: '2020 - 2023', description }],
});

describe('ReadOnlyCandidateProfile work experience (#262)', () => {
  it('renders bullet lines as list items without the bullet characters', () => {
    renderProfile(
      candidate(experience('• Built the payments API\n• Led a team of 4\n• Cut deploy time by 60%')),
    );

    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Built the payments API',
      'Led a team of 4',
      'Cut deploy time by 60%',
    ]);
  });

  it.each(['-', '*', '●', '▪'])('treats "%s" as a bullet marker', (marker) => {
    renderProfile(candidate(experience(`${marker} First\n${marker} Second`)));

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['First', 'Second']);
  });

  it('keeps plain lines as separate paragraphs and mixes them with bullets in order', () => {
    const { container } = renderProfile(
      candidate(experience('Owned the billing platform.\n- Cut cost\n- Added retries\nMentored two juniors.')),
    );

    const desc = container.querySelector('.experience-card__desc') as HTMLElement;
    expect(desc).not.toBeNull();
    expect(within(desc).getAllByRole('listitem')).toHaveLength(2);
    expect(desc.textContent).toBe('Owned the billing platform.Cut costAdded retriesMentored two juniors.');
    expect(container.querySelector('.experience-card__description')).toBeNull();
  });

  it('does not treat a hyphen inside a word or a dash with no space as a bullet', () => {
    renderProfile(candidate(experience('-5% churn\nCo-founded the team')));

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('-5% churn')).toBeInTheDocument();
  });

  it('shows nothing for a missing or blank description', () => {
    const { container } = renderProfile(candidate(experience('   \n  ')));
    expect(container.querySelector('.experience-card__desc')).toBeNull();
  });

  it('gives a long job title a tooltip with the full text', () => {
    const long = 'Senior Principal Staff Software Engineer, Platform Reliability and Developer Experience';
    renderProfile(candidate(experience(null, long)));

    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });

  it('gives a long degree a tooltip with the full text', () => {
    const degree = 'Bachelor of Science in Computer Science and Engineering (Honours)';
    renderProfile(candidate({ educations: [{ id: 1, degree, institution: 'BUET' }] }));

    expect(screen.getByText(degree)).toHaveAttribute('title', degree);
  });
});

describe('ReadOnlyCandidateProfile free-text skills (#262)', () => {
  it('drops a leading category label so the chip is just the skill', () => {
    renderProfile(candidate({ skills: 'Languages: C#, Java\nFrameworks: React; Node.js' }));

    for (const skill of ['C#', 'Java', 'React', 'Node.js']) {
      expect(screen.getByText(skill)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Languages/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Frameworks/)).not.toBeInTheDocument();
  });

  it('keeps a plain skill list working', () => {
    renderProfile(candidate({ skills: 'SQL • Docker | Git' }));

    for (const skill of ['SQL', 'Docker', 'Git']) {
      expect(screen.getByText(skill)).toBeInTheDocument();
    }
  });
});
