/**
 * Xưởng đề — logic thuần: ma trận độ khó (tổng, cảnh báo Siêu khó), điều kiện sang bước, điều kiện duyệt,
 * tô đoạn trùng nguồn.
 */
import { describe, it, expect } from 'vitest'
import { DIFFICULTY_PRESETS, type StudioDraft, type StudioItem, type StudioSource } from '@/lib/adminExamStudioApi'
import {
  CHECKLIST_KEYS,
  approveBlockers,
  checkMatrix,
  countByLevel,
  flaggedSelectedSources,
  markSnippets,
  maxReachableStep,
  planTotal,
  setPlanLevel,
  sourceStepReady,
} from '@/lib/examStudioLogic'

describe('checkMatrix', () => {
  it('Đề thi thử: tổng phải bằng số câu của Teil', () => {
    expect(checkMatrix({ EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }, 'EXAM', 5)).toMatchObject({ total: 5, sumError: false, valid: true })
    expect(checkMatrix({ EASY: 2, MEDIUM: 2, HARD: 2, EXPERT: 0 }, 'EXAM', 5)).toMatchObject({ total: 6, sumError: true, valid: false })
    expect(checkMatrix({ EASY: 1, MEDIUM: 1, HARD: 0, EXPERT: 0 }, 'EXAM', 5).sumError).toBe(true)
  })

  it('Bài luyện Teil: số câu được khác, nhưng không được bằng 0', () => {
    expect(checkMatrix({ EASY: 0, MEDIUM: 3, HARD: 4, EXPERT: 1 }, 'PRACTICE', 5)).toMatchObject({ sumError: false, valid: true })
    expect(checkMatrix({ EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }, 'PRACTICE', 5)).toMatchObject({ empty: true, valid: false })
  })

  it('cảnh báo vàng khi Đề thi thử có > 1 câu Siêu khó, không chặn; bài luyện không cảnh báo', () => {
    const plan = { EASY: 0, MEDIUM: 1, HARD: 2, EXPERT: 2 }
    expect(checkMatrix(plan, 'EXAM', 5)).toMatchObject({ expertWarning: true, valid: true })
    expect(checkMatrix(plan, 'PRACTICE', 5).expertWarning).toBe(false)
    expect(checkMatrix({ EASY: 1, MEDIUM: 1, HARD: 2, EXPERT: 1 }, 'EXAM', 5).expertWarning).toBe(false)
  })

  it('mọi mẫu nhanh đều hợp lệ cho Teil 5 câu', () => {
    for (const p of DIFFICULTY_PRESETS) expect(planTotal(p.plan)).toBe(5)
  })

  it('setPlanLevel kẹp trong [0, max] và bỏ NaN', () => {
    const base = { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }
    expect(setPlanLevel(base, 'EXPERT', -1).EXPERT).toBe(0)
    expect(setPlanLevel(base, 'EASY', 99, 10).EASY).toBe(10)
    expect(setPlanLevel(base, 'HARD', Number.NaN).HARD).toBe(0)
    expect(base.EXPERT).toBe(0) // không sửa object gốc
  })
})

function src(over: Partial<StudioSource> = {}): StudioSource {
  return {
    id: 1, url: 'https://x', publisher: null, title: null, author: null, publishedAt: null, licenseText: null,
    usageMode: 'FACTS_ONLY', usageModeConfirmed: false, neutrality: 'OK', neutralityReason: null,
    facts: [{ id: 'f1', text: 'x', figure: null, year: null, paragraph: 1, corroborated: false, selected: true }],
    ...over,
  }
}

function item(over: Partial<StudioItem> = {}): StudioItem {
  return {
    id: 'LV2-6', question: 'q', options: { a: 'a', b: 'b', c: 'c' }, correct: 'a', explanationVi: '', evidence: '',
    traps: [], difficultyTarget: 'EASY', difficultyMeasured: null, locked: false, light: 'GREEN', flags: [], ...over,
  }
}

