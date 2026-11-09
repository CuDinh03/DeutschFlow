/** Đọc `code` từ fragment `#code=…` (fragment không bao giờ tới máy chủ, log hay Referer). */
export function readHandoffCode(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const code = new URLSearchParams(raw).get('code')
  return code && code.trim() ? code.trim() : null
}
