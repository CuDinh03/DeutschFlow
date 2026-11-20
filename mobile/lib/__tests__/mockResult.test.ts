import {
  analysisRows,
  gateBadge,
  gateView,
  givenAnswers,
  lostLabel,
  lostReason,
  lostRows,
  resultHeadline,
  sectionScoreRows,
  shortDate,
  teilName,
  teilNameOfKey,
} from '../mockResult'
import type { ExamBudget, ExamGate } from '../examApi'
import type { PracticeItemResult, PracticeTeilResult } from '../telcPracticeApi'

const written = (raw: number, status = raw >= 135 ? 'PASSED' : 'FAILED'): ExamGate => ({ id: 'written', raw, max: 225, min: 135, status })
const oralPending: ExamGate = { id: 'oral', raw: 0, max: 75, min: 45, status: 'PENDING' }

describe('ngưỡng đỗ và câu tiêu đề', () => {
  it('ô ngưỡng: tỉ lệ, vạch ngưỡng, khoảng cách', () => {
    expect(gateView([written(147), oralPending], 'written')).toEqual({
      raw: 147, max: 225, min: 135, status: 'PASSED', margin: 12, ratio: 147 / 225, markRatio: 0.6,
    })
    expect(gateView([written(147), oralPending], 'oral')).toMatchObject({ margin: null, ratio: 0 })
    expect(gateView(undefined, 'written')).toBeNull()
  })

  it('tiêu đề theo kết luận phần viết', () => {
    expect(resultHeadline([written(147)], 147)).toEqual({ before: 'Đỗ phần viết, hơn ngưỡng', mark: '12 điểm' })
    expect(resultHeadline([written(135)], 135)).toEqual({ before: 'Đỗ phần viết,', mark: 'vừa đúng ngưỡng' })
    expect(resultHeadline([written(122.5)], 122.5)).toEqual({ before: 'Còn thiếu', mark: '12,5 điểm', after: 'phần viết' })
    // Đề không có ngưỡng (Goethe): nói điểm.
    expect(resultHeadline(undefined, 64)).toEqual({ before: 'Đã chấm xong:', mark: '64 điểm' })
    expect(resultHeadline([], 80, true)).toEqual({ before: 'Bạn đã', mark: 'đỗ', after: 'với 80 điểm' })
  })

  it('nhãn ước tính', () => {
    expect(gateBadge(gateView([written(147)], 'written')!)).toEqual({ label: 'Ước tính · Đỗ', tone: 'success' })
    expect(gateBadge(gateView([written(100)], 'written')!)).toEqual({ label: 'Ước tính · Chưa đỗ', tone: 'danger' })
    expect(gateBadge(gateView([oralPending], 'oral')!)).toBeNull()
  })
})

describe('lấy lại điểm', () => {
  const budget: ExamBudget = {
    totalMax: 300, earned: 147, lost: 78, pending: true, targets: [],
    losses: [
      { section: 'LESEN', teil: 3, max: 25, lost: 7.5, items: 10, correct: 7, pending: false },
      { section: 'HOEREN', teil: 2, max: 25, lost: 12.5, items: 10, correct: 5, pending: false },
      { section: 'SPRACHBAUSTEINE', teil: 2, max: 15, lost: 4.5, items: 10, correct: 7, pending: false },
      { section: 'LESEN', teil: 1, max: 25, lost: 0, items: 5, correct: 5, pending: false },
      { section: 'SPRECHEN', max: 75, lost: 75, pending: true },
      { section: 'SCHREIBEN', max: 45, lost: 18, pending: false },
    ],
  }

  it('ba chỗ mất nhiều nhất, bỏ phần Nói và dòng chưa chấm', () => {
    const rows = lostRows(budget)
    expect(rows.map((r) => r.key)).toEqual(['SCHREIBEN-1', 'HOEREN-2', 'LESEN-3'])
    expect(rows[1]).toEqual({ key: 'HOEREN-2', section: 'HOEREN', teil: 2, lost: 12.5, wrong: 5, items: 10 })
    expect(lostRows(null)).toEqual([])
  })

  it('lý do mất điểm và nhãn số', () => {
    const [w, h] = lostRows(budget)
    expect(lostReason(h, null)).toBe('Sai 5/10 câu')
    expect(lostReason({ ...h, section: 'SPRACHBAUSTEINE' }, null)).toBe('Sai 5/10 chỗ trống')
    expect(lostReason(w, { text: '', missingPoints: 0 })).toBe('Chưa viết bài')
    expect(lostReason(w, { text: 'Liebe Anna', missingPoints: 2 })).toBe('Thiếu 2 ý bắt buộc')
    expect(lostReason(w, { text: 'Liebe Anna', missingPoints: 0 })).toBe('Mất điểm ở cách viết thư')
    expect(lostReason({ ...h, wrong: null }, null)).toBe('Mất điểm ở Teil này')
    expect(lostLabel(12.5)).toBe('−12,5')
  })
})

