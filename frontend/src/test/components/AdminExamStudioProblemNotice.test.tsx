/** Xưởng đề — thông báo lỗi phải đủ ba phần: chuyện gì, ở đâu, làm gì (kèm nút mở chỗ sửa). */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import adminContentEn from '../../../messages/v2/adminContent.en.json'
import adminContentDe from '../../../messages/v2/adminContent.de.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import type { SetRun, SetRunTeil } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({
  listSetRuns: vi.fn(), createSetRun: vi.fn(), discardSetRun: vi.fn(), approveSetRun: vi.fn(), getStudioChannel: vi.fn(),
  recheckSetRun: vi.fn(), redoSetRunTeil: vi.fn(), addSetRunHoeren: vi.fn(),
}))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

import { SetRunsPanel } from '@/components/admin/exam-studio/SetRunsPanel'
import { ProblemNotice } from '@/components/admin/ProblemNotice'
import { apiProblem, isGuided } from '@/lib/apiProblem'

const teil = (over: Partial<SetRunTeil>): SetRunTeil => ({
  section: 'LESEN', teil: 1, status: 'READY', stage: 'DONE', theme: 'Wohnen', draftId: 41,
  repairRound: 0, themeTry: 0, lastError: null, ...over,
})
const run = (over: Partial<SetRun>): SetRun => ({
  id: 11, examFormat: 'TELC', cefrLevel: 'B1', status: 'REVIEW', channel: 'FIREWORKS', profile: 'REAL', note: null,
  createdAt: '2026-11-13T01:00:00Z', updatedAt: null, teile: [teil({})], ...over,
})

const STALE_WHAT = 'Bài hoặc câu hỏi đã được sửa sau lần tự kiểm gần nhất, nên kết quả tự kiểm cũ không còn đúng'
const STALE_ACTION = 'Mở bản nháp, sang bước "Kiểm & duyệt", bấm "Chạy tự kiểm" và đợi chạy xong'
const DETAIL = 'Chưa duyệt được lượt #11: 2 trong 9 Teil chưa đạt, chưa Teil nào vào kho. Hören T2 · bản nháp #103: …'

/** Thân lỗi 409 đúng như backend `GuidedException` trả. */
const blocked = () => Object.assign(new Error('Request failed with status code 409'), {
  isAxiosError: true,
  response: {
    status: 409,
    data: {
      type: 'https://deutschflow.com/errors/conflict', title: 'Conflict', status: 409, detail: DETAIL,
      extensions: {
        code: 'EXAM_SET_RUN_NOT_APPROVABLE',
        title: 'Chưa duyệt được lượt #11: 2 trong 9 Teil chưa đạt, chưa Teil nào vào kho',
        where: { runId: 11 },
        issues: [
          { code: 'VERIFY_STALE', label: 'Hören T2 · bản nháp #103', what: STALE_WHAT, action: STALE_ACTION,
            url: '/v2/admin/exam-studio/103', where: { runId: 11, section: 'HOEREN', teil: 2, draftId: 103 } },
          { code: 'RED_LIGHTS', label: 'Lesen T3 · bản nháp #98', what: 'Còn 1 mục đỏ sau tự kiểm: Trùng nguồn',
            action: 'Mở bản nháp, sửa các mục đỏ', url: '/v2/admin/exam-studio/98',
            where: { runId: 11, section: 'LESEN', teil: 3, draftId: 98 } },
        ],
        next: 'Sửa xong các Teil trên thì quay lại lượt #11 và bấm "Duyệt cả bộ" lần nữa',
      },
    },
  },
})

const wrap = (ui: React.ReactNode) => render(
  <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }} onError={() => undefined}>
    {ui}
  </NextIntlClientProvider>,
)

