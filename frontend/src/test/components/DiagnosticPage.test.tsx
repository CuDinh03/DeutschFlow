/**
 * Bài chẩn đoán `/v2/student/exam/diagnostic` (đợt (f) làm mới Luyện thi, 07/11/2026): khai ngày thi +
 * phút mỗi ngày → đủ mọi Teil như đề thật (13/11/2026: Lesen 1–3, Sprachbausteine 1–2, Hören 1–3 chấm qua
 * luyện đề; Viết AI chấm; Nói là lượt thi thử phần nói) → kết quả + lịch ôn.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  start: vi.fn(),
  grade: vi.fn(),
  finish: vi.fn(),
  overview: vi.fn(),
  check: vi.fn(),
  plan: vi.fn(),
  draft: vi.fn(),
  push: vi.fn(),
}))

const tts = vi.hoisted(() => ({
  speakExamLine: vi.fn(async () => {}),
  stopExamTts: vi.fn(),
  prepareExamLine: vi.fn(),
}))
vi.mock('@/components/features/exam-speaking/examTts', () => tts)

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }) }))

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/examDiagnosticApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/examDiagnosticApi')>()),
  examDiagnosticApi: { get: h.get, start: h.start, finish: h.finish },
}))
vi.mock('@/lib/telcPracticeApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/telcPracticeApi')>()),
  getPracticeOverview: h.overview,
  checkPracticeTeil: h.check,
  gradePracticeWriting: h.grade,
  savePracticeDraft: h.draft,
}))
vi.mock('@/lib/examPlanApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/examPlanApi')>()),
  examPlanApi: { get: h.plan },
}))

import DiagnosticPage from '@/app/v2/student/exam/diagnostic/page'
import { localIsoDate } from '@/lib/examPlanApi'
import type { DiagnosticView } from '@/lib/examDiagnosticApi'

const TEILE = ['LESEN-1', 'LESEN-2', 'LESEN-3', 'SPRACHBAUSTEINE-1', 'SPRACHBAUSTEINE-2', 'HOEREN-1', 'HOEREN-2', 'HOEREN-3', 'SCHREIBEN-1']
/** Bài chẩn đoán bản ngắn (trước 13/11/2026): chỉ Teil 1 mỗi phần. */
const OLD_TEILE = ['LESEN-1', 'SPRACHBAUSTEINE-1', 'HOEREN-1', 'SCHREIBEN-1']
const view = (over: Partial<DiagnosticView>): DiagnosticView => ({
  status: 'IN_PROGRESS', examId: 9, teile: TEILE, oral: null, skills: {}, startedAt: '2026-11-07T08:00:00Z', finishedAt: null, ...over,
})
const checked = { answers: {}, checked: true, score: 10, max: 25, elapsedSeconds: 0, updatedAt: null, result: null }
const WRITING = JSON.stringify({ sections: [{ name: 'SCHREIBEN', teile: [{ teil: 1, instruction_de: 'Schreiben Sie eine E-Mail.', writing_points: ['Dank', 'Grund', 'Vorschlag', 'Gruß'] }] }] })
const overview = (done: string[], keys: string[] = TEILE, sectionsJson: string = WRITING) => ({
  examId: 9, title: 'Đề 9', level: 'B1', format: 'TELC', sectionsJson,
  teile: keys.map((key) => ({ key, section: key.split('-')[0], teil: Number(key.split('-')[1]), type: null, items: 5, maxPoints: 25, suggestMinutes: 10, progress: done.includes(key) ? checked : null })),
})
/** Ba Teil Hören KHÔNG khai `max_plays` (đề thiếu trường này) — bài chẩn đoán phải tự bù theo đề thật. */
const HOEREN = JSON.stringify({
  sections: [{
    name: 'HOEREN',
    teile: [1, 2, 3].map((n) => ({
      teil: n,
      ansage_de: `Hörverstehen, Teil ${n}.`,
      items: [
        { id: `H${n}-1`, question: `Aussage ${n}-1 stimmt.`, audio_script: 'Der Zug fährt heute von Gleis 9.', speaker: 'M' },
        { id: `H${n}-2`, question: `Aussage ${n}-2 stimmt.`, audio_script: 'Bitte rufen Sie uns zurück.', speaker: 'F' },
      ],
    })),
  }],
})
const BEFORE_HOEREN = TEILE.slice(0, 5)
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return localIsoDate(d)
}

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset())
  tts.speakExamLine.mockClear()
  window.localStorage.clear()
  // jsdom không có matchMedia; khung làm bài đọc nó để chọn bố cục hai cột.
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
})


