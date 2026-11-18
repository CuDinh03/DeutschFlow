// Dựng cây phần tử của một Teil (không có renderer trong dự án — gọi thẳng hàm component như
// MinorAudioBlockedSheet.test). Kiểm: Teil ghép rao vặt in kho lựa chọn và thêm "không mẩu nào hợp";
// lựa chọn câu khác đã dùng bị khoá; sau kiểm tra thì khoá hết, tô đáp án đúng / lựa chọn sai, có giải thích.

import type { ReactElement } from 'react'
import { ObjGroupView } from '../ExamTeilBody'
import { parseExamSections, type ExamObjGroup } from '@/lib/examApi'
import type { PracticeItemResult } from '@/lib/telcPracticeApi'

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
jest.mock('../ReadingPassage', () => ({ ReadingPassage: () => null }))
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
