/** Xưởng đề — bước Nguồn: tải tệp (PDF/DOCX/TXT) thay cho dán URL khi trang nguồn chỉ có toàn văn ở dạng PDF. */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import adminContentEn from '../../../messages/v2/adminContent.en.json'
import adminContentDe from '../../../messages/v2/adminContent.de.json'
import { StepSource } from '@/components/admin/exam-studio/StepSource'
import { SOURCE_FILE_MAX_BYTES, type StudioDraft } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({ addSource: vi.fn(), addSourceFile: vi.fn() }))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))

const draft = { id: 7, sources: [], warnings: [] } as unknown as StudioDraft

function setup() {
  const run = vi.fn(async (fn: () => Promise<StudioDraft>) => { await fn(); return true })
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: adminContentVi }}>
      <StepSource draft={draft} locked={false} run={run} onNext={() => undefined} />
    </NextIntlClientProvider>,
  )
  return run
}

describe('StepSource — tải tệp', () => {
  beforeEach(() => {
    m.addSource.mockReset()
    m.addSourceFile.mockReset().mockResolvedValue(draft)
  })

  it('chọn tệp rồi gửi: gọi addSourceFile kèm tiêu đề và đường dẫn bài gốc, không gọi addSource', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Tải tệp lên' }))
    const submit = screen.getByRole('button', { name: /Đọc nguồn/ })
    expect(submit).toBeDisabled()

    const file = new File(['%PDF-1.7 …'], 'johm-11-08-DE.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText(/Tệp bài báo/), file)
    await userEvent.type(screen.getByLabelText(/Đường dẫn bài gốc/), 'https://doi.org/10.25646/14239')
    await userEvent.type(screen.getByLabelText('Tiêu đề (tuỳ chọn)'), 'Stress und Coping')
    expect(submit).toBeEnabled()
    await userEvent.click(submit)

    expect(m.addSource).not.toHaveBeenCalled()
    expect(m.addSourceFile).toHaveBeenCalledWith(7, file, {
      title: 'Stress und Coping', url: 'https://doi.org/10.25646/14239',
    })
  })

  it('tệp quá 10 MB hoặc đường dẫn bài gốc sai dạng thì không gửi được', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Tải tệp lên' }))
    const big = new File(['x'], 'to.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: SOURCE_FILE_MAX_BYTES + 1 })
    await userEvent.upload(screen.getByLabelText(/Tệp bài báo/), big)
    expect(screen.getByRole('alert')).toHaveTextContent('Tệp lớn hơn 10 MB')
    expect(screen.getByRole('button', { name: /Đọc nguồn/ })).toBeDisabled()

    const ok = new File(['x'], 'ok.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText(/Tệp bài báo/), ok)
    expect(screen.getByRole('button', { name: /Đọc nguồn/ })).toBeEnabled()
    await userEvent.type(screen.getByLabelText(/Đường dẫn bài gốc/), 'doi.org/abc')
    expect(screen.getByRole('button', { name: /Đọc nguồn/ })).toBeDisabled()
  })

  it('ba ngôn ngữ đều có đủ khoá của phần tải tệp', () => {
    for (const msg of [adminContentVi, adminContentEn, adminContentDe]) {
      const src = (msg as { adminContent: { examStudio: { source: Record<string, string> } } }).adminContent.examStudio.source
      for (const k of ['kindFile', 'file', 'fileTooLarge', 'refUrl']) expect(src[k]).toBeTruthy()
    }
  })
})
