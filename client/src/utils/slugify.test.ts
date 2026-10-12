import { describe, expect, it } from 'vitest';
import { headingsOf, slugify } from './slugify';

describe('slugify', () => {
  // These are the guide's own existing cross-reference anchors, e.g.
  // [2.2](#22-your-dashboard). The slugger has to reproduce GitHub's algorithm
  // exactly, or every in-page link in the guide breaks.
  it.each([
    ['2.2 Your dashboard', '22-your-dashboard'],
    ['0.2 First login: set your own password', '02-first-login-set-your-own-password'],
    ['2.8 Offers', '28-offers'],
    ['5.2 The pipeline map', '52-the-pipeline-map'],
    ['2.3 Adding candidates: Upload CVs', '23-adding-candidates-upload-cvs'],
  ])('slugifies %j to %j', (text, expected) => {
    expect(slugify(text)).toBe(expected);
  });
});

describe('headingsOf', () => {
  it('collects # and ## headings in order, with their slug ids', () => {
    const markdown = [
      '# Chapter 0: Getting started',
      '',
      'Some text.',
      '',
      '## 0.1 Signing in',
      '',
      '## 0.2 First login: set your own password',
    ].join('\n');

    expect(headingsOf(markdown)).toEqual([
      { level: 1, text: 'Chapter 0: Getting started', id: 'chapter-0-getting-started' },
      { level: 2, text: '0.1 Signing in', id: '01-signing-in' },
      { level: 2, text: '0.2 First login: set your own password', id: '02-first-login-set-your-own-password' },
    ]);
  });

  it('ignores deeper headings and non-heading lines', () => {
    const markdown = '### Not collected\n\n- a list item\n\n## Collected';
    expect(headingsOf(markdown)).toEqual([{ level: 2, text: 'Collected', id: 'collected' }]);
  });

  it('strips bold markers from the heading text', () => {
    expect(headingsOf('## The **four** roles')).toEqual([
      { level: 2, text: 'The four roles', id: 'the-four-roles' },
    ]);
  });
});
