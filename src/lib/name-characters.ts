/**
 * Characters a name may never contain: anything that is not a letter, a
 * combining mark, whitespace, or the period, apostrophe and hyphen real names
 * carry. The typing-time twin of NAME_SHAPE in ./validation - keep the two in
 * step, or the field will accept a character the server then refuses.
 */
const NOT_NAME_CHARACTER = /[^\p{L}\p{M}\s.'-]/gu;

/** Drops every character a name may not contain, digits included. */
export function stripNonNameCharacters(value: string): string {
  return value.replace(NOT_NAME_CHARACTER, "");
}
