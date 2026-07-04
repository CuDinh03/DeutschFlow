import api from '@/lib/api'

/**
 * Teacher-side helpers for the messaging hub: the teacher's classes (for the group-channel list)
 * and the flattened, de-duplicated student roster across all classes (for the "message a student"
 * picker). The backend already restricts direct messages / channel posts to shared-class members,
 * so this only needs to surface valid recipients — no new endpoints required.
 */

/** A class the teacher owns/co-teaches — the unit for a group channel. */
export interface TeacherClass {
  id: number
  name: string
  studentCount: number
}

/** A student the teacher can message 1-1, with the classes they appear in (for context). */
export interface RosterStudent {
  studentId: number
  displayName: string
  email: string
  classNames: string[]
}

interface RawClass {
  id: number
  name?: string
  studentCount?: number
}

interface RawStudent {
  studentId: number
  displayName?: string
  email?: string
}

/** GET the teacher's classes (most useful fields only). */
export async function listTeacherClasses(): Promise<TeacherClass[]> {
  const res = await api.get<RawClass[]>('/v2/teacher/classes')
  return (res.data ?? []).map((c) => ({
    id: c.id,
    name: c.name?.trim() || `Lớp #${c.id}`,
    studentCount: Number(c.studentCount) || 0,
  }))
}

/**
 * Flatten every class roster into a single de-duplicated student list. One student enrolled in
 * several of the teacher's classes appears once, with all their class names attached. Per-class
 * roster fetches run in parallel; a failing class is skipped rather than failing the whole list.
 */
export async function listAllTeacherStudents(): Promise<RosterStudent[]> {
  const classes = await listTeacherClasses()
  const rosters = await Promise.all(
    classes.map(async (cls) => {
      try {
        const res = await api.get<RawStudent[]>(`/v2/teacher/classes/${cls.id}/students`)
        return { cls, students: res.data ?? [] }
      } catch {
        return { cls, students: [] as RawStudent[] }
      }
    }),
  )

  const byId = new Map<number, RosterStudent>()
  for (const { cls, students } of rosters) {
    for (const s of students) {
      const existing = byId.get(s.studentId)
      if (existing) {
        if (!existing.classNames.includes(cls.name)) existing.classNames.push(cls.name)
      } else {
        byId.set(s.studentId, {
          studentId: s.studentId,
          displayName: s.displayName?.trim() || `Học viên #${s.studentId}`,
          email: s.email ?? '',
          classNames: [cls.name],
        })
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'))
}
