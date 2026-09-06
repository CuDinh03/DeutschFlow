import { attemptTotalScore, mapExam, type AttemptResultDto, type RawMockExam } from '@/lib/examApi'

describe('mapExam', () => {
  it('maps snake_case backend row to ExamVariant', () => {
    const raw: RawMockExam = {
      id: 7,
      cefr_level: 'B1',
      title: 'Goethe B1 Modellsatz',
      time_limit_minutes: 90,
      total_questions: 60,
    }

    expect(mapExam(raw)).toEqual({
      id: 7,
      title: 'Goethe B1 Modellsatz',
      cefrLevel: 'B1',
      totalQuestions: 60,
      timeLimitMinutes: 90,
    })
  })

  it('defaults totalQuestions to 0 when the backend omits it', () => {
    const raw: RawMockExam = {
      id: 1,
      cefr_level: 'A1',
      title: 'A1 Test',
      time_limit_minutes: 60,
    }

    expect(mapExam(raw).totalQuestions).toBe(0)
  })
})

describe('attemptTotalScore (F-10a soát 02/09)', () => {
  it('đọc đúng khoá snake_case `total_score` của ExamResultDto backend', () => {
    const result: AttemptResultDto = { total_score: 42, status: 'COMPLETED' }
    expect(attemptTotalScore(result)).toBe(42)
  })

  it('điểm chưa có (job đang chấm) hoặc thiếu → 0, không NaN/undefined', () => {
    expect(attemptTotalScore({ total_score: null, status: 'IN_PROGRESS' })).toBe(0)
    expect(attemptTotalScore({})).toBe(0)
    expect(attemptTotalScore(null)).toBe(0)
  })

  it('hồi quy: khoá camelCase `totalScore` KHÔNG tồn tại trong hợp đồng — không được đọc ra điểm', () => {
    // Đây chính là lỗi cũ: màn kết quả đọc `totalScore` nên luôn hiện 0.
    const wrongShape = { totalScore: 42 } as unknown as AttemptResultDto
    expect(attemptTotalScore(wrongShape)).toBe(0)
  })
})

// ── AC-MOBFIX-03 (06/09): sanitizer backend (từ 06/2026) strip `correct` và sinh `type`
// (MULTIPLE_CHOICE / RICHTIG_FALSCH / MATCHING); options trong seed là OBJECT {A,B,C}.
// Parser cũ chỉ nhận options MẢNG hoặc `correct` richtig/falsch → 0 nhóm → mọi đề "Chưa hỗ trợ trên app".
import { itemChoices, parseLesenItems } from '@/lib/examApi'

const SANITIZED = JSON.stringify({
  sections: [
    {
      name: 'HOEREN',
      teile: [{ type: 'AUDIO_MC', items: [{ id: 'H1-1', question: 'Hören?', options: { A: 'a', B: 'b' }, type: 'MULTIPLE_CHOICE' }] }],
    },
    {
      name: 'LESEN',
      teile: [
        { teil: 1, type: 'MATCH', title: 'Teil 1', items: [{ id: 'L1-1', question: 'Jeder dritte Arbeitnehmer arbeitet von zu Hause.', points: 1, type: 'RICHTIG_FALSCH' }] },
        { teil: 2, type: 'MATCH_PERSON', items: [{ id: 'L2-1', person: 'Kenji hat Informatik studiert.', points: 1, type: 'MATCHING' }] },
        {
          teil: 3,
          type: 'MULTIPLE_CHOICE',
          title: 'Teil 3',
          items: [{ id: 'L3-1', question: 'Wie lange hat die Reise gedauert?', options: { A: 'Zwei Wochen', B: 'Drei Wochen', C: 'Einen Monat' }, points: 1, type: 'MULTIPLE_CHOICE' }],
        },
      ],
    },
  ],
})

describe('parseLesenItems — dữ liệu đã qua sanitizer (không có correct, options object)', () => {
  const parsed = parseLesenItems(SANITIZED)

  it('bóc được Teil 1 (richtig/falsch theo type) và Teil 3 (trắc nghiệm options object); bỏ MATCHING', () => {
    expect(parsed.groups.map((g) => g.title)).toEqual(['Teil 1', 'Teil 3'])
    expect(parsed.skippedSections).toEqual(['HOEREN'])
  })

  it('trắc nghiệm: nhãn = giá trị object, khoá chữ cái giữ riêng để nộp', () => {
    const mc = parsed.groups[1].items[0]
    expect(mc.options).toEqual(['Zwei Wochen', 'Drei Wochen', 'Einen Monat'])
    expect(mc.optionKeys).toEqual(['A', 'B', 'C'])
  })

  it('đúng/sai: không options, không khoá', () => {
    const tf = parsed.groups[0].items[0]
    expect(tf.options).toBeUndefined()
    expect(tf.optionKeys).toBeUndefined()
  })
})

describe('parseLesenItems — định dạng cũ vẫn chạy', () => {
  it('options mảng + correct còn nguyên → nhãn = giá trị nộp', () => {
    const legacy = JSON.stringify({
      sections: [{ name: 'LESEN', teile: [{ items: [{ id: 'L1', question: 'Q?', options: ['x', 'y'], correct: 'x' }, { id: 'L2', question: 'TF?', correct: 'falsch' }] }] }],
    })
    const g = parseLesenItems(legacy).groups[0]
    expect(g.items.map((i) => i.id)).toEqual(['L1', 'L2'])
    expect(g.items[0].optionKeys).toBeUndefined()
  })
})

describe('itemChoices — giá trị nộp khớp ExamScoringService.equalsIgnoreCase(correct)', () => {
  it('trắc nghiệm object: nộp chữ cái, hiện "A. nhãn"', () => {
    expect(itemChoices({ id: 'x', question: 'q', options: ['Zwei', 'Drei'], optionKeys: ['A', 'B'] })).toEqual([
      { value: 'A', label: 'A. Zwei' },
      { value: 'B', label: 'B. Drei' },
    ])
  })
  it('đúng/sai: nộp richtig/falsch', () => {
    expect(itemChoices({ id: 'x', question: 'q' })).toEqual([
      { value: 'richtig', label: 'Richtig' },
      { value: 'falsch', label: 'Falsch' },
    ])
  })
  it('options mảng cũ: nộp chính nhãn', () => {
    expect(itemChoices({ id: 'x', question: 'q', options: ['x', 'y'] })).toEqual([
      { value: 'x', label: 'x' },
      { value: 'y', label: 'y' },
    ])
  })
})
