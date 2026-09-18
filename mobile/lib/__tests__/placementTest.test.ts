// Kiểm tra đầu vào mobile (M8b, Đợt 3 PR-2): phần thuần + hợp đồng hai endpoint.

const postMock = jest.fn()
jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: (...a: unknown[]) => postMock(...a) } }))

import {
  answeredCount,
  isAnswered,
  isChoiceQuestion,
  normalizePlacementLevel,
  placementApi,
  placementProgress,
  placementResultCopy,
  skillMeta,
  type PlacementQuestion,
} from '@/lib/placementTest'

const Q: PlacementQuestion[] = [
  { id: 1, skillSection: 'HOEREN', type: 'MULTIPLE_CHOICE', questionDe: 'Was sagt er?', options: ['Ja', 'Nein'] },
  { id: 2, skillSection: 'SCHREIBEN', type: 'FREE_WRITE', questionDe: 'Schreiben Sie…', options: null },
  { id: 3, skillSection: 'LESEN', type: 'MULTIPLE_CHOICE', questionDe: 'Lesen…', options: ['A', 'B', 'C'] },
]

beforeEach(() => postMock.mockReset())

describe('normalizePlacementLevel', () => {
  test('nhận A1–C2, bỏ khoảng trắng, viết hoa', () => {
    expect(normalizePlacementLevel('a2')).toBe('A2')
    expect(normalizePlacementLevel(' B1 ')).toBe('B1')
    expect(normalizePlacementLevel('C2')).toBe('C2')
  })
  test.each(['A0', '', undefined, null, 42, 'B3', ['A1']])('%p → null (không bịa claimedLevel)', (raw) => {
    expect(normalizePlacementLevel(raw)).toBeNull()
  })
})

describe('skillMeta', () => {
  test('bốn kỹ năng có nhãn tiếng Việt + glyph Galerie; lạ → Viết', () => {
    expect(skillMeta('HOEREN')).toEqual({ label: 'Nghe', glyph: 'nghe' })
    expect(skillMeta('SPRECHEN')).toEqual({ label: 'Nói', glyph: 'noi' })
    expect(skillMeta('LESEN')).toEqual({ label: 'Đọc', glyph: 'doc' })
    expect(skillMeta('SCHREIBEN')).toEqual({ label: 'Viết', glyph: 'viet' })
    expect(skillMeta('???').label).toBe('Viết')
  })
})

describe('câu trả lời', () => {
  test('MULTIPLE_CHOICE có options ⇒ chọn; FREE_WRITE options null ⇒ nhập tự do', () => {
    expect(isChoiceQuestion(Q[0])).toBe(true)
    expect(isChoiceQuestion(Q[1])).toBe(false)
    expect(isChoiceQuestion({ options: [] })).toBe(false)
  })

  test('khoảng trắng không tính là đã trả lời (server trim rồi chấm)', () => {
    expect(isAnswered({ '2': '   ' }, 2)).toBe(false)
    expect(isAnswered({ '2': ' Hallo ' }, 2)).toBe(true)
    expect(isAnswered({}, 2)).toBe(false)
  })

  test('answeredCount đếm theo id câu, bỏ qua khoá lạ', () => {
    expect(answeredCount(Q, { '1': 'Ja', '3': 'B', '99': 'x' })).toBe(2)
    expect(answeredCount(Q, {})).toBe(0)
  })

  test('placementProgress là câu đang xem / tổng, kẹp 0..1', () => {
    expect(placementProgress(0, 10)).toBe(0.1)
    expect(placementProgress(9, 10)).toBe(1)
    expect(placementProgress(15, 10)).toBe(1)
    expect(placementProgress(0, 0)).toBe(0)
  })
})

describe('placementResultCopy', () => {
  test('đậu: nêu chặng theo trình độ tự khai, CTA vào lộ trình', () => {
    const c = placementResultCopy({ passed: true, scorePercent: 80, correctCount: 8, totalQuestions: 10 }, 'B1')
    expect(c.title).toBe('Tốt rồi, bạn đã sẵn sàng!')
    expect(c.score).toBe('8/10 câu đúng (80%)')
    expect(c.body).toContain('chặng B1')
    expect(c.cta).toBe('Vào lộ trình của tôi')
  })

  test('rớt: số chủ đề cần ôn + ngày làm lại, KHÔNG lộ số module máy', () => {
    const c = placementResultCopy(
      { passed: false, scorePercent: 40, correctCount: 4, totalQuestions: 10, weakModules: [3, 7], retryAfterDays: 3 },
      'A2',
    )
    expect(c.title).toBe('Mình đã tìm ra chỗ cần ôn')
    expect(c.body).toContain('2 chủ đề')
    expect(c.body).toContain('sau 3 ngày')
    expect(c.body).not.toMatch(/\b3, 7\b/)
    expect(c.cta).toBe('Xem lộ trình phù hợp')
  })

  test('rớt không có weakModules/retryAfterDays → câu chung + mặc định 3 ngày', () => {
    const c = placementResultCopy({ passed: false, scorePercent: 50, correctCount: 5, totalQuestions: 10 }, 'A1')
    expect(c.body).toContain('A1')
    expect(c.body).toContain('sau 3 ngày')
  })
})

describe('placementApi', () => {
  test('create gửi claimedLevel, trả testId + questions (mảng rỗng khi server thiếu)', async () => {
    postMock.mockResolvedValueOnce({ data: { testId: 't-1', timeLimit: 900 } })
    const r = await placementApi.create('A2')
    expect(postMock).toHaveBeenCalledWith('/skill-tree/placement-test', { claimedLevel: 'A2' })
    expect(r).toEqual({ testId: 't-1', questions: [], timeLimit: 900 })
  })

  test('submit gửi đúng đường dẫn + answers nguyên khoá id chuỗi', async () => {
    postMock.mockResolvedValueOnce({ data: { passed: true, scorePercent: 90, correctCount: 9, totalQuestions: 10 } })
    const r = await placementApi.submit('t-1', { '1': 'Ja', '2': 'Hallo' })
    expect(postMock).toHaveBeenCalledWith('/skill-tree/placement-test/t-1/submit', { answers: { '1': 'Ja', '2': 'Hallo' } })
    expect(r.passed).toBe(true)
  })

  test('lỗi API ném ra cho màn hình xử lý (cooldown 400 có detail)', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 400, data: { detail: 'Làm lại sau 3 ngày' } } })
    await expect(placementApi.create('B1')).rejects.toBeTruthy()
  })
})
