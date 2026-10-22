/**
 * The offer form's limits, mirroring the API's OfferInputValidator (#197). The server stays the authority: this only
 * saves a round trip and says what is wrong next to the field instead of after a failed save.
 */
export const OFFER_LIMITS = {
  jobTitle: 200,
  equity: 200,
  notes: 2000,
  maxAmount: 1_000_000_000_000,
} as const;

export interface OfferFormValues {
  jobTitle: string;
  baseSalary: string;
  currency: string;
  bonus: string;
  equity: string;
  /** `YYYY-MM-DD`, or empty. */
  startDate: string;
  /** `YYYY-MM-DD`, or empty. */
  expirationDate: string;
  notes: string;
}

/** Today as `YYYY-MM-DD` in UTC, the day the API compares the expiry against. */
const utcToday = () => new Date().toISOString().slice(0, 10);

/** The first problem with the form, or null when it can be sent. */
export function validateOfferForm(v: OfferFormValues): string | null {
  const salary = parseFloat(v.baseSalary);
  if (isNaN(salary) || salary <= 0) return 'Please enter a valid base salary greater than zero.';
  if (salary > OFFER_LIMITS.maxAmount) return `Base salary cannot be more than ${OFFER_LIMITS.maxAmount.toLocaleString('en-US')}.`;

  if (v.bonus.trim() !== '') {
    const bonus = parseFloat(v.bonus);
    if (isNaN(bonus)) return 'Please enter a valid bonus amount.';
    if (bonus < 0) return 'Bonus cannot be negative.';
    if (bonus > OFFER_LIMITS.maxAmount) return `Bonus cannot be more than ${OFFER_LIMITS.maxAmount.toLocaleString('en-US')}.`;
  }

  if (!/^[A-Za-z]{3}$/.test(v.currency.trim())) return 'Currency must be a 3-letter code such as USD.';

  if (v.jobTitle.trim().length > OFFER_LIMITS.jobTitle) return `Job title cannot be longer than ${OFFER_LIMITS.jobTitle} characters.`;
  if (v.equity.trim().length > OFFER_LIMITS.equity) return `Equity cannot be longer than ${OFFER_LIMITS.equity} characters.`;
  if (v.notes.trim().length > OFFER_LIMITS.notes) return `Notes cannot be longer than ${OFFER_LIMITS.notes} characters.`;

  if (v.expirationDate) {
    if (v.expirationDate < utcToday()) return 'The offer expiry date cannot be in the past.';
    if (v.startDate && v.expirationDate < v.startDate) return 'The offer expiry date cannot be before the start date.';
  }

  return null;
}
