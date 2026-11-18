import { parseExamSections } from '../examApi'
import { continueTeil, formatClock, locateTeil, nextTeilKey, objectiveResult, scoreSummary, splitTeilKey, teilStatus, teilTitle, writingResult } from '../practiceTeil'
import type { PracticeOverview, PracticeTeil } from '../telcPracticeApi'

jest.mock('../api', () => ({ __esModule: true, default: {} }))

const exam = parseExamSections(
  JSON.stringify({
    format: 'TELC',
    sections: [
      {
        name: 'LESEN',
        teile: [
          { teil: 1, type: 'MATCH_HEADLINE', headlines: { a: 'Eins', b: 'Zwei' }, items: [{ id: 'LV1-1', question: 'Text 1', text: 'Hallo' }] },
          { teil: 2, type: 'MULTIPLE_CHOICE', context: 'Ein Artikel', items: [{ id: 'LV2-6', question: 'Was?', options: { a: 'A', b: 'B', c: 'C' } }] },
        ],
      },
      { name: 'SCHREIBEN', teile: [{ teil: 1, prompt: 'Schreiben Sie', writing_points: ['a', 'b'] }] },
    ],
  }),
)

const teil = (key: string, progress: PracticeTeil['progress'], section = key.split('-')[0]): PracticeTeil => ({
  key, section, teil: Number(key.split('-')[1]), type: null, items: 5, maxPoints: 25, suggestMinutes: 15, progress,
})
const prog = (answers: Record<string, string>, checked = false, score: number | null = null) => ({
  answers, checked, score, max: checked ? 25 : null, elapsedSeconds: 0, updatedAt: null, result: null,
})

describe('practiceTeil', () => {
  it('tách khoá Teil như backend', () => {
    expect(splitTeilKey('SPRACHBAUSTEINE-2')).toEqual({ section: 'SPRACHBAUSTEINE', teil: 2 })
    expect(splitTeilKey('LESEN')).toBeNull()
    expect(teilTitle('HOEREN-3')).toBe('Hören · Teil 3')
    expect(formatClock(75)).toBe('1:15')
  })

  it('tìm đúng Teil trắc nghiệm và bài viết trong đề đã bóc', () => {
    const l2 = locateTeil(exam, 'LESEN-2')
    expect(l2?.kind).toBe('objective')
    expect(l2 && l2.kind === 'objective' && l2.group.items[0].id).toBe('LV2-6')
    expect(locateTeil(exam, 'SCHREIBEN-1')?.kind).toBe('writing')
    expect(locateTeil(exam, 'HOEREN-1')).toBeNull()
    expect(locateTeil(null, 'LESEN-1')).toBeNull()
  })

  it('Teil kế tiếp theo thứ tự đề; hết thì null', () => {
    const ov = { teile: [teil('LESEN-1', null), teil('LESEN-2', null)] }
    expect(nextTeilKey(ov, 'LESEN-1')).toBe('LESEN-2')
    expect(nextTeilKey(ov, 'LESEN-2')).toBeNull()
  })

  it('điểm và nhãn theo ngưỡng 60/50', () => {
    expect(scoreSummary(15, 25)).toMatchObject({ pct: 60, passed: true, label: 'Đạt' })
    expect(scoreSummary(13, 25)?.label).toBe('Sát ngưỡng')
    expect(scoreSummary(null, 25)).toBeNull()
  })

  it('trạng thái Teil ở màn Đề và Teil làm tiếp', () => {
    expect(teilStatus(teil('LESEN-1', null))).toEqual({ tone: 'new', text: 'Chưa làm' })
    expect(teilStatus(teil('LESEN-2', prog({ 'LV2-6': 'a' })))).toEqual({ tone: 'doing', text: 'Đang làm · 1/5 câu' })
    expect(teilStatus(teil('LESEN-3', prog({}, true, 20)))).toEqual({ tone: 'pass', text: '20/25 · Đạt' })
    expect(teilStatus(teil('SCHREIBEN-1', prog({ text: 'Liebe Anna, danke' })))).toEqual({ tone: 'doing', text: 'Đang viết · 3 từ' })
    const ov: Pick<PracticeOverview, 'teile'> = { teile: [teil('LESEN-1', prog({}, true, 20)), teil('LESEN-2', prog({ x: 'a' }))] }
    expect(continueTeil(ov)?.key).toBe('LESEN-2')
  })

  it('tách kết quả trắc nghiệm và phiếu chấm Viết', () => {
    const obj = { teilKey: 'LESEN-1', type: 'X', score: 1, max: 5, correctCount: 1, total: 5, items: [], unusedOptions: [] }
    expect(objectiveResult(obj)).toBe(obj)
    expect(writingResult(obj)).toBeNull()
    const w = { status: 'AI_EVALUATED', total: 30, max: 45 }
    expect(writingResult(w)).toBe(w)
    expect(objectiveResult(w)).toBeNull()
  })
})
