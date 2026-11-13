/** Xưởng đề — "Tạo bộ đề tự động": nút tạo lượt và bảng theo dõi các Teil. */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import adminContentEn from '../../../messages/v2/adminContent.en.json'
import adminContentDe from '../../../messages/v2/adminContent.de.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import type { SetAuto, SetRun, SetRunTeil } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({
  listSetRuns: vi.fn(), createSetRun: vi.fn(), discardSetRun: vi.fn(), approveSetRun: vi.fn(), getStudioChannel: vi.fn(),
  getSetAuto: vi.fn(), putSetAuto: vi.fn(), recheckSetRun: vi.fn(), redoSetRunTeil: vi.fn(), addSetRunHoeren: vi.fn(),
}))
const autoView = (over: Partial<SetAuto> = {}): SetAuto => ({
  enabled: false, examFormat: 'TELC', cefrLevel: 'B1', profile: 'REAL', channel: 'FIREWORKS', note: null,
  waiting: 1, maxWaiting: 5, ...over,
})
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

import { SetRunsPanel } from '@/components/admin/exam-studio/SetRunsPanel'

const teil = (over: Partial<SetRunTeil>): SetRunTeil => ({
  section: 'LESEN', teil: 1, status: 'RUNNING', stage: 'SOURCING', theme: 'Wohnen', draftId: 41,
  repairRound: 0, themeTry: 0, lastError: null, ...over,
})
const run = (over: Partial<SetRun>): SetRun => ({
  id: 7, examFormat: 'TELC', cefrLevel: 'B1', status: 'RUNNING', channel: 'FIREWORKS', profile: 'REAL', note: null,
  createdAt: '2026-11-12T01:00:00Z', updatedAt: null, teile: [teil({})], ...over,
})

const show = () => render(
  <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }} onError={() => undefined}>
    <SetRunsPanel active />
  </NextIntlClientProvider>,
)

