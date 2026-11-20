import {
  applyPen,
  applyPenWord,
  dropStale,
  emptyPack,
  fnv1a,
  lineSegments,
  parsePack,
  sentenceRanges,
  splitLines,
  sentencesIn,
  setStruck,
  isStruck,
  wordRanges,
  type MarksPack,
  type Piece,
} from '@/lib/passageMarks'

const TEXT = 'Seit einem Jahr gibt es Paten. Jede neue Kraft bekommt Hilfe! Die Paten helfen auch bei „Ämtern“.'
const texts = { ctx: TEXT }
const piece = (s: number, e: number) => ({ b: 'ctx', s, e })

describe('fnv1a — cùng hash với server và web', () => {
  test('giá trị chuẩn FNV-1a 32 bit', () => {
    expect(fnv1a('')).toBe('811c9dc5')
    expect(fnv1a('a')).toBe('e40c292c')
  })
})

describe('sentenceRanges', () => {
  test('cắt theo dấu hết câu, kèm nháy đóng; bỏ khoảng trắng hai đầu', () => {
    const ranges = sentenceRanges(TEXT)
    expect(ranges.map(([a, b]) => TEXT.slice(a, b))).toEqual([
      'Seit einem Jahr gibt es Paten.',
      'Jede neue Kraft bekommt Hilfe!',
      'Die Paten helfen auch bei „Ämtern“.',
    ])
  })

  test('bài đánh số dòng: câu vắt qua dòng, dòng trống là hết đoạn', () => {
    const t = 'Das ist ein\nlanger Satz. Kurz.\n\nTitel ohne Punkt\nNeuer Satz.'
    expect(sentenceRanges(t, false).map(([a, b]) => t.slice(a, b))).toEqual([
      'Das ist ein\nlanger Satz.',
      'Kurz.',
      'Titel ohne Punkt\nNeuer Satz.',
    ])
    expect(sentenceRanges('Zeile eins\nZeile zwei', true).length).toBe(2)
  })
})

describe('applyPen — chạm câu để tô', () => {
  test('tô màu, chạm lại cùng màu thì bỏ; màu khác thì đè', () => {
    let pack = applyPen(emptyPack(), texts, piece(0, 30), 'y')
    expect(pack.marks).toHaveLength(1)
    expect(pack.marks[0]).toMatchObject({ b: 'ctx', s: 0, e: 30, k: 'hl', c: 'y', q: null, n: '' })
    expect(pack.blocks.ctx).toBe(fnv1a(TEXT))
    const green = applyPen(pack, texts, piece(0, 30), 'g')
    expect(green.marks.map((m) => m.c)).toEqual(['g'])
    pack = applyPen(pack, texts, piece(0, 30), 'y')
    expect(pack.marks).toHaveLength(0)
  })

  test('gạch chân bật/tắt, không đụng lớp màu', () => {
    let pack = applyPen(emptyPack(), texts, piece(0, 30), 'y')
    pack = applyPen(pack, texts, piece(0, 30), 'ul')
    expect(pack.marks.map((m) => m.k).sort()).toEqual(['hl', 'ul'])
    pack = applyPen(pack, texts, piece(0, 30), 'ul')
    expect(pack.marks.map((m) => m.k)).toEqual(['hl'])
  })

  test('tẩy KHÔNG xoá mảnh web có gắn câu / ghi chú (app không hiện được, xoá là mất âm thầm)', () => {
    const fromWeb = parsePack({
      v: 1,
      blocks: { ctx: fnv1a(TEXT) },
      marks: [{ id: 'h1', g: 'g1', b: 'ctx', s: 20, e: 45, k: 'hl', c: 'p', q: '8', n: 'Bằng chứng' }],
      struck: { '8': ['a'] },
    })
    const pack = applyPen(fromWeb, texts, piece(0, 30), 'erase')
    expect(pack.marks).toHaveLength(1)
    expect(pack.marks[0]).toMatchObject({ s: 20, e: 45, q: '8', n: 'Bằng chứng', c: 'p' })
    expect(pack.struck).toEqual({ '8': ['a'] })
  })
})

