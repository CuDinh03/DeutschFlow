/**
 * Tests cho phiếu kết quả mock (`Ergebnisbogen.tsx`) sau N1c-3/N1c-6:
 *   1. Phiếu MỚI mang msg structured (passRuleMsg/noteMsgs/evidenceMsgs) → render bản dịch theo
 *      locale (catalog vi THẬT — canh luôn thiếu khoá i18n), không hiện chuỗi backend.
 *   2. Phiếu CŨ (trước N1c-3, không có msg) → fallback nguyên văn chuỗi tiếng Việt đã lưu trong DB.
 *   3. `reducedMaxNote` bị loại khỏi danh sách ghi chú vì header đã có dòng `reducedMax` riêng.
 *   4. N1c-6: passes > 1 → có dòng giải thích band = trung vị / điểm = trung bình.
 *   5. Code msg lạ (backend mới hơn FE) → hiện raw code thay vì crash vì thiếu khoá.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { Ergebnisbogen } from '@/components/features/exam-speaking/Ergebnisbogen'
import type { ScoreSheet } from '@/types/exam-speaking'

function renderSheet(sheet: ScoreSheet) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <Ergebnisbogen sheet={sheet} />
    </NextIntlClientProvider>,
  )
}

const baseSheet: ScoreSheet = {
  rubricRef: { provider: 'GOETHE', level: 'B1', version: 1 },
  parts: [
    {
      teilNo: 1,
      criteria: [
        {
          code: 'STRUKTUREN', label: 'Strukturen', band: 'E', points: 0, max: 4, scored: true,
          confidence: 'medium',
          evidence: ['mit der Bus fahren'],
          evidenceMsgs: [
            { code: 'errorDensity', params: { density: '15.2', errors: 5, words: 33, band: 'E' } },
            { code: 'llmProposedBand', params: { band: 'A' } },
          ],
        },
      ],
      points: 0,
      max: 4,
      zeroed: false,
    },
  ],
  global: [],
  total: 44,
  totalLow: 40,
  totalHigh: 48,
  maxPoints: 84,
  officialMax: 100,
  passed: false,
  passRule: 'Modul đỗ khi ≥60/100. (chuỗi backend — không được render khi có msg)',
  passRuleMsg: { code: 'passModule', params: { min: '60', max: '100' } },
  errors: [],
  notes: ['ghi chú VI cũ — không được render khi có noteMsgs'],
  noteMsgs: [
    { code: 'unscoredCount', params: { count: 2 } },
    { code: 'reducedMaxNote', params: { max: '84', official: '100' } },
  ],
  passes: 3,
}

describe('Ergebnisbogen — N1c-3 msg structured', () => {
  it('phiếu mới: dịch passRuleMsg + noteMsgs theo locale, bỏ chuỗi backend', () => {
    renderSheet(baseSheet)
    expect(screen.getByText('Modul đỗ khi ≥60/100.')).toBeInTheDocument()
    expect(screen.queryByText(/chuỗi backend — không được render/)).not.toBeInTheDocument()
    expect(screen.getByText('2 tiêu chí/nhiệm vụ chưa chấm được.')).toBeInTheDocument()
    expect(screen.queryByText(/ghi chú VI cũ/)).not.toBeInTheDocument()
  })

  it('reducedMaxNote không lặp trong danh sách ghi chú (header đã có dòng riêng)', () => {
    renderSheet(baseSheet)
    // header (khoá reducedMax) hiện đúng 1 lần; msg reducedMaxNote trong noteMsgs bị bỏ
    expect(screen.getAllByText(/tính trên 84\/100/)).toHaveLength(1)
  })

  it('evidenceMsgs dịch theo locale, đứng sau trích dẫn LLM nguyên văn', async () => {
    renderSheet(baseSheet)
    await userEvent.click(screen.getByRole('button', { name: /Bằng chứng/ }))
    expect(screen.getByText('mit der Bus fahren')).toBeInTheDocument()
    expect(
      screen.getByText('Mật độ lỗi đếm được: 15.2 lỗi/100 từ (5 lỗi, 33 từ) → band E.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('AI đề xuất band A — band cuối do bảng ngưỡng mật độ lỗi quyết định.'),
    ).toBeInTheDocument()
  })

  it('N1c-6: passes > 1 → có dòng band trung vị / điểm trung bình', () => {
    renderSheet(baseSheet)
    expect(screen.getByText(/Band là trung vị, điểm là trung bình của 3 lượt chấm/)).toBeInTheDocument()
  })

  it('code msg lạ → hiện raw code, không crash', async () => {
    const sheet: ScoreSheet = {
      ...baseSheet,
      noteMsgs: [{ code: 'someFutureCode', params: {} }],
    }
    renderSheet(sheet)
    expect(screen.getByText('someFutureCode')).toBeInTheDocument()
  })
})

describe('Ergebnisbogen — F-17 sát ngưỡng', () => {
  it('borderline=true → badge "Sát ngưỡng" thay cho đỗ/trượt + dòng giải thích khoảng điểm + msg dịch', () => {
    renderSheet({
      ...baseSheet,
      total: 61,
      totalLow: 58,
      totalHigh: 64,
      passed: true,
      borderline: true,
      noteMsgs: [{ code: 'borderline', params: { low: '58', high: '64', min: '60' } }],
    })
    expect(screen.getByTestId('result-borderline')).toHaveTextContent('Sát ngưỡng')
    expect(screen.queryByTestId('result-passed')).not.toBeInTheDocument()
    expect(screen.getByTestId('result-borderline-note')).toHaveTextContent('58–64')
    expect(screen.getByText('Khoảng điểm 58–64 vắt qua ngưỡng 60 — kết luận đỗ/trượt chưa chắc chắn.')).toBeInTheDocument()
  })

  it('phiếu cũ không có borderline → vẫn hiện đỗ/trượt như trước', () => {
    renderSheet({ ...baseSheet, passed: true })
    expect(screen.getByTestId('result-passed')).toBeInTheDocument()
    expect(screen.queryByTestId('result-borderline')).not.toBeInTheDocument()
  })
})

describe('Ergebnisbogen — fallback phiếu cũ (trước N1c-3)', () => {
  const oldSheet: ScoreSheet = {
    ...baseSheet,
    parts: [
      {
        teilNo: 1,
        criteria: [
          {
            code: 'STRUKTUREN', label: 'Strukturen', band: 'E', points: 0, max: 4, scored: true,
            confidence: 'medium',
            evidence: ['Mật độ lỗi đếm được: 15.2 lỗi/100 từ (5 lỗi, 33 từ) → band E'],
          },
        ],
        points: 0,
        max: 4,
        zeroed: false,
      },
    ],
    passRule: 'Modul đỗ khi ≥60/100.',
    passRuleMsg: undefined,
    notes: ['1 tiêu chí/nhiệm vụ chưa chấm được.'],
    noteMsgs: undefined,
    passes: 1,
    totalLow: 44,
    totalHigh: 44,
  }

  it('không có msg → hiện nguyên văn chuỗi VI đã lưu; passes=1 → không có dòng trung vị', async () => {
    renderSheet(oldSheet)
    expect(screen.getByText('Modul đỗ khi ≥60/100.')).toBeInTheDocument()
    expect(screen.getByText('1 tiêu chí/nhiệm vụ chưa chấm được.')).toBeInTheDocument()
    expect(screen.queryByText(/Band là trung vị/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Bằng chứng/ }))
    expect(screen.getByText(/Mật độ lỗi đếm được: 15.2/)).toBeInTheDocument()
  })
})
