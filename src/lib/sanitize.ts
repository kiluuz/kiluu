/** Minimal HTML/XSS sanitizer for user-generated text. */
export function sanitizeText(input: string, max = 4000): string {
  return String(input || "")
    .replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"))
    .slice(0, max)
    .trim();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
