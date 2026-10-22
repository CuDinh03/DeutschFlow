// LT1 (22/10/2026): ngân sách điểm trên màn kết quả đề telc — nhãn, định dạng, mục tiêu chọn sẵn.
jest.mock('@/lib/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }))

import {
  budgetRowDetail,
  budgetRowLabel,
  defaultTarget,
  formatPoints,
  gateMargin,
  gradeLabel,
  type GradeTarget,
} from '../examApi'

const target = (grade: string, remaining: number): GradeTarget => ({ grade, minPoints: 0, maxLoss: 0, remaining, example: [] })

describe('ngân sách điểm (LT1)', () => {
  test('nhãn Teil và phần, không lộ mã máy', () => {
    expect(budgetRowLabel({ section: 'HOEREN', teil: 1 })).toBe('Nghe hiểu · Teil 1')
    expect(budgetRowLabel({ section: 'SPRACHBAUSTEINE', teil: 2 })).toBe('Ngữ pháp – từ vựng · Teil 2')
    expect(budgetRowLabel({ section: 'SPRECHEN' })).toBe('Nói')
    expect(budgetRowLabel({ section: 'LẠ' })).toBe('Phần khác')
    expect(gradeLabel('GUT')).toBe('gut (giỏi)')
  })

  test('điểm kiểu Việt: dấu phẩy thập phân, bỏ số 0 thừa', () => {
    expect(formatPoints(2.5)).toBe('2,5')
    expect(formatPoints(48.5)).toBe('48,5')
    expect(formatPoints(60)).toBe('60')
  })

  test('dòng phụ: câu đúng + trọng số, hoặc lý do chưa có điểm', () => {
    expect(budgetRowDetail({ section: 'HOEREN', teil: 1, max: 25, earned: 15, lost: 10, pointPerItem: 5, items: 5, correct: 3, pending: false }))
      .toBe('3/5 câu đúng · 5 điểm/câu')
    expect(budgetRowDetail({ section: 'SPRACHBAUSTEINE', teil: 1, max: 15, earned: 9, lost: 6, pointPerItem: 1.5, items: 10, correct: 6, pending: false }))
      .toBe('6/10 câu đúng · 1,5 điểm/câu')
    expect(budgetRowDetail({ section: 'SCHREIBEN', max: 45, earned: 30, lost: 15, pending: false })).toBe('30/45 điểm')
    expect(budgetRowDetail({ section: 'SPRECHEN', max: 75, pending: true })).toBe('Chưa thi Nói')
    expect(budgetRowDetail({ section: 'SCHREIBEN', max: 45, pending: true })).toBe('Bài viết đang chờ chấm')
    expect(budgetRowDetail({ section: 'HOEREN', teil: 2, max: 25, pending: true })).toBe('Chưa có điểm phần này')
  })

  test('mục tiêu chọn sẵn: mức cao nhất còn trong ngân sách; vượt hết thì mức thấp nhất', () => {
    expect(defaultTarget([target('SEHR_GUT', -18.5), target('GUT', 11.5), target('AUSREICHEND', 71.5)])).toBe('GUT')
    expect(defaultTarget([target('SEHR_GUT', -1), target('AUSREICHEND', -1)])).toBe('AUSREICHEND')
    expect(defaultTarget([])).toBeNull()
  })

  test('khoảng cách tới ngưỡng của cổng', () => {
    expect(gateMargin({ raw: 180, min: 135, status: 'PASSED' })).toBe(45)
    expect(gateMargin({ raw: 40, min: 45, status: 'FAILED' })).toBe(-5)
    expect(gateMargin({ raw: 0, min: 45, status: 'PENDING' })).toBeNull()
  })
})
