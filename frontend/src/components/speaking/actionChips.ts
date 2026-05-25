/** Split backend `action` string into discrete suggestion chips (V2). */
export function parseActionChips(action: string | null | undefined): string[] {
  if (!action?.trim()) return [];
  const t = action.trim();
  const lines = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const bullets = t.split(/\s*[•·]\s+/).map((s) => s.trim()).filter(Boolean);
  if (bullets.length > 1) return bullets;
  const semi = t.split(/\s*;\s+/).map((s) => s.trim()).filter(Boolean);
  if (semi.length > 1) return semi;
  return [t];
}
