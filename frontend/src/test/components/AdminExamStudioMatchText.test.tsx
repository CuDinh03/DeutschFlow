/** Xưởng đề — bước Bài đọc cho Lesen T1: 5 ô "Text 1…5", không có tiêu đề/Vorspann/chú thích, lưu ghép bằng \n\n. */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import { StepText } from '@/components/admin/exam-studio/StepText'
import type { StudioDraft } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({ patchDraft: vi.fn(), writeText: vi.fn() }))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))

const words = (n: number, w = 'Wort') => Array.from({ length: n }, () => w).join(' ')
const draft = {
  id: 5, teil: 1, teilType: 'MATCH_HEADLINE', itemCount: 5, sources: [], items: [], quelle: null, textMetrics: null,
  text: { titleDe: '', vorspannDe: '', glossary: [], context: [60, 60, 60, 60, 40].map((n) => words(n)).join('\n\n') },
} as unknown as StudioDraft

describe('StepText MATCH_HEADLINE', () => {
  it('5 ô riêng, số từ từng ô, lưu ghép lại', async () => {
    const run = vi.fn(async (fn: () => Promise<StudioDraft>) => { await fn(); return true })
    m.patchDraft.mockResolvedValue(draft)
    render(
      <NextIntlClientProvider locale="vi" messages={{ v2: adminContentVi }}>
        <StepText draft={draft} locked={false} run={run} onNext={() => undefined} />
      </NextIntlClientProvider>,
    )
    expect(screen.queryByLabelText('Tiêu đề (tiếng Đức)')).not.toBeInTheDocument()
    expect(screen.queryByText('Chú thích từ khó')).not.toBeInTheDocument()
    for (let i = 1; i <= 5; i++) expect(screen.getByLabelText(`Text ${i}`)).toBeInTheDocument()
    expect(screen.getByText('40 từ / 55–110')).toBeInTheDocument()

    const box = screen.getByLabelText('Text 5')
    await userEvent.clear(box)
    await userEvent.type(box, 'Neu')
    await userEvent.click(screen.getByRole('button', { name: /Lưu sửa tay/ }))
    const body = m.patchDraft.mock.calls[0][1]
    expect(body.text.titleDe).toBe('')
    expect(body.text.context.split('\n\n')).toHaveLength(5)
    expect(body.text.context.endsWith('\n\nNeu')).toBe(true)
  })
})
