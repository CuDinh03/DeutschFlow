import api from '@/lib/api'

/** A teacher's self-declared teaching center (D11). */
export interface TeacherCenter {
  centerName: string | null
}

/** GET /api/v2/teacher/center — current declared center. */
export async function getTeacherCenter(): Promise<TeacherCenter> {
  const res = await api.get<TeacherCenter>('/v2/teacher/center')
  return res.data
}

/** PUT /api/v2/teacher/center — set/clear the declared center; returns the normalized value. */
export async function setTeacherCenter(centerName: string | null): Promise<TeacherCenter> {
  const res = await api.put<TeacherCenter>('/v2/teacher/center', { centerName })
  return res.data
}
