import {
  anyBlockShown,
  appMarkInfo,
  gapPieces,
  hoerenLines,
  marksSupported,
  marksTexts,
  matchBlock,
  rawTeilOf,
  strikeOptions,
  teilKindOf,
  type RawTeil,
} from '@/lib/marksBlocks'

// Đề mẫu đủ các dạng có bút trên web (mẫu: frontend/src/components/exam/marks/marksBlocks.test.ts).
const lesen1: RawTeil = {
  teil: 1,
  type: 'MATCH_HEADLINE',
  headlines: { a: 'Kopf A', b: 'Kopf B' },
  items: [{ id: 'LV1-1', question: 'Text 1', text: 'Erster Text.\r\nZweite Zeile.' }, { id: 'LV1-2', question: 'Text 2', text: '  ' }],
}
const lesen2: RawTeil = {
  teil: 2,
  type: 'MULTIPLE_CHOICE',
  context: 'Satz eins.\r\nSatz zwei.',
  items: [{ id: 'LV2-6', question: 'Was stimmt?', options: { a: 'x', b: 'y', c: 'z' } }],
}
const lesen3: RawTeil = {
  teil: 3,
  type: 'MATCH_AD_X',
  ads: { a: 'Anzeige A', b: '', c: 'Anzeige C' },
  items: [{ id: 'LV3-11', question: 'Situation 11' }],
}
const sb1: RawTeil = { teil: 1, type: 'GAP_MC', gapped_text: 'Liebe Anna, ___21___ geht es dir?', items: [{ id: 'SB1-21', options: { a: 'wie', b: 'was', c: 'wo' } }] }
const hoeren: RawTeil = {
  teil: 1,
  audio_script: 'Teil-Text',
  items: [{ id: 'HV1-41', lead_in_de: ' Sie hören … ', audio_script: [{ text: 'Hallo!' }, { text: '  ' }, { text: 'Tschüss.' }] }],
}
const json = JSON.stringify({
  sections: [
    { name: 'LESEN', teile: [lesen1, lesen2, lesen3] },
    { name: 'SPRACHBAUSTEINE', teile: [sb1] },
    { name: 'HOEREN', teile: [hoeren] },
    { name: 'SCHREIBEN', teile: [{ teil: 1 }] },
  ],
})

describe('rawTeilOf', () => {
  test('lấy Teil thô theo khoá, theo số `teil`; đề không đánh số thì theo vị trí', () => {
    expect(rawTeilOf(json, 'LESEN-2')?.type).toBe('MULTIPLE_CHOICE')
    expect(rawTeilOf(json, 'LESEN-4')).toBeNull()
    expect(rawTeilOf(json, 'lesen-2')).toBeNull()
    expect(rawTeilOf('{', 'LESEN-2')).toBeNull()
    const unnumbered = JSON.stringify({ sections: [{ name: 'LESEN', teile: [{ context: 'A' }, { context: 'B' }] }] })
    expect(rawTeilOf(unnumbered, 'LESEN-2')?.context).toBe('B')
  })
})

describe('teilKindOf — như kindOf của web', () => {
  test('theo `type`, Hören luôn trắc nghiệm, Viết theo form', () => {
    expect(teilKindOf(lesen1, 'LESEN-1')).toBe('match')
    expect(teilKindOf(lesen2, 'LESEN-2')).toBe('mc')
    expect(teilKindOf(sb1, 'SPRACHBAUSTEINE-1')).toBe('gap-mc')
    expect(teilKindOf({ type: 'GAP_WORDBANK' }, 'SPRACHBAUSTEINE-2')).toBe('gap-bank')
    expect(teilKindOf(hoeren, 'HOEREN-1')).toBe('mc')
    expect(teilKindOf({ type: 'FILL_FORM' }, 'SCHREIBEN-1')).toBe('form')
    expect(teilKindOf({}, 'LESEN-9')).toBe('unknown')
  })
})

describe('marksTexts — chữ của từng khối', () => {
  test('ctx / q / t / ad / gap chuẩn hoá xuống dòng; bỏ khối rỗng', () => {
    expect(marksTexts(lesen1)).toEqual({ 'q:LV1-1': 'Text 1', 't:LV1-1': 'Erster Text.\nZweite Zeile.', 'q:LV1-2': 'Text 2' })
    expect(marksTexts(lesen2)).toEqual({ ctx: 'Satz eins.\nSatz zwei.', 'q:LV2-6': 'Was stimmt?' })
    expect(marksTexts(lesen3)).toEqual({ 'ad:a': 'Anzeige A', 'ad:c': 'Anzeige C', 'q:LV3-11': 'Situation 11' })
    expect(marksTexts(sb1)).toEqual({ gap: 'Liebe Anna, ___21___ geht es dir?' })
    expect(marksTexts(null)).toEqual({})
  })
  test('lời bài nghe theo dòng: cấp Teil rồi từng câu (câu dẫn là dòng đầu, bỏ lượt rỗng)', () => {
    expect(hoerenLines(hoeren)).toEqual([
      ['h:teil:0', 'Teil-Text'],
      ['h:HV1-41:0', 'Sie hören …'],
      ['h:HV1-41:1', 'Hallo!'],
      ['h:HV1-41:2', 'Tschüss.'],
    ])
  })
})

