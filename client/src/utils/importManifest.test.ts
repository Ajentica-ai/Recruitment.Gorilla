import { describe, expect, it } from 'vitest';
import { parseImportManifest, stripJsonComments } from './importManifest';

const cv = (name: string, size = 10) => new File(['x'.repeat(size)], name, { type: 'application/pdf' });

const entry = (overrides: Record<string, unknown> = {}) => ({
  cvFileName: 'jane.pdf',
  fullName: 'Jane Doe',
  email: 'jane@test.com',
  ...overrides,
});

describe('stripJsonComments', () => {
  it('removes line and block comments and trailing commas', () => {
    const text = `/* header
      spanning lines */
      {
        "a": 1, // trailing note
        "b": [1, 2,],
      }`;
    expect(JSON.parse(stripJsonComments(text))).toEqual({ a: 1, b: [1, 2] });
  });

  it('leaves comment-like text inside strings alone', () => {
    const text = '{ "url": "https://example.com/a,]", "note": "/* not a comment */", "q": "say \\"//hi\\"" }';
    expect(JSON.parse(stripJsonComments(text))).toEqual({
      url: 'https://example.com/a,]',
      note: '/* not a comment */',
      q: 'say "//hi"',
    });
  });
});

describe('parseImportManifest', () => {
  it.each([
    ['a wrapped list', JSON.stringify({ candidates: [entry()] })],
    ['a bare list', JSON.stringify([entry()])],
    ['a single object', JSON.stringify(entry())],
    ['any casing of the wrapper and keys', JSON.stringify({ Candidates: [{ CVFileName: 'jane.pdf', FULLNAME: 'Jane Doe', Email: 'jane@test.com' }] })],
  ])('reads %s', (_, json) => {
    const m = parseImportManifest(json, [cv('jane.pdf')]);
    expect(m.error).toBeNull();
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].errors).toEqual([]);
    expect(m.rows[0].file?.name).toBe('jane.pdf');
    expect(m.rows[0].fullName).toBe('Jane Doe');
  });

  it('reports unreadable JSON and the wrong shape as a file-level error', () => {
    expect(parseImportManifest('{ nope', []).error).toMatch(/could not be read/);
    expect(parseImportManifest('{ "candidates": 5 }', []).error).toMatch(/Expected/);
    expect(parseImportManifest('[]', []).error).toMatch(/no candidates/);
  });

  it('flags missing mandatory fields and an invalid name or email', () => {
    const m = parseImportManifest(
      JSON.stringify([{}, entry({ fullName: '😀', email: 'nope', cvFileName: 'b.pdf' })]),
      [cv('b.pdf')]
    );
    expect(m.rows[0].errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/cvFileName/), expect.stringMatching(/fullName/), expect.stringMatching(/email/)])
    );
    expect(m.rows[1].errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/emoji/), expect.stringMatching(/not a valid email/)])
    );
  });

  it('matches CVs by name ignoring case and reports missing and unused ones', () => {
    const m = parseImportManifest(
      JSON.stringify([entry({ cvFileName: 'JANE.PDF' }), entry({ cvFileName: 'missing.pdf', email: 'b@test.com' })]),
      [cv('jane.pdf'), cv('extra.pdf')]
    );
    expect(m.rows[0].file?.name).toBe('jane.pdf');
    expect(m.rows[1].errors).toContain('No CV named "missing.pdf" was added.');
    expect(m.unusedFiles).toEqual(['extra.pdf']);
  });

  it('refuses one CV for two entries and warns about a repeated email', () => {
    const m = parseImportManifest(JSON.stringify([entry(), entry()]), [cv('jane.pdf')]);
    expect(m.rows[0].errors).toEqual([]);
    expect(m.rows[1].errors).toContain('Entry 1 already uses this CV.');
    expect(m.rows[1].warnings).toContain('Entry 1 has the same email.');
  });

  it('refuses a CV that is too large or not a PDF/DOCX, and warns about unknown keys', () => {
    const m = parseImportManifest(
      JSON.stringify([entry(), entry({ cvFileName: 'notes.txt', email: 'b@test.com', colour: 'blue' })]),
      [cv('jane.pdf', 10 * 1024 * 1024 + 1), new File(['x'], 'notes.txt')]
    );
    expect(m.rows[0].errors).toContain('The CV is larger than 10 MB.');
    expect(m.rows[1].errors).toContain('The CV must be a PDF or Word (.docx) file.');
    expect(m.rows[1].warnings).toContain('Unknown key(s) will be ignored: colour.');
  });
});