describe('parsePack + dropStale', () => {
  test('bỏ mảnh hỏng; khối đổi chữ thì bỏ đánh dấu và báo', () => {
    const raw = {
      blocks: { ctx: 'deadbeef' },
      marks: [
        { id: 'h1', g: 'g1', b: 'ctx', s: 0, e: 4, k: 'hl', c: 'y' },
        { id: 'h2', g: 'g2', b: 'ctx', s: 5, e: 2, k: 'hl', c: 'y' },
        { id: 'h3', g: 'g3', b: 'ctx', s: 0, e: 4, k: 'hl', c: 'z' },
      ],
    }
    const pack = parsePack(raw)
    expect(pack.marks).toHaveLength(1)
    expect(dropStale(pack, texts)).toEqual({ pack: { ...pack, marks: [] }, dropped: true })
    const fresh: MarksPack = { ...pack, blocks: { ctx: fnv1a(TEXT) } }
    expect(dropStale(fresh, texts).dropped).toBe(false)
    expect(parsePack(null)).toEqual(emptyPack())
  })
})

describe('lineSegments', () => {
  test('cắt theo câu và theo đánh dấu; giữ toàn bộ chữ của dòng', () => {
    const pack = applyPen(applyPen(emptyPack(), texts, piece(31, 61), 'g'), texts, piece(0, 30), 'ul')
    const [line] = splitLines(TEXT)
    const segs = lineSegments(TEXT, line, sentenceRanges(TEXT), pack.marks)
    expect(segs.map((s) => s.text).join('')).toBe(TEXT)
    const first = segs[0]
    expect(first).toMatchObject({ text: 'Seit einem Jahr gibt es Paten.', underline: true, color: null, sentence: [0, 30] })
    const second = segs.find((s) => s.start === 31)
    expect(second).toMatchObject({ color: 'g', underline: false, sentence: [31, 61] })
    expect(segs.find((s) => s.text === ' ')?.sentence).toBeNull()
  })
})

describe('sentencesIn — câu của một đoạn trong khối', () => {
  test('vị trí tính trên cả khối', () => {
    const text = 'Hallo ___1___ Welt. Gut so! Ende'
    expect(sentencesIn(text, 13, text.length)).toEqual([[14, 19], [20, 27], [28, 32]])
  })
})

describe('setStruck / isStruck', () => {
  test('bật, tắt, bỏ khoá câu khi rỗng; không đụng gói cũ', () => {
    const a = setStruck(emptyPack(), 'LV2-6', 'b', true)
    expect(isStruck(a, 'LV2-6', 'b')).toBe(true)
    const b = setStruck(a, 'LV2-6', 'b', false)
    expect(b.struck).toEqual({})
    expect(isStruck(a, 'LV2-6', 'b')).toBe(true)
  })
})

describe('giữ đánh dấu web ngoài bài đọc (soát Đợt 4c)', () => {
  const ctx = 'Satz eins. Satz zwei.'
  const webPack = parsePack({
    v: 1,
    blocks: { ctx: fnv1a(ctx), 'q:7': 'abcd1234' },
    marks: [
      { id: 'a', g: 'g1', b: 'q:7', s: 0, e: 4, k: 'hl', c: 'y', q: null, n: 'ghi chú web' },
      { id: 'b', g: 'g2', b: 'ctx', s: 0, e: 4, k: 'hl', c: 'g', q: '8', n: 'gắn câu 8' },
    ],
    struck: {},
  })
  it('dropStale giữ mảnh khối q:<id> và không báo bỏ', () => {
    const r = dropStale(webPack, { ctx })
    expect(r.dropped).toBe(false)
    expect(r.pack.marks.map((m) => m.b)).toEqual(['q:7', 'ctx'])
  })
  it('tô một câu vẫn gửi lại mảnh q:7 cùng hash của nó', () => {
    const next = applyPen(webPack, { ctx }, { b: 'ctx', s: 11, e: 21 }, 'y')
    expect(next.marks.some((m) => m.b === 'q:7' && m.n === 'ghi chú web')).toBe(true)
    expect(next.blocks['q:7']).toBe('abcd1234')
  })
  it('tô đè câu có mảnh web gắn câu: giữ q và n', () => {
    const next = applyPen(webPack, { ctx }, { b: 'ctx', s: 0, e: 10 }, 'y')
    const m = next.marks.find((x) => x.b === 'ctx')
    expect(m?.c).toBe('y')
    expect(m?.q).toBe('8')
    expect(m?.n).toBe('gắn câu 8')
  })
  it('tẩy không xoá mảnh mang ghi chú web', () => {
    const next = applyPen(webPack, { ctx }, { b: 'ctx', s: 0, e: 10 }, 'erase')
    expect(next.marks.some((x) => x.b === 'ctx' && x.q === '8')).toBe(true)
  })
})


