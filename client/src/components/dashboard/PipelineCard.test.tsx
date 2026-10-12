import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineCard from './PipelineCard';
import type { StatusCount } from '../../types';

const data: StatusCount[] = [
  { status: 'Uploaded', count: 72, sortOrder: 1 },
  { status: 'Ask for Assessment', count: 1, sortOrder: 2 },
  { status: 'Technical Assessment', count: 1, sortOrder: 3 },
  { status: 'Call for Interview', count: 1, sortOrder: 4 },
  { status: 'Interview Scheduled', count: 3, sortOrder: 5 },
  { status: 'Recommended', count: 1, sortOrder: 6 },
  { status: 'Offer Preparation', count: 1, sortOrder: 7 },
  { status: 'Not Recommended', count: 1, sortOrder: 8 },
  { status: 'Offer Accepted', count: 1, sortOrder: 9 },
];

const renderCard = (canDrill: boolean) =>
  render(
    <MemoryRouter>
      <PipelineCard data={data} canDrill={canDrill} />
    </MemoryRouter>,
  );

describe('PipelineCard', () => {
  it('links each stage to the candidate list filtered to it, for roles that can open it', () => {
    renderCard(true);
    const row = screen.getByRole('link', { name: /^Interview Scheduled: 3 candidates/ });
    expect(row).toHaveAttribute('href', '/candidates?status=Interview%20Scheduled');
    expect(screen.getByText('82 candidates, by current stage.')).toBeInTheDocument();
  });

  it('renders plain rows with no links for Interviewers', () => {
    renderCard(false);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('shows five stages until asked for all of them', () => {
    renderCard(true);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: 'Show all 9 stages' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Show fewer stages' })).toBeInTheDocument();
  });

  it('"Active" drops the intake stage and recomputes the shares', () => {
    renderCard(true);
    expect(screen.getByText('87.8%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));

    expect(screen.queryByText('Uploaded')).not.toBeInTheDocument();
    expect(screen.getByText('10 candidates past intake.')).toBeInTheDocument();
    // Interview Scheduled is now 3 of 10.
    expect(screen.getByRole('link', { name: /^Interview Scheduled: 3 candidates, 30 percent/ })).toBeInTheDocument();
  });
});
