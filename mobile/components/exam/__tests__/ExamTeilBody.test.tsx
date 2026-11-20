// Dựng cây phần tử của một Teil (không có renderer trong dự án — gọi thẳng hàm component như
// MinorAudioBlockedSheet.test). Kiểm: Teil ghép rao vặt in kho lựa chọn và thêm "không mẩu nào hợp";
// lựa chọn câu khác đã dùng bị khoá; sau kiểm tra thì khoá hết, tô đáp án đúng / lựa chọn sai, có giải thích.

import type { ReactElement } from 'react'
import { ObjGroupView } from '../ExamTeilBody'
import { parseExamSections, type ExamObjGroup } from '@/lib/examApi'
import type { PracticeItemResult } from '@/lib/telcPracticeApi'
import type { MarksLayer } from '@/hooks/usePassageMarks'

// jest tự đưa jest.mock lên trước các import.

jest.mock('@/lib/theme', () => ({
  radius: { xs: 2, sm: 4, md: 4, lg: 4, full: 9999 },
  space: { 1: 4, 2: 8, 3: 12, 4: 16 },
  useTheme: () => ({ colors: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) }),
}))
jest.mock('@/components/ui', () => ({
  Caption: (_p: unknown) => null,
  Card: (_p: unknown) => null,
  Icon: (_p: unknown) => null,
  SelectableRow: (_p: unknown) => null,
  ThemedText: (_p: unknown) => null,
}))
jest.mock('lucide-react-native', () => ({ Check: 'Check', X: 'X' }))
jest.mock('../TeilStrategyCard', () => ({ TeilStrategyCard: () => null }))
jest.mock('../ExamAudio', () => ({ ExamAudio: () => null }))
jest.mock('../HoerenGate', () => ({ HoerenGate: () => null }))
jest.mock('../TelcGapText', () => ({ TelcGapText: () => null }))
jest.mock('../ReadingPassage', () => ({ ReadingPassage: function ReadingPassage() { return null } }))
jest.mock('../MarksToolbar', () => ({ MarksToolbar: function MarksToolbar() { return null } }))
jest.mock('../MarkablePassage', () => ({ MarkablePassage: function MarkablePassage() { return null } }))
jest.mock('../MarkedRun', () => ({ MarkedRun: function MarkedRun() { return null } }))
jest.mock('../HeadlineMatch', () => ({ HeadlineMatch: function HeadlineMatch() { return null } }))
jest.mock('@/lib/api', () => ({ __esModule: true, default: {}, apiMessage: () => '' }))


type El = ReactElement<Record<string, unknown>>
const isEl = (n: unknown): n is El => !!n && typeof n === 'object' && 'props' in (n as object) && 'type' in (n as object)

/** Mở mọi component tự viết (hàm có tên viết hoa không phải stub) để thấy cây đầy đủ. */
function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand)
  if (!isEl(node)) return node
  const t = node.type as unknown
  if (typeof t === 'function' && ['QuestionCard', 'Choice', 'ItemExplanation'].includes((t as { name: string }).name)) {
    return expand((t as (p: unknown) => unknown)(node.props))
  }
  const kids = node.props.children
  return { ...node, props: { ...node.props, children: expand(kids) } }
}

function collect(node: unknown, pred: (e: El) => boolean, out: El[] = []): El[] {
  if (Array.isArray(node)) node.forEach((n) => collect(n, pred, out))
  else if (isEl(node)) {
    if (pred(node)) out.push(node)
    collect(node.props.children, pred, out)
  }
  return out
}

const parsed = parseExamSections(
  JSON.stringify({
    format: 'TELC',
    sections: [{
      name: 'LESEN',
      teile: [{
        teil: 3, type: 'MATCH_AD_X', allow_none: true, single_use: true,
        ads: { a: 'Anzeige A', b: 'Anzeige B' },
        items: [{ id: 'LV3-11', question: 'Situation 11' }, { id: 'LV3-12', question: 'Situation 12' }],
      }],
    }],
  }),
)
const group = parsed.sections[0].groups[0] as ExamObjGroup
const rows = (tree: unknown) => collect(tree, (e) => typeof e.props.role === 'string' && e.props.role === 'radio')
const base = { group, section: 'LESEN', answers: { 'LV3-11': 'a' } as Record<string, string>, onAnswer: () => {} }

