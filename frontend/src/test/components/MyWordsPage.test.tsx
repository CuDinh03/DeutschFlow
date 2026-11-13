/**
 * Trang "Từ của tôi" (đợt 2 lưu từ, 13/11/2026): xem theo chủ đề / theo bài đọc, mở trong bài, chuyển chủ đề,
 * sửa nghĩa, gỡ. Ca EXAM-233…235.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedWord } from '@/lib/myWordsApi'

const h = vi.hoisted(() => ({
  list: vi.fn(),
  topics: vi.fn(),
  setTopic: vi.fn(),
  setMeaning: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/myWordsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/myWordsApi')>()),
  myWordsApi: { list: h.list, topics: h.topics, setTopic: h.setTopic, setMeaning: h.setMeaning, remove: h.remove, save: vi.fn() },
}))

import MyWordsPage from '@/app/v2/student/vocabulary/my-words/page'

const base = (o: Partial<SavedWord>): SavedWord => ({
  id: 1, lemma: 'Zeitaufwand', article: 'der', pos: 'NOUN', meaning: 'thời gian bỏ ra', topic: 'Beruf',
  topicLabel: 'Nghề nghiệp', surface: 'Zeitaufwand', sentence: 'Wer zu uns kommt, fragt nach dem Zeitaufwand.',
  examId: 7, examTitle: 'Modelltest 1', teilKey: 'LESEN-2', block: 'ctx', start: 40, end: 51,
  createdAt: '2026-11-13T10:00:00Z', alreadySaved: false, ...o,
})
const WORDS = [
  base({}),
  base({ id: 2, lemma: 'Wohnung', article: 'die', meaning: 'căn hộ', topic: 'Wohnen', topicLabel: 'Nhà ở', surface: 'Wohnungen', sentence: null, examId: 8, examTitle: 'Modelltest 2', teilKey: 'LESEN-1', block: null, start: null, end: null }),
  base({ id: 3, lemma: 'teilnehmen', article: null, meaning: 'tham gia', topic: null, topicLabel: null, surface: 'nimmt teil', sentence: null }),
]

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset())
  h.list.mockResolvedValue({ items: WORDS, total: 3 })
  h.topics.mockResolvedValue([
    { name: 'Beruf', label: 'Nghề nghiệp' },
    { name: 'Reise', label: 'Du lịch' },
    { name: 'Wohnen', label: 'Nhà ở' },
  ])
})

const groupNames = () => Array.from(document.querySelectorAll('[id^="grp-"]')).map((el) => el.textContent)

describe('Từ của tôi', () => {
  it('theo chủ đề và theo bài đọc; mở trong bài đúng chỗ (EXAM-233)', async () => {
    const user = userEvent.setup()
    render(<MyWordsPage />)
    await screen.findByText('der Zeitaufwand')
    expect(h.list).toHaveBeenCalledWith('vi')
    expect(groupNames()).toEqual(['Nghề nghiệp', 'Nhà ở', 'Chưa phân loại'])
    const review = document.querySelector('a[href="/v2/student/review"]')
    expect(review?.textContent).toBe('Đã lưu: 3 · đã vào lịch ônÔn ngay')

    const open = screen.getAllByRole('link', { name: 'Mở trong bài' })[0]
    const p = new URL(open.getAttribute('href')!, 'https://x.test').searchParams
    expect(p.get('at')).toBe('ctx:40:51')
    expect(p.get('w')).toBe('Zeitaufwand')

    await user.click(screen.getByRole('tab', { name: 'Theo bài đọc' }))
    expect(groupNames()).toEqual(['Modelltest 1 · Lesen 2', 'Modelltest 2 · Lesen 1'])
  })

  it('chuyển chủ đề và sửa nghĩa (EXAM-234)', async () => {
    const user = userEvent.setup()
    h.setTopic.mockResolvedValue({ ...WORDS[2], topic: 'Reise', topicLabel: 'Du lịch' })
    h.setMeaning.mockResolvedValue({ ...WORDS[0], meaning: 'thời gian cần bỏ ra' })
    render(<MyWordsPage />)
    await screen.findByText('teilnehmen')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Chủ đề của teilnehmen' }), 'Reise')
    expect(h.setTopic).toHaveBeenCalledWith(3, 'Reise', 'vi')
    await waitFor(() => expect(groupNames()).toEqual(['Du lịch', 'Nghề nghiệp', 'Nhà ở']))

    await user.click(screen.getByRole('button', { name: 'Sửa nghĩa của der Zeitaufwand' }))
    const box = screen.getByRole('textbox', { name: 'Nghĩa của der Zeitaufwand' })
    await user.clear(box)
    await user.type(box, 'thời gian cần bỏ ra{Enter}')
    expect(h.setMeaning).toHaveBeenCalledWith(1, 'thời gian cần bỏ ra', 'vi')
    await screen.findByText('thời gian cần bỏ ra')
  })

  it('gỡ khỏi sổ cần xác nhận (EXAM-235)', async () => {
    const user = userEvent.setup()
    h.remove.mockResolvedValue(undefined)
    render(<MyWordsPage />)
    await screen.findByText('die Wohnung')
    await user.click(screen.getByRole('button', { name: 'Gỡ die Wohnung khỏi sổ' }))
    expect(h.remove).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Gỡ khỏi sổ' }))
    expect(h.remove).toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.queryByText('die Wohnung')).toBeNull())
  })

  it('sổ trống ⇒ hướng dẫn cách lưu', async () => {
    h.list.mockResolvedValue({ items: [], total: 0 })
    render(<MyWordsPage />)
    expect(await screen.findByText('Sổ từ đang trống')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Đi luyện đề đọc/ })).toHaveAttribute('href', '/v2/student/exam')
  })
})
