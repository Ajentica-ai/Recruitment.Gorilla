import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuideMarkdown from './GuideMarkdown';

describe('GuideMarkdown', () => {
  it('gives headings ids matching the slug of their text', () => {
    render(<GuideMarkdown markdown={'## 2.2 Your dashboard'} knownAnchors={new Set()} />);
    expect(screen.getByRole('heading', { name: '2.2 Your dashboard' })).toHaveAttribute(
      'id',
      '22-your-dashboard',
    );
  });

  it('renders a known in-page anchor as a clickable link', () => {
    render(
      <GuideMarkdown
        markdown={'See [2.2](#22-your-dashboard).'}
        knownAnchors={new Set(['22-your-dashboard'])}
      />,
    );
    const link = screen.getByRole('link', { name: '2.2' });
    expect(link).toHaveAttribute('href', '#22-your-dashboard');
  });

  it('renders a link to an anchor outside the reader\'s edition as plain text', () => {
    render(<GuideMarkdown markdown={'See [2.2](#22-your-dashboard).'} knownAnchors={new Set()} />);
    expect(screen.queryByRole('link', { name: '2.2' })).not.toBeInTheDocument();
    expect(screen.getByText('2.2')).toBeInTheDocument();
  });

  it('opens an external link in a new tab with rel=noopener', () => {
    render(
      <GuideMarkdown markdown={'[our site](https://example.com)'} knownAnchors={new Set()} />,
    );
    const link = screen.getByRole('link', { name: 'our site' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('rewrites a relative images/ path to the public user-guide folder', () => {
    render(<GuideMarkdown markdown={'![Sign-in page](images/00-login.png)'} knownAnchors={new Set()} />);
    expect(screen.getByRole('img', { name: 'Sign-in page' })).toHaveAttribute(
      'src',
      '/user-guide/images/00-login.png',
    );
  });

  it('does not render a raw script tag embedded in markdown', () => {
    const { container } = render(
      <GuideMarkdown markdown={'Hello <script>window.x = 1</script> world'} knownAnchors={new Set()} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });
});
