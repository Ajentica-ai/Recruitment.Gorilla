/**
 * The one definition of what a person's name may contain (issue #38): the user
 * Name field, the candidate full name and the reference name all go through
 * this. Permissive about script and punctuation so "Anne-Marie O'Neill" and
 * non-Latin names still save; strict about the two things a name never holds.
 *
 * Mirrors server/Recruitment.Gorilla.API/Services/PersonNameValidator.cs —
 * change one and change the other. The server is the authority; this only buys
 * the user an immediate message instead of a round trip.
 */

export const MAX_NAME_LENGTH = 100;

/** At least one letter, in any script. */
const HAS_LETTER = /\p{L}/u;

/**
 * Symbols (\p{S}) is where emoji and pictographs live; Other (\p{C}) covers
 * control characters and the zero-width joiners that glue emoji sequences.
 */
const HAS_EMOJI_OR_SYMBOL = /[\p{S}\p{C}]/u;

/** Returns an error message, or null when the name is acceptable. */
export function validatePersonName(value: string | null | undefined, label: string): string | null {
  const trimmed = (value ?? '').trim();

  if (!trimmed) return `${label} is required.`;
  if (trimmed.length > MAX_NAME_LENGTH) return `${label} must be ${MAX_NAME_LENGTH} characters or less.`;
  if (HAS_EMOJI_OR_SYMBOL.test(trimmed)) return `${label} cannot contain emoji or symbols.`;
  if (!HAS_LETTER.test(trimmed)) return `${label} must contain at least one letter.`;

  return null;
}
