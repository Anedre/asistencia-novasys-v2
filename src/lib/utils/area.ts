/**
 * Area/department label normalization.
 *
 * Employee records carry inconsistent area spellings (e.g. "Consultoría" with
 * an accent vs "Consultoria" without). These helpers collapse such variants so
 * the same area never shows up twice in filters/breakdowns, and so the
 * accented (correct Spanish) spelling is preferred for display.
 */

/** Accent/space/case-insensitive key for grouping area labels. */
export function areaKey(raw?: string | null): string {
  return (raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const hasDiacritics = (s: string) =>
  s !== s.normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Build a `Map<normalizedKey, canonicalLabel>` from raw area strings, preferring
 * the variant that carries diacritics (the correct Spanish spelling).
 */
export function buildAreaCanon(
  raws: Iterable<string | null | undefined>
): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const raw of raws) {
    const s = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!s) continue;
    const key = areaKey(s);
    const cur = byKey.get(key);
    if (!cur || (hasDiacritics(s) && !hasDiacritics(cur))) byKey.set(key, s);
  }
  return byKey;
}
