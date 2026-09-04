import { redirect } from 'next/navigation'

/**
 * /v2/org/finance — ĐÃ GỠ (Đợt 0 OWNER, F01 báo cáo 31/08).
 *
 * Trang cũ lấy hóa đơn license (tiền trung tâm TRẢ CHO DeutschFlow) nhưng dán nhãn
 * "doanh thu / đang chờ thu / ghế đã bán" — sai chiều tiền với giám đốc trung tâm.
 * Dữ liệu đó giờ nằm đúng chỗ ở "Gói DeutschFlow & thanh toán" (/v2/org/billing) với
 * nhãn theo góc nhìn người mua. Route này giữ lại làm redirect để bookmark cũ không 404;
 * slot "Tài chính" trên nav để dành cho tài chính trung tâm thật (học phí/thu chi, Đợt 2).
 */
export default function V2OrgFinanceRedirect() {
  redirect('/v2/org/billing')
}
