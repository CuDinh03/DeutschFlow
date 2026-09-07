/**
 * G3 / D11 — biểu đồ phải đọc được mà không cần rê chuột.
 *
 * Trong các biểu đồ recharts của cohort analytics, con số CHỈ nằm trong tooltip. Tooltip đòi hover:
 * thiết bị cảm ứng không có trạng thái đó, bàn phím không tới được, trình đọc màn hình chỉ thấy một
 * khối SVG. Với những người dùng đó, biểu đồ hiện là hình trang trí không đọc được — và trục Y còn
 * rút gọn số lớn (12,5tr₫), nên ngay cả người rê được chuột cũng không thấy giá trị đầy đủ ở đâu.
 *
 * `GaChartData` là đường đọc số thứ hai: <details> + <table>, mở bằng bàn phím, không cần JS.
 * `GaSection description` trả lời "đọc con số này ra sao" (đơn vị, khoảng, mẫu số) — thứ tiêu đề
 * không nói được.
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { GaSection } from '@/app/v2/sectionShared'
import { GaChartData } from '@/app/v2/analyticsShared'

describe('GaSection — dòng mô tả nêu cách đọc số', () => {
  it('hiện mô tả khi được truyền, và vẫn giữ slot right cho thao tác', () => {
    render(
      <GaSection title="Từ vựng" description="Số từ học mới mỗi ngày." right={<button>Lọc</button>}>
        <p>nội dung</p>
      </GaSection>,
    )

    expect(screen.getByRole('heading', { name: 'Từ vựng' })).toBeInTheDocument()
    expect(screen.getByText('Số từ học mới mỗi ngày.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lọc' })).toBeInTheDocument()
  })

  it('không truyền mô tả thì không chèn phần tử rỗng', () => {
    const { container } = render(
      <GaSection title="Từ vựng">
        <p>nội dung</p>
      </GaSection>,
    )
    expect(container.querySelectorAll('p')).toHaveLength(1) // chỉ có nội dung
  })
})

describe('GaChartData — đường đọc số thứ hai', () => {
  const rows = [
    { label: 'T2', values: ['3', '6'] },
    { label: 'T3', values: ['0', '2'] },
  ]

  it('mở được bằng BÀN PHÍM và in đủ số liệu (không cần hover)', async () => {
    render(<GaChartData summaryLabel="Xem số liệu dạng bảng" columns={['Ngày', 'Học mới', 'Ôn lại']} rows={rows} />)

    const summary = screen.getByText('Xem số liệu dạng bảng')
    await userEvent.click(summary)

    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Học mới' })).toBeInTheDocument()
    // Nhãn hàng là <th scope="row"> để trình đọc màn hình ghép được ô số với ngày của nó.
    expect(within(table).getByRole('rowheader', { name: 'T2' })).toBeInTheDocument()
    expect(within(table).getAllByRole('cell').map((c) => c.textContent)).toEqual(['3', '6', '0', '2'])
  })

  it('giá trị ÂM và số đầy đủ hiển thị nguyên vẹn (trục rút gọn không phải đường duy nhất)', () => {
    render(
      <GaChartData
        summaryLabel="Xem số liệu dạng bảng"
        columns={['Kỳ', 'Còn lại']}
        rows={[{ label: '2026-08', values: ['-3.500.000 ₫'] }]}
      />,
    )
    expect(screen.getByText('-3.500.000 ₫')).toBeInTheDocument()
  })

  it('không có dữ liệu thì không dựng khối rỗng', () => {
    const { container } = render(<GaChartData summaryLabel="Xem số liệu dạng bảng" columns={['Ngày']} rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
