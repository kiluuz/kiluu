export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 20;

export function normalizeDisplayName(value: string): string | null {
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(value)) return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  const length = [...normalized].length;
  if (length < DISPLAY_NAME_MIN_LENGTH || length > DISPLAY_NAME_MAX_LENGTH) return null;
  return normalized;
}
