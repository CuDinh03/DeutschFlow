import api from '@/lib/api'
import type { OrgRole, MemberStatus, Page } from '@/lib/orgApi'

/**
 * Platform-admin Org API client — B2B Phase 3.
 *
 * Paths are relative to the configured axios `baseURL` (`<origin>/api`), so the
 * `/api` prefix is omitted here. All routes live under `/admin/organizations/*`
 * and require an ADMIN JWT (backend `@PreAuthorize hasRole('ADMIN')`).
 */

export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING'
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID'

/** GET /admin/organizations — one row in the platform-admin org list. */
export interface AdminOrg {
  id: number
  name: string
  slug: string | null
  planCode: string | null
  seatLimit: number
  status: string
  monthlyTokenPool: number | null
  validUntil: string | null
  seatUsed?: number
  teacherCount?: number
  studentCount?: number
  createdAt?: string
}

/** A member of an organization as seen by the platform admin. */
export interface AdminOrgMember {
  userId: number
  email: string
  displayName: string | null
  role: OrgRole
  status: MemberStatus
  joinedAt: string
}

/** GET /admin/organizations/{id}/invoices — a billing line for an org. */
export interface OrgInvoice {
  id: number
  orgId: number
  periodStart: string | null
  periodEnd: string | null
  seats: number
  amountVnd: number
  status: string
  note: string | null
  createdAt: string
}

/** POST /admin/organizations — body to provision a new tenant. */
export interface CreateOrgInput {
  name: string
  slug?: string
  planCode?: string
  seatLimit?: number
  ownerEmail?: string
}

/** PATCH-style update body for an org (all fields optional → partial update). */
export interface UpdateOrgInput {
  planCode?: string
  seatLimit?: number
  monthlyTokenPool?: number
  status?: OrgStatus
  /** ISO-8601 instant; null clears the licence end date. */
  validUntil?: string | null
}

/** POST /admin/organizations/{id}/members — attach an existing/new member. */
export interface AddMemberInput {
  email: string
  role: OrgRole
}

/** POST /admin/organizations/{id}/invoices — draft a billing line. */
export interface CreateInvoiceInput {
  periodStart?: string
  periodEnd?: string
  seats: number
  amountVnd: number
  note?: string
}

/** GET /admin/organizations — paginated tenant list (Spring Data `Page`). */
export async function listOrganizations(
  page = 0,
  size = 20,
): Promise<Page<AdminOrg>> {
  const res = await api.get<Page<AdminOrg>>('/admin/organizations', {
    params: { page, size },
  })
  return res.data
}

/** POST /admin/organizations — provision a new tenant. */
export async function createOrganization(body: CreateOrgInput): Promise<AdminOrg> {
  const res = await api.post<AdminOrg>('/admin/organizations', body)
  return res.data
}

/** GET /admin/organizations/{id} — full detail for a single tenant. */
export async function getOrganization(id: number): Promise<AdminOrg> {
  const res = await api.get<AdminOrg>(`/admin/organizations/${id}`)
  return res.data
}

/** PATCH /admin/organizations/{id} — update plan/seats/pool/status/validUntil. */
export async function updateOrganization(
  id: number,
  body: UpdateOrgInput,
): Promise<AdminOrg> {
  const res = await api.patch<AdminOrg>(`/admin/organizations/${id}`, body)
  return res.data
}

/** POST /admin/organizations/{id}/members — add a member by email + role. */
export async function addMember(
  id: number,
  body: AddMemberInput,
): Promise<AdminOrgMember> {
  const res = await api.post<AdminOrgMember>(
    `/admin/organizations/${id}/members`,
    body,
  )
  return res.data
}

/** GET /admin/organizations/{id}/members — full member roster for a tenant. */
export async function listOrgMembers(id: number): Promise<AdminOrgMember[]> {
  const res = await api.get<AdminOrgMember[]>(
    `/admin/organizations/${id}/members`,
  )
  return res.data ?? []
}

/**
 * POST /admin/organizations/{id}/activate-entitlements — grant the org's plan
 * to every active student. Returns the number of students newly granted.
 */
export async function activateEntitlements(id: number): Promise<number> {
  const res = await api.post<{ granted: number }>(
    `/admin/organizations/${id}/activate-entitlements`,
  )
  return res.data?.granted ?? 0
}

/** POST /admin/organizations/{id}/invoices — draft a new invoice (status DRAFT). */
export async function createInvoice(
  id: number,
  body: CreateInvoiceInput,
): Promise<OrgInvoice> {
  const res = await api.post<OrgInvoice>(
    `/admin/organizations/${id}/invoices`,
    body,
  )
  return res.data
}

/** GET /admin/organizations/{id}/invoices — all invoices, newest first. */
export async function listOrgInvoices(id: number): Promise<OrgInvoice[]> {
  const res = await api.get<OrgInvoice[]>(
    `/admin/organizations/${id}/invoices`,
  )
  return res.data ?? []
}

/** PATCH /admin/organizations/{id}/invoices/{invoiceId}/status — change status. */
export async function updateInvoiceStatus(
  id: number,
  invoiceId: number,
  status: InvoiceStatus,
): Promise<OrgInvoice> {
  const res = await api.patch<OrgInvoice>(
    `/admin/organizations/${id}/invoices/${invoiceId}/status`,
    { status },
  )
  return res.data
}
