import type { CSSProperties } from 'react';

/**
 * A stable, low-chroma tint for a person's initials avatar.
 *
 * Why not one colour for everyone: a list of forty candidates with forty
 * identical blue discs is forty identical blue discs — the avatar stops being
 * an identifier and becomes decoration. Varying the tint makes a row
 * recognisable at a glance and makes "the same person" visibly the same
 * person across the candidate list, the kanban board and the audit log.
 *
 * Why not the eight saturated fills the skill chips used to use: an avatar
 * sits at the left edge of every row, so whatever colour it carries is
 * repeated down the entire page. At full chroma that is the loudest thing on
 * screen and it means nothing — the hue is a hash of a name, not a fact about
 * the person. These six pairs are the semantic hues pulled down to a tint,
 * with the initials carrying the contrast.
 *
 * The pairs are given as CSS custom properties rather than as class names so a
 * caller can set them inline on any element that uses `.avatar`, without the
 * stylesheet needing a rule per tone.
 */

type Tone = { bg: string; fg: string };

/** Six tones. Six rather than eight so two adjacent rows collide less often
 *  than they would with a longer, harder-to-tell-apart ramp. */
const TONES: readonly Tone[] = [
  { bg: 'rgba(37, 99, 235, 0.13)', fg: '#1d4ed8' }, // cobalt
  { bg: 'rgba(124, 58, 237, 0.13)', fg: '#6d28d9' }, // violet
  { bg: 'rgba(5, 150, 105, 0.14)', fg: '#047857' }, // emerald
  { bg: 'rgba(217, 119, 6, 0.14)', fg: '#b45309' }, // amber
  { bg: 'rgba(8, 145, 178, 0.14)', fg: '#0e7490' }, // cyan
  { bg: 'rgba(100, 116, 139, 0.16)', fg: '#475569' }, // slate
];

/** The same six, lifted for a dark ground: the tint stays translucent (so it
 *  works on any surface) and the ink brightens to clear 4.5:1 on --surface. */
const TONES_DARK: readonly Tone[] = [
  { bg: 'rgba(96, 165, 250, 0.16)', fg: '#93c5fd' },
  { bg: 'rgba(167, 139, 250, 0.16)', fg: '#c4b5fd' },
  { bg: 'rgba(52, 211, 153, 0.16)', fg: '#6ee7b7' },
  { bg: 'rgba(251, 191, 36, 0.16)', fg: '#fcd34d' },
  { bg: 'rgba(34, 211, 238, 0.16)', fg: '#67e8f9' },
  { bg: 'rgba(148, 163, 184, 0.18)', fg: '#cbd5e1' },
];

/** FNV-1a. Any stable hash would do; this one is short and avoids the
 *  clustering a plain character sum produces on names that share letters. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Custom properties aren't in React's CSSProperties, so the return type is a
 *  CSSProperties intersection — that is what makes it spreadable onto `style`
 *  without a cast at every call site. */
export type AvatarToneStyle = CSSProperties & {
  ['--avatar-bg']: string;
  ['--avatar-fg']: string;
  ['--avatar-bg-dark']: string;
  ['--avatar-fg-dark']: string;
};

/**
 * Inline style carrying the tone for `key`. Spread onto any `.avatar` element:
 *
 *   <span className="avatar" style={avatarTone(candidate.fullName)}>AR</span>
 *
 * BOTH ramps are emitted, and CSS picks between them under
 * [data-bs-theme='dark'] (see `.avatar` in index.css). The alternative — a
 * `dark` argument read from the theme context — made every avatar, and so
 * every table row and kanban card, require a ThemeProvider above it. That is
 * a lot of coupling for a background colour, and it broke rendering the
 * components in isolation.
 */
export function avatarTone(key: string): AvatarToneStyle {
  const index = hash(key || '?') % TONES.length;
  const light = TONES[index];
  const dark = TONES_DARK[index];
  return {
    '--avatar-bg': light.bg,
    '--avatar-fg': light.fg,
    '--avatar-bg-dark': dark.bg,
    '--avatar-fg-dark': dark.fg,
  };
}
