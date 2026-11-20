/**
 * Pure text-layout helpers for CV extraction. No pdf.js or DOM imports, so they are unit tested
 * in jsdom. The pdf.js and mammoth wrappers live in extractText.ts.
 */

/** One positioned run of text, in PDF user space (origin bottom-left, y grows upward). */
export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Same repair as CVParserService.NormalizeText on the server: ligatures, unmapped "ti", control chars. */
const LIGATURES: Record<string, string> = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'st',
  '\uFB06': 'st',
};

export function normalizeText(text: string): string {
  return (
    text
      .replace(/[\uFB00-\uFB06]/g, (c) => LIGATURES[c])
      // A subsetted font's missing "ti" arrives as NUL or a euro sign wedged between two letters.
      // oxlint-disable-next-line no-control-regex
      .replace(/(?<=\p{L})[\u0000\u20AC](?=\p{L})/gu, 'ti')
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .normalize('NFC')
  );
}

/** Baseline distance (in PDF units) under which two runs sit on the same line. */
const SAME_LINE_TOLERANCE = 3;
/** A horizontal gap wider than this between runs on one line is rendered as a tab-like double space. */
const WIDE_GAP = 18;

/**
 * Finds a vertical gutter that splits the page into a left and right column.
 * Returns the x of the gutter, or null for a single-column page. A gutter is an x in the middle band
 * that no run crosses, with a real share of the text on both sides, so a centred heading or a right
 * aligned date does not count as a column break unless the page is genuinely split.
 */
export function findColumnGutter(items: PositionedText[], pageWidth: number): number | null {
  const real = items.filter((i) => i.str.trim().length > 0);
  if (real.length < 12 || pageWidth <= 0) return null;

  let best: number | null = null;
  let bestRoom = 0;
  // Scan the middle band in 4-unit steps and keep the widest empty stretch.
  for (let x = pageWidth * 0.3; x <= pageWidth * 0.7; x += 4) {
    const crossing = real.filter((i) => i.x < x && i.x + i.width > x).length;
    if (crossing > real.length * 0.03) continue;
    const left = real.filter((i) => i.x + i.width <= x).length;
    const right = real.filter((i) => i.x >= x).length;
    if (left < real.length * 0.2 || right < real.length * 0.2) continue;
    const room = Math.min(
      ...real.filter((i) => i.x >= x).map((i) => i.x - x),
      ...real.filter((i) => i.x + i.width <= x).map((i) => x - (i.x + i.width)),
    );
    if (room > bestRoom) {
      bestRoom = room;
      best = x;
    }
  }
  // A real gutter is a visible gap, not two words that happen not to touch.
  return best !== null && bestRoom >= 6 ? best : null;
}

/** Groups runs into lines top to bottom, joining each line left to right. */
export function buildLines(items: PositionedText[]): string[] {
  const real = items.filter((i) => i.str.length > 0);
  const sorted = [...real].sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: PositionedText[][] = [];
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= SAME_LINE_TOLERANCE);
    if (row) row.push(item);
    else rows.push([item]);
  }

  return rows
    .sort((a, b) => b[0].y - a[0].y)
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let line = '';
      let prevEnd: number | null = null;
      for (const run of row) {
        if (prevEnd !== null) {
          const gap = run.x - prevEnd;
          if (gap > WIDE_GAP) line += '  ';
          else if (gap > 1 && !line.endsWith(' ') && !run.str.startsWith(' ')) line += ' ';
        }
        line += run.str;
        prevEnd = run.x + run.width;
      }
      return line.replace(/[ \t]+$/g, '');
    })
    .filter((l) => l.trim().length > 0);
}

/**
 * Lines of one page in reading order: a two-column page is read left column first, then right, so
 * the columns do not interleave the way a single baseline sweep would.
 */
export function pageToLines(items: PositionedText[], pageWidth: number): string[] {
  const gutter = findColumnGutter(items, pageWidth);
  if (gutter === null) return buildLines(items);
  const left = items.filter((i) => i.x + i.width <= gutter);
  const right = items.filter((i) => i.x >= gutter);
  return [...buildLines(left), ...buildLines(right)];
}
