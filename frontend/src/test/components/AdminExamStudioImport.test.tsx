/** Xưởng đề — nhập một Teil soạn ngoài hệ thống (tệp JSON Claude trả về theo prompt mẫu). */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import adminContentEn from '../../../messages/v2/adminContent.en.json'
import adminContentDe from '../../../messages/v2/adminContent.de.json'
import commonVi from '../../../messages/v2/chrome.vi.json'
import { IMPORT_MAX_BYTES, IMPORT_PROMPT_TEMPLATE, ImportTeilModal } from '@/components/admin/exam-studio/ImportTeilModal'
import type { StudioDraft } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({ importDraft: vi.fn() }))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))

function setup() {
  const onImported = vi.fn()
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...commonVi } }} onError={() => undefined}>
      <ImportTeilModal open onOpenChange={() => undefined} onImported={onImported} />
    </NextIntlClientProvider>,
  )
  return onImported
}

describe('ImportTeilModal', () => {
  beforeEach(() => m.importDraft.mockReset().mockResolvedValue({ id: 9 } as StudioDraft))

  it('chọn tệp JSON rồi nhập: gọi importDraft và báo bản nháp mới', async () => {
    const onImported = setup()
    const submit = screen.getByRole('button', { name: /Nhập$/ })
    expect(submit).toBeDisabled()
    const file = new File(['{"format":"deutschflow-teil-v1"}'], 'teil.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText(/Tệp JSON/), file)
    await userEvent.click(submit)
    expect(m.importDraft).toHaveBeenCalledWith(file)
    expect(onImported).toHaveBeenCalledWith({ id: 9 })
  })

  it('tệp quá 512 KB không gửi được', async () => {
    setup()
    const big = new File(['x'], 'to.json', { type: 'application/json' })
    Object.defineProperty(big, 'size', { value: IMPORT_MAX_BYTES + 1 })
    await userEvent.upload(screen.getByLabelText(/Tệp JSON/), big)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nhập$/ })).toBeDisabled()
  })

  it('prompt mẫu nêu đúng định dạng nhập; ba ngôn ngữ đủ khoá', () => {
    expect(IMPORT_PROMPT_TEMPLATE).toContain('"format": "deutschflow-teil-v1"')
    expect(IMPORT_PROMPT_TEMPLATE).toContain('{1}, {2}, {3}')
    for (const msg of [adminContentVi, adminContentEn, adminContentDe]) {
      const imp = (msg as { adminContent: { examStudio: { import: Record<string, string> } } }).adminContent.examStudio.import
      for (const k of ['open', 'title', 'lead', 'copyPrompt', 'copied', 'copyFailed', 'file', 'submit', 'done', 'scope']) {
        expect(imp[k]).toBeTruthy()
      }
    }
  })
})
