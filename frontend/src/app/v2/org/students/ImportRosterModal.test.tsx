import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const importRoster = vi.fn()
const listClasses = vi.fn()
vi.mock('@/lib/orgApi', () => ({
  importRoster: (...a: unknown[]) => importRoster(...a),
  listClasses: (...a: unknown[]) => listClasses(...a),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import { ImportRosterModal } from '@/app/v2/org/students/ImportRosterModal'

const NS = 'v2.org.students.importModal'
const csvFile = (text: string) => new File([text], 'hoc-vien.csv', { type: 'text/csv' })
const page = (content: { id: number; name: string }[], last = true) => ({
  content: content.map((c) => ({ ...c, inviteCode: null, teacherId: null, createdAt: '2026-09-01T00:00:00' })),
  number: 0, size: 50, totalElements: content.length, totalPages: 1, first: true, last,
})

beforeEach(() => {
  importRoster.mockReset()
  listClasses.mockReset()
  listClasses.mockResolvedValue(page([{ id: 7, name: 'B1 Tối' }, { id: 8, name: 'A2 Sáng' }]))
})

/** BF-07 / AC-ORG-ROSTER-01: xem trước → nhập kèm lớp → kết quả từng dòng. */
describe('ImportRosterModal', () => {
  it('chọn file → xem trước đúng dòng + cảnh báo email sai; nhập với lớp đã chọn → kết quả và danh sách lỗi', async () => {
    importRoster.mockResolvedValue({ total: 3, created: 1, linked: 1, enrolled: 2, failed: 1, errors: ['Dòng 3: email không hợp lệ "khong-phai-email"'] })
    const onImported = vi.fn()
    render(<ImportRosterModal onClose={() => undefined} onImported={onImported} />)

    const input = await screen.findByTestId('roster-file-input')
    const file = csvFile('﻿email,displayName,phone\r\nan@x.com,"Nguyễn, An",0912\r\nbinh@x.com,Bình,\r\nkhong-phai-email,C,\r\n')
    await userEvent.upload(input, file)

    expect(await screen.findByText(`${NS}.preview:{"count":3}`)).toBeTruthy()
    expect(screen.getByText(`${NS}.invalidEmails:{"count":1}`)).toBeTruthy()
    expect(screen.getByText('Nguyễn, An')).toBeTruthy()

    await waitFor(() => expect(screen.getByRole('option', { name: 'B1 Tối' })).toBeTruthy())
    await userEvent.selectOptions(screen.getByLabelText(`${NS}.classLabel`), '7')
    await userEvent.click(screen.getByTestId('roster-submit'))

    const result = await screen.findByTestId('roster-result')
    expect(importRoster).toHaveBeenCalledTimes(1)
    expect(importRoster.mock.calls[0][0]).toBe(file)
    expect(importRoster.mock.calls[0][1]).toBe(7)
    expect(within(result).getByText('Dòng 3: email không hợp lệ "khong-phai-email"')).toBeTruthy()
    expect(within(result).getByRole('button', { name: new RegExp(`${NS}.downloadErrors`) })).toBeTruthy()
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ created: 1, failed: 1 }))
    // Nút nhập không còn (đã xong) — tránh bấm nhập lặp.
    expect(screen.queryByTestId('roster-submit')).toBeNull()
  })

  it('file không có dòng dữ liệu → báo rỗng, nút nhập bị khoá; không gọi API', async () => {
    render(<ImportRosterModal onClose={() => undefined} onImported={() => undefined} />)
    await userEvent.upload(await screen.findByTestId('roster-file-input'), csvFile('email,displayName,phone\r\n'))
    expect(await screen.findByText(`${NS}.emptyFile`)).toBeTruthy()
    expect((screen.getByTestId('roster-submit') as HTMLButtonElement).disabled).toBe(true)
    expect(importRoster).not.toHaveBeenCalled()
  })

  it('máy chủ lỗi → banner lỗi, giữ nguyên xem trước để thử lại; không gắn lớp thì classId undefined', async () => {
    importRoster.mockRejectedValueOnce(new Error('HTTP 500 — DB down'))
    render(<ImportRosterModal onClose={() => undefined} onImported={() => undefined} />)
    await userEvent.upload(await screen.findByTestId('roster-file-input'), csvFile('an@x.com,An\r\n'))
    await screen.findByText(`${NS}.preview:{"count":1}`)
    await userEvent.click(screen.getByTestId('roster-submit'))
    expect(await screen.findByText(/HTTP 500 — DB down/)).toBeTruthy()
    expect(importRoster.mock.calls[0][1]).toBeUndefined()
    expect(screen.queryByTestId('roster-result')).toBeNull()
    expect(screen.getByText(`${NS}.preview:{"count":1}`)).toBeTruthy()
  })
})
