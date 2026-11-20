// Mô hình thuần của màn Hôm nay (giao diện v3.4, Đợt 2b, 19/11/2026; mẫu `plans/ios-v3.4-mau` màn
// `today`): dòng ngày trên lời chào, ô "Thi thử trọn đề" lấy buổi thi thử kế tiếp trong lịch ôn tuần
// này, thẻ phỏng vấn theo nghề biết buổi đang dở (tham chiếu resume cục bộ), hàng "Tiếp tục học" lấy
// chặng đang học trên lộ trình. Không bịa số: thiếu dữ liệu thì trả null để màn tự ẩn phần đó.

import type { ExamPlanDay } from './examPlanApi'
import type { ActiveSessionRef } from './activeSession'
import type { RoadmapNode } from './lernwegApi'

const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Dòng ngày nhỏ trên lời chào: "Thứ Tư, 18 tháng 11". */
export function todayDateLine(d: Date): string {
  return `${WEEKDAY[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`
}

/** Tên gọi trong lời chào: chữ cuối của họ tên Việt ("Nguyễn Thị Lan" → "Lan"); trống → "bạn". */
export function greetingName(displayName: string | null | undefined): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.at(-1) ?? 'bạn'
}

/** `2026-11-21` → "T7, 21/11". */
export function shortDayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${WEEKDAY_SHORT[d.getDay()]}, ${dd}/${mm}`
}

/** Buổi thi thử trọn đề kế tiếp (hôm nay trở đi, chưa làm) trong các buổi của tuần hiện tại. */
export function nextMockDay(days: readonly ExamPlanDay[] | null | undefined, today: string): ExamPlanDay | null {
  return (
    (days ?? []).find(
      (d) => d.kind === 'FULL_EXAM' && d.date >= today && (d.status === 'TODAY' || d.status === 'UPCOMING'),
    ) ?? null
  )
}

/** Buổi phỏng vấn còn dở từ lần mở app trước (tham chiếu resume); phiên chế độ khác ⇒ null. */
export function pendingInterview(ref: ActiveSessionRef | null | undefined): { position: string | null; persona: string | null } | null {
  if (!ref || ref.sessionMode !== 'INTERVIEW') return null
  return { position: ref.interviewPosition?.trim() || ref.topic?.trim() || null, persona: ref.persona ?? null }
}

/** Chặng nên học tiếp: chặng đang học dở, không có thì chặng đang mở đầu tiên. */
export function continueNode(nodes: readonly RoadmapNode[]): RoadmapNode | null {
  return (
    nodes.find((n) => n.progressStatus === 'IN_PROGRESS') ??
    nodes.find((n) => n.state === 'current' || n.progressStatus === 'AVAILABLE') ??
    null
  )
}

const CEFR_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Khoảng trình độ của lộ trình theo các chặng có trong danh sách: "A1 → B2"; một mức ⇒ "B1"; không rõ ⇒ null. */
export function roadmapRange(nodes: readonly Pick<RoadmapNode, 'cefrLevel'>[]): string | null {
  const ranks = nodes
    .map((n) => CEFR_ORDER.indexOf((n.cefrLevel ?? '').trim().toUpperCase()))
    .filter((i) => i >= 0)
  if (ranks.length === 0) return null
  const lo = CEFR_ORDER[Math.min(...ranks)]
  const hi = CEFR_ORDER[Math.max(...ranks)]
  return lo === hi ? lo : `${lo} → ${hi}`
}
