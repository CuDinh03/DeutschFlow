import api from '@/lib/api'

/**
 * Co-branded certificate API client (D5 cert-lite).
 *
 * Teacher endpoints are authenticated and live under `/v2/teacher/certificates`; the verify
 * endpoint is public under `/public/certificate/{token}`. Paths are relative to the axios
 * `baseURL` (`<origin>/api`), so the `/api` prefix is omitted.
 */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** Full certificate, as rendered / publicly verified. */
export interface Certificate {
  certificateCode: string
  verifyToken: string
  studentName: string
  cefrLevel: string
  score: number | null
  note: string | null
  /** Center co-brand; null when the issuer has no org (default DeutschFlow branding). */
  orgName: string | null
  orgLogoUrl: string | null
  issuedByName: string | null
  issuedAt: string
  active: boolean
}

/** Compact row for the teacher's per-class list. */
export interface CertificateSummary {
  id: number
  certificateCode: string
  verifyToken: string
  studentName: string
  cefrLevel: string
  score: number | null
  issuedAt: string
  active: boolean
}

/** POST /v2/teacher/certificates — request body. */
export interface IssueCertificateInput {
  classId: number
  studentId: number
  cefrLevel: CefrLevel
  score?: number | null
  note?: string | null
}

/** Issue a co-branded certificate to a student in one of the teacher's classes. */
export async function issueCertificate(input: IssueCertificateInput): Promise<Certificate> {
  const res = await api.post<Certificate>('/v2/teacher/certificates', input)
  return res.data
}

/** List certificates issued from a class (teacher must own it). */
export async function listClassCertificates(classId: number | string): Promise<CertificateSummary[]> {
  const res = await api.get<CertificateSummary[]>(`/v2/teacher/certificates/class/${classId}`)
  return res.data
}

/** Revoke (soft-delete) a certificate. */
export async function revokeCertificate(certificateId: number): Promise<void> {
  await api.post(`/v2/teacher/certificates/${certificateId}/revoke`)
}

/**
 * Public verification — fetch a certificate by its verify token.
 *
 * DEC-20: chứng nhận đã thu hồi vẫn trả 200 với `active=false` (trước đây 404) để trang xác thực
 * báo "đã thu hồi" thay vì "không tồn tại" — 404 không phân biệt được giấy giả với giấy bị rút.
 */
export async function getCertificate(token: string): Promise<Certificate> {
  const res = await api.get<Certificate>(`/public/certificate/${encodeURIComponent(token)}`)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Sổ chứng nhận toàn trung tâm (DEC-20) — /org/certificates, OWNER/MANAGER đọc, chỉ OWNER thu hồi.
// ─────────────────────────────────────────────────────────────────────────────

/** Một dòng trong sổ chứng nhận toàn trung tâm — GET /org/certificates. */
export interface OrgCertificateRow {
  id: number
  certificateCode: string
  verifyToken: string
  classId: number
  /** Tên HIỆN TẠI của lớp (không chụp lúc cấp); null khi lớp đã bị xoá. */
  className: string | null
  studentUserId: number
  /** Tên in trên chứng nhận (bản chụp lúc cấp). */
  studentName: string
  cefrLevel: string
  score: number | null
  issuedByUserId: number
  issuedByName: string | null
  issuedAt: string
  /** false = đã thu hồi (giáo viên phụ trách hoặc giám đốc). */
  active: boolean
}

/** Phong bì phân trang `{items,total,page,size}` — cùng khuôn với sổ hoạt động (C6). */
export interface OrgCertificatePage {
  items: OrgCertificateRow[]
  total: number
  page: number
  size: number
}

export interface ListOrgCertificatesOptions {
  /** Tên học viên trên chứng nhận, không phân biệt hoa thường. */
  q?: string
  /** Chỉ chứng nhận cấp từ lớp này. */
  classId?: number
  /** true = còn hiệu lực, false = đã thu hồi, bỏ trống = cả hai. */
  active?: boolean
}

/**
 * GET /org/certificates — sổ chứng nhận của CHÍNH trung tâm người gọi.
 *
 * OWNER và MANAGER đọc được (`OrgGuard.assertOrgAdmin`); TEACHER bị 403. Không nhận `orgId` —
 * máy chủ ép theo principal nên không có đường đọc sổ của trung tâm khác. `size` bị chặn trần 100.
 */
export async function listOrgCertificates(
  page = 0,
  size = 30,
  opts: ListOrgCertificatesOptions = {},
): Promise<OrgCertificatePage> {
  const q = opts.q?.trim()
  const res = await api.get<OrgCertificatePage>('/org/certificates', {
    params: {
      page,
      size,
      ...(q ? { q } : {}),
      ...(typeof opts.classId === 'number' ? { classId: opts.classId } : {}),
      ...(typeof opts.active === 'boolean' ? { active: opts.active } : {}),
    },
  })
  const data = res.data
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    size: data?.size ?? size,
  }
}

/**
 * POST /org/certificates/{id}/revoke — giám đốc thu hồi kèm lý do (5–300 ký tự, máy chủ kiểm).
 *
 * CHỈ OWNER (`OrgGuard.assertOrgOwner`, MANAGER 403); chứng nhận của trung tâm khác ⇒ 404; đã thu
 * hồi rồi ⇒ vẫn 200 (idempotent). Trả dòng đã cập nhật để bảng thay tại chỗ, khỏi tải lại trang.
 */
export async function revokeOrgCertificate(certificateId: number, reason: string): Promise<OrgCertificateRow> {
  const res = await api.post<OrgCertificateRow>(`/org/certificates/${certificateId}/revoke`, { reason })
  return res.data
}

/**
 * URL trang xác thực công khai — cùng dạng `<origin>/certificate/{token}/` (gạch chéo cuối, khớp
 * canonical của trang in). `origin` tách ra để test và SSR không đụng `window`.
 */
export function certificateVerifyUrl(token: string, origin?: string): string {
  const base = (origin ?? (typeof window === 'undefined' ? '' : window.location.origin)).replace(/\/+$/, '')
  return `${base}/certificate/${encodeURIComponent(token)}/`
}
