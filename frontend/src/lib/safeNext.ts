/**
 * Kiểm tra đường dẫn chuyển hướng nội bộ (`?next=`, `?return=`…) — MỘT luật dùng chung cho
 * middleware (Edge runtime) lẫn mã phía trình duyệt. Module thuần: không đụng `window`/`document`.
 *
 * Chỉ nhận đường dẫn tương đối theo gốc của chính ứng dụng: bắt đầu bằng đúng một dấu "/", không
 * chứa gạch chéo ngược hay ký tự điều khiển (kể cả ở dạng mã hoá phần trăm), và sau khi chuẩn hoá
 * vẫn nằm trong cùng origin. Trả về `pathname + search + hash` đã chuẩn hoá, hoặc `null`.
 */

// Gốc giả chỉ để phân giải; `.invalid` là TLD dành riêng nên không trùng tên miền thật nào.
const BASE_ORIGIN = 'http://df-internal.invalid'

/** Số vòng giải mã tối đa khi soát giá trị bị mã hoá phần trăm nhiều lớp. */
const MAX_DECODE_ROUNDS = 3

function hasForbiddenChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f || code === 0x5c) return true
  }
  return false
}

function isPlainInternalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !hasForbiddenChar(value)
}

export function safeNext(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value === '') return null
  if (!isPlainInternalPath(value)) return null

  // Soát thêm các lớp đã giải mã. Chuỗi mã hoá hỏng (ví dụ "%" lẻ) thì dừng giải mã — phần thô
  // đã được soát ở trên và bước phân giải bên dưới vẫn áp dụng.
  let decoded = value
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    let nextDecoded: string
    try {
      nextDecoded = decodeURIComponent(decoded)
    } catch {
      break
    }
    if (nextDecoded === decoded) break
    if (!isPlainInternalPath(nextDecoded)) return null
    decoded = nextDecoded
  }

  let url: URL
  try {
    url = new URL(value, BASE_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== BASE_ORIGIN) return null

  const normalized = `${url.pathname}${url.search}${url.hash}`
  return isPlainInternalPath(normalized) ? normalized : null
}
