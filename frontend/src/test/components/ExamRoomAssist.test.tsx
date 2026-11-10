/**
 * B3 "Nâng phòng thi" (09/11/2026): cờ "đánh dấu xem lại" cho mọi dạng câu + hàng nhảy tới câu đã đánh
 * dấu, cờ do trang giữ (thi thử) và lưu cùng nháp trên server, danh sách câu đánh dấu của chặng thi, bộ
 * nhớ trong trang cho "Hỏi AI về câu này".
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }))
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/api', () => ({
  default: { post: h.post, patch: h.patch, get: vi.fn() },
  apiMessage: () => 'lỗi',
  httpStatus: (e: { response?: { status?: number } }) => e?.response?.status ?? null,
  isAxiosErr: (e: unknown) => !!(e as { response?: unknown })?.response,
}))

import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { PracticeFootSlot } from '@/components/exam/practice/PracticeShell'
import { ItemAssist, useCachedAsk, type ItemAssistValue } from '@/components/exam/practice/itemAssist'
import { FlaggedNav } from '@/components/exam/mock/FlaggedNav'
import type { PracticeTeilData } from '@/components/exam/practice/practiceModel'
import { askAttemptItemAi, saveAttemptDraft, startAttempt } from '@/lib/exam/mockAttemptApi'
import { classifyDraftSaveError } from '@/lib/exam/examDraftSync'
import { askPracticeItemAi } from '@/lib/telcPracticeApi'

const GAP: PracticeTeilData = {
  teil: 2,
  type: 'GAP_WORDBANK',
  gapped_text: 'Liebe Anna, ___31___ dir. Ich ___32___ morgen.',
  word_bank: { a: 'danke', b: 'komme', c: 'gehe' },
  items: [{ id: 'SB2-31', gap: 31 }, { id: 'SB2-32', gap: 32 }],
}

/** Trang giữ cờ như thi thử: Set trong state, toggle qua context. */
function Harness({ teil, kind, initial = [] as string[] }: { teil: PracticeTeilData; kind: 'gap-bank' | 'mc'; initial?: string[] }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [flags, setFlags] = React.useState<string[]>(initial)
  const [slot, setSlot] = React.useState<HTMLElement | null>(null)
  const assist = React.useMemo<ItemAssistValue>(
    () => ({
      flags: new Set(flags),
      onToggleFlag: (id) => setFlags((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    }),
    [flags],
  )
  return (
    <>
      <ItemAssist.Provider value={assist}>
        <PracticeFootSlot.Provider value={slot}>
          <ObjectiveTeilView
            teil={teil}
            kind={kind}
            answers={answers}
            onAnswer={(id, v) => setAnswers((p) => ({ ...p, [id]: v ?? '' }))}
            result={null}
            wide
            tips={null}
          />
        </PracticeFootSlot.Provider>
      </ItemAssist.Provider>
      <footer data-testid="foot"><div ref={setSlot} /></footer>
      <output data-testid="flags">{JSON.stringify(flags)}</output>
    </>
  )
}

beforeEach(() => {
  h.post.mockReset()
  h.patch.mockReset()
})

describe('Đánh dấu xem lại trong ObjectiveTeilView', () => {
  it('dạng chỗ trống cũng có cờ cho câu đang chọn; cờ do trang giữ; hàng "Câu đã đánh dấu" nhảy tới câu', async () => {
    const user = userEvent.setup()
    render(<Harness teil={GAP} kind="gap-bank" />)

    const flag31 = screen.getByRole('button', { name: 'Đánh dấu câu 31 để xem lại' })
    expect(flag31).toHaveAttribute('aria-pressed', 'false')
    await user.click(flag31)
    expect(screen.getByTestId('flags').textContent).toBe('["SB2-31"]')
    expect(screen.getByRole('button', { name: 'Đánh dấu câu 31 để xem lại' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByTestId('foot')).getByRole('button', { name: 'Câu 31, chưa làm, đã đánh dấu' })).toBeInTheDocument()

    // Sang câu 32 rồi dùng hàng "Câu đã đánh dấu" để quay lại câu 31.
    await user.click(within(screen.getByTestId('foot')).getByRole('button', { name: 'Câu 32, chưa làm' }))
    expect(screen.getByText('Chọn từ cho chỗ 32')).toBeInTheDocument()
    const list = screen.getByRole('group', { name: 'Câu đã đánh dấu' })
    await user.click(within(list).getByRole('button', { name: 'Tới câu 31' }))
    expect(screen.getByText('Chọn từ cho chỗ 31')).toBeInTheDocument()
  })

  it('phím F đánh dấu câu đang chọn ở dạng chỗ trống (F không phải lựa chọn của kho từ)', async () => {
    const user = userEvent.setup()
    render(<Harness teil={GAP} kind="gap-bank" />)
    await user.keyboard('f')
    expect(screen.getByTestId('flags').textContent).toBe('["SB2-31"]')
    await user.keyboard('f')
    expect(screen.getByTestId('flags').textContent).toBe('[]')
  })

  it('cờ đã lưu (tải lại trang) hiện ngay khi mở Teil', () => {
    render(<Harness teil={GAP} kind="gap-bank" initial={['SB2-32']} />)
    const list = screen.getByRole('group', { name: 'Câu đã đánh dấu' })
    expect(within(list).getByRole('button', { name: 'Tới câu 32' })).toBeInTheDocument()
  })
})

describe('Danh sách câu đánh dấu của chặng thi', () => {
  it('nút hiện số câu, mở danh sách, bấm một câu thì nhảy; Esc đóng', async () => {
    const onJump = vi.fn()
    const user = userEvent.setup()
    render(<FlaggedNav entries={[{ id: 'LV2-6', teilIdx: 1, teil: 'Lesen Teil 2', label: '6' }]} onJump={onJump} />)
    const btn = screen.getByRole('button', { name: /Câu đánh dấu \(1\)/ })
    await user.click(btn)
    const region = screen.getByRole('region', { name: 'Câu đánh dấu trong phần đang thi' })
    await user.click(within(region).getByRole('button', { name: 'Lesen Teil 2 · câu 6' }))
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ id: 'LV2-6', teilIdx: 1 }))
    expect(screen.queryByRole('region')).toBeNull()

    await user.click(btn)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region')).toBeNull()
    expect(btn).toHaveFocus()
  })

  it('chưa đánh dấu câu nào ⇒ hướng dẫn cách đánh dấu', async () => {
    const user = userEvent.setup()
    render(<FlaggedNav entries={[]} onJump={() => undefined} />)
    await user.click(screen.getByRole('button', { name: /Câu đánh dấu \(0\)/ }))
    expect(screen.getByText(/Chưa đánh dấu câu nào/)).toBeInTheDocument()
  })
})

