import { describe, it, expect } from 'vitest'
import { isInvoiceOverdue } from '@/lib/orgInvoice'

/**
 * V-12b — MỘT định nghĩa "quá hạn" cho cả khu billing/finance.
 *
 * Trước đợt này `/v2/org/billing` đo bằng `dueDate` còn `/v2/admin/organizations` đo bằng
 * `periodEnd`. `periodEnd` là ngày kết thúc KỲ DỊCH VỤ; hạn trả tiền là lúc gửi + 7 ngày. Hai màn
 * vì thế nói ngược nhau về cùng một hoá đơn.
 */
const NOW = Date.parse('2026-09-08T00:00:00Z')
const inv = (status: string, dueDate: string | null) => ({ status, dueDate })

describe('isInvoiceOverdue', () => {
  it('SENT + hạn đã qua ⇒ quá hạn', () => {
    expect(isInvoiceOverdue(inv('SENT', '2026-09-07T00:00:00Z'), NOW)).toBe(true)
  })

  it('SENT + hạn còn tới ⇒ CHƯA quá hạn, kể cả khi kỳ dịch vụ đã kết thúc', () => {
    // Đây chính là ca bảng admin từng gắn cờ đỏ oan: kỳ kết thúc 31/08, hạn trả 14/09.
    expect(isInvoiceOverdue({ status: 'SENT', dueDate: '2026-09-14T00:00:00Z' }, NOW)).toBe(false)
  })

  it('PAID không bao giờ quá hạn — hạn chỉ còn là dữ kiện lịch sử', () => {
    expect(isInvoiceOverdue(inv('PAID', '2026-08-01T00:00:00Z'), NOW)).toBe(false)
  })

  it('DRAFT/VOID và hoá đơn chưa có hạn ⇒ không quá hạn', () => {
    expect(isInvoiceOverdue(inv('DRAFT', null), NOW)).toBe(false)
    expect(isInvoiceOverdue(inv('VOID', '2026-08-01T00:00:00Z'), NOW)).toBe(false)
    expect(isInvoiceOverdue(inv('SENT', null), NOW)).toBe(false)
  })

  it('status thiếu hoặc hạn rác ⇒ không quá hạn, không ném lỗi', () => {
    expect(isInvoiceOverdue({ status: null, dueDate: '2026-08-01T00:00:00Z' }, NOW)).toBe(false)
    expect(isInvoiceOverdue(inv('SENT', 'không-phải-ngày'), NOW)).toBe(false)
  })

  it('không phân biệt hoa thường ở status', () => {
    expect(isInvoiceOverdue(inv('sent', '2026-09-07T00:00:00Z'), NOW)).toBe(true)
  })
})
