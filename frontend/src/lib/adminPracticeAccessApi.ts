import api from '@/lib/api'

/** Quyền dùng luyện đề telc (04/11/2026) — `/api/admin/practice-access`, chỉ ADMIN. */
export type PracticeAccessMode = 'OFF' | 'ALLOWLIST' | 'ALL'

export interface PracticeAccessMember {
  id: number
  email: string
  displayName: string
  role: string
}

export interface PracticeAccessState {
  mode: PracticeAccessMode
  members: PracticeAccessMember[]
  /** Mục trong danh sách không khớp tài khoản nào (đã xoá hoặc gõ sai). */
  unknown: string[]
}

export async function getPracticeAccessState(): Promise<PracticeAccessState> {
  const res = await api.get<PracticeAccessState>('/admin/practice-access')
  return res.data
}

export async function setPracticeAccessMode(mode: PracticeAccessMode): Promise<PracticeAccessState> {
  const res = await api.put<PracticeAccessState>('/admin/practice-access/mode', { mode })
  return res.data
}

/** Thêm theo id hoặc email. */
export async function addPracticeAccessUser(identifier: string): Promise<PracticeAccessState> {
  const res = await api.post<PracticeAccessState>('/admin/practice-access/users', { identifier })
  return res.data
}

export async function removePracticeAccessUser(userId: number): Promise<PracticeAccessState> {
  const res = await api.delete<PracticeAccessState>(`/admin/practice-access/users/${userId}`)
  return res.data
}

export async function removePracticeAccessToken(token: string): Promise<PracticeAccessState> {
  const res = await api.delete<PracticeAccessState>('/admin/practice-access/tokens', { params: { token } })
  return res.data
}

export async function searchPracticeAccessUsers(q: string): Promise<PracticeAccessMember[]> {
  const res = await api.get<PracticeAccessMember[]>('/admin/practice-access/search', { params: { q } })
  return res.data ?? []
}
