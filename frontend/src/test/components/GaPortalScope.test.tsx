/**
 * Wave 0 (W0-C4) — PORTAL SCOPE CONTRACT test.
 *
 * Radix portal render nội dung trên document.body, NGOÀI subtree `.ga-scope`. Hợp đồng:
 * nội dung portal phải TỰ mang class `ga-scope` + đúng `data-role` (dò từ vị trí trigger
 * hoặc prop `gaRole` tường minh) để token `--ga-*` và role accent resolve được.
 *
 * jsdom không đọc stylesheet nên test khẳng định ở mức HỢP ĐỒNG DOM: class + attribute
 * trên phần tử portal thật (đã nằm ngoài container render).
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeAll } from 'vitest'
import { GaPopover, GaPopoverTrigger, GaPopoverContent } from '@/components/ui-v2/GaPopover'
import { GaTooltip, GaTooltipTrigger, GaTooltipContent } from '@/components/ui-v2/GaTooltip'
import {
  GaSelect,
  GaSelectTrigger,
  GaSelectValue,
  GaSelectContent,
  GaSelectItem,
} from '@/components/ui-v2/GaSelect'

beforeAll(() => {
  // jsdom thiếu các API Radix Select cần — polyfill tối thiểu cho test.
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false)
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {})
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {})
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {})
})

function inGaScope(ui: React.ReactNode, role = 'teacher') {
  return render(
    <div className="ga-scope" data-role={role}>
      {ui}
    </div>,
  )
}

describe('GaPopover — portal giữ Galerie scope', () => {
  it('content portaled mang ga-scope + data-role dò từ trigger', async () => {
    inGaScope(
      <GaPopover>
        <GaPopoverTrigger>Mở</GaPopoverTrigger>
        <GaPopoverContent>Nội dung</GaPopoverContent>
      </GaPopover>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mở' }))
    await waitFor(() => {
      const content = document.querySelector('[data-slot="ga-popover-content"]') as HTMLElement
      expect(content).not.toBeNull()
      expect(content.classList.contains('ga-scope')).toBe(true)
      expect(content.getAttribute('data-role')).toBe('teacher')
      // Xác nhận content THẬT SỰ nằm ngoài subtree .ga-scope của app (portal).
      expect(content.closest('div.ga-scope[data-role="teacher"] [data-slot]')).toBeNull()
    })
  })

  it('prop gaRole tường minh thắng auto-detect', async () => {
    inGaScope(
      <GaPopover gaRole="admin">
        <GaPopoverTrigger>Mở</GaPopoverTrigger>
        <GaPopoverContent>Nội dung</GaPopoverContent>
      </GaPopover>,
      'student',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mở' }))
    await waitFor(() => {
      const content = document.querySelector('[data-slot="ga-popover-content"]') as HTMLElement
      expect(content.getAttribute('data-role')).toBe('admin')
    })
  })
})

describe('GaTooltip — portal giữ Galerie scope', () => {
  it('content mang ga-scope + data-role khi mở bằng focus', async () => {
    inGaScope(
      <GaTooltip>
        <GaTooltipTrigger>Trợ giúp</GaTooltipTrigger>
        <GaTooltipContent>Giải thích</GaTooltipContent>
      </GaTooltip>,
      'org',
    )
    fireEvent.focus(screen.getByRole('button', { name: 'Trợ giúp' }))
    await waitFor(() => {
      const content = document.querySelector('[data-slot="ga-tooltip-content"]') as HTMLElement
      expect(content).not.toBeNull()
      expect(content.classList.contains('ga-scope')).toBe(true)
      expect(content.getAttribute('data-role')).toBe('org')
    })
  })
})

describe('GaSelect — portal giữ Galerie scope', () => {
  it('content mang ga-scope + data-role; item render trong portal', async () => {
    inGaScope(
      <GaSelect defaultValue="a">
        <GaSelectTrigger aria-label="Chọn lớp">
          <GaSelectValue />
        </GaSelectTrigger>
        <GaSelectContent>
          <GaSelectItem value="a">Lớp A1</GaSelectItem>
          <GaSelectItem value="b">Lớp B1</GaSelectItem>
        </GaSelectContent>
      </GaSelect>,
      'student',
    )
    const trigger = screen.getByLabelText('Chọn lớp')
    // jsdom không có PointerEvent thật — mở bằng bàn phím (hành vi Radix chuẩn, cũng chính là
    // đường accessibility mà Wave 0 phải bảo đảm).
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await waitFor(() => {
      const content = document.querySelector('[data-slot="ga-select-content"]') as HTMLElement
      expect(content).not.toBeNull()
      expect(content.classList.contains('ga-scope')).toBe(true)
      expect(content.getAttribute('data-role')).toBe('student')
      expect(content.textContent).toContain('Lớp B1')
    })
  })
})
