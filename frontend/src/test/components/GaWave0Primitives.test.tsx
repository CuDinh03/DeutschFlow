/**
 * Wave 0 (W0-C7) — contract test cho primitive remediation:
 *   • focus-visible: interactive element có class ring nhìn thấy được (F-05).
 *   • touch target mobile ≥44px: class min-h-11/h-11 dưới lg (F-06/D8).
 *   • aria-invalid trên GaInput/GaTextarea (từng 0/27).
 *   • GaProgress: role="progressbar" + aria-value* + nhãn % (không chỉ màu).
 *   • DataTable: loading → role="status", error → role="alert" (F-08).
 *
 * jsdom không tính px từ Tailwind class nên các test target-size khẳng định qua className —
 * cùng quy ước với GaSidebarDrawer.test.tsx hiện có; đo px thật thuộc visual regression gate.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaInput, GaTextarea } from '@/components/ui-v2/GaInput'
import { GaProgress } from '@/components/ui-v2/GaProgress'
import { TkBadge } from '@/components/ui-v2/TkBadge'
import { DataTable } from '@/components/ui-v2/DataTable'
import { TkSearch } from '@/components/ui-v2/TkSearch'
import { TeacherPendingPill } from '@/components/ui-v2/TeacherPendingPill'
import { GaPopover, GaPopoverTrigger } from '@/components/ui-v2/GaPopover'

// TeacherPendingPill fetch summary khi mount — treo promise để giữ trạng thái ban đầu.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})) },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => {
    // Trả về key (kèm params nếu có) để test assert theo key, không phụ thuộc bản dịch.
    const f = (k: string, v?: Record<string, unknown>) =>
      v ? `${k}:${Object.values(v).join(',')}` : k
    ;(f as unknown as { has: (k: string) => boolean }).has = () => false
    return f
  },
  useLocale: () => 'vi',
}))

describe('GaBtn — focus-visible + touch target (F-05/F-06)', () => {
  it('có ring focus-visible và min-height 44px mobile ở mọi size', () => {
    const { rerender } = render(<GaBtn size="sm">Lưu</GaBtn>)
    for (const size of ['sm', 'md', 'lg'] as const) {
      rerender(<GaBtn size={size}>Lưu</GaBtn>)
      const btn = screen.getByRole('button', { name: 'Lưu' })
      expect(btn.className).toContain('focus-visible:ring-2')
      expect(btn.className).toContain('h-11')
    }
  })

  it('loading: disabled + aria-busy', () => {
    render(<GaBtn loading>Đang lưu</GaBtn>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.getAttribute('aria-busy')).toBe('true')
  })
})

describe('GaInput / GaTextarea — aria-invalid + focus-visible', () => {
  it('invalid → aria-invalid=true + class viền đỏ', () => {
    render(<GaInput invalid aria-label="Email" />)
    const input = screen.getByLabelText('Email')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.className).toContain('aria-[invalid=true]:border-ga-red')
    expect(input.className).toContain('focus-visible:ring-2')
    expect(input.className).toContain('min-h-11')
    expect(input.className).toContain('rounded-ga-touch')
  })

  it('mặc định không aria-invalid; disabled có style riêng', () => {
    render(<GaTextarea aria-label="Ghi chú" disabled />)
    const ta = screen.getByLabelText('Ghi chú')
    expect(ta.getAttribute('aria-invalid')).toBeNull()
    expect(ta).toBeDisabled()
    expect(ta.className).toContain('disabled:opacity-50')
  })
})

describe('GaProgress — giá trị đọc được ngoài màu', () => {
  it('role=progressbar + aria-valuenow + nhãn %', () => {
    render(<GaProgress value={72} label="Tiến độ chương" showValue />)
    const bar = screen.getByRole('progressbar', { name: 'Tiến độ chương' })
    expect(bar.getAttribute('aria-valuenow')).toBe('72')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('clamp giá trị ngoài khoảng', () => {
    render(<GaProgress value={140} label="x" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
  })
})

describe('TkBadge — solid không còn text-white thô', () => {
  it('solid dùng token text-ga-bg', () => {
    render(<TkBadge variant="solid" tone="green">Hoạt động</TkBadge>)
    const badge = screen.getByText('Hoạt động')
    expect(badge.className).toContain('text-ga-bg')
    expect(badge.className).not.toContain('text-white')
  })
})

describe('DataTable — trạng thái có ngữ nghĩa (F-08)', () => {
  const columns = [{ key: 'name', header: 'Tên', sortable: true }]
  const data = [{ name: 'Anna' }, { name: 'Bao' }]

  it('loading → role=status + aria-busy', () => {
    render(<DataTable columns={columns} data={[]} rowKey={(_, i) => i} loading />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-busy')).toBe('true')
  })

  it('error → role=alert + nút thử lại', () => {
    const retry = vi.fn()
    render(<DataTable columns={columns} data={[]} rowKey={(_, i) => i} error="Lỗi mạng" onRetry={retry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    screen.getByRole('button', { name: 'retry' }).click()
    expect(retry).toHaveBeenCalled()
  })

  it('header sortable là <button> thật có focus-visible (W0-C3 nested interactive)', () => {
    render(<DataTable columns={columns} data={data} rowKey={(_, i) => i} />)
    const sortBtn = screen.getByRole('button', { name: 'Tên' })
    expect(sortBtn.tagName).toBe('BUTTON')
    expect(sortBtn.className).toContain('focus-visible:ring-2')
  })

  it('pager có aria-label + touch target 44px', () => {
    render(<DataTable columns={columns} data={data} rowKey={(_, i) => i} pageSize={1} />)
    const prev = screen.getByRole('button', { name: 'prevPage' })
    expect(prev.className).toContain('h-11')
    expect(prev.className).toContain('focus-visible:ring-2')
    const page1 = screen.getByRole('button', { name: 'page:1' })
    expect(page1.getAttribute('aria-current')).toBe('page')
  })

  it('row-action contract (remediation #2): NÚT THẬT trong cell, accessible name có ngữ cảnh row', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(_, i) => i}
        onRowClick={onRowClick}
        rowActionLabel={(r: { name: string }) => `Mở hồ sơ ${r.name}`}
      />,
    )
    // Button thật, focusable, tên có ngữ cảnh row.
    const btn = screen.getByRole('button', { name: 'Mở hồ sơ Anna' })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.className).toContain('focus-visible:ring-ga-focus')
    // Enter / Space / click đều mở đúng row (native button + user-event mô phỏng UA).
    btn.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(btn)
    expect(onRowClick).toHaveBeenCalledTimes(3)
    expect(onRowClick).toHaveBeenLastCalledWith({ name: 'Anna' })
    // <tr> GIỮ table semantics: không tabindex, không role — không phải tab stop thay control.
    const row = btn.closest('tr') as HTMLElement
    expect(row.getAttribute('tabindex')).toBeNull()
    expect(row.getAttribute('role')).toBeNull()
    // Pointer click toàn row vẫn là enhancement.
    await user.click(screen.getByText('Anna'))
    expect(onRowClick).toHaveBeenCalledTimes(4)
  })

  it('row-action fallback: thiếu rowActionLabel → nhãn chung v2.ui.openRow; có cột Actions sr-only', () => {
    render(<DataTable columns={columns} data={data} rowKey={(_, i) => i} onRowClick={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: 'openRow' })).toHaveLength(2)
    expect(screen.getByText('actions').className).toContain('sr-only')
  })

  it('row KHÔNG clickable: không action column, không tabindex', () => {
    render(<DataTable columns={columns} data={data} rowKey={(_, i) => i} />)
    const row = screen.getByText('Anna').closest('tr') as HTMLElement
    expect(row.getAttribute('tabindex')).toBeNull()
    expect(screen.queryByRole('button', { name: 'openRow' })).toBeNull()
  })
})

describe('Gate 0 review — các gap a11y đã vá', () => {
  it('TkSearch container: min-h 44px dưới lg + focus-within ring ga-focus', () => {
    const { container } = render(<TkSearch aria-label="Tìm" />)
    const wrap = container.firstElementChild as HTMLElement
    expect(wrap.className).toContain('min-h-11')
    expect(wrap.className).toContain('lg:min-h-0')
    expect(wrap.className).toContain('focus-within:ring-ga-focus')
  })

  it('TeacherPendingPill: mọi biến thể có min-h 44px dưới lg', () => {
    render(<TeacherPendingPill />)
    const pill = screen.getByText('roleChipTeacher')
    expect(pill.className).toContain('min-h-11')
    expect(pill.className).toContain('lg:min-h-0')
  })

  it('GaPopoverTrigger dùng TRỰC TIẾP (không asChild): có focus-visible + ≥44px mặc định', () => {
    render(
      <GaPopover>
        <GaPopoverTrigger>Mở</GaPopoverTrigger>
      </GaPopover>,
    )
    const trigger = screen.getByRole('button', { name: 'Mở' })
    expect(trigger.className).toContain('focus-visible:ring-ga-focus')
    expect(trigger.className).toContain('min-h-11')
  })

  it('GaPopoverTrigger asChild: KHÔNG ép class mặc định (phần tử con tự chịu contract)', () => {
    render(
      <GaPopover>
        <GaPopoverTrigger asChild>
          <button className="my-own">Mở</button>
        </GaPopoverTrigger>
      </GaPopover>,
    )
    const trigger = screen.getByRole('button', { name: 'Mở' })
    expect(trigger.className).toContain('my-own')
    expect(trigger.className).not.toContain('min-h-11')
  })
})
