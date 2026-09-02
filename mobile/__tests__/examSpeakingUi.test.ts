// Khoá các quyết định hiển thị thuần của Luyện thi Nói — đồng hồ neo giờ server,
// sort level, tông màu điểm, và trích stimulus degrade êm với kiểu lạ.

import {
  criterionRatio,
  formatClock,
  levelsFromBlueprints,
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
