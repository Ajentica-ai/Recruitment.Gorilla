import { describe, expect, it } from 'vitest';
import { buildLines, findColumnGutter, normalizeText, pageToLines, type PositionedText } from './textLayout';

const run = (str: string, x: number, y: number, width = str.length * 5): PositionedText => ({ str, x, y, width });

describe('normalizeText', () => {
  it('expands ligature codepoints', () => {
    const fi = String.fromCharCode(0xfb01);
    const ffl = String.fromCharCode(0xfb04);
    expect(normalizeText(`${fi}nance and o${ffl}ine`)).toBe('finance and offline');
  });

  it('restores an unmapped ti between letters but leaves a euro amount alone', () => {
    const euro = String.fromCharCode(0x20ac);
    expect(normalizeText(`Sta${euro}on`)).toBe('Station');
    expect(normalizeText(`Salary ${euro}50,000`)).toBe(`Salary ${euro}50,000`);
  });

  it('drops stray control characters', () => {
    expect(normalizeText(`a${String.fromCharCode(1)}b `)).toBe('ab ');
  });
});

describe('buildLines', () => {
  it('groups runs on one baseline left to right and orders lines top to bottom', () => {
    const lines = buildLines([run('World', 40, 700), run('Second', 10, 680), run('Hello', 10, 700)]);
    expect(lines).toEqual(['Hello World', 'Second']);
  });

  it('keeps adjacent runs together and marks a wide gap', () => {
    const lines = buildLines([run('Jan 2020', 10, 500, 40), run('Present', 200, 500, 35)]);
    expect(lines[0]).toBe('Jan 2020  Present');
    expect(buildLines([run('Sta', 10, 500, 15), run('tion', 25, 500, 20)])[0]).toBe('Station');
  });

  it('treats a small baseline wobble as one line', () => {
    expect(buildLines([run('A', 10, 500.5), run('B', 30, 499)])).toEqual(['A B']);
  });
});

describe('two-column pages', () => {
  const left = Array.from({ length: 8 }, (_, i) => run(`Left${i}`, 40, 700 - i * 20, 60));
  const right = Array.from({ length: 8 }, (_, i) => run(`Right${i}`, 320, 700 - i * 20, 70));

  it('finds the gutter and reads the left column before the right', () => {
    expect(findColumnGutter([...left, ...right], 612)).not.toBeNull();
    const lines = pageToLines([...left, ...right], 612);
    expect(lines.slice(0, 8)).toEqual(left.map((l) => l.str));
    expect(lines.slice(8)).toEqual(right.map((r) => r.str));
  });

  it('does not split a single column page', () => {
    const wide = Array.from({ length: 14 }, (_, i) => run(`This is a long paragraph line ${i}`, 40, 700 - i * 20, 500));
    expect(findColumnGutter(wide, 612)).toBeNull();
  });

  it('does not split when a full-width heading crosses the middle', () => {
    const heading = Array.from({ length: 4 }, (_, i) => run('A heading across the page', 40, 760 - i * 10, 500));
    expect(findColumnGutter([...left, ...right, ...heading], 612)).toBeNull();
  });

  it('returns null for a sparse page', () => {
    expect(findColumnGutter([run('hi', 10, 10)], 612)).toBeNull();
  });
});
