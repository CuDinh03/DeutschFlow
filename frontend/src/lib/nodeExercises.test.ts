import { describe, expect, test } from 'vitest'
import {
  buildItemAnswers,
  collectExercises,
  correctIndexOf,
  gradeItems,
  isFillCorrect,
  isScored,
  normalizeAnswer,
  questionTextOf,
  type NodeExerciseItem,
} from '@/lib/nodeExercises'

/**
 * Mục lấy NGUYÊN VĂN từ migration prod (V100__satellite_gastronomie_2_service.sql) — đây chính là
 * hình dạng dữ liệu thật mà web đang chấm sai.
 */
const MC_THAT: NodeExerciseItem = {
  id: 'sat_g2_01',
  type: 'MULTIPLE_CHOICE',
  question_vi: 'Khách phàn nàn đồ ăn nguội. Bạn nói gì?',
  options: [
    'Das ist normal.',
    'Das tut mir leid! Ich bringe sofort ein neues Gericht.',
    'Sie haben bestellt, was Sie bekommen.',
    'Warten Sie bitte.',
  ],
  correct: 1,
}

const FILL_THAT: NodeExerciseItem = {
  id: 'rq_sg3_01',
  type: 'FILL_BLANK',
  question_vi: 'Reinheitsgebot ra đời năm nào?',
  answer: '1516',
  accept_also: ['fünfzehnhundert sechzehn'],
}

describe('correctIndexOf — hồi quy cho F-21', () => {
  test('đọc khoá `correct` của nội dung thật', () => {
    expect(correctIndexOf(MC_THAT)).toBe(1)
  })

  test('chấp nhận `correct` = 0 chứ không nhầm thành "không có đáp án"', () => {
    expect(correctIndexOf({ type: 'MULTIPLE_CHOICE', correct: 0 })).toBe(0)
  })

  test('vẫn đỡ được khoá cũ `answerIndex` (chỉ còn 2 mục trong migration)', () => {
    expect(correctIndexOf({ type: 'MULTIPLE_CHOICE', answerIndex: 2 })).toBe(2)
  })

  test('không có khoá nào thì trả null, không trả undefined lặng lẽ', () => {
    expect(correctIndexOf({ type: 'MULTIPLE_CHOICE' })).toBeNull()
  })
})

describe('gradeItems', () => {
  test('trả lời đúng mục thật được tính điểm — trước bản vá luôn ra 0', () => {
    expect(gradeItems([MC_THAT], { 0: 1 })).toEqual({ scored: 1, correct: 1, percent: 100 })
  })

  test('trả lời sai không được tính', () => {
    expect(gradeItems([MC_THAT], { 0: 3 })).toEqual({ scored: 1, correct: 0, percent: 0 })
  })

  test('chưa trả lời không được tính nhưng vẫn nằm trong mẫu số', () => {
    expect(gradeItems([MC_THAT, FILL_THAT], { 0: 1 })).toEqual({ scored: 2, correct: 1, percent: 50 })
  })

  test('FILL_BLANK chấm theo answer + accept_also, bỏ qua hoa thường và dấu câu', () => {
    expect(gradeItems([FILL_THAT], { 0: '1516' }).correct).toBe(1)
    expect(gradeItems([FILL_THAT], { 0: '  Fünfzehnhundert Sechzehn.  ' }).correct).toBe(1)
    expect(gradeItems([FILL_THAT], { 0: '1517' }).correct).toBe(0)
  })

  test('mục thiếu `id` không chấm được — khớp countScored của backend', () => {
    const khongId: NodeExerciseItem = { type: 'MULTIPLE_CHOICE', options: ['a', 'b'], correct: 0 }
    expect(gradeItems([khongId], { 0: 0 })).toEqual({ scored: 0, correct: 0, percent: 0 })
  })

  test('loại không chấm được (SPEAKING…) bị bỏ qua', () => {
    expect(gradeItems([{ id: 'x', type: 'SPEAKING' }], { 0: 'gì đó' }).scored).toBe(0)
  })
})

