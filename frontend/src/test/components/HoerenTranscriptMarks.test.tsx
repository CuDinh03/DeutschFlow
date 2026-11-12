/**
 * Đánh dấu lời bài Hören (đợt 3b, 10/11/2026): chỉ SAU khi kiểm tra; lời thoại vẽ từng dòng thành khối
 * `h:<phạm vi>:<i>` khớp server; đánh dấu đã lưu hiện lại trên đúng dòng. Lúc đang làm bài: không có bút.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/features/exam-speaking/examTts', () => ({ speakExamLine: vi.fn(async () => {}), stopExamTts: vi.fn(), prepareExamLine: vi.fn() }))
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

import { HoerenTeilView } from '@/components/exam/practice/HoerenTeilView'
import { marksTexts } from '@/components/exam/marks/marksBlocks'
import { emptyPack, fnv1a, type MarksPack } from '@/components/exam/marks/marksModel'
import type { PassageMarks } from '@/components/exam/marks/usePassageMarks'
import type { PracticeTeilData } from '@/components/exam/practice/practiceModel'
import type { PracticeTeilResult } from '@/lib/telcPracticeApi'

const teil: PracticeTeilData = {
  teil: 1,
  items: [
    { id: 'HV1-41', question: 'Der Zug fährt von Gleis 7.', lead_in_de: 'Am Bahnhof hören Sie:', audio_script: ' Der Zug fährt heute von Gleis 9. ', speaker: 'M' },
  ],
}
const texts = marksTexts(teil)

function fakeMarks(pack: MarksPack): PassageMarks {
  return {
    ready: true, pack, texts, saveState: 'idle', staleDropped: false, hidden: false, setHidden: () => undefined,
    apply: vi.fn(), undo: () => undefined, canUndo: false, clearLocal: () => undefined,
  }
}

const result: PracticeTeilResult = {
  teilKey: 'HOEREN-1', type: 'TRUE_FALSE', score: 0, max: 5, correctCount: 0, total: 1, unusedOptions: [],
  items: [{ id: 'HV1-41', label: '41', given: 'r', givenText: null, correct: 'f', correctText: 'falsch', answered: true, isCorrect: false, points: 0, whyRight: null, whyWrong: null, trap: null, evidence: ['von Gleis 9'], need: null, rule: null }],
} as unknown as PracticeTeilResult

beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('min-width'), media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => undefined
})

describe('Đánh dấu lời bài Hören (đợt 3b)', () => {
  it('sau kiểm tra: lời thoại từng dòng là khối đánh dấu, đánh dấu đã lưu hiện đúng dòng', async () => {
    const user = userEvent.setup()
    const line = texts['h:HV1-41:1']
    expect(texts['h:HV1-41:0']).toBe('Am Bahnhof hören Sie:')
    expect(line).toBe('Der Zug fährt heute von Gleis 9.')
    const s = line.indexOf('Gleis 9')
    const pack: MarksPack = {
      ...emptyPack(),
      blocks: { 'h:HV1-41:1': fnv1a(line) },
      marks: [{ id: 'h1', g: 'g1', b: 'h:HV1-41:1', s, e: s + 7, k: 'hl', c: 'g', q: null, n: '' }],
    }
    render(<HoerenTeilView teil={teil} answers={{ 'HV1-41': 'r' }} onAnswer={() => undefined} result={result} wide tips={null} marks={fakeMarks(pack)} />)

    expect(screen.getByText('Bút đánh dấu')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xem lời thoại' }))
    const seg = document.querySelector('[data-seg][data-b="h:HV1-41:1"][data-gid="g1"]')
    expect(seg).toHaveTextContent('Gleis 9')
    expect(seg).toHaveClass('ga-mark-g')
    expect(document.querySelector('[data-b="h:HV1-41:0"]')).toHaveTextContent('Am Bahnhof hören Sie:')
  })

  it('đang làm bài (chưa kiểm tra): không có bút đánh dấu', () => {
    render(<HoerenTeilView teil={teil} answers={{}} onAnswer={() => undefined} result={null} wide tips={null} allowRelaxed marks={fakeMarks(emptyPack())} />)
    expect(screen.queryByText('Bút đánh dấu')).toBeNull()
  })
})
