/**
 * Đề định dạng telc trên app điện thoại (15/09/2026).
 *
 * Trước đợt này app chỉ bóc `LESEN`, nên một đề telc chỉ làm được 75 trong 225 điểm — không tài
 * nào chạm ngưỡng đỗ 135. Và riêng dạng ghép nối thì còn SAI LẶNG LẼ: kho lựa chọn nằm ở cấp Teil
 * (`headlines`/`ads`/`word_bank`) nên parser cũ không thấy, rơi xuống 5 nút chữ cái A–E mặc định —
 * sai cả số lượng, sai cả chữ hoa/thường, và không hiện một dòng tiêu đề nào.
 */
import { describe, it, expect } from '@jest/globals'
import { parseExamSections, itemChoices } from '@/lib/examApi'

const TELC = JSON.stringify({
  format: 'TELC',
  blocks: [
    { id: 'LV_SB', minutes: 90, sections: ['LESEN', 'SPRACHBAUSTEINE'] },
    { id: 'PAUSE', minutes: 20 },
    { id: 'HV', minutes: 30, sections: ['HOEREN'] },
    { id: 'SA', minutes: 30, sections: ['SCHREIBEN'] },
  ],
  sections: [
    {
      name: 'LESEN', max_points: 75,
      teile: [
        { teil: 1, type: 'MATCH_HEADLINE',
          headlines: { c: 'Weniger Autos', a: 'Mehr Fahrräder', j: 'Neues Museum' },
          items: [{ id: 'LV1-1', question: 'Text 1', type: 'MATCHING' }] },
        { teil: 3, type: 'MATCH_AD_X', ads: { a: 'Zimmer frei', b: 'Klavierunterricht' }, allow_none: true,
          items: [{ id: 'LV3-11', question: 'Situation 11', type: 'MATCHING' }] },
      ],
    },
    {
      name: 'SPRACHBAUSTEINE', max_points: 30,
      teile: [
        { teil: 1, type: 'GAP_MC', gapped_text: 'Ich schreibe ___21___ ich krank bin.',
          items: [{ id: 'SB1-21', options: { a: 'weil', b: 'denn', c: 'obwohl' }, type: 'MULTIPLE_CHOICE' }] },
        { teil: 2, type: 'GAP_WORDBANK', gapped_text: 'Ich gebe Ihnen ___31___ .',
          word_bank: { a: 'Bescheid', o: 'verschieben' },
          items: [{ id: 'SB2-31', type: 'MATCHING' }] },
      ],
    },
    {
      name: 'HOEREN', max_points: 75,
      teile: [
        { teil: 1, max_plays: 1, audio_script: 'Guten Tag, hier ist das Kino.',
          items: [{ id: 'HV1-1', question: 'Richtig?', type: 'RICHTIG_FALSCH' }] },
        { teil: 2, max_plays: 2,
          audio_script: [{ speaker: 'PRUEFER', name: 'Moderatorin', text: 'Guten Tag.' },
                         { speaker: 'PARTNER', name: 'Herr Lang', text: 'Ja, gern.' }],
          items: [{ id: 'HV2-1', question: 'Richtig?', type: 'RICHTIG_FALSCH' }] },
      ],
    },
    {
      name: 'SCHREIBEN', max_points: 45,
      teile: [{ teil: 1, instruction_vi: 'Viết một bức thư', prompt: 'Sie möchten einen Termin verschieben.',
                writing_points: ['Grund nennen', 'Neuen Termin vorschlagen'] }],
    },
  ],
})

const parsed = parseExamSections(TELC)
const sec = (name: string) => parsed.sections.find((s) => s.name === name)!