describe('bước Nguồn', () => {
  it('cần ≥ 1 dữ kiện tích và không có nguồn đang dùng bị cờ', () => {
    expect(sourceStepReady([src()])).toBe(true)
    expect(sourceStepReady([src({ facts: [] })])).toBe(false)
    const flagged = src({ id: 2, neutrality: 'FLAGGED', neutralityReason: 'Partei' })
    expect(flaggedSelectedSources([src(), flagged])).toHaveLength(1)
    expect(sourceStepReady([src(), flagged])).toBe(false)
    // Nguồn bị cờ nhưng không tích dữ kiện nào thì không chặn.
    const unused = src({ id: 3, neutrality: 'FLAGGED', facts: [{ id: 'f9', text: 'y', figure: null, year: null, paragraph: null, corroborated: false, selected: false }] })
    expect(sourceStepReady([src(), unused])).toBe(true)
  })
})

describe('maxReachableStep', () => {
  const base = {
    mode: 'EXAM', itemCount: 5, difficultyPlan: { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 },
    step: 'FRAME', sources: [], text: null, items: [],
  } as unknown as StudioDraft
  it('mở dần theo dữ liệu đã có', () => {
    expect(maxReachableStep(base)).toBe(1)
    expect(maxReachableStep({ ...base, difficultyPlan: { EASY: 1, MEDIUM: 0, HARD: 0, EXPERT: 0 } })).toBe(0)
    const withSrc = { ...base, sources: [src()] }
    expect(maxReachableStep(withSrc)).toBe(2)
    const withText = { ...withSrc, text: { titleDe: 't', vorspannDe: '', context: 'c', glossary: [] } }
    expect(maxReachableStep(withText)).toBe(3)
    expect(maxReachableStep({ ...withText, items: [item()] })).toBe(4)
  })
  it('không lùi dưới bước máy chủ đã ghi', () => {
    expect(maxReachableStep({ ...base, step: 'ITEMS', difficultyPlan: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 } })).toBe(3)
  })
})

describe('approveBlockers', () => {
  const all = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true]))
  const ok = { status: 'DRAFT' as const, busyOp: null, items: [item()], checks: [] }
  it('đủ 8 mục, không đèn đỏ, không bận → duyệt được', () => {
    expect(approveBlockers(ok, all)).toEqual([])
  })
  it('chặn khi thiếu một mục checklist, có câu/kiểm đỏ, hoặc đang bận', () => {
    expect(approveBlockers(ok, { ...all, QUELLE: false })).toContain('CHECKLIST')
    expect(approveBlockers({ ...ok, items: [item({ light: 'RED' })] }, all)).toContain('RED_ITEM')
    expect(approveBlockers({ ...ok, checks: [{ key: 'X', label: 'x', light: 'RED', detail: null }] }, all)).toContain('RED_CHECK')
    expect(approveBlockers({ ...ok, busyOp: 'VERIFY' }, all)).toContain('BUSY')
    expect(approveBlockers({ ...ok, items: [item({ light: 'YELLOW' })] }, all)).toEqual([])
  })
})

describe('countByLevel', () => {
  it('đếm theo bậc giao và bậc đo (bỏ câu chưa đo)', () => {
    const items = [
      item({ difficultyTarget: 'HARD', difficultyMeasured: { scores: { phrasing: 1, evidence: 1, distractors: 1, language: 1 }, total: 4, level: 'MEDIUM', hint: null } }),
      item({ id: 'b', difficultyTarget: 'HARD' }),
    ]
    expect(countByLevel(items, 'target')).toEqual({ EASY: 0, MEDIUM: 0, HARD: 2, EXPERT: 0 })
    expect(countByLevel(items, 'measured')).toEqual({ EASY: 0, MEDIUM: 1, HARD: 0, EXPERT: 0 })
  })
})

describe('markSnippets', () => {
  it('tách và đánh dấu đoạn trùng, kể cả ký tự đặc biệt regex', () => {
    const parts = markSnippets('Die Preise (2024) steigen stark an.', ['(2024) steigen'])
    expect(parts).toEqual([
      { text: 'Die Preise ', hit: false },
      { text: '(2024) steigen', hit: true },
      { text: ' stark an.', hit: false },
    ])
    expect(markSnippets('abc', [])).toEqual([{ text: 'abc', hit: false }])
  })
})