describe('collectExercises', () => {
  test('gộp theory_gate TRƯỚC rồi practice — đúng thứ tự backend chấm', () => {
    const items = collectExercises({
      theory_gate: [{ id: 'g1', type: 'MULTIPLE_CHOICE' }],
      practice: [{ id: 'p1', type: 'FILL_BLANK' }],
    })
    expect(items.map((i) => i.id)).toEqual(['g1', 'p1'])
  })

  test('web trước đây bỏ hẳn theory_gate — nay phải có mặt', () => {
    const items = collectExercises({ theory_gate: [{ id: 'g1', type: 'MULTIPLE_CHOICE' }], practice: [] })
    expect(items).toHaveLength(1)
  })

  test('thiếu trường, sai kiểu, hay null đều không làm vỡ', () => {
    expect(collectExercises(undefined)).toEqual([])
    expect(collectExercises({ theory_gate: 'hỏng', practice: null })).toEqual([])
    expect(collectExercises({ practice: [null, { type: 'MULTIPLE_CHOICE' }] })).toHaveLength(1)
  })
})

describe('questionTextOf', () => {
  test('nội dung thật dùng question_vi', () => {
    expect(questionTextOf(MC_THAT)).toBe('Khách phàn nàn đồ ăn nguội. Bạn nói gì?')
  })

  test('ưu tiên question khi có', () => {
    expect(questionTextOf({ question: 'A', question_vi: 'B' })).toBe('A')
  })

  test('không có câu nào thì null để nơi gọi tự quyết, thay vì hiện "Câu hỏi..."', () => {
    expect(questionTextOf({})).toBeNull()
  })
})

describe('buildItemAnswers — payload gửi /skill-tree/{nodeId}/submit', () => {
  test('khoá theo id của mục, đúng thứ backend tra', () => {
    expect(buildItemAnswers([MC_THAT, FILL_THAT], { 0: 1, 1: '1516' })).toEqual({
      sat_g2_01: { choice: 1 },
      rq_sg3_01: { text: '1516' },
    })
  })

  test('mục chưa trả lời vẫn gửi, để máy chủ tính đúng mẫu số', () => {
    expect(buildItemAnswers([MC_THAT, FILL_THAT], {})).toEqual({
      sat_g2_01: { choice: -1 },
      rq_sg3_01: { text: '' },
    })
  })

  test('bỏ qua mục không chấm được', () => {
    expect(buildItemAnswers([{ id: 's', type: 'SPEAKING' }], { 0: 'x' })).toEqual({})
  })
})

describe('normalizeAnswer / isFillCorrect — phản chiếu backend', () => {
  test('chuẩn hoá giống NodeExerciseGrader.normalize', () => {
    expect(normalizeAnswer('  Das  ist,  gut!  ')).toBe('das ist gut')
  })

  test('chuỗi rỗng không bao giờ đúng', () => {
    expect(isFillCorrect('   ', FILL_THAT)).toBe(false)
  })

  test('isScored khớp countScored: cần cả id lẫn loại chấm được', () => {
    expect(isScored(MC_THAT)).toBe(true)
    expect(isScored({ type: 'MULTIPLE_CHOICE' })).toBe(false)
    expect(isScored({ id: 'a', type: 'REORDER' })).toBe(false)
  })
})

describe('scoredExercises — hồi quy từ nghiệm thu prod node 136', () => {
  test('loại TRANSLATE/REORDER: backend không chấm, web chưa có runner ⇒ không đưa ra', async () => {
    const { scoredExercises } = await import('@/lib/nodeExercises')
    const items = scoredExercises({
      theory_gate: [
        { id: 'tg31_01', type: 'FILL_BLANK', answer: 'dem', sentence_de: 'Ich helfe ___ Mann.' },
        { id: 'tg31_02', type: 'MULTIPLE_CHOICE', question_vi: 'Giới từ nào?', options: ['a'], correct: 0 },
      ],
      practice: [
        { id: 'p31_01', type: 'TRANSLATE', sentence: '…', answer: '…' },
        { id: 'p31_02', type: 'REORDER', words: ['a'], correct_order: ['a'] },
        { id: 'p31_03', type: 'FILL_BLANK', answer: 'der', sentence_de: '… ___ …' },
      ],
    })
    expect(items.map((i) => i.id)).toEqual(['tg31_01', 'tg31_02', 'p31_03'])
  })

  test('mẫu số hiển thị bằng đúng số mục chấm được — 6/8 trên prod là sai', async () => {
    const { scoredExercises, gradeItems } = await import('@/lib/nodeExercises')
    const items = scoredExercises({
      theory_gate: [{ id: 'a', type: 'MULTIPLE_CHOICE', options: ['x', 'y'], correct: 1 }],
      practice: [{ id: 'b', type: 'TRANSLATE', answer: 'z' }],
    })
    expect(items).toHaveLength(1)
    const g = gradeItems(items, { 0: 1 })
    expect(g).toEqual({ scored: 1, correct: 1, percent: 100 })
  })
})