describe('đề telc: bóc đủ bốn phần viết', () => {
  it('cả bốn phần đều dựng được, không phần nào bị bỏ', () => {
    expect(parsed.sections.map((s) => s.name)).toEqual(['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'])
    expect(parsed.skippedSections).toEqual([])
  })

  it('mang theo thang điểm và tên người đọc được của từng phần', () => {
    expect(sec('SPRACHBAUSTEINE').maxPoints).toBe(30)
    expect(sec('SPRACHBAUSTEINE').label).toBe('Ngữ pháp – từ vựng')
    expect(sec('SCHREIBEN').label).toBe('Viết')
  })

  it('bóc được các khối thời gian 90/20/30/30', () => {
    expect(parsed.blocks?.map((b) => b.minutes)).toEqual([90, 20, 30, 30])
    expect(parsed.blocks?.[0].sections).toEqual(['LESEN', 'SPRACHBAUSTEINE'])
  })
})

describe('ghép tiêu đề và mẩu rao vặt', () => {
  it('lựa chọn là kho của CẢ TEIL, xếp theo chữ cái, kèm nội dung — không phải A–E rỗng như trước', () => {
    const item = sec('LESEN').groups[0].items[0]
    expect(item.optionKeys).toEqual(['a', 'c', 'j'])
    expect(item.options).toEqual(['Mehr Fahrräder', 'Weniger Autos', 'Neues Museum'])
    expect(itemChoices(item)[0]).toEqual({ value: 'a', label: 'a. Mehr Fahrräder' })
  })

  it('Teil ghép mẩu rao vặt được đánh dấu cho thêm đáp án x, và khoá mỗi lựa chọn một lần', () => {
    const g = sec('LESEN').groups[1]
    expect(g.telcType).toBe('MATCH_AD_X')
    expect(g.allowNone).toBe(true)
    expect(g.singleUse).toBe(true)
  })
})

describe('hai dạng điền khuyết', () => {
  it('GAP_MC giữ văn bản có ô trống và bộ a/b/c của từng ô', () => {
    const g = sec('SPRACHBAUSTEINE').groups[0]
    expect(g.gappedText).toBe('Ich schreibe ___21___ ich krank bin.')
    expect(g.items[0].gap).toBe(21)
    expect(g.items[0].optionKeys).toEqual(['a', 'b', 'c'])
  })

  it('GAP_WORDBANK dùng chung hộp từ; câu không có đề bài thì nhãn là số ô', () => {
    const g = sec('SPRACHBAUSTEINE').groups[1]
    expect(g.pool?.map((o) => o.key)).toEqual(['a', 'o'])
    expect(g.items[0].gap).toBe(31)
    expect(g.items[0].question).toBe('Ô trống 31')
    expect(g.items[0].options).toEqual(['Bescheid', 'verschieben'])
  })
})

describe('phần Nghe', () => {
  it('mang theo số lần được nghe của từng Teil', () => {
    expect(sec('HOEREN').groups[0].maxPlays).toBe(1)
    expect(sec('HOEREN').groups[1].maxPlays).toBe(2)
  })

  it('nhận cả kịch bản một giọng lẫn kịch bản hai người nói', () => {
    expect(sec('HOEREN').groups[0].audio).toBe('Guten Tag, hier ist das Kino.')
    expect(Array.isArray(sec('HOEREN').groups[1].audio)).toBe(true)
  })
})

describe('phần Viết', () => {
  it('bóc được đề bài, các ý bắt buộc, và khoá nộp đúng hợp đồng server', () => {
    const task = sec('SCHREIBEN').writing[0]
    expect(task.answerKey).toBe('email_1')
    expect(task.prompt).toBe('Sie möchten einen Termin verschieben.')
    expect(task.points).toEqual(['Grund nennen', 'Neuen Termin vorschlagen'])
  })
})

describe('đề Goethe không đổi', () => {
  it('Teil điền form của A1/A2 vẫn chưa dựng trên app, và phần đó được khai là bỏ qua', () => {
    const goethe = JSON.stringify({
      sections: [{ name: 'SCHREIBEN', teile: [{ teil: 1, form_fields: [{ field: 'Vorname' }] }] }],
    })
    const p = parseExamSections(goethe)
    expect(p.sections).toEqual([])
    expect(p.skippedSections).toEqual(['SCHREIBEN'])
  })

  it('phần Nói vẫn nằm ngoài — cần thu âm, thuộc module luyện thi nói', () => {
    const p = parseExamSections(JSON.stringify({ sections: [{ name: 'SPRECHEN', teile: [{ teil: 1 }] }] }))
    expect(p.skippedSections).toEqual(['SPRECHEN'])
  })
})

