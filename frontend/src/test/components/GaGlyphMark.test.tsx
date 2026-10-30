import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import { GaNavIcon } from '@/components/ui-v2/GaNavIcon'

describe('GaGlyphMark', () => {
  it('vẽ mảng vàng trước nét mực, nét mực theo currentColor', () => {
    const { container } = render(<GaGlyphMark name="speaking" />)
    const shapes = Array.from(container.querySelectorAll("svg > *"))
    expect(shapes[0].getAttribute('fill')).toBe('var(--ga-yellow)')
    expect(shapes.slice(1).every((s) => s.getAttribute('stroke') === 'currentColor')).toBe(true)
  })

  it('glyph huỷ dùng mảng đỏ thay vàng', () => {
    const { container } = render(<GaGlyphMark name="xoa" />)
    expect(container.querySelector('[fill="var(--ga-red)"]')).not.toBeNull()
    expect(container.querySelector('[fill="var(--ga-yellow)"]')).toBeNull()
  })

  it('nét trên ô vàng lớn giữ màu mực để đọc được ở nền tối', () => {
    const { container } = render(<GaGlyphMark name="hoanthanh" />)
    expect(container.querySelector('.ga-glyph-ink')?.getAttribute('stroke')).toBe('var(--ga-ink)')
  })

  it('mặc định ẩn với trình đọc màn hình, có title thì đọc như một hình', () => {
    const { container, rerender } = render(<GaGlyphMark name="hoc" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    rerender(<GaGlyphMark name="hoc" title="Học" />)
    expect(screen.getByRole('img', { name: 'Học' })).toBeInTheDocument()
  })
})

describe('GaNavIcon', () => {
  it('có glyph thì vẽ glyph, không có thì rơi về Lucide', () => {
    const { container, rerender } = render(<GaNavIcon icon="dashboard" glyph="heute" size={18} />)
    expect(container.querySelector('.ga-glyph')).not.toBeNull()
    rerender(<GaNavIcon icon="dashboard" size={18} />)
    expect(container.querySelector('.ga-glyph')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
