import { describe, expect, it } from 'vitest';
import { validatePersonName } from './personName';

// Same table as server/Recruitment.Gorilla.Tests/PersonNameValidatorTests.cs.
describe('validatePersonName', () => {
  it.each([
    'Tahmid Rahman',
    "Anne-Marie O'Neill",
    'Anne-Marie O’Neill',
    'José Álvarez',
    'তাহমিদ', // Bangla
    '张伟', // CJK
    'محمد', // Arabic
    'Dr. Jane Smith, Jr.',
    'X',
    '  Padded Name  ',
    'Elizabeth II',
  ])('accepts %j', (name) => {
    expect(validatePersonName(name, 'Name')).toBeNull();
  });

  it.each([
    '\u{1F604}\u{1F60A}', // the reported bug
    'Tahmid \u{1F604}',
    '\u{1F469}‍\u{1F4BB}', // ZWJ sequence
    '\u{1F1E7}\u{1F1E9}', // flag
    '\u{1F44D}\u{1F3FD}', // skin-tone modifier
    'Jane\u0000Doe',
    'Jane​Doe',
    '♥ ★',
    'Jane ❤ Doe',
  ])('rejects %j as emoji or symbols', (name) => {
    expect(validatePersonName(name, 'Name')).toBe('Name cannot contain emoji or symbols.');
  });

  it.each(['###', '...', '12345', '-'])('rejects %j for having no letter', (name) => {
    expect(validatePersonName(name, 'Name')).toBe('Name must contain at least one letter.');
  });

  it.each([null, undefined, '', '   '])('rejects %j as missing', (name) => {
    expect(validatePersonName(name, 'Name')).toBe('Name is required.');
  });

  it('caps the length at 100 characters', () => {
    expect(validatePersonName('a'.repeat(100), 'Name')).toBeNull();
    expect(validatePersonName('a'.repeat(101), 'Name')).toBe('Name must be 100 characters or less.');
  });

  it('uses the supplied label in every message', () => {
    expect(validatePersonName('', 'Full name')).toBe('Full name is required.');
    expect(validatePersonName('\u{1F604}', 'Full name')).toBe('Full name cannot contain emoji or symbols.');
  });
});
