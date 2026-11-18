/**
 * Short, lowercase, collision-resistant suffix for test-owned names
 * (inbox prefixes, subjects, addresses) so parallel runs never share data.
 */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Random 6-digit one-time code, as a string.
 */
export function randomSixDigitCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}
