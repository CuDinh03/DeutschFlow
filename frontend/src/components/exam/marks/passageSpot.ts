/**
 * Mở lại đúng chỗ đã lưu từ trong bài đọc (sổ từ, 13/11/2026): `at=<khối>:<đầu>:<cuối>` + `w=<chữ bôi>`.
 * Hàm thuần + dựng `Range` trên các `span[data-seg]` do `MarkedText` vẽ.
 */

export interface PassageSpot {
  b: string
  s: number
  e: number
  /** Chữ đã bôi lúc lưu — để kiểm đề chưa bị sửa chữ. */
  w: string | null
}

/** Khối có thể chứa `:` (`q:<id>`, `h:teil:0`) ⇒ hai số cuối là vị trí. */
export function parseSpot(at: string | null, w: string | null): PassageSpot | null {
  if (!at) return null
  const parts = at.split(':')
  if (parts.length < 3) return null
  const e = Number(parts.pop())
  const s = Number(parts.pop())
  const b = parts.join(':')
  if (!b || !Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e <= s) return null
  return { b, s, e, w: w && w.trim() ? w.trim() : null }
}

const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Vị trí thật trong chữ hiện tại của khối. Chữ ở vị trí cũ khớp ⇒ giữ; lệch (đề đã sửa) ⇒ tìm chữ đã bôi
 * lần đầu trong khối; không thấy ⇒ `null` (không tô nhầm chỗ).
 */
export function resolveSpot(spot: PassageSpot, text: string | undefined): { s: number; e: number } | null {
  if (!text) return null
  if (!spot.w) return spot.e <= text.length ? { s: spot.s, e: spot.e } : null
  if (spot.e <= text.length && norm(text.slice(spot.s, spot.e)) === norm(spot.w)) return { s: spot.s, e: spot.e }
  const i = text.toLowerCase().indexOf(spot.w.toLowerCase())
  return i >= 0 ? { s: i, e: i + spot.w.length } : null
}

/** Dựng `Range` cho [s, e) của khối trong `root`; kèm các đoạn `span` bị phủ (để nhấp nháy khi không có Highlight API). */
export function spotRange(root: HTMLElement, b: string, s: number, e: number): { range: Range; segs: HTMLElement[] } | null {
  const segs = Array.from(root.querySelectorAll<HTMLElement>('[data-seg][data-b]')).filter((el) => el.dataset.b === b)
  let range: Range | null = null
  let started = false
  const covered: HTMLElement[] = []
  for (const seg of segs) {
    const at = Number(seg.dataset.s)
    const node = seg.firstChild
    if (!node || node.nodeType !== Node.TEXT_NODE) continue
    const len = node.textContent?.length ?? 0
    if (at + len <= s || at >= e) continue
    covered.push(seg)
    if (!started) {
      range = document.createRange()
      range.setStart(node, Math.max(0, s - at))
      started = true
    }
    range!.setEnd(node, Math.min(len, e - at))
  }
  return range ? { range, segs: covered } : null
}
