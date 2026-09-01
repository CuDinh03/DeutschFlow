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
