// Knowledge points ("kiến thức cần học") for a class lesson.
//
// They are stored newline-separated in the existing ClassLesson.description
// column — no schema change. A leading bullet/dash on any stored line is
// tolerated and stripped, so legacy free-text descriptions and the structured
// list stay interchangeable. Shared by the teacher checklist editor and the
// student-facing lesson views so both parse/format identically.

/** Split a lesson description into trimmed, non-empty knowledge points. */
export function parseKnowledgePoints(description: string | null | undefined): string[] {
  if (!description) return []
  return description
    .split('\n')
    .map((s) => s.replace(/^\s*[-•·*]\s*/, '').trim())
    .filter((s) => s.length > 0)
}

/** Join knowledge points back into the newline-separated storage form. */
export function formatKnowledgePoints(points: string[]): string {
  return points
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join('\n')
}

/**
 * Display texts for a lesson (Phase 1b): the structured knowledge points when present,
 * otherwise the legacy newline-encoded description. Lets read-only views migrate to the
 * sub-table while still rendering lessons that haven't been re-saved yet.
 */
export function resolvePointTexts(
  points: { text: string }[] | null | undefined,
  description: string | null | undefined,
): string[] {
  if (points && points.length > 0) return points.map((p) => p.text)
  return parseKnowledgePoints(description)
}
