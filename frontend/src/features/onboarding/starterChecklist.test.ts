import { describe, expect, it } from 'vitest'
import {
  PLACEMENT_RETRY_ROUTE,
  STARTER_WINDOW_DAYS,
  buildStarterChecklist,
  hasActivity,
  isProgressRowMissing,
  type OnboardingProgress,
} from './starterChecklist'
import { BEGINNER_ROUTE, MOCK_EXAM_ROUTE, ROADMAP_ROUTE } from './postProfileRoute'

const NOW = Date.parse('2026-09-19T10:00:00Z')
const DAY = 24 * 60 * 60 * 1000

/** Bản mặc định `readProgress` trả khi user chưa có hàng. */
const NO_ROW: OnboardingProgress = {
  flowVersion: 'onb_v3',
  lastStep: 'INTRO',
  completedActivities: [],
  activatedAt: null,
  coreCompletedAt: null,
}

function progress(p: Partial<OnboardingProgress>): OnboardingProgress {
  return { ...NO_ROW, lastStep: 'CLAIMED', ...p }
}

describe('W10 — checklist tuần đầu (trạng thái từ server)', () => {
  it('không có hàng progress (tài khoản cũ) ⇒ ẩn, không dựng checklist từ chỗ không biết', () => {
    const c = buildStarterChecklist(NO_ROW, { level: 'A0', now: NOW })
    expect(isProgressRowMissing(NO_ROW)).toBe(true)
    expect(c.visible).toBe(false)
    expect(c.hiddenReason).toBe('no_row')
  })

  it('A0 vừa claim, chưa làm gì ⇒ ba mục: Ngày 1 · chặng đầu · nói thử, chưa tích ô nào', () => {
    const c = buildStarterChecklist(progress({}), { level: 'A0', now: NOW })
    expect(c.visible).toBe(true)
    expect(c.items.map((i) => i.key)).toEqual(['first_lesson', 'roadmap_node', 'mock_exam'])
    expect(c.items.map((i) => i.href)).toEqual([BEGINNER_ROUTE, ROADMAP_ROUTE, MOCK_EXAM_ROUTE])
    expect(c.doneCount).toBe(0)
  })

  it('A1+ bỏ qua ở Chọn đường ⇒ mục đầu là "Kiểm tra đầu vào" trỏ lối làm lại (AC-ONB-15)', () => {
    const c = buildStarterChecklist(progress({}), { level: 'B1', now: NOW })
    expect(c.visible).toBe(true)
    expect(c.items[0]).toEqual({ key: 'placement', done: false, href: PLACEMENT_RETRY_ROUTE })
  })

  it('trình độ thiếu coi như A0 (I-1)', () => {
    expect(buildStarterChecklist(progress({}), { level: null, now: NOW }).items[0].key).toBe('first_lesson')
  })

  it('tích ô theo FIRST_LESSON:<kind> — Ngày 1 web hoặc Câu đầu tiên mobile đều là bài đầu', () => {
    const web = progress({ completedActivities: ['FIRST_LESSON:BEGINNER_SESSION'], activatedAt: '2026-09-19T09:00:00Z' })
    const mobile = progress({ completedActivities: ['FIRST_LESSON:FIRST_SENTENCE'], activatedAt: '2026-09-19T09:00:00Z' })
    expect(buildStarterChecklist(web, { level: 'A0', now: NOW }).items[0].done).toBe(true)
    expect(buildStarterChecklist(mobile, { level: 'A0', now: NOW }).items[0].done).toBe(true)
    expect(hasActivity(web, 'PLACEMENT')).toBe(false)
  })

  it('placement xong tích mục Kiểm tra đầu vào; chặng và nói thử tích theo kind riêng', () => {
    const p = progress({
      completedActivities: ['FIRST_LESSON:PLACEMENT', 'FIRST_LESSON:ROADMAP_NODE'],
      activatedAt: '2026-09-18T09:00:00Z',
    })
    const c = buildStarterChecklist(p, { level: 'A2', now: NOW })
    expect(c.items.map((i) => i.done)).toEqual([true, true, false])
    expect(c.doneCount).toBe(2)
    expect(c.visible).toBe(true)
  })

  it('đủ ba ô ⇒ ẩn (all_done)', () => {
    const p = progress({
      completedActivities: ['FIRST_LESSON:BEGINNER_SESSION', 'FIRST_LESSON:ROADMAP_NODE', 'FIRST_LESSON:MOCK_EXAM'],
      activatedAt: '2026-09-19T09:00:00Z',
    })
    const c = buildStarterChecklist(p, { level: 'A0', now: NOW })
    expect(c.visible).toBe(false)
    expect(c.hiddenReason).toBe('all_done')
  })

  it(`quá ${STARTER_WINDOW_DAYS} ngày kể từ activatedAt ⇒ ẩn (expired); đúng 7 ngày vẫn hiện`, () => {
    const at = new Date(NOW - (STARTER_WINDOW_DAYS * DAY + 1)).toISOString()
    const edge = new Date(NOW - STARTER_WINDOW_DAYS * DAY).toISOString()
    const base = { completedActivities: ['FIRST_LESSON:BEGINNER_SESSION'] }
    expect(buildStarterChecklist(progress({ ...base, activatedAt: at }), { level: 'A0', now: NOW }).hiddenReason).toBe('expired')
    expect(buildStarterChecklist(progress({ ...base, activatedAt: edge }), { level: 'A0', now: NOW }).visible).toBe(true)
  })

  it('chưa activation (A1+ bỏ qua) ⇒ không có mốc, checklist ở lại', () => {
    const c = buildStarterChecklist(progress({ lastStep: 'CLAIMED' }), { level: 'B1', now: NOW + 30 * DAY })
    expect(c.visible).toBe(true)
  })

  it('activatedAt không parse được ⇒ không ẩn nhầm', () => {
    const c = buildStarterChecklist(progress({ activatedAt: 'không-phải-ngày' }), { level: 'A0', now: NOW })
    expect(c.visible).toBe(true)
  })

  it('payload lệch hợp đồng (null, mảng rỗng, thiếu lastStep) coi như không có hàng', () => {
    for (const bad of [null, undefined, [], {}, { activatedAt: null }]) {
      const c = buildStarterChecklist(bad as unknown as OnboardingProgress, { level: 'A0', now: NOW })
      expect(c.visible).toBe(false)
      expect(c.hiddenReason).toBe('no_row')
    }
  })

  it('completedActivities thiếu (backend cũ) không làm nổ', () => {
    const p = { ...progress({}), completedActivities: undefined as unknown as string[] }
    expect(() => buildStarterChecklist(p, { level: 'A0', now: NOW })).not.toThrow()
  })
})