describe('marksSupported / appMarkTexts — Teil nào có bút', () => {
  test('như web: Lesen 1/2/3, Sprachbausteine; Hören có lời bài', () => {
    expect(marksSupported(lesen1, 'match')).toBe(true)
    expect(marksSupported(lesen2, 'mc')).toBe(true)
    expect(marksSupported(lesen3, 'match')).toBe(true)
    expect(marksSupported(sb1, 'gap-mc')).toBe(true)
    expect(marksSupported(hoeren, 'mc')).toBe(true)
    expect(marksSupported({ type: 'MATCH_HEADLINE', items: [{ id: '1', text: ' ' }] }, 'match')).toBe(false)
    expect(marksSupported({ type: 'MATCH_AD_X', ads: { a: '' } }, 'match')).toBe(false)
    expect(marksSupported({ gapped_text: '  ' }, 'gap-bank')).toBe(false)
    expect(marksSupported({ items: [] }, 'mc')).toBe(false)
    expect(marksSupported(null, 'mc')).toBe(false)
  })
  test('app: Lesen + Sprachbausteine; Hören không (app không in lời bài), Viết không', () => {
    expect(appMarkInfo(json, 'LESEN-1')?.texts).toMatchObject({ 't:LV1-1': 'Erster Text.\nZweite Zeile.' })
    expect(appMarkInfo(json, 'LESEN-2')?.texts).toMatchObject({ ctx: 'Satz eins.\nSatz zwei.' })
    expect(appMarkInfo(json, 'LESEN-2')?.strike).toEqual({ 'LV2-6': ['a', 'b', 'c'] })
    expect(appMarkInfo(json, 'LESEN-3')?.texts).toMatchObject({ 'ad:a': 'Anzeige A' })
    expect(appMarkInfo(json, 'SPRACHBAUSTEINE-1')?.texts).toMatchObject({ gap: expect.any(String) })
    expect(appMarkInfo(json, 'HOEREN-1')).toBeNull()
    expect(appMarkInfo(json, 'SCHREIBEN-1')).toBeNull()
    expect(appMarkInfo(json, 'LESEN-9')).toBeNull()
    expect(appMarkInfo(null, 'LESEN-2')).toBeNull()
  })
})

describe('strikeOptions — như PassageMarksValidator.optionsOf', () => {
  test('chỉ câu có options riêng dạng đối tượng; mảng / không có / thiếu id ⇒ không gạch được', () => {
    expect(
      strikeOptions({
        items: [
          { id: 'A', options: { a: 'x', b: 'y' } },
          { id: 'B', options: ['x', 'y'] },
          { id: 'C', correct: 'richtig' },
          { options: { a: 'x' } },
        ],
      }),
    ).toEqual({ A: ['a', 'b'] })
    expect(strikeOptions(lesen1)).toEqual({})
    expect(strikeOptions(null)).toEqual({})
  })
})

describe('anyBlockShown', () => {
  test('ít nhất một chữ trên màn khớp khối', () => {
    const texts = { ctx: 'A', 'q:1': 'Frage' }
    expect(anyBlockShown(texts, [['ctx', 'B'], ['q:1', 'Frage']])).toBe(true)
    expect(anyBlockShown(texts, [['ctx', 'B'], ['q:2', 'Frage'], ['gap', undefined]])).toBe(false)
    expect(anyBlockShown(null, [['ctx', 'A']])).toBe(false)
  })
})

describe('matchBlock — chỉ tô khi chữ trên màn trùng chữ khối', () => {
  const texts = { ctx: 'A\nB', 'q:1': 'Frage' }
  test('trùng (kể cả \\r\\n) ⇒ khối; lệch hoặc thiếu ⇒ null', () => {
    expect(matchBlock(texts, 'ctx', 'A\r\nB')).toBe('ctx')
    expect(matchBlock(texts, 'ctx', 'A B')).toBeNull()
    expect(matchBlock(texts, 'q:2', 'Frage')).toBeNull()
    expect(matchBlock(null, 'ctx', 'A\nB')).toBeNull()
    expect(matchBlock(texts, 'q:1', undefined)).toBeNull()
  })
})

describe('gapPieces', () => {
  test('đoạn chữ và ô trống giữ vị trí', () => {
    const text = 'Liebe Anna, ___21___ geht es dir? ___ 22 ___'
    expect(gapPieces(text)).toEqual([
      { kind: 'text', s: 0, e: 12 },
      { kind: 'gap', gap: 21, s: 12, e: 20 },
      { kind: 'text', s: 20, e: 34 },
      { kind: 'gap', gap: 22, s: 34, e: 44 },
    ])
    expect(gapPieces('kein Loch')).toEqual([{ kind: 'text', s: 0, e: 9 }])
  })
})
