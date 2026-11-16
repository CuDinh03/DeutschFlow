import { describe, expect, it } from 'vitest'
import { MAX_RELATED, examForWorkplace, exampleQuestion, guideForOccupation, relatedOccupations, tidyQuotedSentenceEnd } from '@/lib/occupationRelated'
import type { OccupationSummary } from '@/lib/occupationTypes'

const occ = (code: string, workplace: OccupationSummary['workplace'], questionSet: OccupationSummary['questionSet'] = 'GENERAL'): OccupationSummary => ({
  code, nameDe: code, nameEn: code, nameVi: code, workplace, aliases: [], questionSet,
})

const ALL = [
  occ('koch', 'gastro', 'CURATED'),
  occ('kellner', 'gastro', 'CURATED'),
  occ('barkeeper', 'gastro'),
  occ('konditor', 'gastro'),
  occ('baecker', 'gastro'),
  occ('metzger', 'gastro'),
  occ('sous_chef', 'gastro'),
  occ('pflegefachkraft', 'pflege'),
]

describe('relatedOccupations', () => {
  it('cùng nơi làm việc, bỏ chính nó, chỉ trang được lập chỉ mục, tối đa 5', () => {
    const indexable = ALL.filter((o) => o.code !== 'barkeeper').map((o) => ({ code: o.code, lastModified: null }))
    const r = relatedOccupations({ code: 'koch', workplace: 'gastro' }, ALL, indexable)
    expect(r.map((o) => o.code)).toEqual(['kellner', 'konditor', 'baecker', 'metzger', 'sous_chef'])
    expect(r.length).toBeLessThanOrEqual(MAX_RELATED)
  })

  it('thiếu danh sách lập chỉ mục thì chỉ dẫn tới nghề có bộ viết tay', () => {
    const r = relatedOccupations({ code: 'koch', workplace: 'gastro' }, ALL, null)
    expect(r.map((o) => o.code)).toEqual(['kellner'])
  })

  it('backend lỗi (null) thì không có khối', () => {
    expect(relatedOccupations({ code: 'koch', workplace: 'gastro' }, null, null)).toEqual([])
  })
})

describe('liên kết cụm chủ đề', () => {
  it('trang nghề bếp dẫn sang bài Cẩm nang nghề bếp; nghề không có bài thì không', () => {
    expect(guideForOccupation('koch')?.slug).toBe('phong-van-tieng-duc-nghe-bep')
    expect(guideForOccupation('maurer')).toBeUndefined()
  })

  it('nghề điều dưỡng dẫn sang telc Pflege', () => {
    expect(examForWorkplace('pflege')?.slug).toBe('telc-pflege-b1-b2')
    expect(examForWorkplace('gastro')).toBeUndefined()
  })
})

describe('exampleQuestion', () => {
  it('bỏ câu mời giới thiệu, lấy câu tiêu biểu kế tiếp', () => {
    expect(exampleQuestion({
      sampleQuestions: [
        { phase: 'INTRO', source: 'BANK', questionDe: 'Stellen Sie sich vor.' },
        { phase: 'HARD_SKILLS', source: 'BANK', questionDe: 'Wie organisieren Sie die Station?' },
      ],
      occupationQuestions: [],
    })).toBe('Wie organisieren Sie die Station?')
  })

  it('không có câu tiêu biểu thì lấy câu lớp nghề đã duyệt, không lấy câu AI chưa duyệt', () => {
    expect(exampleQuestion({
      sampleQuestions: [{ phase: 'INTRO', source: 'BANK', questionDe: 'Stellen Sie sich vor.' }],
      occupationQuestions: [
        { difficulty: 'BEGINNER', status: 'AI_GENERATED', questionDe: 'KI-Frage' },
        { difficulty: 'BEGINNER', status: 'APPROVED', questionDe: 'Geprüfte Frage' },
      ],
    })).toBe('Geprüfte Frage')
    expect(exampleQuestion({ sampleQuestions: [], occupationQuestions: [] })).toBeNull()
  })
})

describe('tidyQuotedSentenceEnd', () => {
  it('bỏ dấu chấm thừa sau ngoặc khi câu trích đã có dấu kết (".“." và "?“.")', () => {
    expect(tidyQuotedSentenceEnd('zum Beispiel: „Nennen Sie einen Vorfall.“. Die Fragen können abweichen.'))
      .toBe('zum Beispiel: „Nennen Sie einen Vorfall.“ Die Fragen können abweichen.')
    expect(tidyQuotedSentenceEnd('ví dụ: „Wie organisieren Sie die Station?“. Câu hỏi có thể khác.'))
      .toBe('ví dụ: „Wie organisieren Sie die Station?“ Câu hỏi có thể khác.')
    expect(tidyQuotedSentenceEnd('for example: “How do you handle it?”. Questions may differ.'))
      .toBe('for example: “How do you handle it?” Questions may differ.')
  })

  it('giữ nguyên khuôn không có dấu chấm sau ngoặc và câu trích không có dấu kết', () => {
    expect(tidyQuotedSentenceEnd('Ein Beispiel: „Wie organisieren Sie die Station?“'))
      .toBe('Ein Beispiel: „Wie organisieren Sie die Station?“')
    expect(tidyQuotedSentenceEnd('zum Beispiel: „Stoßzeit“. Danach')).toBe('zum Beispiel: „Stoßzeit“. Danach')
  })
})