describe('SetRunsPanel', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset())
    toast.success.mockReset()
    m.getStudioChannel.mockReturnValue('ROUTER')
    m.getSetAuto.mockResolvedValue(autoView())
  })

  it('bật tự nối lượt: gửi kỳ thi + kênh đang chọn, hiện trạng thái đang tự nối; bấm lần nữa thì tắt', async () => {
    m.listSetRuns.mockResolvedValue([run({})])
    m.putSetAuto.mockResolvedValueOnce(autoView({ enabled: true, channel: 'ROUTER' }))
      .mockResolvedValueOnce(autoView({ enabled: false }))
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Bật tự nối lượt/ }))
    await waitFor(() => expect(m.putSetAuto).toHaveBeenCalledWith(
      { enabled: true, examFormat: 'TELC', cefrLevel: 'B1', profile: 'REAL', channel: 'ROUTER' }))
    expect(await screen.findByText(/Đang tự nối lượt/)).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Đã bật tự nối lượt.')
    await userEvent.click(screen.getByRole('button', { name: /Tắt tự nối lượt/ }))
    await waitFor(() => expect(m.putSetAuto).toHaveBeenLastCalledWith({ enabled: false }))
    expect(await screen.findByRole('button', { name: /Bật tự nối lượt/ })).toBeInTheDocument()
  })

  it('tự nối lượt đang tạm dừng: hiện lý do máy ghi', async () => {
    m.listSetRuns.mockResolvedValue([])
    m.getSetAuto.mockResolvedValue(autoView({ enabled: true, waiting: 5, note: 'Tạm dừng: đang có 5 bộ chờ bạn xem.' }))
    show()
    expect(await screen.findByText('Tạm dừng: đang có 5 bộ chờ bạn xem.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tắt tự nối lượt/ })).toBeInTheDocument()
  })

  it('chưa có lượt: bấm nút tạo lượt telc B1 trên kênh đang chọn', async () => {
    m.listSetRuns.mockResolvedValue([])
    m.createSetRun.mockResolvedValue(run({}))
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Tạo bộ đề telc B1/ }))
    await waitFor(() => expect(m.createSetRun).toHaveBeenCalledWith(
      { examFormat: 'TELC', cefrLevel: 'B1', profile: 'REAL', channel: 'ROUTER' }))
    expect(toast.success).toHaveBeenCalledWith('Đã bắt đầu lượt tạo bộ đề.')
    expect(m.listSetRuns).toHaveBeenCalledTimes(2)
  })

  it('lượt đang chạy: nút bị khoá; mỗi Teil hiện bước, chủ đề, số vòng sửa, lỗi và đường mở bản nháp', async () => {
    m.listSetRuns.mockResolvedValue([run({
      teile: [
        teil({}),
        teil({ teil: 2, status: 'READY', stage: 'DONE', theme: 'Reisen', draftId: 42 }),
        teil({ section: 'SPRACHBAUSTEINE', teil: 1, stage: 'REPAIR_ITEMS', theme: 'Sport', draftId: 43, repairRound: 1,
          lastError: 'Câu đỏ: SB1-23' }),
        teil({ section: 'SCHREIBEN', teil: 1, status: 'STUCK', stage: 'VERIFY', theme: null, draftId: null, themeTry: 1,
          lastError: 'Không còn chủ đề thay thế có đủ bài.' }),
      ],
    })])
    show()
    expect(await screen.findByText('Lượt #7 · telc B1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tạo bộ đề telc B1/ })).toBeDisabled()
    expect(screen.getByText('1/4 Teil xong')).toBeInTheDocument()
    expect(screen.getByText('Đang có một lượt chạy. Đợi lượt đó xong rồi mới tạo lượt mới.')).toBeInTheDocument()

    const lesen1 = screen.getByText('Lesen T1').closest('li') as HTMLElement
    expect(within(lesen1).getByText('Lấy nguồn')).toBeInTheDocument()
    expect(within(lesen1).getByRole('link', { name: 'Mở bản nháp' })).toHaveAttribute('href', '/v2/admin/exam-studio/41')

    const sb1 = screen.getByText('Sprachbausteine T1').closest('li') as HTMLElement
    expect(within(sb1).getByText('Sửa câu đỏ')).toBeInTheDocument()
    expect(within(sb1).getByText('tự sửa 1 vòng · đổi chủ đề 0 lần')).toBeInTheDocument()
    expect(within(sb1).getByText('Câu đỏ: SB1-23')).toBeInTheDocument()

    const schreiben = screen.getByText('Schreiben T1').closest('li') as HTMLElement
    expect(within(schreiben).getByText('Kẹt')).toBeInTheDocument()
    expect(within(schreiben).queryByRole('link', { name: 'Mở bản nháp' })).not.toBeInTheDocument()
  })

  it('lượt sẵn sàng duyệt: bấm "Duyệt cả bộ", xác nhận, gọi API và báo cho tab nạp lại danh sách bộ đề', async () => {
    m.listSetRuns.mockResolvedValue([run({ status: 'REVIEW', teile: [teil({ status: 'READY', stage: 'DONE' })] })])
    m.approveSetRun.mockResolvedValue(run({ status: 'APPROVED' }))
    const onApproved = vi.fn()
    render(
      <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }} onError={() => undefined}>
        <SetRunsPanel active onApproved={onApproved} />
      </NextIntlClientProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Duyệt cả bộ' }))
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'))
    expect(within(dialog).getByText(/Phần Nghe lấy nguyên từ một đề viết tay/)).toBeInTheDocument()
    expect(m.approveSetRun).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Duyệt cả bộ' }))
    await waitFor(() => expect(m.approveSetRun).toHaveBeenCalledWith(7))
    await waitFor(() => expect(onApproved).toHaveBeenCalled())
  })

  it('lượt có phần Nghe do máy soạn: hộp duyệt KHÔNG nói phần Nghe lấy từ đề viết tay, không có nút "Tạo phần Nghe"', async () => {
    m.listSetRuns.mockResolvedValue([run({ status: 'REVIEW', teile: [
      teil({ status: 'READY', stage: 'DONE' }),
      teil({ section: 'HOEREN', teil: 1, status: 'READY', stage: 'DONE', theme: 'Medien', draftId: 51 }),
    ] })])
    show()
    expect(await screen.findByText('Hören T1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo phần Nghe' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Duyệt cả bộ' }))
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'))
    expect(within(dialog).getByText(/ba Teil Nghe do máy soạn trong lượt này/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Phần Nghe lấy nguyên từ một đề viết tay/)).not.toBeInTheDocument()
  })

  it('lượt cũ chưa có phần Nghe: "Tạo phần Nghe" xác nhận rồi gọi API trên kênh đang chọn; lượt đang chạy thì không có nút', async () => {
    const old = run({ id: 5, status: 'REVIEW', teile: [teil({ status: 'READY', stage: 'DONE' })] })
    m.listSetRuns.mockResolvedValue([old])
    m.addSetRunHoeren.mockResolvedValue({ ...old, status: 'RUNNING' })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Tạo phần Nghe' }))
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'))
    expect(within(dialog).getByText(/Máy thêm ba Teil Nghe/)).toBeInTheDocument()
    expect(m.addSetRunHoeren).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo phần Nghe' }))
    await waitFor(() => expect(m.addSetRunHoeren).toHaveBeenCalledWith(5, 'ROUTER'))
    expect(toast.success).toHaveBeenCalledWith('Đã bắt đầu tạo phần Nghe. Bảng tự cập nhật.')
  })

  it('lượt đang chạy, đã duyệt hoặc không phải telc B1 thì không có nút "Tạo phần Nghe"', async () => {
    m.listSetRuns.mockResolvedValue([
      run({}), run({ id: 8, status: 'APPROVED' }), run({ id: 9, status: 'REVIEW', cefrLevel: 'A2' }),
    ])
    show()
    expect(await screen.findByText('Lượt #9 · telc A2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo phần Nghe' })).not.toBeInTheDocument()
  })

  it('lượt đang chạy hoặc cần xem thì không có nút duyệt', async () => {
    m.listSetRuns.mockResolvedValue([run({}), run({ id: 8, status: 'NEEDS_ATTENTION' })])
    show()
    expect(await screen.findByText('Lượt #8 · telc B1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duyệt cả bộ' })).not.toBeInTheDocument()
  })

  it('Teil kẹt: hiện mục còn đỏ, cách sửa, thế nào là xong; "Kiểm lại bộ" đưa lượt sang chờ duyệt', async () => {
    const stuck = run({
      id: 9, status: 'NEEDS_ATTENTION',
      setChecks: [{ key: 'SET_THEMES', label: 'Mỗi Teil một chủ đề', light: 'GREEN', detail: null }],
      teile: [
        teil({ status: 'READY', stage: 'DONE' }),
        teil({
          section: 'SPRACHBAUSTEINE', status: 'STUCK', stage: 'VERIFY', theme: 'Verkehr', draftId: 77, repairRound: 2, themeTry: 1,
          lastError: 'Câu đỏ: SB1-30',
          problems: [{ kind: 'ITEM', ref: 'SB1-30', label: 'Ich ___ gern mit dem Rad.', detail: 'Hai phương án cùng đúng' }],
        }),
      ],
    })
    m.listSetRuns.mockResolvedValue([stuck])
    m.recheckSetRun.mockResolvedValue({ ...stuck, status: 'REVIEW' })
    show()

    expect(await screen.findByText('Vì sao kẹt và sửa thế nào')).toBeInTheDocument()
    expect(screen.getByText('Câu SB1-30')).toBeInTheDocument()
    expect(screen.getByText('Hai phương án cùng đúng')).toBeInTheDocument()
    expect(screen.getByText(/không còn đèn đỏ nào/)).toBeInTheDocument()
    // Điều kiện duyệt: 1/2 Teil xong ⇒ chưa đạt; kiểm cấp bộ không đỏ ⇒ đạt.
    expect(screen.getByText('1/2 Teil xong (không Teil nào kẹt)')).toBeInTheDocument()
    expect(screen.getByText('Kiểm cấp bộ không còn mục đỏ (đang có 0 mục đỏ)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duyệt cả bộ' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Kiểm lại bộ' }))
    await waitFor(() => expect(m.recheckSetRun).toHaveBeenCalledWith(9))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('đủ điều kiện')))
  })

  it('"Làm lại Teil này": xác nhận rồi gọi API cho đúng Teil; lượt đang chạy thì không có nút', async () => {
    const r = run({ id: 6, status: 'NEEDS_ATTENTION', teile: [teil({ status: 'READY', stage: 'DONE' })] })
    m.listSetRuns.mockResolvedValue([r])
    m.redoSetRunTeil.mockResolvedValue({ ...r, status: 'RUNNING' })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Làm lại Teil này' }))
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'))
    expect(within(dialog).getByText(/chọn chủ đề mới không trùng/)).toBeInTheDocument()
    expect(m.redoSetRunTeil).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Làm lại Teil này' }))
    await waitFor(() => expect(m.redoSetRunTeil).toHaveBeenCalledWith(6, 'LESEN', 1, 'ROUTER'))
  })

  it('lượt đã bỏ không hiện; ba ngôn ngữ đủ khoá', async () => {
    m.listSetRuns.mockResolvedValue([run({ status: 'DISCARDED' })])
    show()
    expect(await screen.findByText('Chưa có lượt tạo bộ đề nào.')).toBeInTheDocument()
    expect(screen.queryByText('Lượt #7 · telc B1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tạo bộ đề telc B1/ })).toBeEnabled()

    const keys = (o: unknown, p = ''): string[] => o && typeof o === 'object'
      ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p]
    const pick = (msg: unknown) => (msg as { adminContent: { examStudio: { setRuns: unknown } } }).adminContent.examStudio.setRuns
    const vi_ = keys(pick(adminContentVi)).sort()
    expect(vi_.length).toBeGreaterThan(30)
    for (const msg of [adminContentEn, adminContentDe]) expect(keys(pick(msg)).sort()).toEqual(vi_)
  })
})