describe('ObjGroupView', () => {
  it('ghép rao vặt: thêm "không mẩu nào hợp", khoá lựa chọn câu khác đã dùng', () => {
    const tree = expand(ObjGroupView(base))
    const r = rows(tree)
    // 2 câu × (a, b, x)
    expect(r).toHaveLength(6)
    const q12 = r.slice(3)
    expect(q12.map((e) => e.props.label)).toEqual(['a. Anzeige A (đã dùng)', 'b. Anzeige B', 'không mẩu nào hợp'].map((x) => expect.stringContaining(x.split(' (')[0])))
    expect(q12[0].props.disabled).toBe(true)
    expect(q12[2].props.disabled).toBe(false)
  })

  it('sau kiểm tra: khoá hết, tô đúng/sai và có phần giải thích', () => {
    const res = (id: string, given: string, correct: string, isCorrect: boolean): PracticeItemResult => ({
      id, label: id, given, givenText: null, correct, correctText: null, answered: true, isCorrect, points: isCorrect ? 1 : 0,
      whyRight: 'Weil …', whyWrong: isCorrect ? null : 'Nicht …', trap: null, evidence: ['Zitat'], need: null, rule: null,
    })
    const review = new Map([['LV3-11', res('LV3-11', 'a', 'b', false)], ['LV3-12', res('LV3-12', 'x', 'x', true)]])
    const tree = expand(ObjGroupView({ ...base, answers: { 'LV3-11': 'a', 'LV3-12': 'x' }, review }))
    const r = rows(tree)
    expect(r.every((e) => e.props.disabled === true)).toBe(true)
    const labels = r.map((e) => String(e.props.label))
    expect(labels[0]).toContain('(bạn chọn, chưa đúng)')
    expect(labels[1]).toContain('(đáp án đúng)')
    expect(labels[5]).toContain('(đáp án đúng)')
    const texts = collect(tree, (e) => typeof e.props.children === 'string').map((e) => e.props.children)
    expect(texts).toEqual(expect.arrayContaining(['Vì sao chưa đúng', 'Bằng chứng trong bài']))
  })
})

describe('ObjGroupView + bút đánh dấu (Đợt 4f)', () => {
  const lesen2 = parseExamSections(
    JSON.stringify({
      format: 'TELC',
      sections: [{
        name: 'LESEN',
        teile: [{
          teil: 2, type: 'MULTIPLE_CHOICE', context: 'Satz eins. Satz zwei.',
          items: [{ id: 'LV2-6', question: 'Was stimmt?', options: { a: 'eins', b: 'zwei', c: 'drei' } }],
        }],
      }],
    }),
  ).sections[0].groups[0] as ExamObjGroup
  const layer = (over: Partial<MarksLayer> = {}): MarksLayer => ({
    pack: { v: 1, blocks: {}, marks: [], struck: { 'LV2-6': ['c'] } },
    texts: { ctx: 'Satz eins. Satz zwei.', 'q:LV2-6': 'Was stimmt?' },
    status: 'ready', pen: 'y', setPen: () => {}, hidden: false, setHidden: () => {}, dropped: false, saveState: 'idle', full: false,
    canUndo: false, undo: () => {}, retry: () => {}, tap: () => {}, flush: async () => {},
    isStruck: (id, opt) => id === 'LV2-6' && opt === 'c', toggleStrike: jest.fn(),
    canStrike: (id, opt) => id === 'LV2-6' && ['a', 'b', 'c'].includes(opt),
    ...over,
  })
  const typeName = (e: El) => (typeof e.type === 'function' ? (e.type as { name: string }).name : String(e.type))
  const props = { group: lesen2, section: 'LESEN', answers: { 'LV2-6': 'a' } as Record<string, string>, onAnswer: () => {} }
  const strikeButtons = (tree: unknown) =>
    collect(tree, (e) => typeof e.props.accessibilityLabel === 'string' && /phương án/.test(e.props.accessibilityLabel as string))

  it('có lớp: thanh bút, bài đọc có bút, đề câu qua lớp đánh dấu, nút gạch bỏ từng phương án', () => {
    const tree = expand(ObjGroupView({ ...props, marks: layer() }))
    const names = collect(tree, () => true).map(typeName)
    expect(names).toEqual(expect.arrayContaining(['MarksToolbar', 'MarkablePassage', 'MarkedRun']))
    expect(names).not.toContain('ReadingPassage')
    const runs = collect(tree, (e) => typeName(e) === 'MarkedRun')
    expect(runs.map((e) => e.props.block)).toEqual(['q:LV2-6'])
    expect(strikeButtons(tree).map((e) => e.props.accessibilityLabel)).toEqual([
      'Gạch bỏ phương án a. eins',
      'Gạch bỏ phương án b. zwei',
      'Bỏ gạch phương án c. drei',
    ])
    expect(rows(tree).map((e) => String(e.props.label))[2]).toContain('(đã gạch bỏ)')
  })

  it('không lớp, hoặc đang xem kết quả: không thanh bút, không nút gạch bỏ', () => {
    const plain = collect(expand(ObjGroupView(props)), () => true).map(typeName)
    expect(plain).not.toContain('MarksToolbar')
    expect(plain).not.toContain('MarkedRun')
    const res: PracticeItemResult = {
      id: 'LV2-6', label: '6', given: 'a', givenText: null, correct: 'b', correctText: null, answered: true, isCorrect: false, points: 0,
      whyRight: null, whyWrong: null, trap: null, evidence: [], need: null, rule: null,
    }
    const tree = expand(ObjGroupView({ ...props, marks: layer(), review: new Map([['LV2-6', res]]) }))
    expect(strikeButtons(tree)).toHaveLength(0)
  })

  it('chữ trên màn lệch chữ khối ⇒ không cho tô khối đó; không khối nào khớp ⇒ không thanh bút', () => {
    const tree = expand(ObjGroupView({ ...props, marks: layer({ texts: { ctx: 'Anderer Text.', 'q:LV2-6': 'Was stimmt?' } }) }))
    expect(collect(tree, () => true).map(typeName)).not.toContain('MarkablePassage')
    expect(collect(tree, () => true).map(typeName)).toContain('MarksToolbar')
    const none = expand(ObjGroupView({ ...props, marks: layer({ texts: { ctx: 'Anderer Text.' } }) }))
    expect(collect(none, () => true).map(typeName)).not.toContain('MarksToolbar')
  })

  it('gạch bỏ theo luật server (canStrike) và khoá khi đang ẩn đánh dấu', () => {
    const onlyB = expand(ObjGroupView({ ...props, marks: layer({ canStrike: (_id, opt) => opt === 'b' }) }))
    expect(strikeButtons(onlyB).map((e) => e.props.accessibilityLabel)).toEqual(['Gạch bỏ phương án b. zwei'])
    const hidden = expand(ObjGroupView({ ...props, marks: layer({ hidden: true }) }))
    expect(strikeButtons(hidden)).toHaveLength(0)
    expect(rows(hidden).map((e) => String(e.props.label))[2]).not.toContain('(đã gạch bỏ)')
  })
})

