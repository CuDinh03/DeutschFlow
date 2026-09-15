/**
 * Định nghĩa DUY NHẤT của "hoá đơn quá hạn" trong khu billing/finance.
 *
 * V-12b (08/09/2026): trước đợt này có HAI định nghĩa khác nhau trên hai màn cùng đọc một
 * `OrgInvoiceDto`:
 *   · `/v2/org/billing`      — quá hạn = SENT + `dueDate` đã qua;
 *   · `/v2/admin/organizations` — quá hạn = SENT + `periodEnd` đã qua.
 * `periodEnd` là ngày kết thúc KỲ DỊCH VỤ, không phải hạn trả tiền: hoá đơn gửi ngày cuối kỳ có
 * hạn 7 ngày sau (Q4), nên bảng admin gắn cờ đỏ "quá hạn" cho trung tâm vẫn còn nguyên một tuần
 * để trả. Hai màn vì thế nói ngược nhau về cùng một hoá đơn.
 *
 * Nguồn thật là `OrgInvoiceDto.dueDate` (lúc gửi + 7 ngày; null = hoá đơn còn nháp nên chưa có hạn).
 */

/** Phần hoá đơn cần để phán "quá hạn" — đủ cho cả `orgApi.OrgInvoice` lẫn `adminOrgApi.OrgInvoice`. */
export interface OverdueCheckable {
  status: string | null | undefined
  dueDate: string | null | undefined
}

/**
 * Hoá đơn đã gửi, có hạn thanh toán, và hạn đó đã qua.
 *
 * Hoá đơn đã trả (PAID) thì hạn chỉ còn là dữ kiện lịch sử — tô đỏ nó là báo động giả. Hoá đơn
 * nháp (DRAFT) chưa có hạn nên không thể quá hạn.
 */
export function isInvoiceOverdue(inv: OverdueCheckable, now: number = Date.now()): boolean {
  if ((inv.status ?? '').toUpperCase() !== 'SENT') return false
  if (!inv.dueDate) return false
  const due = new Date(inv.dueDate).getTime()
  return !Number.isNaN(due) && due < now
}
