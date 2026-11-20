// Hàm thuần cho nhóm màn Lớp học · Tin nhắn · Thông báo theo giao diện v3.4 (Đợt 6B, 19/11/2026).
// Chỉ định dạng và gom nhóm dữ liệu đã tải — không gọi API, không import `@/components/ui`
// (jest chạy môi trường node).

import type { GlyphName } from '@/lib/galerieGlyphs'

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  ESSAY: 'Viết luận',
  MOCK_TEST: 'Thi thử',
  SPEAKING_SCENARIO: 'Luyện Nói AI',
}

/** Nhãn loại bài giao (giữ nguyên câu chữ cũ của màn chi tiết bài). Loại lạ → "Bài tập chung". */
export function assignmentTypeLabel(type: string | null | undefined): string {
  return (type && ASSIGNMENT_TYPE_LABELS[type]) || 'Bài tập chung'
}

const ASSIGNMENT_TYPE_GLYPHS: Record<string, GlyphName> = {
  ESSAY: 'viet',
  MOCK_TEST: 'thithu',
  SPEAKING_SCENARIO: 'noi',
}

/** Glyph Galerie cho từng loại bài giao (mẫu v3.4: Viết · Nói · Thi thử). Loại lạ → `baigiao`. */
export function assignmentTypeGlyph(type: string | null | undefined): GlyphName {
  return (type && ASSIGNMENT_TYPE_GLYPHS[type]) || 'baigiao'
}

/** 7.8 → "7,8"; 8 → "8,0" (điểm trung bình lớp, một chữ số thập phân, dấu phẩy kiểu Việt). */
export function formatAvgVi(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–'
  return value.toFixed(1).replace('.', ',')
}

/** 7 trên 12 → "58%"; tổng 0 → "–". */
export function percentLabel(done: number, total: number): string {
  if (!(total > 0)) return '–'
  const pct = Math.round((Math.max(0, Math.min(done, total)) / total) * 100)
  return `${pct}%`
}

/** Chữ cái đầu của tên, viết hoa, để vẽ ô tròn đại diện. Tên rỗng → "?". */
export function nameInitial(name: string | null | undefined): string {
  const ch = (name ?? '').trim().charAt(0)
  return ch ? ch.toLocaleUpperCase('vi-VN') : '?'
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** ISO → "20/11" theo giờ máy; sai định dạng → null. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
}

/** ISO → "08:31" theo giờ máy; sai định dạng → "". */
export function clockLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

/** Ô ngày của lịch buổi học: số ngày + thứ viết tắt ("19" · "T5"). Sai định dạng → null. */
export function sessionDayBox(iso: string): { day: string; weekday: string; month: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { day: String(d.getDate()), weekday: WEEKDAY_SHORT[d.getDay()], month: `Th${d.getMonth() + 1}` }
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const DAY_MS = 86_400_000

/**
 * Nhãn ngày cho vạch ngăn trong khung chat: "Hôm nay", "Hôm qua", "17/11" (cùng năm)
 * hoặc "17/11/2025" (năm khác). Theo giờ máy. Sai định dạng → null.
 */
export function chatDayLabel(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS)
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Hôm qua'
  const base = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
  return d.getFullYear() === now.getFullYear() ? base : `${base}/${d.getFullYear()}`
}

/**
 * Danh sách chat hiển thị đảo ngược (phần tử 0 = tin MỚI nhất, nằm dưới cùng). Vạch ngày nằm phía
 * TRÊN tin cũ nhất của mỗi ngày, tức là trên phần tử `index` khi phần tử kế tiếp (cũ hơn) thuộc
 * ngày khác, hoặc `index` là tin cũ nhất. Trả nhãn cần vẽ, hoặc null nếu không cần vạch.
 */
export function daySeparatorAbove(
  newestFirst: readonly { createdAt: string }[],
  index: number,
  now: Date,
): string | null {
  const cur = newestFirst[index]
  if (!cur) return null
  const label = chatDayLabel(cur.createdAt, now)
  if (!label) return null
  const older = newestFirst[index + 1]
  if (!older) return label
  return chatDayLabel(older.createdAt, now) === label ? null : label
}

export type DayBucket = 'Hôm nay' | 'Hôm qua' | 'Trước đó'

/** Nhóm thông báo theo ngày tạo, so với `now` theo giờ máy. */
export function dayBucket(iso: string, now: Date): DayBucket {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Trước đó'
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS)
  if (diff <= 0) return 'Hôm nay'
  if (diff === 1) return 'Hôm qua'
  return 'Trước đó'
}

export type GroupedEntry<T> =
  | { kind: 'header'; key: string; label: DayBucket }
  | { kind: 'item'; key: string; item: T; first: boolean; last: boolean }

/**
 * Chèn tiêu đề nhóm ngày vào danh sách (đã sắp mới → cũ) và đánh dấu phần tử đầu/cuối của mỗi
 * nhóm, để màn vẽ mỗi nhóm thành một khối danh sách liền (bo góc trên ở phần tử đầu, góc dưới ở
 * phần tử cuối, vạch ngăn giữa các dòng).
 */
export function groupByDay<T extends { createdAt: string }>(
  items: readonly T[],
  keyOf: (item: T) => string,
  now: Date,
): GroupedEntry<T>[] {
  const out: GroupedEntry<T>[] = []
  let last: DayBucket | null = null
  items.forEach((item, i) => {
    const bucket = dayBucket(item.createdAt, now)
    const isFirst = bucket !== last
    if (isFirst) {
      out.push({ kind: 'header', key: `h-${bucket}-${i}`, label: bucket })
      last = bucket
    }
    const next = items[i + 1]
    const isLast = !next || dayBucket(next.createdAt, now) !== bucket
    out.push({ kind: 'item', key: keyOf(item), item, first: isFirst, last: isLast })
  })
  return out
}
