// LT2 (22/10/2026): chiến thuật từng Teil — gọi đúng endpoint, đề telc mang `format` + số Teil.
const getMock = jest.fn()
jest.mock('@/lib/api', () => ({ __esModule: true, default: { get: (...a: unknown[]) => getMock(...a), post: jest.fn() } }))

import { fetchExamStrategies } from '../examStrategy'
import { parseExamSections, strategyTeile } from '../examApi'

describe('chiến thuật từng Teil (LT2)', () => {
  beforeEach(() => getMock.mockReset())

  test('fetchExamStrategies: đề + bậc + tiếng Việt; dữ liệu hỏng ⇒ rỗng', async () => {
    getMock.mockResolvedValueOnce({ data: [{ section: 'LESEN', teil: 1, points: 25, status: 'COMING_SOON' }] })
    const list = await fetchExamStrategies('TELC', 'B1')
    expect(getMock).toHaveBeenCalledWith('/exam-strategies', { params: { provider: 'TELC', level: 'B1', lang: 'vi' } })
    expect(list).toHaveLength(1)

    getMock.mockResolvedValueOnce({ data: null })
    expect(await fetchExamStrategies('TELC', 'B1')).toEqual([])
  })

  test('parseExamSections giữ `format` của đề và số Teil của từng nhóm câu', () => {
    const parsed = parseExamSections(JSON.stringify({
      format: 'TELC',
      sections: [{
        name: 'LESEN',
        teile: [{ teil: 2, items: [{ id: 'l1', question: 'Frage?', options: ['a', 'b', 'c'], correct: 'a' }] }],
      }],
    }))
    expect(parsed.format).toBe('TELC')
    expect(parsed.groups[0].teilNo).toBe(2)
  })

  test('dòng điểm mất → Teil có chiến thuật', () => {
    expect(strategyTeile({ section: 'HOEREN', teil: 3 })).toEqual([3])
    expect(strategyTeile({ section: 'SCHREIBEN' })).toEqual([1])
    expect(strategyTeile({ section: 'SPRECHEN' })).toEqual([1, 2, 3])
  })
})