/**
 * Nghi thức bài nghe telc (17/09/2026): câu dẫn + giọng người nói ở từng câu, cổng Ansage ở Teil.
 *
 * Trước đợt này parser BỎ `audio_script` của từng câu — HV Teil 1 và Teil 3 trên app không có nút
 * nghe nào (chỉ Teil 2 có audio ở cấp Teil). 10 câu / 50 điểm phần Nghe không làm được trên app
 * mà không ai báo: câu vẫn hiện, chỉ là không có gì để nghe.
 */
describe('nghi thức bài nghe telc trên app', () => {
  const HOEREN = JSON.stringify({
    format: 'TELC',
    sections: [
      {
        name: 'HOEREN', max_points: 75,
        teile: [
          {
            teil: 1, max_plays: 1, reading_seconds: 30,
            ansage_de: 'Sie hören nun fünf kurze Texte.',
            framing_de: 'Wie kommen Sie zur Arbeit?',
            items: [
              { id: 'HV1-41', speaker: 'PRUEFER', question: 'Die Sprecherin fährt Rad.', audio_script: 'Ich fahre Rad.', type: 'RICHTIG_FALSCH' },
              { id: 'HV1-42', speaker: 'PARTNER', question: 'Der Sprecher fährt Auto.', audio_script: 'Ich fahre Auto.', type: 'RICHTIG_FALSCH' },
            ],
          },
          {
            teil: 3, max_plays: 2, reading_seconds: 0,
            ansage_de: 'Sie hören jeden Text zweimal.',
            items: [
              { id: 'HV3-56', speaker: 'PRUEFER', lead_in_de: 'Sie hören eine Nachricht auf dem Anrufbeantworter.', question: 'Die Frau sagt ab.', audio_script: 'Hallo, hier ist Nadine.', type: 'RICHTIG_FALSCH' },
            ],
          },
        ],
      },
    ],
  })

  it('từng câu mang bài nghe riêng: giọng của người nói, câu dẫn đi trước bằng giọng người dẫn', () => {
    const parsed = parseExamSections(HOEREN)
    const [t1, t3] = parsed.sections[0].groups
    expect(t1.items[0].audio).toEqual([{ speaker: 'PRUEFER', name: undefined, text: 'Ich fahre Rad.' }])
    expect(t1.items[1].audio).toEqual([{ speaker: 'PARTNER', name: undefined, text: 'Ich fahre Auto.' }])
    expect(t3.items[0].audio).toEqual([
      { speaker: 'PRUEFER', text: 'Sie hören eine Nachricht auf dem Anrufbeantworter.', kind: 'LEAD_IN' },
      { speaker: 'PRUEFER', name: undefined, text: 'Hallo, hier ist Nadine.' },
    ])
  })

  it('Teil mang cổng nghi thức: Ansage, giây đọc câu hỏi, câu khung; Teil 3 không có giây đọc', () => {
    const parsed = parseExamSections(HOEREN)
    const [t1, t3] = parsed.sections[0].groups
    expect(t1.ansage).toBe('Sie hören nun fünf kurze Texte.')
    expect(t1.readingSeconds).toBe(30)
    expect(t1.framing).toBe('Wie kommen Sie zur Arbeit?')
    expect(t1.maxPlays).toBe(1)
    expect(t3.ansage).toBe('Sie hören jeden Text zweimal.')
    expect(t3.readingSeconds).toBe(0)
    expect(t3.framing).toBeUndefined()
  })

  it('đề Goethe không khai gì thêm ⇒ không cổng, câu không có bài riêng, như trước', () => {
    const goethe = JSON.stringify({
      sections: [{ name: 'HOEREN', max_points: 25, teile: [{ teil: 1, audio_script: 'Guten Tag.',
        items: [{ id: 'H1', question: 'Er kommt.', type: 'RICHTIG_FALSCH' }] }] }],
    })
    const [group] = parseExamSections(goethe).sections[0].groups
    expect(group.ansage).toBeUndefined()
    expect(group.readingSeconds).toBe(0)
    expect(group.audio).toBe('Guten Tag.')
    expect(group.items[0].audio).toBeUndefined()
  })
})

