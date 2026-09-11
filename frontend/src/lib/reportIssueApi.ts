import api from '@/lib/api'
import type { ReportLang } from '@/lib/reportSheetDict'

/**
 * Phiếu đánh giá gửi gia đình — client của 7 endpoint PR-R2 (#639).
 *
 * `api` đã có baseURL `<origin>/api`, nên đường dẫn ở đây bỏ tiền tố `/api`. Lưu ý bộ điều khiển
 * phiếu nằm ở `/api/teacher/**` (KHÔNG phải `/api/v2/teacher/**` như sổ điểm cũ) — đừng thêm `/v2`.
 *
 * Hình dạng dữ liệu chép đúng `ReportIssueDtos` của backend; những gì backend cố tình KHÔNG trả
 * (token khi phiếu đã chết, id nội bộ trên trang công khai) thì ở đây cũng không có.
 */

export type ReportPeriod = 'MIDTERM' | 'FINAL'
export const REPORT_PERIODS: readonly ReportPeriod[] = ['MIDTERM', 'FINAL'] as const

/** Trạng thái dòng phiếu do backend tính tại thời điểm đọc (`StudentReportIssue.statusAt`). */
export type ReportIssueStatus = 'ACTIVE' | 'EXPIRED' | 'SUPERSEDED' | 'REVOKED'

/** Mã xếp loại (`SkillReportDto.gradeCodeOf`) — nhãn dịch ở client (R8). */
export type ReportGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'AVERAGE' | 'WEAK'

/** Mã kỹ năng, đúng thứ tự in trên phiếu (`ReportPayloadBuilder.SKILL_CODES`). */
export type ReportSkillCode = 'HOREN' | 'LESEN' | 'SCHREIBEN' | 'SPRECHEN'

export interface ReportSkillRow {
  code: ReportSkillCode
  score: number | null
  grade: ReportGrade | null
}

/**
 * `payload_json` đã đóng băng. Mọi khối đều có thể `null` (lớp chưa gắn giáo trình, kỳ giữa khoá
 * không có khối chứng nhận…) — nơi hiển thị phải ẩn khối chứ không in số 0.
 *
 * ⛔ KHÔNG có và KHÔNG ĐƯỢC thêm: email, ngày sinh, transcript, audio, `ai_*`. Backend chặn bằng
 * `ReportPayloadBuilder.assertNoForbiddenKeys`; phía web thì kiểu này là lời nhắc thành văn.
 */
export interface ReportPayload {
  schemaVersion: number
  period: ReportPeriod
  lang: ReportLang
  issuedAt: string
  org: { name: string; logoUrl: string | null } | null
  class: { name: string | null; level: string | null; primaryTeacherName: string | null }
  student: { name: string; joinedAt: string | null }
  skills: ReportSkillRow[]
  overall: { score: number | null; grade: ReportGrade | null }
  attendance: { present: number; absent: number; late: number; recorded: number; ratePct: number | null }
  /**
   * `confirmed`/`awaitingTeacher` khai nullable vì lý do giống `certificate`: ô xem trước của giáo viên
   * không có hai số đếm này, và in "0 bài đã chốt" cho thứ chưa đo được là nói sai.
   */
  assignments: { avgScore: number | null; confirmed: number | null; awaitingTeacher: number | null }
  objectives: {
    total: number
    achieved: number
    needsPractice: number
    notAssessed: number
    needsPracticeItems: string[]
  } | null
  selfStudy: {
    speakingSessions: number
    speakingMinutes: number
    vocabMastered: number
    lessonsCompleted: number
  } | null
  teacherComment: string | null
  evaluatedAt: string | null
  /**
   * Chỉ có ở kỳ FINAL (R10). Hai ngưỡng khai `number | null` dù backend luôn gửi số: ô XEM TRƯỚC của
   * giáo viên dựng payload tại chỗ mà KHÔNG đọc được `org_settings` (endpoint đó OWNER-only), nên ở
   * đó hai ngưỡng vắng — nơi hiển thị phải chịu được điều đó thay vì in "null".
   */
  certificate: { eligible: boolean; minAvgScore: number | null; minAttendancePct: number | null } | null
}

