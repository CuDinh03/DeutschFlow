/**
 * Ô "Bạn làm nghề gì?" đọc danh mục nghề công khai (đợt 2d A+B+E), và rơi về dữ liệu tĩnh của
 * đợt 1 khi endpoint chưa có — frontend có thể lên trước backend mà ô không bao giờ trống.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import landingVi from '../../../messages/v2/landing.vi.json'
import type { OccupationDetail, OccupationSummary } from '@/lib/occupationTypes'

const listMock = vi.fn()
const detailMock = vi.fn()

vi.mock('@/lib/occupationApi', () => ({
  occupationApi: { list: () => listMock(), detail: (code: string) => detailMock(code) },
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

vi.mock('@/components/ui-v2', () => ({
  GaCap: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  GaBtn: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

import { OccupationExplorer } from '@/components/landing-v2/OccupationExplorer'

const ALTENPFLEGER: OccupationSummary = {
  code: 'altenpfleger', nameDe: 'Altenpfleger/in', nameEn: 'Geriatric nurse',
  nameVi: 'Điều dưỡng chăm sóc người cao tuổi', workplace: 'pflege', aliases: ['pflegeheim'], questionSet: 'GENERAL',
}

const DETAIL: OccupationDetail = {
  occupation: ALTENPFLEGER,
  personaCode: 'KRUEGER',
  interviewPosition: 'Altenpfleger/in',
  sampleQuestions: [
    {
      phase: 'INTRO', questionDe: 'Bitte stellen Sie sich kurz vor.', source: 'BANK',
      questionVi: 'Mời bạn giới thiệu ngắn về bản thân.', questionEn: 'Please introduce yourself briefly.',
    },
    { phase: 'HARD_SKILLS', questionDe: 'Wie dokumentieren Sie eine Übergabe?', source: 'APPROVED' },
    { phase: 'HARD_SKILLS', questionDe: 'Wie reagieren Sie bei einem Sturz?', source: 'AI_GENERATED' },
  ],
  reviewed: false,
  occupationQuestions: [],
  terms: [{ termDe: 'die Übergabe', meaningEn: 'handover', meaningVi: 'bàn giao ca', exampleDe: null, status: 'AI_GENERATED' }],
}

function renderExplorer() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: landingVi } as unknown as AbstractIntlMessages}>
      <OccupationExplorer startHref="/v2/onboarding" onStart={() => {}} />
    </NextIntlClientProvider>,
  )
}

describe('OccupationExplorer — danh mục nghề công khai', () => {
  beforeEach(() => {
    listMock.mockReset()
    detailMock.mockReset()
  })

  it('có endpoint: hiện người phỏng vấn của nhóm, nhãn thật cho từng câu, từ chuyên môn và lối sang trang nghề', async () => {
    listMock.mockResolvedValue([ALTENPFLEGER])
    detailMock.mockResolvedValue(DETAIL)

    renderExplorer()

    expect(await screen.findByText('„Bitte stellen Sie sich kurz vor.“')).toBeTruthy()
    expect(detailMock).toHaveBeenCalledWith('altenpfleger')
    expect(screen.getByText('Người phỏng vấn: Frau Krüger · Trưởng phòng điều dưỡng')).toBeTruthy()
    // Câu mở đầu thuộc bộ chung (nghề GENERAL) → không được gắn "Đã duyệt".
    expect(screen.getByText('Bộ câu hỏi chung')).toBeTruthy()
    // Bố cục chốt 08/11/2026: hero chỉ hiện câu 1, câu 2–3 gom thành dòng đếm; từ chuyên môn ở trang nghề.
    expect(screen.queryByText('„Wie reagieren Sie bei einem Sturz?“')).toBeNull()
    expect(screen.getByText('+ 2 câu nữa trong buổi thử')).toBeTruthy()
    expect(screen.queryByText('die Übergabe')).toBeNull()
    // K4: bản dịch theo ngôn ngữ trang dưới câu tiếng Đức; câu chưa dịch chỉ có tiếng Đức.
    expect(screen.getByText('Mời bạn giới thiệu ngắn về bản thân.').getAttribute('lang')).toBe('vi')
    expect(screen.queryByText('Please introduce yourself briefly.')).toBeNull()
    expect(screen.getByRole('link', { name: 'Xem trang nghề' }).getAttribute('href')).toBe('/phong-van/altenpfleger/')
  })

  it('#3 câu 1 được gõ: câu đủ vẫn có cho trình đọc màn hình, gõ xong thì về trạng thái nghỉ', async () => {
    // Đồng hồ giả hoàn toàn: máy CI chậm cũng không gõ xong trước khi kịp kiểm tra.
    vi.useFakeTimers()
    try {
      listMock.mockResolvedValue([ALTENPFLEGER])
      detailMock.mockResolvedValue(DETAIL)

      const { container } = renderExplorer()
      // Xả chuỗi promise danh mục → chi tiết mà chưa cho đồng hồ chạy.
      for (let i = 0; i < 5; i += 1) await act(async () => { await vi.advanceTimersByTimeAsync(0) })

      expect(screen.getByText('„Bitte stellen Sie sich kurz vor.“')).toBeTruthy()
      expect(container.querySelector('.ga-type-caret')).toBeTruthy()
      // Lớp phủ đang gõ ẩn khỏi trình đọc màn hình; câu đủ vẫn nằm trong cây.
      expect(container.querySelector('.ga-type-caret')!.closest('[aria-hidden]')).toBeTruthy()

      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(container.querySelector('.ga-type-caret')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('#4 chip đang chọn đổi theo lần bấm, aria-pressed đi theo', async () => {
    listMock.mockRejectedValue(new Error('404'))

    renderExplorer()
    await waitFor(() => expect(listMock).toHaveBeenCalled())

    const kellner = screen.getByRole('button', { name: 'Kellner/in' })
    expect(kellner.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(kellner)
    expect(kellner.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('endpoint lỗi: giữ dữ liệu tĩnh của đợt 1, không gọi chi tiết', async () => {
    listMock.mockRejectedValue(new Error('404'))

    renderExplorer()

    await waitFor(() => expect(listMock).toHaveBeenCalled())
    // Vị trí mặc định của bản tĩnh là đầu bếp (line_cook) với bộ câu hỏi viết tay của Klaus.
    expect(screen.getByText(/Người phỏng vấn: Klaus/)).toBeTruthy()
    expect(detailMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Xem trang nghề')).toBeNull()
  })
})