/**
 * Bấm "Nộp phần này". Còn câu bỏ trống thì trang hỏi lại — bấm "Vẫn nộp phần này" để đi tiếp như ý của ca kiểm.
 */
async function submitPart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Nộp phần này/ }))
  const confirm = screen.queryByRole('button', { name: 'Vẫn nộp phần này' })
  if (confirm) await user.click(confirm)
}

describe('Bài chẩn đoán', () => {
  it('khai thông tin: ngày đã qua báo lỗi tại chỗ; ngày hợp lệ ⇒ bắt đầu với số phút đã chọn', async () => {
    h.get.mockResolvedValue(view({ status: 'NONE', examId: null }))
    h.start.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(overview([]))
    const user = userEvent.setup()
    const { container } = render(<DiagnosticPage />)

    expect(await screen.findByRole('heading', { level: 1, name: /để biết nên luyện gì trước/ })).toBeInTheDocument()
    const date = container.querySelector('#diag-date') as HTMLInputElement
    await user.type(date, day(0))
    expect(screen.getByText('Ngày thi phải sau hôm nay.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Bắt đầu/ }))
    expect(h.start).not.toHaveBeenCalled()

    await user.clear(date)
    await user.type(date, day(35))
    expect(screen.getByText(/35 ngày/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Mỗi ngày ôn được'), '45')
    await user.click(screen.getByRole('button', { name: /Bắt đầu/ }))
    expect(h.start).toHaveBeenCalledWith(day(35), 45)
    // đủ mọi Teil: 9 Teil phần viết + thi nói
    expect(await screen.findByText('Bài chẩn đoán · phần 1/10')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lesen · Teil 1' })).toBeInTheDocument()
  })

  it('khai thông tin: nói rõ đủ mọi Teil như đề thật và thời lượng thật (150 phút viết + 20 phút nói)', async () => {
    h.get.mockResolvedValue(view({ status: 'NONE', examId: null }))
    render(<DiagnosticPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Khoảng 170 phút để biết nên luyện gì trước' })).toBeInTheDocument()
    expect(screen.getByText(/Đủ mọi Teil như đề thật.*Phần viết khoảng 150 phút, thi nói khoảng 20 phút/)).toBeInTheDocument()
    const chips = screen.getByRole('list', { name: 'Các phần' })
    expect(Array.from(chips.querySelectorAll('li')).map((li) => li.textContent?.trim())).toEqual([
      'Lesen · Teil 1–3', 'Sprachbausteine · Teil 1–2', 'Hören · Teil 1–3', 'Schreiben', 'Sprechen · Teil 1–3',
    ])
  })

  it('còn câu bỏ trống: bấm nộp phần thì hỏi lại; "Làm tiếp" không chấm, "Vẫn nộp phần này" mới chấm', async () => {
    h.get.mockResolvedValue(view({}))
    // Đang ở Hören Teil 1 (đề giả có 2 câu), chưa trả lời câu nào.
    h.overview.mockResolvedValue(overview(BEFORE_HOEREN, TEILE, HOEREN))
    h.check.mockResolvedValue(checked)
    const user = userEvent.setup()
    render(<DiagnosticPage />)
    expect(await screen.findByText('Bài chẩn đoán · phần 6/10')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Nộp phần này/ }))
    expect(await screen.findByText('Còn 2 câu chưa trả lời')).toBeInTheDocument()
    expect(screen.getByText(/không làm lại được trong bài chẩn đoán/)).toBeInTheDocument()
    expect(h.check).not.toHaveBeenCalled()

    // Quay lại làm tiếp: không chấm, vẫn ở phần 1.
    await user.click(screen.getByRole('button', { name: /làm tiếp/i }))
    expect(h.check).not.toHaveBeenCalled()
    expect(screen.getByText('Bài chẩn đoán · phần 6/10')).toBeInTheDocument()

    // Xác nhận nộp: lúc này mới chấm.
    await user.click(screen.getByRole('button', { name: /Nộp phần này/ }))
    await user.click(await screen.findByRole('button', { name: 'Vẫn nộp phần này' }))
    await waitFor(() => expect(h.check).toHaveBeenCalledTimes(1))
  })

  it('thứ tự phần như thi thật: Lesen 1–3 → Sprachbausteine 1–2 → Hören 1–3 → Schreiben → Sprechen', async () => {
    h.get.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(overview([]))
    h.check.mockResolvedValue(checked)
    const user = userEvent.setup()
    const { container } = render(<DiagnosticPage />)
    expect(await screen.findByText('Bài chẩn đoán · phần 1/10')).toBeInTheDocument()
    // thanh tiến độ: năm nhóm phần thi, mỗi Teil một vạch, đúng thứ tự
    expect(Array.from(container.querySelectorAll('[data-part]')).map((el) => el.getAttribute('data-part'))).toEqual([...TEILE, 'SPRECHEN'])
    expect(screen.getAllByRole('listitem')).toHaveLength(5)

    const titles = ['Lesen · Teil 1', 'Lesen · Teil 2', 'Lesen · Teil 3', 'Sprachbausteine · Teil 1', 'Sprachbausteine · Teil 2', 'Hören · Teil 1', 'Hören · Teil 2', 'Hören · Teil 3']
    for (let i = 0; i < titles.length; i++) {
      expect(await screen.findByText(`Bài chẩn đoán · phần ${i + 1}/10`)).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: titles[i] })).toBeInTheDocument()
      await submitPart(user)
    }
    expect(h.check.mock.calls.map((c) => c[1])).toEqual(TEILE.slice(0, 8))
    expect(await screen.findByText('Bài chẩn đoán · phần 9/10')).toBeInTheDocument()
    // Schreiben chỉ có một Teil ⇒ không ghi số Teil
    expect(screen.getByRole('heading', { name: 'Schreiben' })).toBeInTheDocument()
  })

  it('lượt bắt đầu từ bản ngắn: Teil 1 đã chấm được giữ, làm tiếp Teil mới đầu tiên; nháp cũ vẫn còn khi tới phần đó', async () => {
    // Bản ngắn: đã xong Lesen 1 + Sprachbausteine 1, đang viết dở ở Hören 1.
    const o = overview(['LESEN-1', 'SPRACHBAUSTEINE-1'])
    o.teile[5].progress = { answers: { 'H1-1': 'richtig' }, checked: false, score: null, max: null, elapsedSeconds: 60, updatedAt: null, result: null } as never
    h.get.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(o)
    h.check.mockResolvedValue(checked)
    const user = userEvent.setup()
    const { container } = render(<DiagnosticPage />)

    expect(await screen.findByText('Bài chẩn đoán · phần 2/10')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lesen · Teil 2' })).toBeInTheDocument()
    const state = (part: string) => container.querySelector(`[data-part="${part}"]`)?.getAttribute('data-state')
    expect(state('LESEN-1')).toBe('done')
    expect(state('SPRACHBAUSTEINE-1')).toBe('done')
    expect(state('LESEN-2')).toBe('cur')
    expect(state('HOEREN-1')).toBe('todo')

    // Lesen 2, Lesen 3 → nhảy qua Sprachbausteine 1 (đã xong) sang Sprachbausteine 2 → Hören 1 với nháp cũ
    await submitPart(user)
    expect(await screen.findByText('Bài chẩn đoán · phần 3/10')).toBeInTheDocument()
    await submitPart(user)
    expect(await screen.findByText('Bài chẩn đoán · phần 5/10')).toBeInTheDocument()
    await submitPart(user)
    expect(await screen.findByText('Bài chẩn đoán · phần 6/10')).toBeInTheDocument()
    await submitPart(user)
    await waitFor(() => expect(h.check).toHaveBeenCalledTimes(4))
    expect(h.check.mock.calls.map((c) => c[1])).toEqual(['LESEN-2', 'LESEN-3', 'SPRACHBAUSTEINE-2', 'HOEREN-1'])
    expect(h.check.mock.calls[3][2]).toEqual({ 'H1-1': 'richtig' })
    expect(h.finish).not.toHaveBeenCalled()
  })

  it('đề đã chọn không có Teil 2/3 (lượt cũ): chỉ còn các Teil đề có, không vỡ', async () => {
    h.get.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(overview(['LESEN-1'], OLD_TEILE))
    render(<DiagnosticPage />)
    expect(await screen.findByText('Bài chẩn đoán · phần 2/5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sprachbausteine' })).toBeInTheDocument()
  })

  it('Nghe như thi thật: Teil 1 nghe 1 lần, Teil 2 và 3 nghe 2 lần, kể cả khi đề không khai số lần nghe', async () => {
    h.get.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(overview(BEFORE_HOEREN, TEILE, HOEREN))
    h.check.mockResolvedValue(checked)
    const user = userEvent.setup()
    render(<DiagnosticPage />)

    expect(await screen.findByRole('heading', { name: 'Hören · Teil 1' })).toBeInTheDocument()
    expect(screen.getByText('Nghe 1 lần')).toBeInTheDocument()
    // bài chẩn đoán không có "Luyện thoải mái"
    expect(screen.queryByText('Nghe không giới hạn')).not.toBeInTheDocument()
    await submitPart(user)
    expect(await screen.findByRole('heading', { name: 'Hören · Teil 2' })).toBeInTheDocument()
    expect(screen.getByText('Nghe 2 lần')).toBeInTheDocument()
    await submitPart(user)
    expect(await screen.findByRole('heading', { name: 'Hören · Teil 3' })).toBeInTheDocument()
    expect(screen.getByText('Nghe 2 lần')).toBeInTheDocument()
  })

  it('Nghe: hướng dẫn mỗi Teil chỉ đọc một lần — chọn đáp án không đưa về bước chuẩn bị', async () => {
    h.get.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(overview(BEFORE_HOEREN, TEILE, HOEREN))
    h.draft.mockResolvedValue(null)
    const user = userEvent.setup()
    render(<DiagnosticPage />)

    await user.click(await screen.findByRole('button', { name: /Bắt đầu Teil 1/ }))
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledWith('PRUEFER', 'Hörverstehen, Teil 1.'))
    expect(await screen.findByText('Aussage 1-1 stimmt.')).toBeInTheDocument()
    const ansage = () => tts.speakExamLine.mock.calls.filter((c) => (c as unknown[])[1] === 'Hörverstehen, Teil 1.').length
    expect(ansage()).toBe(1)

    await user.click(screen.getAllByRole('radio')[0])
    expect(screen.queryByRole('button', { name: /Bắt đầu Teil 1/ })).not.toBeInTheDocument()
    expect(screen.getByText('Aussage 1-1 stimmt.')).toBeInTheDocument()
    expect(ansage()).toBe(1)
  })

  it('làm dở: vào thẳng phần đang dở; Teil qua luyện đề, Viết AI chấm, Nói lấy từ lượt thi nói rồi chốt', async () => {
    h.get.mockResolvedValueOnce(view({}))
    h.overview.mockResolvedValueOnce(overview(TEILE.slice(0, 7)))
    h.check.mockResolvedValue(checked)
    h.grade.mockResolvedValue({ status: 'AI_EVALUATED', total: 30, max: 45 })
    h.overview.mockResolvedValue(overview(TEILE))
    h.finish.mockResolvedValue(view({ status: 'DONE', skills: { LESEN: 45, HOEREN: 80, SCHREIBEN: 67, SPRECHEN: 60 } }))
    h.plan.mockResolvedValue({ status: 'ACTIVE', totalWeeks: 5, weeklyMinutes: 210, warnings: [], weeks: [] })
    const user = userEvent.setup()
    render(<DiagnosticPage />)

    // Lesen, Bausteine, Hören 1–2 đã xong ⇒ vào thẳng Hören Teil 3 (phần 8)
    expect(await screen.findByText('Bài chẩn đoán · phần 8/10')).toBeInTheDocument()
    await submitPart(user)
    expect(h.check).toHaveBeenCalledWith(9, 'HOEREN-3', {}, expect.any(Number))

    // Viết: đề thật, nộp thì AI chấm
    expect(await screen.findByText('Bài chẩn đoán · phần 9/10')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /Nộp bài viết/ })
    expect(submit).toBeDisabled()
    await user.type(screen.getByRole('textbox'), 'Liebe Anna, vielen Dank für die Einladung.')
    await user.click(submit)
    expect(h.grade).toHaveBeenCalledWith(9, 'Liebe Anna, vielen Dank für die Einladung.', expect.any(Number))

    // Nói: dẫn sang phòng thi nói; chưa có lượt thi nói ⇒ báo, có rồi ⇒ chốt
    expect(await screen.findByText('Bài chẩn đoán · phần 10/10')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Vào phòng thi nói/ })).toHaveAttribute('href', '/v2/student/mock-exam/oral?provider=TELC&level=B1&mode=MOCK')
    h.get.mockResolvedValueOnce(view({}))
    await user.click(screen.getByRole('button', { name: /Kiểm tra kết quả thi nói/ }))
    expect(await screen.findByText(/Chưa thấy lượt thi nói nào/)).toBeInTheDocument()
    h.get.mockResolvedValueOnce(view({ oral: { sessionId: 3, total: 45, max: 75 } }))
    await user.click(screen.getByRole('button', { name: /Kiểm tra kết quả thi nói/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Lesen cần luyện trước' })).toBeInTheDocument()
    expect(h.finish).toHaveBeenCalled()
  })

  it('thoát giữa chừng: nạp nháp phần đang làm, hỏi trước khi rời, lưu nháp rồi mới về Hôm nay', async () => {
    const o = overview(TEILE.slice(0, 8))
    o.teile[8].progress = { answers: { text: 'Liebe Anna' }, checked: false, score: null, max: null, elapsedSeconds: 120, updatedAt: null, result: null } as never
    h.get.mockResolvedValue(view({}))
    h.overview.mockResolvedValue(o)
    h.draft.mockResolvedValue(null)
    const user = userEvent.setup()
    render(<DiagnosticPage />)

    expect(await screen.findByText('Bài chẩn đoán · phần 9/10')).toBeInTheDocument()
    // Nháp nạp sau tiêu đề một nhịp (CI chậm từng trượt ở đây) ⇒ chờ giá trị, không đọc ngay.
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Liebe Anna'))
    await user.click(screen.getByRole('button', { name: /^Rời bài chẩn đoán/ }))
    expect(await screen.findByText('Rời bài chẩn đoán?')).toBeInTheDocument()
    expect(h.push).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Lưu và rời' }))
    expect(h.draft).toHaveBeenCalledWith(9, 'SCHREIBEN-1', { text: 'Liebe Anna' }, expect.any(Number))
    expect((h.draft.mock.calls[0] as unknown[])[3]).toBeGreaterThanOrEqual(120)
    expect(h.push).toHaveBeenCalledWith('/v2/student/exam')
  })

  it('kết quả: bốn kỹ năng, Viết/Nói ghi AI chấm ước tính, lịch ôn sẵn sàng', async () => {
    h.get.mockResolvedValue(view({ status: 'DONE', skills: { LESEN: 45, HOEREN: 62, SCHREIBEN: 65, SPRECHEN: 50 } }))
    h.plan.mockResolvedValue({
      status: 'ACTIVE', totalWeeks: 5, weeklyMinutes: 210, warnings: [],
      weeks: [
        { weekNo: 1, tasks: [{ type: 'DIAGNOSTIC_EXAM' }] },
        { weekNo: 4, tasks: [{ type: 'FULL_EXAM' }, { type: 'ORAL_MOCK' }] },
      ],
    })
    render(<DiagnosticPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Lesen cần luyện trước' })).toBeInTheDocument()
    expect(screen.getAllByText('AI chấm theo tiêu chí telc · ước tính')).toHaveLength(2)
    expect(await screen.findByRole('heading', { name: 'Lịch ôn 5 tuần đã sẵn sàng' })).toBeInTheDocument()
    expect(screen.getByText('30 phút mỗi ngày · 2 lần thi thử')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xem hôm nay/ })).toHaveAttribute('href', '/v2/student/exam')
    expect(screen.queryByText(/bản ngắn/)).not.toBeInTheDocument()
  })

  it('kết quả của bài bản ngắn: điểm cũ giữ nguyên, có dòng mời làm lại để đo đủ Teil', async () => {
    h.get.mockResolvedValue(view({ status: 'DONE', shortForm: true, skills: { LESEN: 45, HOEREN: 62, SCHREIBEN: 65, SPRECHEN: 50 } }))
    h.plan.mockResolvedValue({ status: 'ACTIVE', totalWeeks: 5, weeklyMinutes: 210, warnings: [], weeks: [] })
    render(<DiagnosticPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Lesen cần luyện trước' })).toBeInTheDocument()
    expect(screen.getByText(/bài chẩn đoán bản ngắn \(chỉ Teil 1 mỗi phần\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Làm lại bài chẩn đoán/ })).toBeInTheDocument()
  })
})
