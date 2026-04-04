/** Strip spaces, dashes, and parentheses; keep leading + and digits. */
export function normalizePhoneInput(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return t.replace(/[\s\-().]/g, '');
}

/** True if normalized phone matches E.164-style length (9–15 digits, optional +). */
export function isValidNormalizedPhone(normalized: string): boolean {
  return /^\+?[1-9]\d{8,14}$/.test(normalized);
}