export interface ReportIssueSummary {
  id: number
  classId: number
  className: string | null
  studentId: number
  studentName: string | null
  period: ReportPeriod
  lang: ReportLang
  status: ReportIssueStatus
  issuedAt: string
  issuedByName: string | null
  tokenExpiresAt: string | null
  revokedAt: string | null
  /** Mã: SUPERSEDED | OWNER | MANAGER | TEACHER — lý do văn tự chỉ nằm ở sổ hoạt động. */
  revokeReason: string | null
  viewCount: number
  lastViewedAt: string | null
  /** Chỉ có khi status = ACTIVE (link đã chết thì backend không phát lại token cho ai). */
  token: string | null
  /** `/phieu/{token}?lang=…` — web tự ghép domain của chính nó. */
  publicPath: string | null
  verificationCode: string | null
}

export interface ReportIssueDetail {
  issue: ReportIssueSummary
  payload: ReportPayload
}

/** Trang công khai — chỉ những gì in trên phiếu, không id nội bộ, không lượt xem. */
export interface PublicReportIssue {
  period: ReportPeriod
  lang: ReportLang
  issuedAt: string
  tokenExpiresAt: string | null
  orgName: string | null
  orgLogoUrl: string | null
  studentName: string
  issuedByName: string | null
  verificationCode: string | null
  payload: ReportPayload
}

export interface OrgReportIssuePage {
  items: ReportIssueSummary[]
  total: number
  page: number
  size: number
}

/** Lý do thu hồi — cùng ngưỡng với `ReportIssueService.REASON_MIN/MAX_LENGTH` (máy chủ kiểm lại). */
export const REVOKE_REASON_MIN = 5
export const REVOKE_REASON_MAX = 300

/** POST — phát hành (201). 409 khi cổng đồng ý đóng; thông điệp đọc thẳng ra màn qua `apiMessage`. */
export async function issueReport(
  classId: number,
  studentId: number,
  period: ReportPeriod,
  lang: ReportLang,
): Promise<ReportIssueDetail> {
  const res = await api.post<ReportIssueDetail>(
    `/teacher/classes/${classId}/students/${studentId}/report-issues`,
    { period, lang },
  )
  return res.data
}

/** GET — lịch sử phiếu của một học viên trong lớp (mọi kỳ, kể cả đã thu hồi), mới nhất trước. */
export async function listReportIssues(classId: number, studentId: number): Promise<ReportIssueSummary[]> {
  const res = await api.get<ReportIssueSummary[]>(
    `/teacher/classes/${classId}/students/${studentId}/report-issues`,
  )
  return res.data ?? []
}

/** GET — sổ phiếu toàn trung tâm (OWNER/MANAGER), lọc tuỳ chọn theo lớp / học viên. */
export async function listOrgReportIssues(
  opts: { classId?: number; studentId?: number; page?: number; size?: number } = {},
): Promise<OrgReportIssuePage> {
  const res = await api.get<OrgReportIssuePage>('/org/report-issues', {
    params: {
      page: opts.page ?? 0,
      size: opts.size ?? 20,
      ...(typeof opts.classId === 'number' ? { classId: opts.classId } : {}),
      ...(typeof opts.studentId === 'number' ? { studentId: opts.studentId } : {}),
    },
  })
  const data = res.data
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 0,
    size: data?.size ?? (opts.size ?? 20),
  }
}

/** POST — thu hồi kèm lý do (5–300 ký tự). Đã thu hồi rồi ⇒ 200 với dòng hiện tại (idempotent). */
export async function revokeOrgReportIssue(issueId: number, reason: string): Promise<ReportIssueSummary> {
  const res = await api.post<ReportIssueSummary>(`/org/report-issues/${issueId}/revoke`, { reason })
  return res.data
}

/**
 * Tải PDF (giáo viên / trung tâm tự gửi — R1). Trả blob để nơi gọi tự quyết định lưu hay in;
 * backend đặt `Cache-Control: no-store` nên không có bản sao nào nằm lại ở proxy.
 */
export async function downloadReportPdf(issueId: number): Promise<Blob> {
  const res = await api.get<Blob>(`/teacher/report-issues/${issueId}/pdf`, { responseType: 'blob' })
  return res.data
}

/**
 * URL đầy đủ của trang công khai từ `publicPath` backend trả về. `origin` tách ra làm tham số để
 * test và SSR không đụng `window`.
 */
export function reportPublicUrl(publicPath: string, origin?: string): string {
  const base = (origin ?? (typeof window === 'undefined' ? '' : window.location.origin)).replace(/\/+$/, '')
  return `${base}${publicPath}`
}
