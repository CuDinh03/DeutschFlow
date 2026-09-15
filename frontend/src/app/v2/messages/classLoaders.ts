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

/** Nhãn phụ đề theo locale (từ `v2.inbox`) — loader chạy ngoài React nên nhận qua tham số. */
export interface ChannelLabels {
  teacherPrefix: (names: string) => string
  noTeacher: string
  students: (count: number) => string
}

/** Classes the student is enrolled in; subtitled with the teachers they can also DM. */
export async function loadStudentChannelClasses(labels: ChannelLabels): Promise<ChannelClass[]> {
  const classes = await fetchMyClasses()
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle:
      c.teachers.length > 0
        ? labels.teacherPrefix(c.teachers.map((t) => t.displayName).join(', '))
        : labels.noTeacher,
  }))
}

/** Classes the teacher owns or co-teaches; subtitled with the roster size. */
export async function loadTeacherChannelClasses(labels: ChannelLabels): Promise<ChannelClass[]> {
  const classes = await listTeacherClasses()
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: labels.students(c.studentCount),
  }))
}
