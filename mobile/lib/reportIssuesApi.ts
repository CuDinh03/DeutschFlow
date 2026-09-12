// Phiếu đánh giá đã gửi gia đình, phía học viên (R6/PR-R4).
//
// Nguồn duy nhất: `GET /api/student/report-issues` — backend trả ĐÚNG bản đã gửi, đọc từ
// `payload_json` đã đóng băng lúc phát hành. Vì vậy màn này KHÔNG tự tính lại điểm hay chuyên cần
// từ các API khác: nếu giáo viên sửa điểm sau khi phát hành, bản phiếu gia đình đang cầm vẫn là bản
// cũ, và học viên phải thấy đúng bản đó — tính lại là nói khác với tờ giấy trong tay phụ huynh.
//
// Nhãn tiếng Việt giữ khớp `frontend/messages/v2/report.vi.json` (bản web/PDF) để ba mặt cùng gọi
// một thứ bằng một tên. Mobile không có i18n (chỉ tiếng Việt) — xem lib/tabLabels.ts.
import api from '@/lib/api'

export type ReportIssuePeriod = 'MIDTERM' | 'FINAL'
export type ReportIssueStatus = 'ACTIVE' | 'EXPIRED' | 'SUPERSEDED' | 'REVOKED'

export interface ReportIssueSummary {
  id: number
  classId: number | null
  className: string | null
  period: ReportIssuePeriod | string
  lang: string
  status: ReportIssueStatus | string
  issuedAt: string
  issuedByName: string | null
  tokenExpiresAt: string | null
  revokedAt: string | null
  revokeReason: string | null
  viewCount: number
  lastViewedAt: string | null
  verificationCode: string | null
}

/** Ảnh chụp nội dung phiếu. Khoá khớp `ReportPayloadBuilder`; mọi nhánh đều có thể thiếu/null. */
export interface ReportPayload {
  schemaVersion?: number
  period?: string
  issuedAt?: string
  class?: { name?: string | null; level?: string | null; primaryTeacherName?: string | null } | null
  student?: { name?: string | null; joinedAt?: string | null } | null
  org?: { name?: string | null; logoUrl?: string | null } | null
  skills?: { code: string; score: number | null; grade: string | null }[] | null
  overall?: { score: number | null; grade: string | null } | null
  attendance?: {
    present?: number
    absent?: number
    late?: number
    recorded?: number
    ratePct?: number | null
  } | null
  assignments?: { avgScore?: number | null; confirmed?: number; awaitingTeacher?: number } | null
  objectives?: {
    total?: number
    achieved?: number
    needsPractice?: number
    notAssessed?: number
    needsPracticeItems?: string[] | null
  } | null
  selfStudy?: {
    speakingSessions?: number
    speakingMinutes?: number
    vocabMastered?: number
    lessonsCompleted?: number
  } | null
  teacherComment?: string | null
  evaluatedAt?: string | null
  certificate?: { eligible?: boolean; minAvgScore?: number; minAttendancePct?: number } | null
}

export interface ReportIssueEntry {
  issue: ReportIssueSummary
  payload: ReportPayload
}

export function fetchMyReportIssues(): Promise<ReportIssueEntry[]> {
  return api.get<ReportIssueEntry[]>('/student/report-issues').then((r) => r.data ?? [])
}

// ── nhãn (hàm thuần, test ở __tests__/reportIssuesApi.test.ts) ───────────────

export function periodLabel(period: string | null | undefined): string {
  switch (period) {
    case 'MIDTERM':
      return 'Kỳ giữa khoá'
    case 'FINAL':
      return 'Kỳ cuối khoá'
    default:
      return 'Phiếu đánh giá'
  }
}

export function skillLabel(code: string): string {
  switch (code) {
    case 'HOREN':
      return 'Nghe'
    case 'LESEN':
      return 'Đọc'
    case 'SCHREIBEN':
      return 'Viết'
    case 'SPRECHEN':
      return 'Nói'
    default:
      return code
  }
}

export function gradeLabel(grade: string | null | undefined): string | null {
  switch (grade) {
    case 'EXCELLENT':
      return 'Xuất sắc'
    case 'GOOD':
      return 'Giỏi'
    case 'FAIR':
      return 'Khá'
    case 'AVERAGE':
      return 'Trung bình'
    case 'WEAK':
      return 'Yếu'
    default:
      return null
  }
}

export type ReportStatusTone = 'ok' | 'muted' | 'warn'

/**
 * Trạng thái nói bằng lời của người dùng, kèm tông màu.
 *
 * ⚠️ Bốn trạng thái này trả lời một câu duy nhất: "link mà gia đình đang cầm còn mở được không".
 * SUPERSEDED nghĩa là ĐÃ CÓ BẢN MỚI hơn — nếu chỉ nói "không còn hiệu lực" thì học viên tưởng
 * mình mất phiếu, trong khi thực tế giáo viên vừa phát hành lại.
 */
export function statusText(status: string | null | undefined): { label: string; tone: ReportStatusTone } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Gia đình xem được', tone: 'ok' }
    case 'SUPERSEDED':
      return { label: 'Đã có bản mới hơn', tone: 'muted' }
    case 'EXPIRED':
      return { label: 'Link đã hết hạn', tone: 'muted' }
    case 'REVOKED':
      return { label: 'Đã thu hồi', tone: 'warn' }
    default:
      return { label: 'Không rõ trạng thái', tone: 'muted' }
  }
}

/** `null` khi chưa có buổi nào được ghi nhận — KHÔNG hiển thị 0 % (chưa điểm danh ≠ vắng mặt). */
export function attendanceRateText(attendance: ReportPayload['attendance']): string | null {
  const pct = attendance?.ratePct
  return pct === null || pct === undefined ? null : `${pct}%`
}

/** Điểm 0–10 một chữ số thập phân; `null`/thiếu ⇒ gạch ngang, không phải 0. */
export function scoreText(score: number | null | undefined): string {
  return score === null || score === undefined ? '—' : String(score)
}
