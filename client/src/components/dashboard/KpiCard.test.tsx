import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KpiCard from './KpiCard';

const renderCard = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('KpiCard', () => {
  it('shows a rise as a glyph plus the number, and says it in the link name', () => {
    renderCard(
      <KpiCard icon={null} label="New this week" value={16} delta={{ value: 3, label: 'vs last week' }} to="/candidates" />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAccessibleName('New this week: 16, up 3 vs last week. View these candidates.');
    expect(link).toHaveAttribute('href', '/candidates');
    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('shows a fall with the down glyph', () => {
    renderCard(<KpiCard icon={null} label="New" value={5} delta={{ value: -2, label: 'vs last week' }} to="/x" />);
    expect(screen.getByText('▼')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName(/down 2 vs last week/);
  });

  it('says "No change" without a glyph when the delta is zero', () => {
    renderCard(<KpiCard icon={null} label="Rejected" value={1} delta={{ value: 0, label: 'this week' }} />);
    expect(screen.getByText('No change')).toBeInTheDocument();
    expect(screen.queryByText('▲')).not.toBeInTheDocument();
    expect(screen.queryByText('▼')).not.toBeInTheDocument();
  });

  it('renders a plain figure, not a link, without a destination', () => {
    renderCard(<KpiCard icon={null} label="Total" value={82} sub="all candidates" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('all candidates')).toBeInTheDocument();
  });
});
