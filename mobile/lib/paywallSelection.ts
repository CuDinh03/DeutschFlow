// Gói đang chọn trên màn Nâng cấp (giao diện v3.4, Đợt 6C): mẫu `upgrade` đổi từ "mỗi gói một nút
// Đăng ký" sang hàng chọn một gói + một nút Đăng ký. Hàm thuần — test ở __tests__/paywallSelection.test.ts.

/**
 * Gói người dùng đã chạm nếu còn trong danh sách StoreKit trả về; chưa chạm (hoặc gói đó biến mất)
 * thì gói nổi bật (gói chính) rồi tới gói đầu tiên. Danh sách rỗng ⇒ null (không có gì để mua).
 */
export function selectedPlanId(
  productIds: readonly string[],
  chosen: string | null,
  isFeatured: (id: string) => boolean,
): string | null {
  if (productIds.length === 0) return null
  if (chosen && productIds.includes(chosen)) return chosen
  return productIds.find(isFeatured) ?? productIds[0]
}
