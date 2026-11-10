/** telc A2 (đợt 4) — phép thuần của màn làm đề: dạng Teil, form `form_<i>`, số từ gợi ý, chọn 3 trong 4 ý. */
import { describe, expect, it } from 'vitest'
import {
  formAnswers, formKey, formProgress, formResults, kindOf, needsTrueFalse, pointsMissing, withTrueFalse, writingTarget,
  type PracticeTeilData,
} from './practiceModel'
import { teilProgress, type FullTeil } from './fullExamModel'

const form: PracticeTeilData = {
  teil: 1, type: 'FILL_FORM', context: 'Anna Berg wohnt in Graz.', form_title: 'Anmeldung',
  form_fields: [{ field: 'Name' }, { field: 'Wohnort' }, { field: 'Telefon' }],
}

describe('kindOf — telc A2', () => {
  it('Lesen TRUE_FALSE dựng như trắc nghiệm từng câu', () => {
    expect(kindOf({ type: 'TRUE_FALSE' }, 'LESEN-2')).toBe('mc')
    expect(needsTrueFalse({ type: 'TRUE_FALSE' }, 'LESEN-2')).toBe(true)
    expect(needsTrueFalse({ type: 'MULTIPLE_CHOICE' }, 'LESEN-1')).toBe(false)
  })
  it('Schreiben FILL_FORM → form; WRITE_NOTE và thư B1 → writing', () => {
    expect(kindOf(form, 'SCHREIBEN-1')).toBe('form')
    expect(kindOf({ type: 'WRITE_NOTE' }, 'SCHREIBEN-2')).toBe('writing')
    expect(kindOf({}, 'SCHREIBEN-1')).toBe('writing')
  })
  it('withTrueFalse gắn richtig/falsch cho câu TRUE_FALSE', () => {
    const t = withTrueFalse({ type: 'TRUE_FALSE', items: [{ id: 'LV2-6', question: 'Anna fährt nach Wien.' }] })
    expect(t.items?.[0].options).toEqual({ richtig: 'Richtig', falsch: 'Falsch' })
  })
})

describe('form A2', () => {
  it('khoá form_<i>, đếm ô đã điền, chỉ gửi ô có chữ', () => {
    expect(formKey(2)).toBe('form_2')
    const answers = { form_0: 'Anna Berg', form_1: '  ', form_2: '0316 123', LV1: 'x' }
    expect(formProgress(form, answers)).toEqual({ done: 2, total: 3 })
    expect(formAnswers(form, answers)).toEqual({ form_0: 'Anna Berg', form_2: '0316 123' })
  })
  it('thi thử: tiến độ Teil form đếm theo ô', () => {
    const t: FullTeil = { key: 'SCHREIBEN-1', section: 'SCHREIBEN', sectionIndex: 1, no: 1, data: form }
    expect(teilProgress(t, { form_0: 'Anna' })).toEqual({ done: 1, total: 3 })
  })
  it('kết quả từng ô nếu server trả theo id form_<i>; không có thì null', () => {
    const r = formResults(form, {
      items: [{ id: 'form_0', label: '1', given: 'Ana Berg', givenText: null, correct: 'Anna Berg', correctText: null, answered: true,
        isCorrect: true, points: 1, whyRight: null, whyWrong: null, trap: null, evidence: [], need: null, rule: null }],
    })
    expect(r[0]).toEqual({ given: 'Ana Berg', answer: 'Anna Berg', isCorrect: true })
    expect(r[1].isCorrect).toBeNull()
  })
})

describe('Viết A2', () => {
  it('số từ gợi ý theo word_target (A2 40), mặc định 80', () => {
    expect(writingTarget({ word_target: 40 })).toBe(40)
    expect(writingTarget({})).toBe(80)
    expect(writingTarget(null)).toBe(80)
  })
  it('chọn 3 trong 4 ý: đủ 3 dấu là đủ; thư B1 cần cả 4', () => {
    const pts = [{ label: 'P1' }, { label: 'P2' }, { label: 'P3' }, { label: 'P4' }]
    const three = { P1: true, P2: true, P4: true }
    expect(pointsMissing(pts, three, 3)).toBe(false)
    expect(pointsMissing(pts, three)).toBe(true)
    expect(pointsMissing(pts, { P1: true }, 3)).toBe(true)
  })
})
