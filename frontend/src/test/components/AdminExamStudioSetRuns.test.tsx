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
import type { SetRun, SetRunTeil } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({
  listSetRuns: vi.fn(), createSetRun: vi.fn(), discardSetRun: vi.fn(), getStudioChannel: vi.fn(),
}))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
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
