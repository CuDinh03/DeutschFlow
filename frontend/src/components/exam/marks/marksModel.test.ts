import { describe, expect, it } from 'vitest'
import { evidenceRanges, findQuote } from '@/lib/exam/evidenceRanges'
import {
  addMark,
  colorAt,
  diagnose,
  dropStale,
  emptyPack,
  erase,
  fnv1a,
  groupPieces,
  groupsForItem,
  lastPieces,
  parsePack,
  recolor,
  removeGroup,
  setNote,
  setStruck,
  setTag,
  snapToWords,
  toggleUnderline,
  type MarksPack,
} from './marksModel'

const CTX = 'Frau Özdemir leitet eine Agentur.\nWer zu uns kommt, fragt zuerst\nnach dem Zeitaufwand. Ein Projekt.'
const TEXTS = { ctx: CTX, 'q:LV2-7': 'Wer kommt, fragt zuerst, …' }
const order = (b: string) => (b === 'ctx' ? 0 : 1)
const piece = (phrase: string, b = 'ctx') => {
  const s = TEXTS[b as keyof typeof TEXTS].indexOf(phrase)
  return { b, s, e: s + phrase.length }
}
const covered = (pack: MarksPack) =>
  pack.marks
    .map((m) => `${m.k}${m.c ?? ''}:${TEXTS[m.b as keyof typeof TEXTS].slice(m.s, m.e)}`)
    .sort()

describe('evidenceRanges', () => {
  it('tìm câu trích vắt qua dòng tác giả ngắt (bản cũ so trong từng dòng nên bỏ sót)', () => {
    const r = findQuote(CTX, 'fragt zuerst nach dem Zeitaufwand')
    expect(r).not.toBeNull()
    expect(CTX.slice(r![0], r![1])).toBe('fragt zuerst\nnach dem Zeitaufwand')
  })

  it('khoảng trắng thừa trong câu trích không làm hỏng; câu không có thì null', () => {
    expect(findQuote(CTX, '  Ein   Projekt ')).toEqual([CTX.indexOf('Ein Projekt'), CTX.indexOf('Ein Projekt') + 11])
    expect(findQuote(CTX, 'gibt es nicht')).toBeNull()
    expect(findQuote(CTX, '   ')).toBeNull()
  })

  it('nhiều câu trích theo thứ tự trong bài, bỏ câu không có', () => {
    expect(evidenceRanges(CTX, ['Ein Projekt', 'leitet', 'xyz']).map(([s, e]) => CTX.slice(s, e))).toEqual(['leitet', 'Ein Projekt'])
  })
})

