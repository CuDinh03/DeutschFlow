import type { ReportGrade, ReportPayload, ReportPeriod, ReportSkillCode } from '@/lib/reportIssueApi'
import type { ReportLang } from '@/lib/reportSheetDict'
import type { StudentEvaluation } from '@/lib/teacherEvaluationApi'

/**
 * Dựng bản XEM TRƯỚC của phiếu từ dòng đánh giá giáo viên đang nhìn (thiết kế §3.2 bước 2).
 *
 * <b>Vì sao dựng ở client.</b> PR-R2 (PR 639) không có endpoint xem trước: 7 đường hiện có đều hoặc
 * PHÁT HÀNH thật (đóng băng + sinh token + báo học viên), hoặc đọc phiếu đã phát hành. Gọi phát hành
 * để xem trước rồi thu hồi là đổi một lượt "xem" lấy một dòng rác vĩnh viễn trong sổ trung tâm và một
 * thông báo sai cho học viên — không làm. Nên ô xem trước dựng tại chỗ từ ĐÚNG những số liệu mà
 * `ReportPayloadBuilder` sẽ đọc (cả hai đều lấy từ `StudentEvaluationService`).
 *
 * <b>Khác biệt đã biết, và đã nói ra trên giao diện</b> (`report.previewNotice`):
 * <ul>
 *   <li>thiếu mục tiêu giáo trình và phần tự học ngoài lớp — hai khối này chỉ có ở đường máy chủ;</li>
 *   <li>thiếu trình độ lớp và tên giáo viên phụ trách;</li>
 *   <li>hai ngưỡng chứng nhận vắng (endpoint `org_settings` là OWNER-only, giáo viên không đọc được);</li>
 *   <li>số liệu là của thời điểm MỞ màn, không phải thời điểm bấm phát hành.</li>
 * </ul>
 * Nợ: một endpoint `preview` phía máy chủ sẽ xoá trọn danh sách này.
 *
 * <b>Ngưỡng xếp loại chép từ `SkillReportDto.gradeCodeOf`</b> (9 / 8 / 6,5 / 5). Đây là chỗ trùng lặp
 * duy nhất với backend và nó có ý thức: bản phát hành luôn lấy mã xếp loại từ máy chủ, bản sao ở đây
 * chỉ phục vụ ô xem trước. Đổi ngưỡng ở backend thì sửa cả hai nơi.
 */
export function gradeCodeOf(score: number | null): ReportGrade | null {
  if (score == null) return null
  if (score >= 9) return 'EXCELLENT'
  if (score >= 8) return 'GOOD'
  if (score >= 6.5) return 'FAIR'
  if (score >= 5) return 'AVERAGE'
  return 'WEAK'
}

const SKILL_FIELDS: ReadonlyArray<[ReportSkillCode, keyof StudentEvaluation]> = [
  ['HOREN', 'skillHoren'],
  ['LESEN', 'skillLesen'],
  ['SCHREIBEN', 'skillSchreiben'],
  ['SPRECHEN', 'skillSprechen'],
]

function round1(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10
}

export function buildPreviewPayload(
  evaluation: StudentEvaluation,
  period: ReportPeriod,
  lang: ReportLang,
  issuedAt: string,
  orgName: string | null = null,
): ReportPayload {
  const skills = SKILL_FIELDS.map(([code, field]) => {
    const raw = evaluation[field]
    const score = typeof raw === 'number' ? raw : null
    return { code, score: round1(score), grade: gradeCodeOf(score) }
  })

  // Điểm tổng = trung bình các kỹ năng ĐÃ CÓ điểm; chưa có kỹ năng nào thì để trống chứ không ra 0.
  const scored = skills.map((s) => s.score).filter((s): s is number => s != null)
  const overallScore = scored.length ? round1(scored.reduce((a, b) => a + b, 0) / scored.length) : null

  const recorded = evaluation.recordedSessions
  const ratePct = recorded > 0
    ? Math.round((100 * (evaluation.presentCount + evaluation.lateCount)) / recorded)
    : null

  return {
    schemaVersion: 1,
    period,
    lang,
    issuedAt,
    org: orgName ? { name: orgName, logoUrl: null } : null,
    class: { name: evaluation.className, level: null, primaryTeacherName: null },
    student: { name: evaluation.name, joinedAt: null },
    skills,
    overall: { score: overallScore, grade: gradeCodeOf(overallScore) },
    attendance: {
      present: evaluation.presentCount,
      absent: evaluation.absentCount,
      late: evaluation.lateCount,
      recorded,
      ratePct,
    },
    // Số bài đã chốt / đang chờ chấm chỉ có ở đường máy chủ ⇒ null, và tờ phiếu ẩn hẳn hai dòng đó
    // thay vì in "0" (in 0 là nói với gia đình rằng em ấy chưa nộp bài nào).
    assignments: { avgScore: round1(evaluation.avgScore), confirmed: null, awaitingTeacher: null },
    objectives: null,
    selfStudy: null,
    teacherComment:
      evaluation.teacherComment && evaluation.teacherComment.trim() !== ''
        ? evaluation.teacherComment
        : null,
    evaluatedAt: evaluation.evaluatedAt,
    certificate:
      period === 'FINAL'
        ? { eligible: evaluation.certificateEligible, minAvgScore: null, minAttendancePct: null }
        : null,
  }
}
