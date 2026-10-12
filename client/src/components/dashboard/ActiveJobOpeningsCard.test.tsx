import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActiveJobOpeningsCard from './ActiveJobOpeningsCard';
import { sortByClosing } from './jobOrder';
import type { JobOpening } from '../../types';

const auth = vi.hoisted(() => ({ canWriteCandidates: true }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

const job = (id: number, title: string, endDate: string, extra: Partial<JobOpening> = {}): JobOpening => ({
  id,
  title,
  location: null,
  department: null,
  priority: null,
  postedDate: '2026-06-29T00:00:00Z',
  endDate,
  applicants: 0,
  ...extra,
});

const jobs = [
  job(1, 'Backend Engineer', '2027-12-31T00:00:00Z', { priority: 'High', location: 'Office', applicants: 30 }),
  job(2, 'QA Engineer', '2027-01-15T00:00:00Z', { applicants: 3 }),
  job(3, 'DevOps Engineer', '2027-06-01T00:00:00Z'),
];

const renderCard = (data: JobOpening[]) =>
  render(
    <MemoryRouter>
      <ActiveJobOpeningsCard data={data} />
    </MemoryRouter>,
  );

describe('ActiveJobOpeningsCard', () => {
  it('links "View all" to the Job Openings page', () => {
    auth.canWriteCandidates = true;
    renderCard([]);
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/jobs');
  });

  it('hides "View all" and the role links for roles that cannot open them', () => {
    auth.canWriteCandidates = false;
    renderCard(jobs);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
  });

  it('orders roles soonest to close first', () => {
    expect(sortByClosing(jobs).map((j) => j.title)).toEqual(['QA Engineer', 'DevOps Engineer', 'Backend Engineer']);
  });

  it("links a role to its applicants and shows location only when it's set", () => {
    auth.canWriteCandidates = true;
    renderCard(jobs);

    const backend = screen.getByRole('link', { name: /^Backend Engineer, 30 applicants/ });
    expect(backend).toHaveAttribute('href', '/candidates?role=1');
    expect(within(backend).getByText('Office')).toBeInTheDocument();
    expect(within(backend).getByText('High priority')).toBeInTheDocument();

    const qa = screen.getByRole('link', { name: /^QA Engineer/ });
    expect(within(qa).queryByText('Office')).not.toBeInTheDocument();
    expect(within(qa).getByText('3 applicants')).toBeInTheDocument();
  });
});
