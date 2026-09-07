/**
 * Field rules shared by registration and the member profile, so a name that is
 * accepted at sign-up cannot be rejected when the same person edits it later.
 */

/**
 * A person's name: letters plus the punctuation real names carry, and never a
 * digit. Written against Unicode letters so "Peña" and "Ma. Ángela" pass, and
 * allowing the period, apostrophe and hyphen that "Ma. Anna G. Louie",
 * "O'Brien" and "Dela Cruz-Santos" need.
 */
const NAME_SHAPE = /^\p{L}[\p{L}\p{M}\s.'-]*$/u;

export function isPersonName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  if (!NAME_SHAPE.test(trimmed)) return false;
  // Guard against input that is all punctuation after the first letter.
  return (trimmed.match(/\p{L}/gu) ?? []).length >= 2;
}

/** Collapses runs of whitespace so "Ana   Reyes" is stored as "Ana Reyes". */
export function tidyName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Philippine mobile numbers, canonically 11 digits beginning 09.
 *
 * Accepts what people actually type - 0917 123 4567, +63 917 123 4567,
 * 63-917-123-4567 - and returns the one stored form, or null when it is not a
 * Philippine mobile number.
 */
export function normalizePhilippineMobile(value: string): string | null {
  const digitsOnly = value.replace(/[\s()\-.]/g, "");
  if (!/^\+?\d+$/.test(digitsOnly)) return null;

  const digits = digitsOnly.replace(/^\+/, "");

  // 639XXXXXXXXX (12) and 09XXXXXXXXX (11) are the same number.
  const local = digits.startsWith("63") && digits.length === 12 ? `0${digits.slice(2)}` : digits;

  if (local.length !== 11) return null;
  if (!local.startsWith("09")) return null;
  return local;
}


/** Spelled out only when a number is refused, not as a hint before typing. */
export const MOBILE_HINT = "11 digits starting with 09, or +63 followed by 10 digits.";
