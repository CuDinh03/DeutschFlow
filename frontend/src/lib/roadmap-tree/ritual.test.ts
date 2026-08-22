import { describe, expect, it } from 'vitest'
import { buildTreeLayout } from './treeLayout'
import { parseFeiernParam, planRitual, RITUAL_TIMELINE } from './ritual'

/** 10 ngày × 2 tuần; ngày 1–4 xong, ngày 5 đang học (tuần 1 còn dở), ngày 6 đã mở. */
function nodes(overrides: Partial<Record<number, string>> = {}) {
  return Array.from({ length: 10 }, (_, i) => {
    const day = i + 1
    const progressStatus =
      overrides[day] ??
      (day <= 4 ? 'COMPLETED' : day === 5 ? 'IN_PROGRESS' : day === 6 ? 'AVAILABLE' : 'LOCKED')
    return {
      id: 100 + day,
      code: `D${day}`,
      state: progressStatus === 'COMPLETED' ? 'completed' : progressStatus === 'LOCKED' ? 'locked' : 'current',
      progressStatus,
      dayNumber: day,
      weekNumber: Math.ceil(day / 5),
    }
  })
}

const mastered = { bestScorePercent: 85, latestStatus: 'COMPLETED' }
const missed = { bestScorePercent: 40, latestStatus: 'COMPLETED' }

describe('parseFeiernParam', () => {
  it('chỉ nhận 4 kỹ năng, chữ thường', () => {
    expect(parseFeiernParam('hoeren')).toBe('hoeren')
    expect(parseFeiernParam('LESEN')).toBe('lesen')
    expect(parseFeiernParam('confetti')).toBeNull()
    expect(parseFeiernParam(null)).toBeNull()
  })
})

describe('planRitual', () => {
  it('bậc 0: node hoa, kỹ năng chưa đạt → cánh chỉ nhún', () => {
    const layout = buildTreeLayout(nodes())
    const plan = planRitual(layout, 105, 'lesen', { lesen: missed })
    expect(plan).toEqual({ nodeId: 105, skill: 'lesen', tier: 0, nextNodeId: null, week: null })
  })

  it('bậc 1: node hoa, kỹ năng vừa đạt ≥70 → cánh nhận màu', () => {
    const layout = buildTreeLayout(nodes())
    const plan = planRitual(layout, 105, 'hoeren', { hoeren: mastered })
    expect(plan?.tier).toBe(1)
    expect(plan?.nextNodeId).toBeNull()
  })

  it('bậc 2: node đã hoá lá (backend đóng node) → hoa hoá lá + nụ kế nở', () => {
    // Ngày 5 vừa xong nhưng tuần 1 (ngày 1–5) đủ ⇒ thật ra là bậc 3; dùng ngày 7 giữa tuần 2.
    const layout = buildTreeLayout(nodes({ 5: 'COMPLETED', 6: 'COMPLETED', 7: 'COMPLETED', 8: 'IN_PROGRESS' }))
    const plan = planRitual(layout, 107, 'schreiben', { schreiben: mastered })
    expect(plan?.tier).toBe(2)
    expect(plan?.nextNodeId).toBe(108)
    expect(plan?.week).toBeNull()
  })

  it('bậc 3: node cuối tuần hoá lá, cả tuần xong → tuần khép tán', () => {
    const layout = buildTreeLayout(nodes({ 5: 'COMPLETED', 6: 'IN_PROGRESS' }))
    const plan = planRitual(layout, 105, 'sprechen', { sprechen: mastered })
    expect(plan).toEqual({ nodeId: 105, skill: 'sprechen', tier: 3, nextNodeId: 106, week: 1 })
  })

  it('bậc 2 không có hoa kế tiếp (đã xong hết) → nextNodeId null, vẫn diễn', () => {
    const all = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 'COMPLETED']))
    const layout = buildTreeLayout(nodes(all))
    const plan = planRitual(layout, 110, 'hoeren', { hoeren: mastered })
    expect(plan?.tier).toBe(3)
    expect(plan?.nextNodeId).toBeNull()
  })

  it('node không có trên cây / node nụ-khoá → không nghi thức', () => {
    const layout = buildTreeLayout(nodes())
    expect(planRitual(layout, 999, 'hoeren', { hoeren: mastered })).toBeNull()
    expect(planRitual(layout, 106, 'hoeren', { hoeren: mastered })).toBeNull()
    expect(planRitual(layout, 109, 'hoeren', {})).toBeNull()
  })

  it('timeline gói trong 2,5 giây', () => {
    expect(RITUAL_TIMELINE.totalMs).toBeLessThanOrEqual(2600)
    expect(RITUAL_TIMELINE.cameraGlideMs).toBeLessThan(RITUAL_TIMELINE.totalMs)
  })
})
