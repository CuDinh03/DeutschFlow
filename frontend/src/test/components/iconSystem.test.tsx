import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { GA_LINE_GLYPHS } from '@/components/ui-v2/glyphs'
import { GaGlyph } from '@/components/ui-v2/GaGlyph'
import { EmptyState } from '@/components/ui-v2/EmptyState'
import { GA_ICON_NAMES } from '@/components/ui-v2/GaIcon'
import { TYPE_ICON } from '@/lib/notificationDisplay'

/** Mọi số trong chuỗi `d` (đủ để kiểm hình nằm trong lưới — không phải trình phân tích path đầy đủ). */
function numbersOf(el: Element): number[] {
  if (el.tagName === 'circle') {
    const [cx, cy, r] = ['cx', 'cy', 'r'].map((a) => Number(el.getAttribute(a)))
    return [cx - r, cx + r, cy - r, cy + r]
  }
  const d = el.getAttribute('d') ?? ''
  // Lệnh tương đối (chữ thường) cộng dồn từ điểm trước nên chỉ kiểm điểm tuyệt đối đầu mỗi path (M).
  const m = d.match(/^M\s*([\d.]+)[ ,]+([\d.]+)/)
  return m ? [Number(m[1]), Number(m[2])] : []
}

describe('Glyph nét tự vẽ (components/ui-v2/glyphs)', () => {
  for (const [name, Glyph] of Object.entries(GA_LINE_GLYPHS)) {
    it(`${name}: lưới 24, nét 1.9 currentColor, đầu nét tròn, không tô`, () => {
      const { container } = render(<Glyph />)
      const svg = container.querySelector('svg')!
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(svg.getAttribute('stroke')).toBe('currentColor')
      expect(svg.getAttribute('stroke-width')).toBe('1.9')
      expect(svg.getAttribute('stroke-linecap')).toBe('round')
      expect(svg.getAttribute('stroke-linejoin')).toBe('round')
      expect(svg.getAttribute('fill')).toBe('none')
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(svg.classList.contains('ga-line-glyph')).toBe(true)
      const shapes = Array.from(svg.querySelectorAll('path, circle'))
      expect(shapes.length).toBeGreaterThan(0)
      for (const s of shapes) {
        expect(s.getAttribute('fill')).toBeNull()
        for (const n of numbersOf(s)) {
          expect(n).toBeGreaterThanOrEqual(2)
          expect(n).toBeLessThanOrEqual(22)
        }
      }
    })
  }

  it('có title thì đọc như một hình', () => {
    const { SpeakAi } = GA_LINE_GLYPHS
    render(<SpeakAi title="AI" />)
    expect(screen.getByRole('img', { name: 'AI' })).toBeInTheDocument()
  })
})

describe('GaGlyph — ô icon nhận diện', () => {
  it('mặc định ô navy cỡ md, vuông bo rounded-ga, icon 18px', () => {
    const { container } = render(<GaGlyph icon={BookOpen} />)
    const box = container.firstElementChild!
    expect(box.className).toContain('rounded-ga')
    expect(box.className).not.toContain('rounded-ga-pill')
    expect(box.className).toContain('bg-ga-navy-soft')
    expect(box.className).toContain('h-9')
    expect(box.querySelector('svg')?.getAttribute('width')).toBe('18')
  })

  it('nhận glyph tự vẽ như icon Lucide', () => {
    const { container } = render(<GaGlyph icon={GA_LINE_GLYPHS.TreeBud} size="lg" tone="green" />)
    expect(container.querySelector('[data-glyph="TreeBud"]')?.getAttribute('width')).toBe('24')
    expect(container.firstElementChild!.className).toContain('bg-ga-green-soft')
  })

  it('EmptyState dùng ô vuông, không còn vòng tròn theo màu vai trò', () => {
    const { container } = render(<EmptyState title="Trống" icon="inbox" />)
    const box = container.querySelector('.h-12')!
    expect(box.className).toContain('rounded-ga')
    expect(box.className).not.toContain('rounded-ga-pill')
    expect(box.className).toContain('bg-ga-side-active')
  })
})

describe('Bảng icon theo tên không rơi về vòng tròn rỗng', () => {
  it('mọi loại thông báo trỏ tới một khoá có trong GaIcon', () => {
    const missing = Object.entries(TYPE_ICON).filter(([, icon]) => !GA_ICON_NAMES.includes(icon))
    expect(missing).toEqual([])
  })
})

describe('Một nét cho mọi icon trong khu Galerie', () => {
  it('galerie.css ép Lucide và glyph tự vẽ về nét 1.9', () => {
    const css = readFileSync(join(__dirname, '../../styles/galerie.css'), 'utf8')
    expect(css).toMatch(/\.ga-scope svg\.lucide,\s*\.ga-scope svg\.ga-line-glyph\s*\{\s*stroke-width:\s*1\.9;/)
  })
})

describe('Thanh bên admin: mỗi mục một hình', () => {
  it('không hai mục nào trùng icon, và icon nào cũng có trong GaIcon', async () => {
    const { adminNav } = await import('@/components/ui-v2/nav')
    const items = adminNav.sections.flatMap((s) => s.items)
    const icons = items.map((i) => i.icon)
    expect(icons.filter((ic) => !GA_ICON_NAMES.includes(ic))).toEqual([])
    const dup = icons.filter((ic, idx) => icons.indexOf(ic) !== idx)
    // `person` (Hồ sơ) nằm ở nhóm Tài khoản, không trùng với mục nào ở nhóm chính.
    expect(dup).toEqual([])
  })
})
