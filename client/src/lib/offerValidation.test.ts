import { describe, it, expect } from 'vitest';
import { validateOfferForm, type OfferFormValues } from './offerValidation';

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const valid: OfferFormValues = {
  jobTitle: 'Engineer', baseSalary: '100000', currency: 'USD', bonus: '', equity: '',
  startDate: '', expirationDate: '', notes: '',
};

describe('validateOfferForm (#197)', () => {
  it('accepts a valid form, and values at the limits', () => {
    expect(validateOfferForm(valid)).toBeNull();
    expect(validateOfferForm({
      ...valid, jobTitle: 't'.repeat(200), equity: 'e'.repeat(200), notes: 'n'.repeat(2000),
      baseSalary: '1000000000000', bonus: '0', startDate: today(), expirationDate: today(),
    })).toBeNull();
  });

  it.each([
    ['a zero salary', { baseSalary: '0' }, 'base salary greater than zero'],
    ['no salary', { baseSalary: '' }, 'base salary greater than zero'],
    ['a salary above the limit', { baseSalary: '1000000000001' }, 'Base salary cannot be more than'],
    ['a negative bonus', { bonus: '-1' }, 'Bonus cannot be negative'],
    ['a bonus above the limit', { bonus: '1000000000001' }, 'Bonus cannot be more than'],
    ['a bad currency', { currency: 'US' }, 'Currency must be a 3-letter code'],
    ['a currency with digits', { currency: 'U5D' }, 'Currency must be a 3-letter code'],
    ['a long job title', { jobTitle: 't'.repeat(201) }, 'Job title cannot be longer than 200'],
    ['long equity', { equity: 'e'.repeat(201) }, 'Equity cannot be longer than 200'],
    ['long notes', { notes: 'n'.repeat(2001) }, 'Notes cannot be longer than 2000'],
    ['an expiry in the past', { expirationDate: inDays(-2) }, 'expiry date cannot be in the past'],
    ['an expiry before the start', { startDate: inDays(30), expirationDate: inDays(10) }, 'cannot be before the start date'],
  ])('refuses %s', (_name, patch, message) => {
    expect(validateOfferForm({ ...valid, ...patch })).toContain(message);
  });

  it('allows an expiry with no start date, and a start date with no expiry', () => {
    expect(validateOfferForm({ ...valid, expirationDate: inDays(5) })).toBeNull();
    expect(validateOfferForm({ ...valid, startDate: inDays(-40) })).toBeNull();
  });
});