describe('Câu đánh dấu lưu cùng nháp thi thử', () => {
  it('PATCH nháp gửi flags; không có flags thì không gửi trường (server giữ giá trị cũ)', async () => {
    h.patch.mockResolvedValue({ data: { version: 4, remaining_seconds: 100 } })
    await saveAttemptDraft(9, { answers: { 'LV2-6': 'a' }, sectionIndex: 0, flags: ['LV2-6'] }, 3)
    expect(h.patch).toHaveBeenLastCalledWith('/mock-exams/attempts/9/draft', {
      answers: { 'LV2-6': 'a' }, sectionIndex: 0, flags: ['LV2-6'], baseVersion: 3,
    })
    await saveAttemptDraft(9, { answers: {}, sectionIndex: 0 }, 4)
    expect(h.patch.mock.calls[1][1]).not.toHaveProperty('flags')
  })

  it('làm tiếp lượt dở: /start trả draft.flags ⇒ khôi phục; xung đột phiên bản mang flags của server', async () => {
    h.post.mockResolvedValue({
      data: { id: 9, exam_id: 7, sections_json: '{"sections":[]}', remaining_seconds: 600,
        draft: { answers_json: '{"LV2-6":"a"}', section_index: 0, version: 2, flags: ['LV2-6', 5, ''] } },
    })
    const s = await startAttempt(7)
    expect(s.flags).toEqual(['LV2-6'])
    expect(s.answers).toEqual({ 'LV2-6': 'a' })

    const conflict = classifyDraftSaveError(409, { server_version: 5, draft: { answers_json: '{}', version: 5, flags: ['LV2-7'] } })
    expect(conflict).toMatchObject({ kind: 'conflict', draft: { flags: ['LV2-7'] } })
  })
})

describe('Hỏi AI về câu này — API và bộ nhớ trong trang', () => {
  it('POST đúng đường dẫn cho luyện Teil và lượt thi thử, kèm ngôn ngữ giao diện', async () => {
    h.post.mockResolvedValue({ data: { itemId: 'LV2-6', locale: 'en', answer: 'x', cached: false } })
    await askPracticeItemAi(7, 'LESEN-2', 'LV2-6', 'en')
    expect(h.post).toHaveBeenLastCalledWith('/mock-exams/practice/7/teile/LESEN-2/items/LV2-6/ask-ai', { locale: 'en' })
    await askAttemptItemAi(9, 'HOEREN-1', 'HV1-41', 'vi')
    expect(h.post).toHaveBeenLastCalledWith('/mock-exams/practice/attempts/9/teile/HOEREN-1/items/HV1-41/ask-ai', { locale: 'vi' })
  })

  it('mở lại câu đã hỏi không gọi lại server', async () => {
    const ask = vi.fn(async (id: string) => ({ itemId: id, locale: 'vi', answer: 'a', cached: false }))
    let cached: ((id: string) => Promise<unknown>) | undefined
    function Probe() {
      cached = useCachedAsk(ask, 'scope')
      return null
    }
    render(<Probe />)
    await cached!('LV2-6')
    await cached!('LV2-6')
    await cached!('LV2-7')
    expect(ask).toHaveBeenCalledTimes(2)
  })
})
