// Gốc kho media (Cloudflare R2 — presigned URL `https://<account_id>.r2.cloudflarestorage.com/<bucket>/…`,
// không qua CDN). Một nguồn duy nhất cho CSP (`src/middleware.ts`) và `images.remotePatterns`
// (`next.config.mjs`) — trước đây hai nơi chép tay danh sách host S3 và phải có test chặn trôi lệch.
//
// Đọc `NEXT_PUBLIC_MEDIA_ORIGINS` (phân tách bằng dấu phẩy) — giá trị NHÚNG LÚC DỰNG, đổi là phải dựng lại.
// Chỉ nhận https; mục hỏng bị bỏ qua thay vì sinh nguồn rỗng trong CSP.

/** @param {string | undefined} raw @returns {URL[]} */
function parse(raw) {
  return (raw || '')
    .split(',')
    .map((part) => {
      try {
        return new URL(part.trim())
      } catch {
        return null
      }
    })
    .filter((url) => url !== null && url.protocol === 'https:')
}

/** Origin dạng `https://host` cho các directive CSP. @returns {string[]} */
export function mediaOrigins(raw = process.env.NEXT_PUBLIC_MEDIA_ORIGINS) {
  return Array.from(new Set(parse(raw).map((url) => url.origin)))
}

/** Mục cho `images.remotePatterns` của Next. */
export function mediaRemotePatterns(raw = process.env.NEXT_PUBLIC_MEDIA_ORIGINS) {
  return mediaOrigins(raw).map((origin) => ({
    protocol: 'https',
    hostname: new URL(origin).hostname,
    pathname: '/**',
  }))
}
