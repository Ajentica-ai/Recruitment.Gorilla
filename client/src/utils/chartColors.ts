// Resolves chart colors from the app's design tokens so Recharts (which needs
// concrete values, not var()) matches the rest of the UI and flips with the
// light/dark theme. Status-coloured graphics (the dashboard pipeline bar) are
// plain CSS on the .status--* tones and don't need this.

/**
 * Reads a design token off :root, resolved for the active theme. Recharts needs
 * concrete values — it renders to SVG attributes, not CSS — so tokens have to be
 * computed rather than passed through as var(). Reading them here keeps
 * styles/tokens.css the only place the colours are written down.
 */
function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Brand single-hue used for single-series magnitude charts (roles, skills).
 *
 *  A single hue, deliberately: these charts rank nominal categories, where the
 *  bar's length already carries the value and a per-category colour would only
 *  restate it in a second, worse encoding. Colour is reserved for graphics that
 *  genuinely need to distinguish series, such as the dashboard pipeline bar,
 *  which uses the status tones so a segment matches its badge exactly. */
export const ACCENT: Record<'light' | 'dark', string> = {
  light: '#7c5cfc', // Violet, matches --primary
  dark: '#8b6dff', // Violet, matches --primary
};

/** Convenience: the accent hue for the active theme. */
export const accentFor = (theme: 'light' | 'dark'): string => ACCENT[theme];

/** Recessive axis/grid/tooltip colors for chart chrome, per theme. */
export interface ChartChrome {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

/**
 * `theme` is not read directly — the tokens already resolve per theme via
 * [data-bs-theme] — but it stays in the signature so callers keep passing it and
 * React recomputes the chrome when the theme flips.
 */
export const chartChrome = (theme: 'light' | 'dark'): ChartChrome => {
  const dark = theme === 'dark';
  return {
    axis: token('--muted', dark ? '#93a1b5' : '#64748b'),
    grid: token('--line-soft', dark ? '#1e2530' : '#eef2f7'),
    tooltipBg: token('--surface', dark ? '#161b23' : '#ffffff'),
    tooltipBorder: token('--border', dark ? '#242c38' : '#e6ebf2'),
    tooltipText: token('--text', dark ? '#e6ebf2' : '#0f172a'),
  };
};
