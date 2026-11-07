import { describe, expect, it } from 'vitest'
import { fullTeile, resumeIndex, teilProgress, unansweredCount, writingKey } from './fullExamModel'
import { TRUE_FALSE_OPTIONS, kindOf, withTrueFalse } from './practiceModel'

const EXAM = JSON.stringify({
  sections: [
    { name: 'LESEN', teile: [{ teil: 1, type: 'MATCH_HEADLINE', items: [{ id: 'LV1-1' }, { id: 'LV1-2' }] }] },
    { name: 'SPRACHBAUSTEINE', teile: [{ teil: 1, type: 'GAP_MC', items: [{ id: 'SB1-21' }] }] },
    {
      name: 'HOEREN',
      teile: [
        { teil: 1, max_plays: 1, items: [{ id: 'HV1-41', audio_script: 'Nummer 41.' }, { id: 'HV1-42' }] },
        { teil: 2, items: [{ id: 'HV2-46', options: { a: 'A', b: 'B' } }] },
      ],
    },
    { name: 'SCHREIBEN', teile: [{ teil: 1, writing_points: ['P1'] }] },
    { name: 'SPRECHEN', teile: [{ teil: 1 }] },
  ],
})

describe('thi thử trọn đề — danh sách Teil', () => {
  it('theo thứ tự đề, bỏ Sprechen (thi ở phòng thi nói), khoá giống chế độ luyện', () => {
    const list = fullTeile(EXAM)
    expect(list.map((x) => x.key)).toEqual(['LESEN-1', 'SPRACHBAUSTEINE-1', 'HOEREN-1', 'HOEREN-2', 'SCHREIBEN-1'])
    expect(list.find((x) => x.key === 'HOEREN-2')?.sectionIndex).toBe(2)
  })

  it('đếm câu đã làm; bài Viết tính là xong khi có chữ ở khoá email_<teil>', () => {
    const list = fullTeile(EXAM)
    const answers = { 'LV1-1': 'a', 'HV1-41': 'richtig', [writingKey(1)]: 'Liebe Lena' }
    expect(teilProgress(list[0], answers)).toEqual({ done: 1, total: 2 })
    expect(teilProgress(list[4], answers)).toEqual({ done: 1, total: 1 })
    expect(teilProgress(list[4], {})).toEqual({ done: 0, total: 1 })
    expect(unansweredCount(list, answers)).toBe(4) // LV1-2, SB1-21, HV1-42, HV2-46
  })

  it('làm tiếp từ Teil đầu của phần đã lưu trong nháp; chỉ số lạ thì về đầu đề', () => {
    const list = fullTeile(EXAM)
    expect(resumeIndex(list, 2)).toBe(2)
    expect(resumeIndex(list, 9)).toBe(0)
  })

  it('JSON hỏng hoặc rỗng ⇒ không có Teil nào', () => {
    expect(fullTeile('{')).toEqual([])
    expect(fullTeile(null)).toEqual([])
  })
})

describe('Hören trong giao diện mới', () => {
  it('dựng như trắc nghiệm từng câu', () => {
    expect(kindOf({ items: [] }, 'HOEREN-1')).toBe('mc')
    expect(kindOf(null, 'HOEREN-1')).toBe('unknown')
  })

  it('câu không khai lựa chọn được gắn richtig/falsch; câu có sẵn a/b/c giữ nguyên', () => {
    const teil = fullTeile(EXAM).find((x) => x.key === 'HOEREN-1')!.data
    const withOpts = withTrueFalse(teil)
    expect(withOpts.items?.[0].options).toEqual(TRUE_FALSE_OPTIONS)
    expect(withOpts.items?.[0].audio_script).toBe('Nummer 41.')

    const mc = fullTeile(EXAM).find((x) => x.key === 'HOEREN-2')!.data
    expect(withTrueFalse(mc)).toBe(mc)
  })
})
