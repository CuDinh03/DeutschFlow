/**
 * Co-teaching helpers — a class can have one PRIMARY (giáo viên chính) and any number of
 * ASSISTANT (trợ giảng) teachers. Mirrors backend `ClassTeacherDto` and the authz rule that
 * only a PRIMARY may add/remove co-teachers (enforced server-side via `assertPrimaryTeacher`;
 * these helpers gate the UI so non-primaries don't see the controls).
 */

/** A teacher on a class. `role` is 'PRIMARY' | 'ASSISTANT'. */
export interface ClassTeacher {
  teacherId: number
  name: string
  email: string
  role: string
  joinedAt: string | null
}

/**
 * Whether `currentUserId` is the PRIMARY teacher of the class (may manage co-teachers).
 * The user store exposes the id as a string while `teacherId` is numeric — compare as strings.
 */
export function isPrimaryTeacher(
  teachers: readonly ClassTeacher[],
  currentUserId: string | number | null | undefined,
): boolean {
  if (currentUserId == null || currentUserId === '') return false
  return teachers.some((t) => t.role === 'PRIMARY' && String(t.teacherId) === String(currentUserId))
}

/** A PRIMARY teacher cannot be removed (backend rejects it); only ASSISTANTs are removable. */
export function isRemovable(teacher: ClassTeacher): boolean {
  return teacher.role !== 'PRIMARY'
}