describe('marksModel', () => {
  it('hash FNV-1a khớp server (PassageMarksValidatorTest)', () => {
    expect(fnv1a('')).toBe('811c9dc5')
    expect(fnv1a('a')).toBe('e40c292c')
    expect(fnv1a('Zeit')).not.toBe(fnv1a('Zeit.'))
  })

  it('chọn giữa từ ⇒ mở rộng cho trọn từ, bỏ khoảng trắng hai đầu', () => {
    const s = CTX.indexOf('dem Zeitaufwand') + 6 // giữa "Zeitaufwand"
    const r = snapToWords(CTX, s - 8, s)
    expect(CTX.slice(r![0], r![1])).toBe('nach dem Zeitaufwand')
    expect(snapToWords(CTX, 3, 3)).toBeNull()
    const sp = CTX.indexOf(' kommt')
    const k = snapToWords(CTX, sp, sp + 2) // " k" ⇒ bỏ dấu cách đầu, mở rộng tới hết từ
    expect(CTX.slice(k![0], k![1])).toBe('kommt')
  })

  it('tô đè màu khác lên giữa đoạn đã tô ⇒ đoạn cũ tách đôi, giữa mang màu mới (EXAM-194)', () => {
    let { pack, gid } = addMark(emptyPack(), TEXTS, [piece('fragt zuerst\nnach dem Zeitaufwand')], 'hl', 'y', 'LV2-7')
    pack = setNote(pack, gid!, 'Zeitaufwand')
    ;({ pack } = addMark(pack, TEXTS, [piece('zuerst\nnach')], 'hl', 'p'))
    expect(covered(pack)).toEqual(['hlp:zuerst\nnach', 'hly: dem Zeitaufwand', 'hly:fragt '])
    // hai mảnh còn lại vẫn cùng nhóm, giữ số câu + ghi chú
    expect(groupPieces(pack, gid!)).toHaveLength(2)
    expect(groupPieces(pack, gid!).every((m) => m.q === 'LV2-7' && m.n === 'Zeitaufwand')).toBe(true)
    expect(groupsForItem(pack, 'LV2-7', order)).toEqual([gid])
    // nhãn số câu đặt ở mảnh cuối của nhóm
    expect(lastPieces(pack, order).get(gid!)?.e).toBe(piece('Zeitaufwand').e)
  })

  it('gạch chân bật/tắt; xếp chồng được với màu', () => {
    let { pack } = addMark(emptyPack(), TEXTS, [piece('Frau Özdemir')], 'hl', 'g')
    let r = addMark(pack, TEXTS, [piece('Frau Özdemir leitet')], 'ul', null)
    pack = r.pack
    expect(covered(pack)).toEqual(['hlg:Frau Özdemir', 'ul:Frau Özdemir leitet'])
    r = addMark(pack, TEXTS, [piece('Özdemir')], 'ul', null) // đã gạch cả ⇒ bỏ gạch phần đó
    expect(r.gid).toBeNull()
    expect(covered(r.pack)).toEqual(['hlg:Frau Özdemir', 'ul: leitet', 'ul:Frau '])
  })

  it('đổi màu, gạch chân nhóm, gắn câu, xoá nhóm', () => {
    let { pack, gid } = addMark(emptyPack(), TEXTS, [piece('Agentur')], 'hl', 'y')
    ;({ pack } = recolor(pack, TEXTS, gid!, 'g'))
    expect(colorAt(pack, piece('Agentur'))).toBe('g')
    pack = toggleUnderline(pack, TEXTS, gid!)
    expect(covered(pack)).toEqual(['hlg:Agentur', 'ul:Agentur'])
    pack = toggleUnderline(pack, TEXTS, gid!)
    expect(covered(pack)).toEqual(['hlg:Agentur'])
    pack = setTag(pack, gid!, 'LV2-6')
    expect(groupsForItem(pack, 'LV2-6', order)).toEqual([gid])
    pack = removeGroup(pack, gid!)
    expect(pack.marks).toHaveLength(0)
  })

  it('nhóm chỉ gạch chân đổi màu ⇒ thêm lớp màu, chuyển số câu sang lớp màu', () => {
    let { pack, gid } = addMark(emptyPack(), TEXTS, [piece('Projekt')], 'ul', null)
    pack = setTag(pack, gid!, 'LV2-9')
    const r = recolor(pack, TEXTS, gid!, 'y')
    expect(covered(r.pack)).toEqual(['hly:Projekt', 'ul:Projekt'])
    expect(groupsForItem(r.pack, 'LV2-9', order)).toEqual([r.gid])
  })

  it('tẩy mọi lớp trong vùng chọn', () => {
    let { pack } = addMark(emptyPack(), TEXTS, [piece('Wer zu uns kommt')], 'hl', 'y')
    ;({ pack } = addMark(pack, TEXTS, [piece('uns')], 'ul', null))
    pack = erase(pack, [piece('zu uns')])
    expect(covered(pack)).toEqual(['hly: kommt', 'hly:Wer '])
  })

  it('gạch bỏ phương án', () => {
    let pack = setStruck(emptyPack(), 'LV2-6', 'a', true)
    pack = setStruck(pack, 'LV2-6', 'c', true)
    expect(pack.struck).toEqual({ 'LV2-6': ['a', 'c'] })
    pack = setStruck(setStruck(pack, 'LV2-6', 'a', false), 'LV2-6', 'c', false)
    expect(pack.struck).toEqual({})
  })

  it('khối đổi chữ ⇒ bỏ đánh dấu của khối đó, báo đã bỏ (EXAM-200)', () => {
    const { pack } = addMark(emptyPack(), TEXTS, [piece('Agentur')], 'hl', 'y')
    const withQ = addMark(pack, TEXTS, [piece('fragt', 'q:LV2-7')], 'hl', 'g').pack
    expect(dropStale(withQ, TEXTS).dropped).toBe(false)
    const changed = dropStale(withQ, { ...TEXTS, ctx: CTX.replace('Agentur', 'Agenturen') })
    expect(changed.dropped).toBe(true)
    expect(changed.pack.marks.map((m) => m.b)).toEqual(['q:LV2-7'])
  })

  it('đọc gói server: bỏ mảnh hỏng, lấp mặc định', () => {
    const p = parsePack({
      marks: [
        { id: 'h1', g: 'g1', b: 'ctx', s: 0, e: 4, k: 'hl', c: 'y', q: null, n: '' },
        { id: 'h2', g: 'g2', b: 'ctx', s: 4, e: 4, k: 'hl', c: 'y' },
        { id: 'h3', g: 'g3', b: 'ctx', s: 0, e: 4, k: 'hl', c: 'r' },
        { id: 'h4', g: 'g4', b: 'ctx', s: 0, e: 4, k: 'ul', c: 'y' },
      ],
      struck: { 'LV2-6': ['b'], 'LV2-7': [] },
    })
    expect(p.marks.map((m) => m.id)).toEqual(['h1', 'h4'])
    expect(p.marks[1].c).toBeNull()
    expect(p.struck).toEqual({ 'LV2-6': ['b'] })
    expect(parsePack(null)).toEqual(emptyPack())
  })

  it('chẩn đoán: đúng chỗ / gắn lệch / tô đúng chưa gắn / chưa đánh dấu', () => {
    const ev = [piece('fragt zuerst\nnach dem Zeitaufwand')]
    expect(diagnose(emptyPack(), 'LV2-7', ev).kind).toBe('none')
    const untagged = addMark(emptyPack(), TEXTS, [piece('Zeitaufwand')], 'hl', 'y').pack
    expect(diagnose(untagged, 'LV2-7', ev).kind).toBe('untagged')
    const off = addMark(untagged, TEXTS, [piece('Agentur')], 'hl', 'g', 'LV2-7').pack
    const d = diagnose(off, 'LV2-7', ev)
    expect(d.kind).toBe('offTarget')
    expect(d.tagged).toHaveLength(1)
    const found = addMark(off, TEXTS, [piece('fragt zuerst')], 'hl', 'g', 'LV2-7').pack
    expect(diagnose(found, 'LV2-7', ev).kind).toBe('found')
    // đánh dấu trong đề câu không tính là tìm trong bài
    const inStem = addMark(emptyPack(), TEXTS, [piece('fragt', 'q:LV2-7')], 'hl', 'g', 'LV2-7').pack
    expect(diagnose(inStem, 'LV2-7', ev).kind).toBe('none')
  })
})
