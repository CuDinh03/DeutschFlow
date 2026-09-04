/**
 * Shared contracts for the unified messages inbox (student + teacher).
 *
 * The inbox merges two backend surfaces into one list:
 *  - direct 1-1 threads (`/messages/*`, {@link @/lib/messagesApi})
 *  - class group channels (`/v2/classes/{id}/channel/*`, {@link @/lib/classChannelApi})
 */

/**
 * A class channel row, normalized across the two class-list endpoints that feed it
 * (`/v2/teacher/classes` for teachers, `/v2/students/classes` for students). The channel endpoints
 * themselves are role-agnostic — only the way we enumerate the caller's classes differs.
 */
export interface ChannelClass {
  id: number
  name: string
  /** Secondary line: student count for teachers, teacher names for students. */
  subtitle: string
}

/** Loads the caller's classes. Supplied per role by the page that renders the inbox. */
export type ChannelClassLoader = () => Promise<ChannelClass[]>

/**
 * Which thread the right pane shows. `null` means nothing is selected — on desktop that's the
 * "pick a conversation" hint, on mobile it's what keeps the list visible.
 */
export type Selection =
  | { kind: 'direct'; userId: number; name: string }
  | { kind: 'class'; classId: number; name: string }

/** True when both selections point at the same thread (used for the active-row highlight). */
export function isSameSelection(a: Selection | null, b: Selection | null): boolean {
  if (a == null || b == null) return a === b
  if (a.kind === 'direct' && b.kind === 'direct') return a.userId === b.userId
  if (a.kind === 'class' && b.kind === 'class') return a.classId === b.classId
  return false
}