describe('wordRanges + applyPenWord — chạm từ để tô như bôi chọn web', () => {
  const text = 'Insgesamt waren die Jungen mit 51 Prozent nur knapp in der Mehrheit. Nur wenige Kinder.'
  const texts = { ctx: text }
  const w = (word: string, nth = 0): Piece => {
    let i = -1
    for (let k = 0; k <= nth; k++) i = text.indexOf(word, i + 1)
    return { b: 'ctx', s: i, e: i + word.length }
  }
  const spans = (p: MarksPack) => p.marks.map((m) => `${m.k}${m.c ?? ''}:${text.slice(m.s, m.e)}`).sort()

  test('từ bỏ dấu câu hai đầu, giữ số và dấu nối bên trong', () => {
    const t = '„Mehrheit.“ 6.000 Schul-Anfänger (0,7)'
    expect(wordRanges(t).map(([a, b]) => t.slice(a, b))).toEqual(['Mehrheit', '6.000', 'Schul-Anfänger', '0,7'])
    expect(wordRanges('  ')).toEqual([])
    expect(wordRanges(t, 12, 17).map(([a, b]) => t.slice(a, b))).toEqual(['6.000'])
  })

  test('chạm một từ chỉ tô từ đó, không tô cả câu', () => {
    const p = applyPenWord(emptyPack(), texts, w('Jungen'), 'g')
    expect(spans(p)).toEqual(['hlg:Jungen'])
    expect(p.blocks.ctx).toBe(fnv1a(text))
  })

  test('chạm từ kế bên cùng bút ⇒ nối thành một mảnh; qua dấu chấm cuối câu cũng nối', () => {
    let p = applyPenWord(emptyPack(), texts, w('Jungen'), 'y')
    p = applyPenWord(p, texts, w('mit'), 'y')
    p = applyPenWord(p, texts, w('51'), 'y')
    expect(spans(p)).toEqual(['hly:Jungen mit 51'])
    p = applyPenWord(p, texts, w('Mehrheit'), 'y')
    p = applyPenWord(p, texts, w('Nur'), 'y')
    expect(spans(p)).toEqual(['hly:Jungen mit 51', 'hly:Mehrheit. Nur'])
  })

  test('không nối với mảnh khác màu hay mảnh ở xa', () => {
    let p = applyPenWord(emptyPack(), texts, w('Jungen'), 'y')
    p = applyPenWord(p, texts, w('mit'), 'g')
    p = applyPenWord(p, texts, w('Prozent'), 'g')
    expect(spans(p)).toEqual(['hlg:Prozent', 'hlg:mit', 'hly:Jungen'])
  })

  test('chạm lại từ giữa cụm ⇒ bỏ từ đó, mảnh tách đôi không sót khoảng trắng', () => {
    let p = emptyPack()
    for (const x of ['Jungen', 'mit', '51']) p = applyPenWord(p, texts, w(x), 'y')
    p = applyPenWord(p, texts, w('mit'), 'y')
    expect(spans(p)).toEqual(['hly:51', 'hly:Jungen'])
  })

  test('bút màu khác đè lên từ đã tô; gạch chân và tẩy theo từ', () => {
    let p = applyPenWord(emptyPack(), texts, w('Jungen'), 'y')
    p = applyPenWord(p, texts, w('Jungen'), 'p')
    expect(spans(p)).toEqual(['hlp:Jungen'])
    p = applyPenWord(p, texts, w('Jungen'), 'ul')
    expect(spans(p)).toEqual(['hlp:Jungen', 'ul:Jungen'])
    p = applyPenWord(p, texts, w('Jungen'), 'erase')
    expect(spans(p)).toEqual([])
  })

  test('nhấn giữ vẫn tô cả câu (applyPen); lineSegments tách theo từ', () => {
    const [s0] = sentenceRanges(text)
    const p = applyPen(emptyPack(), texts, { b: 'ctx', s: s0[0], e: s0[1] }, 'g')
    expect(spans(p)).toEqual(['hlg:Insgesamt waren die Jungen mit 51 Prozent nur knapp in der Mehrheit.'])
    const words = wordRanges(text)
    const segs = lineSegments(text, { start: 0, end: 20, text: '' }, sentenceRanges(text), [], 'ctx', words)
    expect(segs.map((g) => [g.text, g.word ? 'w' : '-'])).toEqual([
      ['Insgesamt', 'w'], [' ', '-'], ['waren', 'w'], [' ', '-'], ['die', 'w'], [' ', '-'],
    ])
  })
})
