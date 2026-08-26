import type { RoadmapNode } from '@/lib/roadmap-tree/types'

/**
 * Chọn "việc học tiếp theo" từ lộ trình thật (`GET /roadmap/me`) — nền của khối
 * ContinueLearning trên màn Heute (S-02) và của Journey preview (S-03).
 *
 * Quy tắc chọn phải KHAI RÕ và có fallback (plan S-02 §Risk): dở dang > đến hạn kế tiếp >
 * node mở gần nhất. Không đoán bừa: hết node khả dụng thì trả `undefined` để UI hiển thị
 * trạng thái "đã xong" thay vì trỏ vào một bài ngẫu nhiên.
 *
 * `progressStatus` (COMPLETED · IN_PROGRESS · AVAILABLE · LOCKED) là bản chi tiết của `state`
 * (completed · current · locked); một số node cũ chỉ có `state` nên phải đọc cả hai.
 */

export type NodeStatus = 'completed' | 'inProgress' | 'available' | 'locked'

/** Chuẩn hoá hai trường trạng thái của backend về một thang duy nhất. */
export function nodeStatus(node: RoadmapNode): NodeStatus {
  const detailed = (node.progressStatus ?? '').toUpperCase()
  if (detailed === 'COMPLETED') return 'completed'
  if (detailed === 'IN_PROGRESS') return 'inProgress'
  if (detailed === 'AVAILABLE') return 'available'
  if (detailed === 'LOCKED') return 'locked'

  const state = (node.state ?? '').toLowerCase()
  if (state === 'completed') return 'completed'
  if (state === 'locked') return 'locked'
  // `current` của thang cũ = đang mở; có tiến độ dở thì coi là đang học.
  return node.lessonsCompleted > 0 ? 'inProgress' : 'available'
}

/** % hoàn thành của một node theo số bài đã học. Trả 0 khi node chưa có bài nào. */
export function nodeProgressPercent(node: RoadmapNode): number {
  if (!node.lessonsTotal || node.lessonsTotal <= 0) return 0
  const pct = (node.lessonsCompleted / node.lessonsTotal) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

/** Thứ tự trong giáo trình: tuần → ngày → id (id là fallback ổn định). */
function courseOrder(a: RoadmapNode, b: RoadmapNode): number {
  const aw = a.weekNumber ?? Number.MAX_SAFE_INTEGER
  const bw = b.weekNumber ?? Number.MAX_SAFE_INTEGER
  if (aw !== bw) return aw - bw
  const ad = a.dayNumber ?? Number.MAX_SAFE_INTEGER
  const bd = b.dayNumber ?? Number.MAX_SAFE_INTEGER
  if (ad !== bd) return ad - bd
  return a.id - b.id
}

/**
 * Node để "học tiếp". `undefined` nghĩa là không còn gì để học tiếp (mọi node đã xong
 * hoặc còn khoá) — UI phải nói đúng điều đó, không được trỏ bừa.
 */
export function pickContinueNode(nodes: RoadmapNode[]): RoadmapNode | undefined {
  const sorted = [...nodes].sort(courseOrder)
  return (
    sorted.find((n) => nodeStatus(n) === 'inProgress') ??
    sorted.find((n) => nodeStatus(n) === 'available')
  )
}

/**
 * Lát cắt lộ trình quanh node hiện tại để xem nhanh: node hiện tại + `after` node kế tiếp.
 * Dùng cho Journey preview trên Heute và compact overview trên mobile (P4-D4).
 */
export function journeySlice(nodes: RoadmapNode[], after = 2): RoadmapNode[] {
  const sorted = [...nodes].sort(courseOrder)
  const current = pickContinueNode(sorted)
  if (!current) return sorted.slice(-1 - after).slice(0, after + 1)
  const idx = sorted.findIndex((n) => n.id === current.id)
  return sorted.slice(idx, idx + after + 1)
}

/** Tổng tiến độ lộ trình: số node đã hoàn thành / tổng số node. Nguồn thật, không tổng hợp. */
export function courseCompletion(nodes: RoadmapNode[]): { done: number; total: number; percent: number } {
  const total = nodes.length
  const done = nodes.filter((n) => nodeStatus(n) === 'completed').length
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
}
