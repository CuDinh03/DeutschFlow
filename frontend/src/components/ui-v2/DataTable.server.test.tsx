import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type DataTableColumn } from './DataTable'

// Khoá + tham số → chuỗi đọc được, đủ để khẳng định footer lấy tổng từ đâu.
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => (k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k),
}))

type Row = { id: number; name: string }
const columns: DataTableColumn<Row>[] = [{ key: 'name', header: 'Tên', sortable: true }]
const rows = (n: number, offset = 0): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: offset + i + 1, name: `U${offset + i + 1}` }))

/** Đợt 1 admin (09/11/2026): chế độ server cho danh sách quá lớn để tải một lượt. */
describe('DataTable — chế độ server', () => {
  it('hiện ĐÚNG các dòng nhận được, không tự cắt hay sắp xếp lại', () => {
    const data = [{ id: 2, name: 'Zeta' }, { id: 1, name: 'Alpha' }]
    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
        server={{ total: 2, page: 1, pageSize: 1, onPageChange: vi.fn() }}
      />,
    )
    const cells = screen.getAllByRole('cell').map((c) => c.textContent)
    // pageSize=1 nhưng bảng KHÔNG cắt: dữ liệu server đã là một trang.
    expect(cells).toEqual(['Zeta', 'Alpha'])
  })

  it('footer lấy tổng từ `total`, không từ số dòng đang có', () => {
    render(
      <DataTable
        columns={columns}
        data={rows(20, 20)}
        rowKey={(r) => r.id}
        server={{ total: 137, page: 2, pageSize: 20, onPageChange: vi.fn() }}
      />,
    )
    expect(screen.getByText(/tableFooter/).textContent).toContain('"from":21')
    expect(screen.getByText(/tableFooter/).textContent).toContain('"to":40')
    expect(screen.getByText(/tableFooter/).textContent).toContain('"total":"137"')
  })

  it('bấm trang kế gọi onPageChange(page + 1), không tự đổi trang', () => {
    const onPageChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={rows(20)}
        rowKey={(r) => r.id}
        server={{ total: 60, page: 1, pageSize: 20, onPageChange }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'nextPage' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    // Vẫn trang 1 cho tới khi caller truyền page mới.
    expect(screen.getByText('U1')).toBeTruthy()
  })

  it('bấm tiêu đề cột: asc → desc theo trạng thái caller truyền vào', () => {
    const onSortChange = vi.fn()
    const base = { total: 3, page: 1, pageSize: 20, onPageChange: vi.fn(), onSortChange }
    const { rerender } = render(
      <DataTable columns={columns} data={rows(3)} rowKey={(r) => r.id} server={base} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Tên/ }))
    expect(onSortChange).toHaveBeenLastCalledWith('name', 'asc')

    rerender(
      <DataTable
        columns={columns}
        data={rows(3)}
        rowKey={(r) => r.id}
        server={{ ...base, sortKey: 'name', sortDir: 'asc' }}
      />,
    )
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(screen.getByRole('button', { name: /Tên/ }))
    expect(onSortChange).toHaveBeenLastCalledWith('name', 'desc')
  })

  it('keepPreviousRows: đang tải trang mới vẫn giữ dòng cũ, đánh dấu aria-busy', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={rows(2)}
        rowKey={(r) => r.id}
        loading
        keepPreviousRows
        server={{ total: 40, page: 1, pageSize: 20, onPageChange: vi.fn() }}
      />,
    )
    expect(screen.getByText('U1')).toBeTruthy()
    expect(container.querySelector('[data-refreshing="true"]')).toBeTruthy()
  })

  it('chế độ client không đổi: tự cắt 8 dòng/trang', () => {
    render(<DataTable columns={columns} data={rows(10)} rowKey={(r) => r.id} />)
    expect(screen.getAllByRole('row')).toHaveLength(1 + 8)
  })
})
