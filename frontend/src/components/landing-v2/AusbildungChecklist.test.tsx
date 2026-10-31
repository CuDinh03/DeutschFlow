import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUSBILDUNG_COPY } from '@/content/ausbildung'
import { AusbildungChecklist, CHECKLIST_STORAGE_KEY } from './AusbildungChecklist'

const copy = AUSBILDUNG_COPY.vi.steps
const total = copy.items.length

describe('AusbildungChecklist', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('đánh dấu một bước thì cập nhật tiến độ và lưu lại', () => {
    render(<AusbildungChecklist copy={copy} />)
    expect(screen.getByRole('status')).toHaveTextContent(`Đã xong 0/${total} bước`)

    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn nghề/ }))

    expect(screen.getByRole('status')).toHaveTextContent(`Đã xong 1/${total} bước`)
    expect(JSON.parse(window.localStorage.getItem(CHECKLIST_STORAGE_KEY) ?? '[]')).toEqual(['chon-nghe'])
  })

  it('đọc lại tiến độ đã lưu, bỏ qua id không còn tồn tại', () => {
    window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(['hop-dong', 'buoc-da-xoa']))
    render(<AusbildungChecklist copy={copy} />)
    expect(screen.getByRole('status')).toHaveTextContent(`Đã xong 1/${total} bước`)
    expect(screen.getByRole('checkbox', { name: /Tìm chỗ học/ })).toBeChecked()
  })

  it('dữ liệu lưu hỏng thì coi như chưa có gì', () => {
    window.localStorage.setItem(CHECKLIST_STORAGE_KEY, '{hỏng')
    render(<AusbildungChecklist copy={copy} />)
    expect(screen.getByRole('status')).toHaveTextContent(`Đã xong 0/${total} bước`)
  })

  it('bộ nhớ bị chặn: vẫn đánh dấu được, không ném lỗi', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<AusbildungChecklist copy={copy} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn nghề/ }))
    expect(screen.getByRole('status')).toHaveTextContent(`Đã xong 1/${total} bước`)
  })

  it('xoá dấu đưa tiến độ về 0', () => {
    window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(['chon-nghe']))
    render(<AusbildungChecklist copy={copy} />)
    fireEvent.click(screen.getByRole('button', { name: copy.reset }))
    expect(screen.getByRole('status')).toHaveTextContent(`Đã xong 0/${total} bước`)
    expect(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)).toBe('[]')
  })
})
