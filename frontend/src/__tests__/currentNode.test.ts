/**
 * Wave 1 / S-02 + S-03 — quy tắc chọn "học tiếp" và các phép tính tiến độ lộ trình.
 *
 * Đây là logic quyết định CTA mạnh nhất của màn Heute, nên quy tắc phải khai rõ và có fallback
 * (plan S-02 §Risk: "Continue chọn sai hoạt động"). Mọi con số đều suy từ dữ liệu thật của
 * `GET /roadmap/me`, không tổng hợp chỉ số mới (P4-D2).
 */
import { describe, it, expect } from 'vitest'
import {
  nodeStatus,
  nodeProgressPercent,
  pickContinueNode,
  journeySlice,
  courseCompletion,
} from '@/lib/learning/currentNode'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'

function node(p: Partial<RoadmapNode> & { id: number }): RoadmapNode {
  return {
    code: `n${p.id}`,
    title: `Titel ${p.id}`,
    subtitle: `Chặng ${p.id}`,
    emoji: '📘',
    state: 'current',
    xpReward: 10,
    lessonsTotal: 4,
    lessonsCompleted: 0,
    cefrLevel: 'A1',
    description: '',
    ...p,
  } as RoadmapNode
}

describe('nodeStatus — hợp nhất hai trường trạng thái của backend', () => {
  it('ưu tiên progressStatus chi tiết', () => {
    expect(nodeStatus(node({ id: 1, progressStatus: 'IN_PROGRESS', state: 'locked' }))).toBe('inProgress')
    expect(nodeStatus(node({ id: 2, progressStatus: 'COMPLETED' }))).toBe('completed')
    expect(nodeStatus(node({ id: 3, progressStatus: 'AVAILABLE' }))).toBe('available')
    expect(nodeStatus(node({ id: 4, progressStatus: 'LOCKED' }))).toBe('locked')
  })

  it('node cũ chỉ có `state`: có tiến độ dở thì là đang học', () => {
    expect(nodeStatus(node({ id: 5, state: 'current', lessonsCompleted: 2 }))).toBe('inProgress')
    expect(nodeStatus(node({ id: 6, state: 'current', lessonsCompleted: 0 }))).toBe('available')
    expect(nodeStatus(node({ id: 7, state: 'completed' }))).toBe('completed')
    expect(nodeStatus(node({ id: 8, state: 'locked' }))).toBe('locked')
  })
})

describe('nodeProgressPercent', () => {
  it('tính đúng và làm tròn', () => {
    expect(nodeProgressPercent(node({ id: 1, lessonsCompleted: 3, lessonsTotal: 4 }))).toBe(75)
    expect(nodeProgressPercent(node({ id: 2, lessonsCompleted: 1, lessonsTotal: 3 }))).toBe(33)
  })

  it('node chưa có bài nào → 0, không chia cho 0', () => {
    expect(nodeProgressPercent(node({ id: 3, lessonsTotal: 0, lessonsCompleted: 0 }))).toBe(0)
  })

  it('kẹp trong 0..100 kể cả dữ liệu bẩn', () => {
    expect(nodeProgressPercent(node({ id: 4, lessonsCompleted: 9, lessonsTotal: 4 }))).toBe(100)
    expect(nodeProgressPercent(node({ id: 5, lessonsCompleted: -2, lessonsTotal: 4 }))).toBe(0)
  })
})

describe('pickContinueNode — quy tắc khai rõ: dở dang > sẵn sàng > không có', () => {
  it('ưu tiên node ĐANG HỌC dở, kể cả khi có node sẵn sàng đứng trước', () => {
    const nodes = [
      node({ id: 1, progressStatus: 'COMPLETED', weekNumber: 1, dayNumber: 1 }),
      node({ id: 2, progressStatus: 'AVAILABLE', weekNumber: 1, dayNumber: 2 }),
      node({ id: 3, progressStatus: 'IN_PROGRESS', weekNumber: 1, dayNumber: 3 }),
    ]
    expect(pickContinueNode(nodes)?.id).toBe(3)
  })

  it('không có node dở dang → node sẵn sàng ĐẦU TIÊN theo thứ tự giáo trình', () => {
    const nodes = [
      node({ id: 9, progressStatus: 'AVAILABLE', weekNumber: 2, dayNumber: 1 }),
      node({ id: 4, progressStatus: 'AVAILABLE', weekNumber: 1, dayNumber: 2 }),
      node({ id: 1, progressStatus: 'COMPLETED', weekNumber: 1, dayNumber: 1 }),
    ]
    expect(pickContinueNode(nodes)?.id).toBe(4)
  })

  it('mọi node đã xong hoặc còn khoá → undefined (UI phải nói đúng, không trỏ bừa)', () => {
    const nodes = [
      node({ id: 1, progressStatus: 'COMPLETED' }),
      node({ id: 2, progressStatus: 'LOCKED' }),
    ]
    expect(pickContinueNode(nodes)).toBeUndefined()
    expect(pickContinueNode([])).toBeUndefined()
  })

  it('không có tuần/ngày thì id là thứ tự dự phòng ổn định', () => {
    const nodes = [node({ id: 7, progressStatus: 'AVAILABLE' }), node({ id: 3, progressStatus: 'AVAILABLE' })]
    expect(pickContinueNode(nodes)?.id).toBe(3)
  })
})

describe('journeySlice — lát cắt quanh node hiện tại', () => {
  const nodes = [1, 2, 3, 4, 5].map((i) =>
    node({ id: i, weekNumber: 1, dayNumber: i, progressStatus: i < 3 ? 'COMPLETED' : i === 3 ? 'IN_PROGRESS' : 'LOCKED' }),
  )

  it('bắt đầu từ node đang học và lấy thêm 2 node kế', () => {
    expect(journeySlice(nodes).map((n) => n.id)).toEqual([3, 4, 5])
  })

  it('hết node khả dụng → vẫn trả lát cuối để không rỗng', () => {
    const done = [1, 2].map((i) => node({ id: i, weekNumber: 1, dayNumber: i, progressStatus: 'COMPLETED' }))
    expect(journeySlice(done).length).toBeGreaterThan(0)
  })
})

describe('courseCompletion — tiến độ lộ trình từ nguồn thật', () => {
  it('đếm node đã hoàn thành, không tổng hợp XP/điểm', () => {
    const nodes = [
      node({ id: 1, progressStatus: 'COMPLETED' }),
      node({ id: 2, progressStatus: 'COMPLETED' }),
      node({ id: 3, progressStatus: 'IN_PROGRESS' }),
      node({ id: 4, progressStatus: 'LOCKED' }),
    ]
    expect(courseCompletion(nodes)).toEqual({ done: 2, total: 4, percent: 50 })
  })

  it('lộ trình rỗng → 0%, không chia cho 0', () => {
    expect(courseCompletion([])).toEqual({ done: 0, total: 0, percent: 0 })
  })
})
