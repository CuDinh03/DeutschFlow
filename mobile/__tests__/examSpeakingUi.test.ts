// Khoá các quyết định hiển thị thuần của Luyện thi Nói — đồng hồ neo giờ server,
// sort level, tông màu điểm, và trích stimulus degrade êm với kiểu lạ.

import {
  criterionRatio,
  drillTargets,
  formatClock,
  levelsFromBlueprints,
  nextPrueferAnnouncement,
  ratioTone,
  remainingSec,
  stateLabel,
  stimulusDisplay,
} from '@/lib/examSpeakingUi'

describe('levelsFromBlueprints', () => {
  test('duy nhất + xếp A1→C2 bất kể thứ tự vào', () => {
    const levels = levelsFromBlueprints([
      { level: 'B2' }, { level: 'A1' }, { level: 'B1' }, { level: 'B1' }, { level: 'A2' },
    ])
    expect(levels).toEqual(['A1', 'A2', 'B1', 'B2'])
  })
})

describe('remainingSec — đồng hồ neo giờ SERVER', () => {
  const serverNow = '2026-09-02T10:00:00.000Z'
  const deadline = '2026-09-02T10:05:00.000Z' // còn 300s tại thời điểm fetch

  test('đồng hồ máy lệch bao nhiêu cũng không sai giờ thi', () => {
    const clientAtFetch = 1_000_000 // giá trị client tuỳ ý — chỉ hiệu số có nghĩa
    expect(remainingSec(deadline, serverNow, clientAtFetch, clientAtFetch)).toBe(300)
    expect(remainingSec(deadline, serverNow, clientAtFetch, clientAtFetch + 60_000)).toBe(240)
  })

  test('quá hạn → 0 (không âm); thiếu deadline/mốc hỏng → null', () => {
    expect(remainingSec(deadline, serverNow, 0, 400_000)).toBe(0)
    expect(remainingSec(null, serverNow, 0, 0)).toBeNull()
    expect(remainingSec('hỏng', serverNow, 0, 0)).toBeNull()
  })
})

describe('formatClock', () => {
  test.each([
    [0, '0:00'],
    [59, '0:59'],
    [60, '1:00'],
    [305, '5:05'],
  ])('%is → %s', (sec, out) => {
    expect(formatClock(sec)).toBe(out)
  })
})

describe('stateLabel', () => {
  test('phủ đủ các trạng thái phiên của backend', () => {
    for (const s of ['PREP', 'IN_PART', 'BETWEEN', 'DONE', 'GRADING', 'RESULTS', 'GRADING_FAILED', 'ABORTED'] as const) {
      expect(stateLabel(s)).not.toBe(s) // đều có nhãn tiếng Việt, không rơi fallback
    }
  })
})

describe('criterionRatio + ratioTone', () => {
  test('ratio kẹp 0..1 và chịu được max=0', () => {
    expect(criterionRatio(23, 25)).toBeCloseTo(0.92)
    expect(criterionRatio(30, 25)).toBe(1)
    expect(criterionRatio(-1, 25)).toBe(0)
    expect(criterionRatio(5, 0)).toBe(0)
  })
  test('ngưỡng tông màu theo design đã chốt: ≥0.85 xanh, ≥0.72 vàng, dưới là cam', () => {
    expect(ratioTone(0.92)).toBe('success')
    expect(ratioTone(0.8)).toBe('gold')
    expect(ratioTone(0.72)).toBe('gold')
    expect(ratioTone(0.71)).toBe('orange')
  })
})

describe('stimulusDisplay — degrade êm với mọi kiểu stimulus', () => {
  test('lấy headline từ các khoá phổ biến (thema/prompt/keyword/wort…)', () => {
    expect(stimulusDisplay({ thema: 'Mein Traumberuf' }).headline).toBe('Mein Traumberuf')
    expect(stimulusDisplay({ prompt: 'Beschreiben Sie das Bild.' }).headline).toBe('Beschreiben Sie das Bild.')
    expect(stimulusDisplay({ number: 42 }).headline).toBe('42')
  })
  test('gom bullets từ keywords/hints; kiểu lạ → rỗng chứ không nổ', () => {
    expect(stimulusDisplay({ keywords: ['wann?', 'wo?'], hints: ['砸'] }).bullets).toEqual(['wann?', 'wo?', '砸'])
    expect(stimulusDisplay({ weird: { nested: true } })).toEqual({ headline: null, bullets: [] })
    expect(stimulusDisplay(null)).toEqual({ headline: null, bullets: [] })
  })
})

describe('nextPrueferAnnouncement — chặn lặp câu dẫn giám khảo (directive là echo lời PRUEFER gần nhất)', () => {
  const INTRO = 'Teil 1: Fragen zur Person. Ihre erste Karte: Auto?'

  test('mới vào màn/Teil (chưa hiển thị gì) → hiển thị', () => {
    expect(nextPrueferAnnouncement(null, INTRO)).toBe(INTRO)
  })

  test('cùng câu echo lại ở step sau (partner vừa đáp xong) → bỏ qua, không chèn lần 2', () => {
    expect(nextPrueferAnnouncement(INTRO, INTRO)).toBeNull()
  })

  test('lệch khoảng trắng rìa vẫn tính là lặp', () => {
    expect(nextPrueferAnnouncement(INTRO, `  ${INTRO}\n`)).toBeNull()
  })

  test('giám khảo nói câu MỚI → hiển thị (đã trim)', () => {
    expect(nextPrueferAnnouncement(INTRO, ' Danke. Und was arbeiten Sie? ')).toBe('Danke. Und was arbeiten Sie?')
  })

  test('directive trống/thiếu → không hiển thị gì', () => {
    expect(nextPrueferAnnouncement(INTRO, null)).toBeNull()
    expect(nextPrueferAnnouncement(null, undefined)).toBeNull()
    expect(nextPrueferAnnouncement(null, '   ')).toBeNull()
  })
})

describe('drillTargets — gom contexts lỗi thành mục tiêu drill theo level + Teil', () => {
  const ctx = (level: string, teilNo: number, count: number) => ({
    provider: 'GOETHE' as const, level, teilNo, archetype: 'X', count, lastSeenAt: '2026-09-05T00:00:00Z',
  })
  test('cộng dồn cùng level+Teil qua nhiều lỗi, sắp nhiều → ít, hoà thì level thấp rồi Teil nhỏ', () => {
    const out = drillTargets([
      { contexts: [ctx('B1', 2, 2), ctx('A2', 1, 1)] },
      { contexts: [ctx('B1', 2, 3), ctx('B1', 1, 5), ctx('B2', 3, 1)] },
    ])
    expect(out.map((t) => [t.level, t.teilNo, t.count])).toEqual([
      ['B1', 1, 5],
      ['B1', 2, 5],
      ['A2', 1, 1],
      ['B2', 3, 1],
    ])
  })
  test('cắt limit; bỏ context thiếu level/Teil; count null coi như 1; rỗng → []', () => {
    const out = drillTargets(
      [{ contexts: [ctx('B1', 1, 9), ctx('B1', 2, 8), { ...ctx('', 3, 7) }, { ...ctx('A1', 0, 6) }, { ...ctx('A1', 1, 1), count: null as unknown as number }] }],
      2,
    )
    expect(out.map((t) => `${t.level}-${t.teilNo}`)).toEqual(['B1-1', 'B1-2'])
    expect(drillTargets([{ contexts: [{ ...ctx('A1', 1, 1), count: null as unknown as number }] }])[0].count).toBe(1)
    expect(drillTargets([])).toEqual([])
    expect(drillTargets([{ contexts: [] }])).toEqual([])
  })
})
