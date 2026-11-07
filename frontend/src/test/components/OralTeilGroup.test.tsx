/**
 * Màn Đề — nhóm "Mündliche Prüfung" (Đợt 2 phòng thi nói): dòng thi thử phần nói + mỗi Teil một dòng
 * mở phòng thi nói trong khu Luyện thi (kèm return về đúng đề), nhãn theo lần thi nói gần nhất; lịch sử
 * thi nói nằm trong "Thi thử đã làm".
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { OralHistory, OralTeilGroup } from '@/components/exam/practice/OralTeilGroup'

const api = vi.hoisted(() => ({ listBlueprints: vi.fn(), listResults: vi.fn() }))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: api }))

const RET = '/v2/student/mock-exam/practice?examId=7'
const BP = {
  id: 9, provider: 'TELC', level: 'B1', title: 'telc B1', prepSec: 1200,
  parts: [
    { teilNo: 1, archetype: 'CONTACT', title: 'Kontakt aufnehmen', durationSec: 180, flow: 'PAIR', hasPartner: true },
    { teilNo: 2, archetype: 'DEBATE', title: 'Über ein Thema sprechen', durationSec: 300, flow: 'PAIR', hasPartner: true },
    { teilNo: 3, archetype: 'PLAN', title: 'Gemeinsam etwas planen', durationSec: 360, flow: 'PAIR', hasPartner: true },
  ],
}
const RESULT = {
  sessionId: 55, provider: 'TELC', level: 'B1', total: 48, max: 75, passed: true, borderline: false, createdAt: '2026-11-06T10:00:00Z',
  scoreSheet: { parts: [ { teilNo: 1, points: 11, max: 15 }, { teilNo: 2, points: 10, max: 30 } ] },
}

function renderVi(ui: React.ReactElement) {
  return render(<NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>{ui}</NextIntlClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listBlueprints.mockResolvedValue({ data: [BP] })
  api.listResults.mockResolvedValue({ data: [RESULT] })
})

describe('Màn Đề — nhóm Mündliche Prüfung', () => {
  it('dòng thi thử + 3 dòng Teil mở phòng thi nói khu Luyện thi, kèm return về đề', async () => {
    renderVi(<OralTeilGroup ret={RET} />)
    const mock = await screen.findByTestId('oral-row-mock')
    const ret = encodeURIComponent(RET)
    expect(within(mock).getByRole('link')).toHaveAttribute('href', `/v2/student/mock-exam/oral?provider=TELC&level=B1&mode=MOCK&return=${ret}`)
    expect(mock.textContent).toContain('14 phút · 3 Teil')
    const t3 = await screen.findByTestId('oral-row-teil-3')
    expect(within(t3).getByRole('link')).toHaveAttribute('href', `/v2/student/mock-exam/oral?provider=TELC&level=B1&mode=DRILL&teil=3&return=${ret}`)
    expect(t3.textContent).toContain('Gemeinsam etwas planen')
    expect(screen.getByText('Kỳ thi khác (Goethe, cấp khác)').closest('a')).toHaveAttribute('href', '/v2/student/mock-exam/oral/other')
  })

  it('nhãn theo lần thi nói gần nhất: đạt ≥ 60% xanh, dưới đỏ, chưa thi xám', async () => {
    renderVi(<OralTeilGroup ret={RET} />)
    const t1 = await screen.findByTestId('oral-row-teil-1')
    expect(t1.textContent).toContain('11/15')
    expect(screen.getByTestId('oral-row-teil-2').textContent).toContain('10/30')
    expect(screen.getByTestId('oral-row-teil-3').textContent).toContain('Chưa thi')
    expect(screen.getByTestId('oral-row-mock').textContent).toContain('48/75')
    expect(screen.getByText('2/3 Teil đã thi')).toBeInTheDocument()
  })

  it('lịch sử thi nói: mỗi lượt mở lại phòng thi của phiên đó', async () => {
    renderVi(<OralHistory ret={RET} />)
    const list = await screen.findByTestId('oral-history')
    expect(within(list).getByRole('link')).toHaveAttribute('href', `/v2/student/mock-exam/oral/55?return=${encodeURIComponent(RET)}`)
    expect(list.textContent).toContain('Đỗ')
  })

  it('chưa có lượt thi nói → không hiện lịch sử thi nói', async () => {
    api.listResults.mockResolvedValue({ data: [] })
    renderVi(<OralHistory ret={RET} />)
    await screen.findByText(() => true).catch(() => null)
    expect(screen.queryByTestId('oral-history')).not.toBeInTheDocument()
  })
})
