import type { AdminOrg, AdminOrgDetail, UpdateOrgInput } from '@/lib/adminOrgApi'

/**
 * Logic thuần của màn T-03 "Sửa gói & giấy phép" — tách khỏi component để test không cần render.
 *
 * Nguyên tắc: form giữ CHUỖI người dùng gõ; chỉ khi dựng body PATCH mới ép kiểu + clamp. Body chỉ
 * mang trường THẬT SỰ đổi so với trung tâm hiện tại — backend ghi vết `admin.org.updated` liệt kê
 * từng trường đổi kèm cũ/mới, nên gửi cả form là vết đầy trường "đổi" thành chính nó.
 */

export type PoolMode = 'unlimited' | 'metered'

export interface LicenceFormState {
  /** Mã gói; '' = không gói. */
  planCode: string
  /** Chuỗi từ ô số; rỗng/không hợp lệ ⇒ 0 = không giới hạn. */
  seatLimit: string
  poolMode: PoolMode
  /** Chuỗi từ ô số (token/tháng), chỉ có nghĩa khi `poolMode === 'metered'`. */
  monthlyTokenPool: string
  /** 'yyyy-mm-dd' theo ngày địa phương, '' = vô thời hạn. */
  validUntil: string
}

/** Ép chuỗi ô số về số nguyên ≥ 0 — cùng luật clamp với backend (âm ⇒ 0, rác ⇒ fallback). */
export function clampInt(raw: string | number | null | undefined, fallback = 0): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.floor(n))
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Instant → giá trị ô `<input type="date">` theo NGÀY ĐỊA PHƯƠNG của trình duyệt. Cùng múi giờ với
 * cách màn danh sách in "Gia hạn dd/mm/yyyy", nên ngày admin thấy ở hai chỗ là một.
 */
export function instantToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * 'yyyy-mm-dd' → instant CUỐI NGÀY địa phương (23:59:59.999). Backend so `now.isAfter(validUntil)`
 * nên "hạn 31/12" phải còn hiệu lực trọn ngày 31/12 — lấy 00:00 là trung tâm mất quyền ghi sớm
 * một ngày. Chuỗi không hợp lệ ⇒ null.
 */
export function dateInputToInstant(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
  if (Number.isNaN(d.getTime()) || d.getDate() !== Number(m[3])) return null
  return d.toISOString()
}

/** Trạng thái form khớp trung tâm hiện tại (dùng lúc mở màn và sau mỗi lần lưu). */
export function formFromOrg(org: AdminOrgDetail): LicenceFormState {
  return {
    planCode: (org.planCode ?? '').toUpperCase(),
    seatLimit: String(org.seatLimit ?? 0),
    poolMode: org.poolUnlimited ? 'unlimited' : 'metered',
    monthlyTokenPool: String(org.monthlyTokenPool ?? 0),
    validUntil: instantToDateInput(org.validUntil),
  }
}

/**
 * Dựng body PATCH chỉ gồm trường đổi; `null` khi không có gì để lưu (nút Lưu bị khoá).
 *
 * - Gói: so sau khi viết hoa (backend chuẩn hoá cùng cách); '' gửi đi để bỏ gói.
 * - Ghế: clamp ≥ 0 rồi so.
 * - AI: bật không-giới-hạn ⇒ chỉ gửi `poolUnlimited: true` (pool giữ nguyên ở backend); hạn mức ⇒
 *   tắt unlimited nếu đang bật, và gửi pool nếu số khác.
 * - Hạn: xoá ⇒ `clearValidUntil`; đặt ⇒ instant cuối ngày, chỉ khi NGÀY khác ngày đang có.
 */
export function buildLicenceUpdate(org: AdminOrgDetail, form: LicenceFormState): UpdateOrgInput | null {
  const body: UpdateOrgInput = {}

  const plan = form.planCode.trim().toUpperCase()
  if (plan !== (org.planCode ?? '').toUpperCase()) body.planCode = plan

  const seats = clampInt(form.seatLimit)
  if (seats !== clampInt(org.seatLimit)) body.seatLimit = seats

  if (form.poolMode === 'unlimited') {
    if (!org.poolUnlimited) body.poolUnlimited = true
  } else {
    if (org.poolUnlimited) body.poolUnlimited = false
    const pool = clampInt(form.monthlyTokenPool)
    if (pool !== clampInt(org.monthlyTokenPool)) body.monthlyTokenPool = pool
  }

  const currentDate = instantToDateInput(org.validUntil)
  if (form.validUntil === '') {
    if (org.validUntil) body.clearValidUntil = true
  } else if (form.validUntil !== currentDate) {
    const instant = dateInputToInstant(form.validUntil)
    if (instant) body.validUntil = instant
  }

  return Object.keys(body).length === 0 ? null : body
}

/**
 * DEC-16: hạ ghế xuống DƯỚI sĩ số đang dùng không gỡ ai — người cũ giữ chỗ, chỉ chặn thêm mới.
 * Backend vẫn lưu; màn phải hỏi lại trước vì hệ quả không hiện ra ở đâu khác. 0 = không giới hạn
 * nên không phải "hạ".
 */
export function isSeatDrop(org: Pick<AdminOrg, 'studentCount'>, body: UpdateOrgInput): boolean {
  if (body.seatLimit === undefined || body.seatLimit <= 0) return false
  return body.seatLimit < (org.studentCount ?? 0)
}

export type PoolSummary = 'unlimited' | 'metered' | 'unset'

/** Tóm tắt hạn mức AI nhân sự cho nhãn: `unset` = pool 0 và không unlimited ⇒ nhân sự bị 429. */
export function poolSummary(org: Pick<AdminOrg, 'monthlyTokenPool' | 'poolUnlimited'>): PoolSummary {
  if (org.poolUnlimited) return 'unlimited'
  return clampInt(org.monthlyTokenPool) > 0 ? 'metered' : 'unset'
}

/** Ngày ân hạn kết thúc = mốc neo + 7 ngày (OrgLicenseState.GRACE). */
export const GRACE_DAYS = 7

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime())
  d.setDate(d.getDate() + days)
  return d
}

/**
 * `LocalDate` backend ('yyyy-mm-dd', ví dụ periodEnd) → Date ĐỊA PHƯƠNG cùng ngày. `new Date('2026-12-31')`
 * parse theo UTC, ở múi giờ âm lùi thành 30/12 — cộng ngày rồi in ra sẽ sai một ngày. Chuỗi khác
 * dạng đó (instant đầy đủ) trả về `new Date(str)` như thường; rác ⇒ null.
 */
export function localDateFromIso(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
