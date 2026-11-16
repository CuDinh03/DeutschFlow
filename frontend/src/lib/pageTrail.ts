/**
 * Trang trước trong cùng tab, ghi theo từng lần đổi đường dẫn ở khu /v2.
 *
 * Vì sao không dùng `document.referrer`: chuyển trang phía client (Next.js) không đổi referrer, nó giữ
 * nguyên trang của lần nạp đầu. Nghiệm thu góp ý 17/11/2026: góp ý của học viên ghi "trang đang mở" là
 * trang admin mà phiên trước trong cùng tab đã nạp.
 *
 * Lưu trong sessionStorage (riêng từng tab, mất khi đóng tab). Chỉ giữ hai đường dẫn, không giữ query.
 */
const KEY = 'df-page-trail'

interface Trail {
  current: string | null
  previous: string | null
}

function read(): Trail {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return { current: null, previous: null }
    const parsed = JSON.parse(raw) as Partial<Trail>
    return {
      current: typeof parsed.current === 'string' ? parsed.current : null,
      previous: typeof parsed.previous === 'string' ? parsed.previous : null,
    }
  } catch {
    return { current: null, previous: null }
  }
}

function write(trail: Trail): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail))
  } catch {
    // sessionStorage bị chặn (chế độ riêng tư, iframe): không nhớ được trang trước, form rơi về referrer.
  }
}

/** Ghi một lần xem trang. Cùng đường dẫn với lần ghi trước (tải lại) thì không đổi gì. */
export function notePageView(pathname: string): void {
  const trail = read()
  if (trail.current === pathname) return
  write({ current: pathname, previous: trail.current })
}

/** Trang ngay trước `currentPath` trong tab này, `null` khi chưa biết. */
export function previousPage(currentPath: string): string | null {
  const trail = read()
  if (trail.current && trail.current !== currentPath) return trail.current
  return trail.previous
}
