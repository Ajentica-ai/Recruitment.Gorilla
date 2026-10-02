import { describe, expect, it } from 'vitest';
import { externalUrl } from './externalUrl';

describe('externalUrl', () => {
  it.each([
    ['linkedin.com/in/arafat-bin-reza', 'https://linkedin.com/in/arafat-bin-reza'],
    ['www.github.com/jane', 'https://www.github.com/jane'],
    ['  github.com/jane  ', 'https://github.com/jane'],
    ['//gitlab.com/jane', 'https://gitlab.com/jane'],
    ['localhost:3000/demo', 'https://localhost:3000/demo'],
  ])('adds https:// to %j', (raw, expected) => {
    expect(externalUrl(raw)).toBe(expected);
  });

  it.each(['https://linkedin.com/in/jane', 'http://example.com', 'HTTPS://GitHub.com/Jane'])(
    'keeps %j unchanged',
    (raw) => {
      expect(externalUrl(raw)).toBe(raw);
    },
  );

  it.each([null, undefined, '', '   ', 'javascript:alert(1)', 'data:text/html,hi', 'mailto:a@b.com'])(
    'returns undefined for %j',
    (raw) => {
      expect(externalUrl(raw)).toBeUndefined();
    },
  );
});
