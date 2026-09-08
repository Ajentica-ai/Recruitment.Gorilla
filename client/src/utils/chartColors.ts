// Resolves chart colors from the app's existing status design tokens so chart
// segments match the StatusBadge pills exactly and flip with the light/dark theme.
//
// The status tones live as CSS variables in index.css (--status-color per tone,
// with [data-bs-theme='dark'] overrides). We read the *computed* value off a
// probe element carrying the tone class, rather than duplicating hex codes here.

import { getStatusTone, type StatusTone } from './statusColors';

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

/** Brand single-hue used for single-series magnitude charts (role, skills, trend).
 *
 *  A single hue, deliberately: these charts rank nominal categories, where the
 *  bar's length already carries the value and a per-category colour would only
 *  restate it in a second, worse encoding. Colour is reserved for the charts
 *  that genuinely need to distinguish series — the status donut, which uses the
 *  pipeline tones so a segment matches its badge exactly. */
export const ACCENT: Record<'light' | 'dark', string> = {
  light: '#7c5cfc', // Violet — matches --primary
  dark: '#8b6dff', // Violet — matches --primary
};

/**
 * Reads the resolved `--status-color` hex for a tone under the current theme.
 * A hidden probe is appended to <body> (inside the html[data-bs-theme] scope) so
 * the dark-mode overrides apply. Falls back to the muted grey if resolution fails.
 */
function resolveTone(tone: StatusTone): string {
  const probe = document.createElement('span');
  probe.className = `status--${tone}`;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue('--status-color').trim();
  probe.remove();
  return value || '#94a3b8';
}

/**
 * Builds a { status -> hex } map for the given statuses under the current theme.
 * Call from a component with `theme` in the dependency list so it recomputes on toggle.
 */
export function statusColorMap(statuses: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const status of statuses) {
    map[status] = resolveTone(getStatusTone(status));
  }
  return map;
}

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