describe('điểm từng phần và phân tích từng câu', () => {
  it('đọc detailed_scores_json theo thứ tự đề, bỏ khoá không phải phần thi', () => {
    const json = JSON.stringify({
      HOEREN: { total: 45, max: 75 },
      LESEN: { total: 54, max: 75 },
      meta: { max: 1 },
      SCHREIBEN: { total: 27, max: 45, status: 'AI_EVALUATED' },
      SPRACHBAUSTEINE: { max: 30 },
    })
    expect(sectionScoreRows(json)).toEqual([
      { section: 'LESEN', label: 'Lesen', total: 54, max: 75 },
      { section: 'SPRACHBAUSTEINE', label: 'Sprachbausteine', total: 0, max: 30 },
      { section: 'HOEREN', label: 'Hören', total: 45, max: 75 },
      { section: 'SCHREIBEN', label: 'Schreiben', total: 27, max: 45 },
    ])
    expect(sectionScoreRows('{hỏng')).toEqual([])
    expect(sectionScoreRows(null)).toEqual([])
  })

  const item = (id: string, given: string | null, ok: boolean): PracticeItemResult => ({
    id, label: id, given, givenText: null, correct: 'a', correctText: null, answered: given != null, isCorrect: ok, points: ok ? 5 : 0,
    whyRight: null, whyWrong: null, trap: null, evidence: [], need: null, rule: null,
  })
  const teil = (key: string, items: PracticeItemResult[]): PracticeTeilResult => ({
    teilKey: key, type: 'X', score: 0, max: 25, correctCount: items.filter((i) => i.isCorrect).length, total: items.length, items, unusedOptions: [],
  })

  it('mỗi Teil một hàng, bài viết một hàng (điểm hoặc đang chờ)', () => {
    const teile = [teil('LESEN-1', [item('1', 'a', true), item('2', 'b', false)]), teil('SPRACHBAUSTEINE-2', [item('31', 'a', true)])]
    expect(analysisRows(teile, null)).toEqual([
      { key: 'LESEN-1', name: 'Lesen Teil 1', section: 'LESEN', meta: '1/2 câu đúng', openable: true },
      { key: 'SPRACHBAUSTEINE-2', name: 'Sprachbausteine Teil 2', section: 'SPRACHBAUSTEINE', meta: '1/1 chỗ trống đúng', openable: true },
    ])
    expect(analysisRows([], { status: 'AI_EVALUATED', total: 27, max: 45 })[0]).toMatchObject({ name: 'Schreiben', meta: '27/45 điểm', openable: true })
    expect(analysisRows([], { status: 'PENDING_AI_EVALUATION', total: 0, max: 45 })[0]).toMatchObject({ meta: 'Đang chờ chấm', openable: false })
    expect(analysisRows([], { status: 'AI_EVALUATED', total: 20, max: 45 }, { total: 27, max: 45 })[0].meta).toBe('27/45 điểm')
  })

  it('câu đã nộp để dựng lại đề ở chế độ xem lại', () => {
    expect(givenAnswers([item('1', 'a', true), item('2', null, false), item('3', 'x', false)])).toEqual({ '1': 'a', '3': 'x' })
  })

  it('tên Teil và ngày ngắn', () => {
    expect(teilName('HOEREN', 2)).toBe('Hören Teil 2')
    expect(teilName('SCHREIBEN', 1)).toBe('Schreiben')
    expect(teilNameOfKey('LESEN-3')).toBe('Lesen Teil 3')
    expect(teilNameOfKey('lạ')).toBe('Teil')
    expect(shortDate('2026-11-14T09:00:00')).toBe('14/11')
    expect(shortDate('hỏng')).toBe('')
    expect(shortDate(null)).toBe('')
  })
})
