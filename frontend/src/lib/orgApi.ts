import api from '@/lib/api'

/**
 * Org (B2B tenant) API client — Phase 1.
 *
 * Paths are relative to the configured axios `baseURL` (`<origin>/api`), so the
 * `/api` prefix is omitted here. Org-admin routes live under `/org/*`; invite
 * preview/accept are public under `/public/org-invitations/*`.
 */

export type OrgRole = 'OWNER' | 'ADMIN' | 'TEACHER' | 'STUDENT'
export type MemberStatus = 'ACTIVE' | 'REMOVED'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

/** GET /org — "my org" overview for an org-admin. */
export interface OrgSummary {
  name: string
  planCode: string | null
  seatUsed: number
  seatLimit: number
  teacherCount: number
  studentCount: number
}

/** A member of the organization (OWNER|ADMIN|TEACHER|STUDENT). */
export interface OrgMember {
  userId: number
  email: string
  displayName: string | null
  role: OrgRole
  status: MemberStatus
  joinedAt: string
}

/** A pending/accepted/revoked/expired invitation to the organization. */
export interface OrgInvitation {
  id: number
  email: string
  role: OrgRole
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

/** A class belonging to the org (read-only, from teacher_classes WHERE org_id). */
export interface OrgClass {
  id: number
  name: string
  inviteCode: string | null
  teacherId: number | null
  createdAt: string
}

/** Public invitation preview (token is the secret). */
export interface InvitationPreview {
  orgName: string
  role: OrgRole
  email: string
  expired: boolean
  /** True when no user exists for the invite email yet — displayName+password required to accept. */
  requiresRegistration: boolean
}

/** Body for accepting an invitation; both fields required only when registering a new user. */
export interface AcceptInvitationInput {
  displayName?: string
  password?: string
}

/** Auth payload returned on successful invite acceptance (mirrors backend AuthResponse). */
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  userId: number
  email: string
  displayName: string
  role: string
  locale: string
  learningTargetLevel: string | null
  industry: string | null
  orgId: number | null
  orgRole: OrgRole | null
}

/** Spring Data `Page<T>` envelope. */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

/** GET /org — tenant summary for the current org-admin. */
export async function getOrgSummary(): Promise<OrgSummary> {
  const res = await api.get<OrgSummary>('/org')
  return res.data
}

/** GET /org/members — optionally filter by role (TEACHER|STUDENT|ADMIN). */
export async function listMembers(role?: OrgRole): Promise<OrgMember[]> {
  const res = await api.get<OrgMember[]>('/org/members', {
    params: role ? { role } : undefined,
  })
  return res.data ?? []
}

/** POST /org/teachers/invite — invite a teacher by email. */
export async function inviteTeacher(email: string): Promise<OrgInvitation> {
  const res = await api.post<OrgInvitation>('/org/teachers/invite', { email })
  return res.data
}

/** GET /org/invitations — pending invitations for the org. */
export async function listInvitations(): Promise<OrgInvitation[]> {
  const res = await api.get<OrgInvitation[]>('/org/invitations')
  return res.data ?? []
}

/** DELETE /org/invitations/{id} — revoke a pending invitation. */
export async function revokeInvitation(id: number): Promise<void> {
  await api.delete(`/org/invitations/${id}`)
}

/** DELETE /org/members/{userId} — remove a member from the org. */
export async function removeMember(userId: number): Promise<void> {
  await api.delete(`/org/members/${userId}`)
}

/** GET /org/classes — read-only paginated list of the org's classes. */
export async function listClasses(page = 0, size = 20): Promise<Page<OrgClass>> {
  const res = await api.get<Page<OrgClass>>('/org/classes', {
    params: { page, size },
  })
  return res.data
}

/** GET /public/org-invitations/{token} — preview an invitation (token is the secret). */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const res = await api.get<InvitationPreview>(
    `/public/org-invitations/${encodeURIComponent(token)}`,
  )
  return res.data
}

/** POST /public/org-invitations/{token}/accept — accept an invitation and log in. */
export async function acceptInvitation(
  token: string,
  body: AcceptInvitationInput,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(
    `/public/org-invitations/${encodeURIComponent(token)}/accept`,
    body,
  )
  return res.data
}