/** Gói A (17/09/2026): bài đọc dài kiểu đề thật, Beispiele của LV Teil 3, mẩu tin trên thư SB2. */
describe('bài đọc dài, Beispiele và mẩu tin kích thích trên app', () => {
  const LESEN = JSON.stringify({
    format: 'TELC',
    sections: [
      {
        name: 'LESEN', max_points: 75,
        teile: [
          { teil: 2, type: 'MULTIPLE_CHOICE', title_de: 'Ehrenamt im Wandel', vorspann_de: 'Wer sich engagiert…',
            context_lines: true, context: 'Zeile eins\nZeile zwei',
            glossary: [{ term: 'Ehrenamt', explanation_de: 'unbezahlte Arbeit' }, { term: 'kaputt' }],
            items: [{ id: 'LV2-6', question: 'Freiwillige hören auf, weil …', options: { a: 'x', b: 'y', c: 'z' }, type: 'MULTIPLE_CHOICE' }] },
          { teil: 3, type: 'MATCH_AD_X', ads: { a: 'Nachhilfe', l: 'Fotograf' }, allow_none: true,
            examples: [{ label: '01', situation: 'Goldene Hochzeit, schöne Bilder', answer: 'l' }, { situation: 'Klavierlehrerin gesucht', answer: 'x' }],
            items: [{ id: 'LV3-11', question: 'Situation 11', type: 'MATCHING' }] },
        ],
      },
      {
        name: 'SPRACHBAUSTEINE', max_points: 30,
        teile: [
          { teil: 2, type: 'GAP_WORDBANK', stimulus_ad: 'Ferienwohnung am See', gapped_text: 'Anzeige ___31___ Wochenende',
            word_bank: { a: 'AM', f: 'IM' }, items: [{ id: 'SB2-31', type: 'MATCHING' }] },
        ],
      },
    ],
  })

  it('LV Teil 2 mang tiêu đề, Vorspann, cờ số dòng và chú thích (bỏ mục thiếu giải thích)', () => {
    const [t2] = parseExamSections(LESEN).sections[0].groups
    expect(t2.passageTitle).toBe('Ehrenamt im Wandel')
    expect(t2.vorspann).toBe('Wer sich engagiert…')
    expect(t2.passageLines).toBe(true)
    expect(t2.passage).toBe('Zeile eins\nZeile zwei')
    expect(t2.glossary).toEqual([{ term: 'Ehrenamt', explanation: 'unbezahlte Arbeit' }])
  })

  it('LV Teil 3 mang hai Beispiele, nhãn thiếu thì để trống cho màn tự đánh 01/02', () => {
    const [, t3] = parseExamSections(LESEN).sections[0].groups
    expect(t3.examples).toEqual([
      { label: '01', situation: 'Goldene Hochzeit, schöne Bilder', answer: 'l' },
      { label: undefined, situation: 'Klavierlehrerin gesucht', answer: 'x' },
    ])
  })

  it('SB Teil 2 mang mẩu tin mà thư trả lời; đề không khai thì các trường này vắng', () => {
    const parsed = parseExamSections(LESEN)
    expect(parsed.sections[1].groups[0].stimulusAd).toBe('Ferienwohnung am See')
    const [t2] = parsed.sections[0].groups
    expect(t2.stimulusAd).toBeUndefined()
    expect(t2.examples).toBeUndefined()
  })
})
