/**
 * Điều hướng bằng TẢI LẠI TRANG (không qua router client). Dùng khi phải bỏ hẳn trạng thái JS đang chạy
 * của tab — ví dụ tab phiên hỗ trợ: mọi thư viện đã khởi động trước khi tab vào chế độ hỗ trợ (PostHog)
 * phải chết theo trang cũ. Tách thành module riêng để test mock được.
 */
export function hardReplace(url: string): void {
  window.location.replace(url)
}
