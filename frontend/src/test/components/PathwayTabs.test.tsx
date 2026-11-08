/** Đợt B (08/11/2026): Hành trình sang Đức thành tab ARIA, mặc định con đường đầu (Học nghề). */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PathwayTabs, type Pathway } from '@/components/landing-v2/PathwayTabs'

const item = (name: string): Pathway => ({ name, de: name, who: `${name} who`, level: 'B1', exam: 'telc', interview: 'x', fit: `${name} fit` })
const renderTabs = () =>
  render(
    <PathwayTabs
      items={[item('Học nghề'), item('Công nhận bằng'), item('Du học')]}
      colors={['red', 'blue', 'green']}
      labels={{ level: 'Trình độ', exam: 'Kỳ thi', interview: 'Phỏng vấn' }}
      ariaLabel="Hành trình sang Đức"
    />,
  )

describe('PathwayTabs', () => {
  it('mặc định mở Học nghề; bảng khác vẫn có trong HTML nhưng ẩn', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: 'Học nghề' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Học nghề fit')
    expect(screen.getByText('Du học fit', { selector: 'p' }).closest('[role="tabpanel"]')).toHaveAttribute('hidden')
  })

  it('bấm hoặc dùng phím mũi tên/Home/End để đổi tab, chỉ tab đang chọn nằm trong thứ tự Tab', () => {
    renderTabs()
    fireEvent.click(screen.getByRole('tab', { name: 'Du học' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Du học fit')

    const list = screen.getByRole('tablist', { name: 'Hành trình sang Đức' })
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Học nghề' })).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Học nghề' }))
    fireEvent.keyDown(list, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Du học' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Học nghề' })).toHaveAttribute('tabindex', '-1')
  })
})