describe('ObjGroupView — Lesen Teil 1 kiểu mẫu v3.4', () => {
  const lesen1 = parseExamSections(
    JSON.stringify({
      format: 'TELC',
      sections: [{
        name: 'LESEN',
        teile: [{
          teil: 1, type: 'MATCH_HEADLINE', single_use: true,
          headlines: { a: 'Kopf A', b: 'Kopf B', c: 'Kopf C' },
          items: [{ id: 'LV1-1', question: 'Text 1', text: 'Erster Text.' }, { id: 'LV1-2', question: 'Text 2', text: 'Zweiter Text.' }],
        }],
      }],
    }),
  ).sections[0].groups[0] as ExamObjGroup
  const typeName = (e: El) => (typeof e.type === 'function' ? (e.type as { name: string }).name : String(e.type))
  const props = { group: lesen1, section: 'LESEN', answers: { 'LV1-1': 'a' } as Record<string, string>, onAnswer: () => {} }

  it('dựng HeadlineMatch thay cho hộp "Các tiêu đề" + thẻ câu có nút chọn; truyền đủ đáp án, kết quả, bút', () => {
    const tree = expand(ObjGroupView({ ...props, marks: null }))
    const hm = collect(tree, (e) => typeName(e) === 'HeadlineMatch')
    expect(hm).toHaveLength(1)
    expect(hm[0].props.answers).toEqual({ 'LV1-1': 'a' })
    expect(rows(tree)).toHaveLength(0)
    const texts = collect(tree, (e) => typeof e.props.children === 'string').map((e) => e.props.children)
    expect(texts).not.toContain('Các tiêu đề')
    expect(texts).toContain('Teil 1')
  })

  it('hideTitle ẩn dòng tên Teil (màn đã ghi ở thanh đầu)', () => {
    const tree = expand(ObjGroupView({ ...props, hideTitle: true }))
    const texts = collect(tree, (e) => typeof e.props.children === 'string').map((e) => e.props.children)
    expect(texts).not.toContain('Teil 1')
  })
})
