import { fetchMyClasses } from '@/lib/studentClassesApi'
import { listTeacherClasses } from '@/lib/teacherMessagingApi'
import type { ChannelClass } from './types'

/**
 * Adapters from the two role-specific class-list endpoints to the inbox's {@link ChannelClass} row.
 * The group-channel endpoints themselves are role-agnostic (membership is checked server-side per
 * call) — only enumerating "which classes am I in" differs.
 *
 * These are module-level constants on purpose: {@link MessagesInbox} keys an effect on the loader
 * identity, so an inline arrow would refetch on every render.
 */

/** Classes the student is enrolled in; subtitled with the teachers they can also DM. */
export async function loadStudentChannelClasses(): Promise<ChannelClass[]> {
  const classes = await fetchMyClasses()
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle:
      c.teachers.length > 0
        ? `GV: ${c.teachers.map((t) => t.displayName).join(', ')}`
        : 'Chưa có giáo viên',
  }))
}

/** Classes the teacher owns or co-teaches; subtitled with the roster size. */
export async function loadTeacherChannelClasses(): Promise<ChannelClass[]> {
  const classes = await listTeacherClasses()
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: `${c.studentCount} học viên`,
  }))
}
