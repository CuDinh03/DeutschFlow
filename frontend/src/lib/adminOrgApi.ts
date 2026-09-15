import api from '@/lib/api'
import type { OrgRole, MemberStatus, Page, OrgMember } from '@/lib/orgApi'

/**
 * Platform-admin Org API client — B2B Phase 3.
 *
 * Paths are relative to the configured axios `baseURL` (`<origin>/api`), so the
 * `/api` prefix is omitted here. All routes live under `/admin/organizations/*`
 * and require an ADMIN JWT (backend `@PreAuthorize hasRole('ADMIN')`).
 */

/**
 * Trạng thái vòng đời trung tâm — backend chỉ nhận ACTIVE | SUSPENDED (`VALID_ORG_STATUSES`).
 * `PENDING` từng nằm ở đây là mã chết: đó là trạng thái LỜI MỜI, backend từ chối 400 khi PATCH.
 */
export type OrgStatus = 'ACTIVE' | 'SUSPENDED'
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID'

/** GET /admin/organizations — one row in the platform-admin org list (`OrgDto`). */
export interface AdminOrg {
  id: number
  name: string
  slug: string | null
  planCode: string | null
  /** 0 = không giới hạn ghế. */
  seatLimit: number
  status: string
  /** Hạn mức token AI nhân sự/tháng; 0 + poolUnlimited=false = CHƯA cấu hình ⇒ nhân sự bị 429. */
  monthlyTokenPool: number | null
  poolUnlimited?: boolean
  /** Hạn giấy phép (ISO instant); null = vô thời hạn khi còn ACTIVE. */
  validUntil: string | null
  /** Mốc bắt đầu đình chỉ — neo 7 ngày ân hạn chỉ-đọc; null = không bị đình chỉ. */
  suspendedAt?: string | null
  seatUsed?: number
  teacherCount?: number
  studentCount?: number
  createdAt?: string
}

/** GET /admin/organizations/{id} — hồ sơ một trung tâm (`OrgDetailDto`), đủ dữ liệu cho màn T-03. */
export interface AdminOrgDetail extends AdminOrg {
  teacherCount: number
  studentCount: number
  pendingInvites: number
  monthlyTokenPool: number
  poolUnlimited: boolean
}

/** GET /admin/plans — một gói trong `subscription_plans` (JDBC map: khoá có thể về chữ thường). */
export interface AdminPlanOption {
  code: string
  name: string
  isActive: boolean
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
  /** Mã ghi vào nội dung chuyển khoản (VietQR); webhook SePay đối soát theo mã này. */
  paymentCode: string | null
  note: string | null
  createdAt: string
  /** Hạn thanh toán = lúc gửi + 7 ngày (Q4). null = hoá đơn còn nháp nên chưa có hạn. */
  dueDate: string | null
}

/** POST /admin/organizations — body to provision a new tenant. */
export interface CreateOrgInput {
  name: string
  slug?: string
  planCode?: string
  seatLimit?: number
  ownerEmail?: string
  /** B2B model §2.1: admin pre-create OWNER. Khi ownerEmail là email MỚI → tạo thẳng account OWNER. */
  ownerName?: string
  ownerPassword?: string
  /** T-03: hạn mức AI nhân sự đặt ngay lúc tạo — không truyền thì org mới bị 429 tới khi cấu hình. */
  monthlyTokenPool?: number
  poolUnlimited?: boolean
}

/**
 * PATCH-style update body for an org (all fields optional → partial update).
 * Chỉ gửi trường THẬT SỰ đổi: backend ghi vết `admin.org.updated` liệt kê từng trường đổi kèm
 * giá trị cũ/mới, gửi cả form là vết đầy rác.
 */
export interface UpdateOrgInput {
  /** Mã gói; chuỗi rỗng = bỏ gói (backend chuẩn hoá '' → null). */
  planCode?: string
  /** 0 = không giới hạn; backend clamp âm về 0. */
  seatLimit?: number
  /** Chỉ có tác dụng khi KHÔNG bật poolUnlimited (bật unlimited thì pool giữ nguyên). */
  monthlyTokenPool?: number
  poolUnlimited?: boolean
  status?: OrgStatus
  /** ISO-8601 instant. Muốn XOÁ hạn (vô thời hạn) dùng `clearValidUntil` — backend không phân biệt null với "không gửi". */
  validUntil?: string
  clearValidUntil?: boolean
}

/**
 * POST /admin/organizations/{id}/force-owner — đường khôi phục quyền giám đốc (DEC-13 / A6).
 * `reason` bắt buộc 10–500 ký tự: đi nguyên văn vào sổ trung tâm, actor ghi là admin.
 */
export interface ForceOwnerInput {
  newOwnerUserId: number
  reason: string
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
export async function getOrganization(id: number): Promise<AdminOrgDetail> {
  const res = await api.get<AdminOrgDetail>(`/admin/organizations/${id}`)
  return res.data
}

/**
 * GET /admin/plans — danh sách gói để màn T-03 chọn thay vì gõ tay mã gói (mã sai = FK từ chối 409).
 * JDBC trả `Map` với alias cột bị PostgreSQL hạ chữ thường (`isactive`), nên đọc cả hai dạng.
 */
export async function listAdminPlans(): Promise<AdminPlanOption[]> {
  const res = await api.get<Record<string, unknown>[]>('/admin/plans')
  return (res.data ?? [])
    .map((r) => ({
      code: String(r.code ?? ''),
      name: String(r.name ?? r.code ?? ''),
      isActive: (r.isActive ?? r.isactive) !== false,
    }))
    .filter((p) => p.code !== '')
}

/** PATCH /admin/organizations/{id} — update plan/seats/pool/status/validUntil. */
export async function updateOrganization(
  id: number,
  body: UpdateOrgInput,
): Promise<AdminOrg> {
  const res = await api.patch<AdminOrg>(`/admin/organizations/${id}`, body)
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
 * POST /admin/organizations/{id}/force-owner — chỉ định một nhân sự ACTIVE (MANAGER/TEACHER)
 * làm OWNER duy nhất; mọi OWNER hiện tại bị hạ xuống MANAGER, phiên đăng nhập hai bên bị thu hồi.
 * Trả về thành viên vừa lên OWNER. Backend từ chối 400 khi lý do < 10 ký tự, người nhận là
 * STUDENT / không phải thành viên, hoặc là admin nền tảng (DEC-13).
 */
export async function forceOwner(id: number, body: ForceOwnerInput): Promise<AdminOrgMember> {
  const res = await api.post<AdminOrgMember>(`/admin/organizations/${id}/force-owner`, body)
  return res.data
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

/** A "free teacher" — TEACHER with no ACTIVE org membership (derived, no flag). */
export interface FreeTeacher {
  userId: number
  email: string
  displayName: string | null
}

/** GET /admin/teachers/free — TEACHERs not attached to any org (recruiting list). */
export async function listFreeTeachers(): Promise<FreeTeacher[]> {
  const res = await api.get<FreeTeacher[]>('/admin/teachers/free')
  return res.data ?? []
}

/**
 * GET /admin/teachers/{userId}/break-glass?orgId= — audited view of an org-affiliated teacher.
 * Default-hidden per the permission matrix; every call writes an audit_logs row server-side.
 */
export async function breakGlassViewTeacher(userId: number, orgId: number): Promise<OrgMember> {
  const res = await api.get<OrgMember>(`/admin/teachers/${userId}/break-glass`, {
    params: { orgId },
  })
  return res.data
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
