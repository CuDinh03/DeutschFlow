/**
 * Trang phiếu công khai `/phieu/[token]` — PR-R3.
 *
 * Ba điều được canh giữ, vì cả ba đều hỏng ÂM THẦM:
 *  1. Ba ngôn ngữ. Trang này không có phiên đăng nhập nên `useTranslations` không dùng được; ngôn ngữ
 *     đến từ `?lang`. Nếu đường đọc từ điển gãy, trang vẫn render — chỉ là render sai thứ tiếng cho
 *     một gia đình không đọc được nó.
 *  2. 404 đồng nhất. Token sai / hết hạn / đã thu hồi đều phải ra CÙNG một trang 404. Một nhánh nào
 *     đó lỡ hiện "phiếu đã bị thu hồi" là biến trang thành máy dò token.
 *  3. Danh sách cấm (R4). Backend chặn bằng `assertNoForbiddenKeys`; test này chặn phía web, kể cả khi
 *     payload lỡ mang thêm khoá lạ.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const notFoundError = new Error('NEXT_NOT_FOUND')
vi.mock('next/navigation', () => ({
  notFound: () => { throw notFoundError },
}))

import PublicReportPage from '@/app/phieu/[token]/page'
import { fetchPublicReportIssue } from '@/app/phieu/[token]/fetchReportIssue'
import type { PublicReportIssue } from '@/lib/reportIssueApi'

const payload = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  period: 'FINAL',
  lang: 'vi',
  issuedAt: '2026-09-11T02:00:00Z',
  org: { name: 'Trung tâm ATB', logoUrl: null },
  class: { name: 'B1-01', level: 'B1', primaryTeacherName: 'Cô Lan' },
  student: { name: 'Nguyễn Đức', joinedAt: '2026-06-01' },
  skills: [
    { code: 'HOREN', score: 8.5, grade: 'GOOD' },
    { code: 'LESEN', score: 7, grade: 'FAIR' },
    { code: 'SCHREIBEN', score: 6, grade: 'AVERAGE' },
    { code: 'SPRECHEN', score: 9.2, grade: 'EXCELLENT' },
  ],
  overall: { score: 7.7, grade: 'FAIR' },
  attendance: { present: 18, absent: 1, late: 2, recorded: 21, ratePct: 95 },
  assignments: { avgScore: 8.1, confirmed: 9, awaitingTeacher: 1 },
  objectives: { total: 10, achieved: 7, needsPractice: 2, notAssessed: 1, needsPracticeItems: ['Perfekt'] },
  selfStudy: { speakingSessions: 12, speakingMinutes: 140, vocabMastered: 230, lessonsCompleted: 18 },
  teacherComment: 'Phát âm tiến bộ rõ.',
  evaluatedAt: '2026-09-10T10:00:00Z',
  certificate: { eligible: true, minAvgScore: 50, minAttendancePct: 80 },
  ...over,
})

const issue = (over: Partial<PublicReportIssue> = {}): PublicReportIssue =>
  ({
    period: 'FINAL',
    lang: 'vi',
    issuedAt: '2026-09-11T02:00:00Z',
    tokenExpiresAt: '2026-10-11T02:00:00Z',
    orgName: 'Trung tâm ATB',
    orgLogoUrl: null,
    studentName: 'Nguyễn Đức',
    issuedByName: 'Cô Lan',
    verificationCode: 'A1B2C3D4',
    payload: payload(),
    ...over,
  }) as PublicReportIssue

function mockFetchOk(body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: true, json: async () => body })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('/phieu/[token] — trang phiếu công khai', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('render tiếng Việt khi ?lang=vi', async () => {
    mockFetchOk(issue())
    render(await PublicReportPage({ params: { token: 'a'.repeat(40) }, searchParams: { lang: 'vi' } }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Phiếu đánh giá kết quả học tập')
    expect(screen.getByText('Kỳ cuối khoá')).toBeInTheDocument()
    expect(screen.getByText('Chuyên cần')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In phiếu' })).toBeInTheDocument()
  })

  it('render tiếng Anh khi ?lang=en', async () => {
    mockFetchOk(issue())
    render(await PublicReportPage({ params: { token: 'a'.repeat(40) }, searchParams: { lang: 'en' } }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Learning progress report')
    expect(screen.getByText('End of course')).toBeInTheDocument()
    expect(screen.getByText('Attendance')).toBeInTheDocument()
  })

  it('render tiếng Đức khi ?lang=de — và nhãn kỹ năng là tiếng Đức thuần', async () => {
    mockFetchOk(issue())
    render(await PublicReportPage({ params: { token: 'a'.repeat(40) }, searchParams: { lang: 'de' } }))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lernstandsbericht')
    expect(screen.getByText('Anwesenheit')).toBeInTheDocument()
    // Mỗi ngôn ngữ thuần một thứ tiếng: bản Đức KHÔNG kèm dòng nghĩa tiếng Việt.
    expect(screen.getByText('Sprechen')).toBeInTheDocument()
    expect(screen.queryByText('Nói')).not.toBeInTheDocument()
  })

  it('?lang thiếu hoặc lạ ⇒ dùng ngôn ngữ đã đóng băng trong phiếu, cuối cùng mới tiếng Việt', async () => {
    mockFetchOk(issue({ lang: 'de' }))
    render(await PublicReportPage({ params: { token: 'a'.repeat(40) }, searchParams: {} }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lernstandsbericht')
  })

  it('token sai / hết hạn / đã thu hồi ⇒ CÙNG một 404, không thông điệp phân biệt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }))
    await expect(
      PublicReportPage({ params: { token: 'khong-ton-tai' }, searchParams: { lang: 'vi' } }),
    ).rejects.toBe(notFoundError)
  })

  it('mạng hỏng cũng ra 404 — không rò lỗi hạ tầng ra trang công khai', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect(await fetchPublicReportIssue('a'.repeat(40))).toBeNull()
  })

  it('KHÔNG in email, ngày sinh, transcript hay điểm AI dù payload lỡ mang theo (R4)', async () => {
    mockFetchOk(
      issue({
        payload: payload({
          studentEmail: 'hocvien@example.com',
          birthDate: '2009-04-05',
          transcript: 'Guten Tag, ich heiße …',
          aiScore: 91,
        }) as never,
      }),
    )
    render(await PublicReportPage({ params: { token: 'a'.repeat(40) }, searchParams: { lang: 'vi' } }))

    const html = document.body.innerHTML
    expect(html).not.toContain('hocvien@example.com')
    expect(html).not.toContain('2009-04-05')
    expect(html).not.toContain('ich heiße')
    expect(html).not.toContain('91')
  })
})
