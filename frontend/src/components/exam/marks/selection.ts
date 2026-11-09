/**
 * Vùng chọn của trình duyệt → `(khối, ký tự)` (09/11/2026). Mỗi đoạn chữ do `MarkedText` vẽ là một
 * `span[data-seg]` mang khối (`data-b`) và vị trí đầu (`data-s`), nên một điểm trong nút chữ đổi ngay
 * được; điểm nằm ở phần tử (bôi đen kéo ra lề, chọn cả đoạn) thì lấy đoạn chữ gần nhất theo thứ tự tài liệu.
 */
import { snapToWords, type Piece } from './marksModel'

interface Pos {
  b: string
  off: number
}

function segPos(seg: HTMLElement, inside: number): Pos {
  return { b: seg.dataset.b ?? '', off: Number(seg.dataset.s ?? 0) + inside }
}

function boundary(root: HTMLElement, node: Node, offset: number, isEnd: boolean): Pos | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const seg = node.parentElement?.closest<HTMLElement>('[data-seg]')
    if (seg && root.contains(seg)) return segPos(seg, offset)
  }
  const point = document.createRange()
  point.setStart(node, offset)
  point.collapse(true)
  const segs = root.querySelectorAll<HTMLElement>('[data-seg]')
  if (!isEnd) {
    // đoạn đầu tiên kết thúc SAU điểm đầu
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]
      if (point.comparePoint(s, s.childNodes.length) > 0) return segPos(s, 0)
    }
  } else {
    // đoạn cuối cùng bắt đầu TRƯỚC điểm cuối
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i]
      if (point.comparePoint(s, 0) < 0) return segPos(s, s.textContent?.length ?? 0)
    }
  }
  return null
}

/**
 * Đổi một `Range` thành mảnh đánh dấu. Vùng chọn kéo sang khối khác (từ bài đọc sang thẻ câu hỏi)
 * bị cắt ở cuối khối đầu. Tự mở rộng cho trọn từ. `null` nếu không chạm chữ đánh dấu được.
 */
export function rangeToPiece(range: Range, root: HTMLElement, texts: Record<string, string>): Piece | null {
  const a = boundary(root, range.startContainer, range.startOffset, false)
  const b = boundary(root, range.endContainer, range.endOffset, true)
  if (!a || !b || texts[a.b] == null) return null
  const text = texts[a.b]
  const end = b.b === a.b ? b.off : text.length
  if (end <= a.off) return null
  const snapped = snapToWords(text, a.off, end)
  return snapped ? { b: a.b, s: snapped[0], e: snapped[1] } : null
}
