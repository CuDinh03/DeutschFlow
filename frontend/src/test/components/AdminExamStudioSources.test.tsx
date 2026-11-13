/** Xưởng đề — tab "Nguồn": danh mục nguồn theo ba hạng, đọc bài mới, bật / tắt. */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import adminContentEn from '../../../messages/v2/adminContent.en.json'
import adminContentDe from '../../../messages/v2/adminContent.de.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import type { SourceFeed } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({ listSourceFeeds: vi.fn(), pollSourceFeed: vi.fn(), setSourceFeedActive: vi.fn() }))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { SourcesTab } from '@/components/admin/exam-studio/SourcesTab'

const feed = (over: Partial<SourceFeed>): SourceFeed => ({
  id: 1, code: 'DESTATIS', publisher: 'Statistisches Bundesamt (Destatis)', homeUrl: 'https://www.destatis.de',
  listingKind: 'RSS', usageClass: 'ADAPT', licenseName: 'Eigene Nutzungsbedingungen',
  licenseUrl: 'https://www.destatis.de/copyright', attribution: 'Destatis', notes: null, active: true,
  approvedOn: '2026-11-12', lastPolledAt: null, lastPollNote: null, seen: 0, used: 0, ...over,
})

const FEEDS = [
  feed({}),
  feed({ id: 2, code: 'RKI_JOHM', publisher: 'Robert Koch-Institut', listingKind: 'NONE' }),
  feed({ id: 3, code: 'TAGESSCHAU_WISSEN', publisher: 'tagesschau.de — Wissen', usageClass: 'TOPIC_ONLY', licenseName: null, licenseUrl: null, seen: 12 }),
]

const show = () => render(
  <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }} onError={() => undefined}>
    <SourcesTab active />
  </NextIntlClientProvider>,
)

describe('SourcesTab', () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset())
    toast.success.mockReset()
    m.listSourceFeeds.mockResolvedValue(FEEDS)
  })

  it('chia nguồn theo hạng; nguồn chưa có cách lấy bài thì không đọc được', async () => {
    show()
    expect(await screen.findByText('Được chuyển thể')).toBeInTheDocument()
    expect(screen.getByText('Gợi ý chủ đề')).toBeInTheDocument()
    expect(screen.queryByText('Chỉ lấy dữ kiện')).not.toBeInTheDocument() // hạng không có nguồn nào thì ẩn
    expect(screen.getByText('Đã thấy 12 · đã dùng 0')).toBeInTheDocument()
    const destatis = screen.getByText('Statistisches Bundesamt (Destatis)').closest('li') as HTMLElement
    expect(within(destatis).getByRole('link', { name: 'Eigene Nutzungsbedingungen' }))
      .toHaveAttribute('href', 'https://www.destatis.de/copyright')

    const rki = screen.getByText('Robert Koch-Institut').closest('li') as HTMLElement
    expect(within(rki).getByRole('button', { name: /Đọc bài mới/ })).toBeDisabled()
    expect(within(rki).getByText('Chưa có cách lấy danh sách bài tự động.')).toBeInTheDocument()
  })

  it('đọc bài mới: gọi API, báo kết quả, nạp lại danh mục; tắt nguồn gọi đúng trạng thái ngược', async () => {
    m.pollSourceFeed.mockResolvedValue({ feedId: 1, found: 10, added: 4, note: 'Thấy 10 bài, 4 bài mới.' })
    m.setSourceFeedActive.mockResolvedValue(FEEDS)
    show()
    const destatis = (await screen.findByText('Statistisches Bundesamt (Destatis)')).closest('li') as HTMLElement

    await userEvent.click(within(destatis).getByRole('button', { name: /Đọc bài mới/ }))
    await waitFor(() => expect(m.pollSourceFeed).toHaveBeenCalledWith(1))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Thấy 10 bài, 4 bài mới.'))
    expect(m.listSourceFeeds).toHaveBeenCalledTimes(2)

    await userEvent.click(within(destatis).getByRole('button', { name: 'Tắt' }))
    await waitFor(() => expect(m.setSourceFeedActive).toHaveBeenCalledWith(1, false))
  })

  it('không tải được danh mục: nói rõ đang tải gì hỏng và có nút thử lại', async () => {
    m.listSourceFeeds.mockReset()
    m.listSourceFeeds.mockRejectedValueOnce(new Error('mất mạng')).mockResolvedValue(FEEDS)
    show()
    const banner = await screen.findByRole('alert')
    expect(within(banner).getByText('Không tải được danh mục nguồn')).toBeInTheDocument()
    await userEvent.click(within(banner).getByRole('button'))
    expect(await screen.findByText('Được chuyển thể')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ba ngôn ngữ đủ khoá của tab Nguồn', () => {
    const keys = (o: unknown, p = ''): string[] => o && typeof o === 'object'
      ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p]
    const pick = (msg: unknown) => (msg as { adminContent: { examStudio: { sources: unknown; tabs: Record<string, string> } } }).adminContent.examStudio
    const vi_ = keys(pick(adminContentVi).sources).sort()
    expect(vi_.length).toBeGreaterThan(15)
    for (const msg of [adminContentEn, adminContentDe]) {
      expect(keys(pick(msg).sources).sort()).toEqual(vi_)
      expect(pick(msg).tabs.sources).toBeTruthy()
    }
  })
})
