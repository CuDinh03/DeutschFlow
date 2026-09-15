/**
 * i18n đợt 3 (06/09/2026, F-I18N-02b): tcShared dùng chung 5 màn theo lớp của giáo viên — tên lớp
 * dự phòng "Lớp #id" và option "Chưa có lớp" đi qua catalog v2.teacher.tcShared; kiểm bằng locale `de`.
 */
import React from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('de'))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/v2/teacher/tc-progress',
  useSearchParams: () => new URLSearchParams(''),
}))

const get = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Unbekannter Fehler'),
}))

import { ClassPicker, useTeacherClasses } from '@/app/v2/teacher/tcShared'

beforeEach(() => vi.clearAllMocks())

describe('tcShared — locale de', () => {
  it('ClassPicker không có lớp → option tiếng Đức', () => {
    render(<ClassPicker classes={[]} classId={null} onChange={vi.fn()} />)
    expect(screen.getByRole('option', { name: 'Noch keine Klasse' })).toBeInTheDocument()
  })

  it('useTeacherClasses: lớp thiếu tên → "Klasse #id"; lớp có tên giữ nguyên; chọn lớp đầu', async () => {
    get.mockResolvedValue({ data: [{ id: 5 }, { id: 6, name: 'B1 Abend' }] })
    const { result } = renderHook(() => useTeacherClasses())
    await waitFor(() => expect(result.current.loadingClasses).toBe(false))
    expect(get).toHaveBeenCalledWith('/v2/teacher/classes')
    expect(result.current.classes.map((c) => c.name)).toEqual(['Klasse #5', 'B1 Abend'])
    expect(result.current.classId).toBe(5)
    expect(result.current.classesError).toBe('')
  })
})