describe('selfCheckExercises — TRANSLATE / REORDER (máy chủ không chấm)', () => {
  // Hình dạng lấy nguyên văn từ node 136 trên prod.
  const DL = {
    theory_gate: [{ id: 'tg31_02', type: 'MULTIPLE_CHOICE', options: ['a', 'b'], correct: 1 }],
    practice: [
      { id: 'p31_01', type: 'TRANSLATE', from: 'vi', sentence: 'Tôi giúp người đàn ông.', answer: 'Ich helfe dem Mann.', accept_also: [] },
      { id: 'p31_02', type: 'REORDER', words: ['gehört', 'Das', 'Buch', 'mir'], correct_order: ['Das', 'Buch', 'gehört', 'mir'], translation: 'Quyển sách là của tôi.' },
      { id: 'p31_03', type: 'FILL_BLANK', answer: 'der', sentence_de: '… ___ …' },
    ],
  }

  test('TRANSLATE lấy đề từ `sentence` và đáp án từ `answer`', async () => {
    const { selfCheckExercises } = await import('@/lib/nodeExercises')
    const t = selfCheckExercises(DL).find((x) => x.id === 'p31_01')
    expect(t).toEqual({
      id: 'p31_01',
      kind: 'TRANSLATE',
      prompt: 'Tôi giúp người đàn ông.',
      words: null,
      answer: 'Ich helfe dem Mann.',
    })
  })

  test('REORDER lấy đề từ `translation`, các từ từ `words`, đáp án ghép từ `correct_order`', async () => {
    const { selfCheckExercises } = await import('@/lib/nodeExercises')
    const r = selfCheckExercises(DL).find((x) => x.id === 'p31_02')
    expect(r).toEqual({
      id: 'p31_02',
      kind: 'REORDER',
      prompt: 'Quyển sách là của tôi.',
      words: ['gehört', 'Das', 'Buch', 'mir'],
      answer: 'Das Buch gehört mir',
    })
  })

  test('KHÔNG lẫn mục chấm được vào nhóm tự kiểm tra, và ngược lại', async () => {
    const { selfCheckExercises, scoredExercises } = await import('@/lib/nodeExercises')
    expect(selfCheckExercises(DL).map((x) => x.id)).toEqual(['p31_01', 'p31_02'])
    expect(scoredExercises(DL).map((x) => x.id)).toEqual(['tg31_02', 'p31_03'])
  })

  test('mục tự kiểm tra KHÔNG được tính vào điểm — mẫu số vẫn là số mục chấm được', async () => {
    const { scoredExercises, gradeItems } = await import('@/lib/nodeExercises')
    const items = scoredExercises(DL)
    expect(gradeItems(items, { 0: 1, 1: 'der' })).toEqual({ scored: 2, correct: 2, percent: 100 })
  })

  test('bỏ mục thiếu đáp án — thà không hiện còn hơn hiện thẻ trống', async () => {
    const { selfCheckExercises } = await import('@/lib/nodeExercises')
    expect(selfCheckExercises({ practice: [{ id: 'x', type: 'TRANSLATE', sentence: 'a' }] })).toEqual([])
    expect(selfCheckExercises({ practice: [{ id: 'y', type: 'REORDER', words: ['a'] }] })).toEqual([])
  })
})
