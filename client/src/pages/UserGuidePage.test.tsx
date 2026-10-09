import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import UserGuidePage from './UserGuidePage';
import { getUserGuide } from '../services/api';
import type { UserGuide } from '../types';

vi.mock('../services/api', () => ({
  getUserGuide: vi.fn(),
}));

const GUIDE: UserGuide = {
  edition: 'recruiter',
  label: 'Recruiter edition',
  chapters: [
    { id: 'intro', title: 'Recruitment Gorilla User Guide', markdown: '# Recruitment Gorilla User Guide' },
    {
      id: 'chapter-0',
      title: 'Chapter 0: Getting started',
      markdown: '# Chapter 0: Getting started\n\n## 0.1 Signing in\n\nOpen the app.',
    },
    {
      id: 'chapter-2',
      title: 'Chapter 2: Recruiter guide',
      markdown: '# Chapter 2: Recruiter guide\n\n## 2.2 Your dashboard\n\nSee it here.',
    },
  ],
};

describe('UserGuidePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserGuide).mockResolvedValue(GUIDE);
  });

  it('renders the edition label and every chapter returned by the API', async () => {
    renderWithProviders(<UserGuidePage />);

    expect(await screen.findByText('Recruiter edition')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chapter 0: Getting started' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chapter 2: Recruiter guide' })).toBeInTheDocument();
  });

  it('lists each chapter heading in the contents rail', async () => {
    renderWithProviders(<UserGuidePage />);

    await screen.findByText('Recruiter edition');
    // Both the mobile (accordion) and desktop rail render in the DOM at once;
    // CSS breakpoints decide which one is visible.
    const rails = screen.getAllByRole('navigation', { name: 'User guide contents' });
    expect(rails.length).toBeGreaterThan(0);
    for (const rail of rails) {
      expect(rail).toHaveTextContent('Chapter 0: Getting started');
      expect(rail).toHaveTextContent('Chapter 2: Recruiter guide');
    }
  });

  it('prints the page when Print / Save as PDF is clicked', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderWithProviders(<UserGuidePage />);

    await screen.findByText('Recruiter edition');
    screen.getByRole('button', { name: /print \/ save as pdf/i }).click();

    await waitFor(() => expect(printSpy).toHaveBeenCalled());
  });

  it('shows an error state when the request fails', async () => {
    vi.mocked(getUserGuide).mockRejectedValue(new Error('network error'));
    renderWithProviders(<UserGuidePage />);

    expect(await screen.findByText(/couldn't load the user guide/i)).toBeInTheDocument();
  });
});
