import api from '@/lib/api'

/**
 * Người duyệt học vụ ("giáo viên trưởng") — PR-2, quyết định P01. Giám đốc (OWNER) mặc định có
 * quyền duyệt, không cần dòng phân công; MANAGER không tự có (tách học vụ khỏi quản trị).
 * Xem = org-admin; gán/thu hồi = OWNER-only (backend chốt).
 */

export type ApproverScope = 'ORG' | 'CLASS'

export interface AcademicApprover {
  id: number
  userId: number
  displayName: string | null
  email: string | null
  orgRole: string | null
  scope: ApproverScope
  classId: number | null
  className: string | null
  grantedAt: string
}

export async function listAcademicApprovers(): Promise<AcademicApprover[]> {
  const res = await api.get<AcademicApprover[]>('/org/academic-approvers')
  return res.data
}

export async function grantAcademicApprover(body: {
  userId: number
  scope: ApproverScope
  classId?: number | null
}): Promise<AcademicApprover> {
  const res = await api.post<AcademicApprover>('/org/academic-approvers', body)
  return res.data
}

export async function revokeAcademicApprover(approverId: number): Promise<void> {
  await api.delete(`/org/academic-approvers/${approverId}`)
}
