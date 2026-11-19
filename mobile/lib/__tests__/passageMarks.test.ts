import {
  applyPen,
  dropStale,
  emptyPack,
  fnv1a,
  lineSegments,
  parsePack,
  sentenceRanges,
  splitLines,
  teilContext,
  type MarksPack,
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

describe('teilContext', () => {
  const json = JSON.stringify({
    sections: [{ name: 'LESEN', teile: [{ teil: 1, context: 'A' }, { teil: 2, context: 'Zeile 1\r\nZeile 2' }] }],
  })
  test('lấy `context` thô theo khoá Teil, chuẩn hoá xuống dòng', () => {
    expect(teilContext(json, 'LESEN-2')).toBe('Zeile 1\nZeile 2')
    expect(teilContext(json, 'LESEN-3')).toBeNull()
    expect(teilContext(json, 'HOEREN-1')).toBeNull()
    expect(teilContext('{', 'LESEN-2')).toBeNull()
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

