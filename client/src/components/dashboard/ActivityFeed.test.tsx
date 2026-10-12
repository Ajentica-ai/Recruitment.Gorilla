import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityFeed from './ActivityFeed';
import { groupActivity } from './activityGroups';
import type { ActivityItem } from '../../types';

const now = new Date(2026, 9, 10, 15, 0);
const item = (candidateId: number, fullName: string, status: string, changedAt: Date): ActivityItem => ({
  candidateId,
  fullName,
  status,
  changedBy: 'Demo Recruiter',
  changedAt: changedAt.toISOString(),
});

const feed: ActivityItem[] = [
  item(1, 'Tanvir Rahman', 'Offer Accepted', new Date(2026, 9, 10, 14, 0)),
  item(1, 'Tanvir Rahman', 'Offer Extended', new Date(2026, 9, 10, 12, 0)),
  item(1, 'Tanvir Rahman', 'Offer Accepted', new Date(2026, 9, 9, 12, 0)),
  item(2, 'Sadia Islam', 'Offer Preparation', new Date(2026, 9, 5, 12, 0)),
  item(2, 'Sadia Islam', 'Recommended', new Date(2026, 9, 5, 11, 0)),
];

describe('groupActivity', () => {
  it('groups by day and folds back-to-back changes to one candidate into a run', () => {
    const days = groupActivity(feed, now);
    expect(days.map((d) => d.label)).toEqual(['Today', 'Yesterday', expect.any(String)]);
    expect(days[0].runs).toHaveLength(1);
    expect(days[0].runs[0].events.map((e) => e.status)).toEqual(['Offer Accepted', 'Offer Extended']);
    expect(days[2].runs[0].fullName).toBe('Sadia Islam');
  });

  it('starts a new run when another candidate comes between', () => {
    const days = groupActivity(
      [
        item(1, 'A', 'Recommended', new Date(2026, 9, 10, 14, 0)),
        item(2, 'B', 'Recommended', new Date(2026, 9, 10, 13, 0)),
        item(1, 'A', 'Uploaded', new Date(2026, 9, 10, 12, 0)),
      ],
      now,
    );
    expect(days[0].runs.map((r) => r.fullName)).toEqual(['A', 'B', 'A']);
  });
});

describe('ActivityFeed', () => {
  const renderFeed = (items: ActivityItem[], viewAllHref = '/audit') =>
    render(
      <MemoryRouter>
        <ActivityFeed items={items} viewAllHref={viewAllHref} />
      </MemoryRouter>,
    );

  it('shows a run as oldest to newest status and expands to every change', () => {
    renderFeed(feed);
    const toggle = screen.getAllByRole('button', { name: '2 changes' })[0];
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Hide changes');
  });

  it('points "View all" where the caller says', () => {
    renderFeed(feed, '/candidates');
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/candidates');
  });

  it('shows a slim empty line when there is nothing to show', () => {
    renderFeed([]);
    expect(screen.getByText('No recent activity.')).toBeInTheDocument();
  });
});
