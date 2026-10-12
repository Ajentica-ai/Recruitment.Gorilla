import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * `isFirefox` is read once at module load, from `navigator.userAgent` (see
 * date-picker.tsx): the whole point is that the engine doesn't change
 * mid-session, so it isn't re-read per render. Testing both branches means
 * setting the UA before the module is evaluated, then resetting the module
 * registry so the next import re-reads it. The first dynamic import after a
 * reset re-transforms the module graph, so this is given a longer timeout.
 */
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const originalUserAgent = navigator.userAgent;

async function renderWithUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  vi.resetModules();
  const { DatePicker } = await import('./date-picker');
  return render(<DatePicker value="" onChange={vi.fn()} />);
}

describe('DatePicker', () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
  });

  it('shows the custom calendar button on a non-Firefox browser', async () => {
    await renderWithUserAgent(CHROME_UA);
    expect(screen.getByRole('button', { name: 'Open calendar' })).toBeInTheDocument();
  }, 15000);

  it("hides the custom button on Firefox, since its own native icon can't be suppressed", async () => {
    const { container } = await renderWithUserAgent(FIREFOX_UA);
    expect(screen.queryByRole('button', { name: 'Open calendar' })).not.toBeInTheDocument();
    // The native date input itself is still there; typing still works.
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  }, 15000);
});
