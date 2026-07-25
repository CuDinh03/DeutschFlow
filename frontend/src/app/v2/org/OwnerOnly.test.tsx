import { renderHook, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useIsOrgOwner } from './OwnerOnly'

// vi.hoisted chạy TRƯỚC cả vi.mock lẫn các import tĩnh, nên hook thấy đúng bản mock này mà không
// cần `await import()` ở top-level (tsconfig của repo không cho phép top-level await).
const getOrgRole = vi.hoisted(() => vi.fn<() => string>())
vi.mock('@/lib/authSession', () => ({ getOrgRole }))

describe('useIsOrgOwner — cổng vai trò cho nút khoá kỳ công', () => {
  beforeEach(() => getOrgRole.mockReset())

  it('SSR không vẽ nhánh nào — chưa biết vai trò thì chưa quyết', () => {
    // Vai trò nằm ở cookie/JWT phía client, server không có. Nếu hook trả false ngay từ render đầu
    // thì chú thích "chờ Giám đốc" bị nháy trước mắt chính giám đốc; nếu trả true thì nút khoá nháy
    // trước mắt quản lý rồi biến mất. Cả hai đều là hydration mismatch. renderToString là chỗ DUY
    // NHẤT quan sát được trạng thái trước-effect (renderHook bọc act nên đã flush effect).
    getOrgRole.mockReturnValue('OWNER')
    function Probe() {
      const isOwner = useIsOrgOwner()
      return <span>{isOwner === null ? 'chua-biet' : String(isOwner)}</span>
    }
    expect(renderToString(<Probe />)).toContain('chua-biet')
    expect(getOrgRole).not.toHaveBeenCalled() // không đọc cookie khi render trên server
  })

  it('OWNER → true (thấy nút khoá kỳ)', async () => {
    getOrgRole.mockReturnValue('OWNER')
    const { result } = renderHook(() => useIsOrgOwner())
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('MANAGER → false (thấy chú thích chờ Giám đốc, không thấy nút)', async () => {
    getOrgRole.mockReturnValue('MANAGER')
    const { result } = renderHook(() => useIsOrgOwner())
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('không có vai trò org (chuỗi rỗng) → false, không phải null vĩnh viễn', async () => {
    getOrgRole.mockReturnValue('')
    const { result } = renderHook(() => useIsOrgOwner())
    await waitFor(() => expect(result.current).toBe(false))
  })
})