describe('Thông báo lỗi có chỉ dẫn', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset())
    Object.values(toast).forEach((f) => f.mockReset())
    m.getStudioChannel.mockReturnValue('ROUTER')
  })

  it('apiProblem: đọc mã, tiêu đề, từng mục và việc sau cùng; lỗi kiểu cũ vẫn ra câu chữ', () => {
    const p = apiProblem(blocked())
    expect(isGuided(p)).toBe(true)
    expect(p.message).toBe(DETAIL)
    expect(p.code).toBe('EXAM_SET_RUN_NOT_APPROVABLE')
    expect(p.where).toEqual({ runId: 11 })
    expect(p.issues.map((i) => i.url)).toEqual(['/v2/admin/exam-studio/103', '/v2/admin/exam-studio/98'])
    expect(p.next).toMatch(/Duyệt cả bộ/)

    const old = apiProblem(Object.assign(new Error('x'), {
      isAxiosError: true, response: { status: 409, data: { detail: 'Teil này đã có y hệt trong kho.' } },
    }))
    expect(isGuided(old)).toBe(false)
    expect(old.message).toBe('Teil này đã có y hệt trong kho.')
    expect(old.issues).toEqual([])
  })

  it('apiProblem: bỏ đường dẫn ra ngoài trang', () => {
    const e = blocked()
    e.response.data.extensions.issues[0].url = 'https://example.com/x'
    e.response.data.extensions.issues[1].url = '//example.com/x'
    expect(apiProblem(e).issues.map((i) => i.url)).toEqual([null, null])
  })

  it('duyệt cả bộ bị chặn: thẻ lượt hiện đủ chuyện gì, ở đâu, làm gì và nút mở từng bản nháp; không tự tắt', async () => {
    m.listSetRuns.mockResolvedValue([run({})])
    m.approveSetRun.mockRejectedValue(blocked())
    wrap(<SetRunsPanel active />)
    await userEvent.click(await screen.findByRole('button', { name: 'Duyệt cả bộ' }))
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Duyệt cả bộ' }))

    const notice = await screen.findByRole('alert')
    // Chuyện gì
    expect(within(notice).getByText('Chưa duyệt được lượt #11: 2 trong 9 Teil chưa đạt, chưa Teil nào vào kho')).toBeInTheDocument()
    expect(within(notice).getByText(STALE_WHAT)).toBeInTheDocument()
    // Ở đâu
    expect(within(notice).getByText('Hören T2 · bản nháp #103')).toBeInTheDocument()
    expect(within(notice).getByText('Lesen T3 · bản nháp #98')).toBeInTheDocument()
    // Làm gì
    expect(within(notice).getByText(STALE_ACTION)).toBeInTheDocument()
    expect(within(notice).getByText(/quay lại lượt #11 và bấm "Duyệt cả bộ"/)).toBeInTheDocument()
    const links = within(notice).getAllByRole('link', { name: /Mở bản nháp/ })
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/v2/admin/exam-studio/103', '/v2/admin/exam-studio/98'])

    // Hộp xác nhận đóng lại để đọc danh sách; toast chỉ là lời nhắc ngắn trỏ tới thẻ lượt.
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(toast.error).toHaveBeenCalledWith(
      'Chưa duyệt được lượt #11: 2 Teil chưa đạt. Danh sách và cách sửa nằm ngay trong thẻ của lượt.')

    await userEvent.click(within(notice).getByRole('button', { name: 'Đóng thông báo' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lỗi kiểu cũ khi duyệt cả bộ: vẫn là toast câu chữ của backend', async () => {
    m.listSetRuns.mockResolvedValue([run({})])
    m.approveSetRun.mockRejectedValue(Object.assign(new Error('x'), {
      isAxiosError: true, response: { status: 400, data: { detail: 'Đề nền không hợp lệ cho kỳ thi và cấp này.' } },
    }))
    wrap(<SetRunsPanel active />)
    await userEvent.click(await screen.findByRole('button', { name: 'Duyệt cả bộ' }))
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Duyệt cả bộ' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Đề nền không hợp lệ cho kỳ thi và cấp này.'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Kiểm lại bộ" chưa đạt: toast nêu lượt nào, Teil nào còn kẹt, mấy mục đỏ và bấm gì tiếp', async () => {
    const stuck = run({ status: 'NEEDS_ATTENTION', teile: [
      teil({}), teil({ section: 'HOEREN', teil: 2, status: 'STUCK', stage: 'VERIFY', draftId: 103 }),
    ] })
    m.listSetRuns.mockResolvedValue([stuck])
    m.recheckSetRun.mockResolvedValue({ ...stuck, setChecks: [{ key: 'DUP', label: 'Trùng Teil kho', light: 'RED', detail: null }] })
    wrap(<SetRunsPanel active />)
    await userEvent.click(await screen.findByRole('button', { name: 'Kiểm lại bộ' }))
    await waitFor(() => expect(toast.message).toHaveBeenCalled())
    const said = toast.message.mock.calls[0][0] as string
    expect(said).toContain('Lượt #11 vẫn chưa duyệt được')
    expect(said).toContain('còn 1 Teil chưa xong (Hören T2)')
    expect(said).toContain('còn 1 mục đỏ')
    expect(said).toContain('Kiểm lại bộ')
  })

  it('"Làm lại Teil này" khi lượt khác đang chạy: khung lỗi trong thẻ lượt nêu lượt đang chạy và có nút mở', async () => {
    const r = run({ status: 'NEEDS_ATTENTION' })
    m.listSetRuns.mockResolvedValue([r])
    m.redoSetRunTeil.mockRejectedValue(Object.assign(new Error('x'), {
      isAxiosError: true,
      response: { status: 400, data: { detail: 'Chưa chạy được "Làm lại Teil này": lượt #12 đang chạy. …', extensions: {
        code: 'EXAM_SET_RUN_ANOTHER_ACTIVE', title: 'Chưa chạy được "Làm lại Teil này": lượt #12 đang chạy', where: { runId: 12 },
        issues: [{ code: 'ANOTHER_RUN_ACTIVE', label: 'Lượt #12', what: 'Mỗi lúc máy chỉ chạy một lượt tạo bộ đề',
          action: 'Đợi lượt #12 chạy xong', url: '/v2/admin/exam-studio?tab=assemblies&run=12', where: { runId: 12 } }],
        next: 'Sau đó bấm lại "Làm lại Teil này"',
      } } },
    }))
    wrap(<SetRunsPanel active />)
    await userEvent.click(await screen.findByRole('button', { name: 'Làm lại Teil này' }))
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Làm lại Teil này' }))
    const notice = await screen.findByRole('alert')
    expect(within(notice).getByText('Chưa chạy được "Làm lại Teil này": lượt #12 đang chạy')).toBeInTheDocument()
    expect(within(notice).getByText('Lượt #12')).toBeInTheDocument()
    expect(within(notice).getByText('Đợi lượt #12 chạy xong')).toBeInTheDocument()
    expect(within(notice).getByRole('link', { name: /Mở chỗ cần sửa/ }))
      .toHaveAttribute('href', '/v2/admin/exam-studio?tab=assemblies&run=12')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('không tải được danh sách lượt: nói rõ đang tải gì và có nút thử lại', async () => {
    m.listSetRuns.mockRejectedValueOnce(new Error('mất mạng')).mockResolvedValue([])
    wrap(<SetRunsPanel active />)
    const banner = await screen.findByRole('alert')
    expect(within(banner).getByText('Không tải được danh sách lượt tạo bộ đề')).toBeInTheDocument()
    await userEvent.click(within(banner).getByRole('button'))
    await waitFor(() => expect(m.listSetRuns).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('ProblemNotice: nhiều lý do của cùng một bản nháp gộp dưới một nhãn và một nút; hideLinks ẩn nút', () => {
    const p = apiProblem(blocked())
    p.issues[1] = { ...p.issues[1], label: p.issues[0].label, url: p.issues[0].url }
    const { unmount } = wrap(<ProblemNotice problem={p} />)
    expect(screen.getAllByText('Hören T2 · bản nháp #103')).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: /Mở bản nháp/ })).toHaveLength(1)
    expect(screen.getByText('Còn 1 mục đỏ sau tự kiểm: Trùng nguồn')).toBeInTheDocument()
    unmount()
    wrap(<ProblemNotice problem={p} hideLinks />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('ba ngôn ngữ đủ khoá của khung lỗi', () => {
    const pick = (msg: unknown) => Object.keys((msg as { adminContent: { problemNotice: object } }).adminContent.problemNotice).sort()
    const vi_ = pick(adminContentVi)
    expect(vi_.length).toBeGreaterThanOrEqual(5)
    for (const msg of [adminContentEn, adminContentDe]) expect(pick(msg)).toEqual(vi_)
  })
})
