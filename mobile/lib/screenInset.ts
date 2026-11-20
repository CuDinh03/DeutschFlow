// Khoảng an toàn (tai thỏ, Dynamic Island, vạch home) CỘNG với phần đệm riêng của màn.
//
// Trước đây `Screen` đặt `paddingTop: insets.top` rồi trải `contentStyle` của màn lên trên; màn nào ghi
// `contentStyle={{ paddingTop: space[2] }}` là đè mất inset ⇒ nút back nằm dưới thanh trạng thái, iOS
// nuốt chạm (Chứng nhận, Tôi và cài đặt, Hướng dẫn, Nâng cấp, An toàn và chặn, Báo lỗi, tab Luyện thi).
// Giờ: với mỗi cạnh được chọn, đệm cuối = inset + đệm của màn (paddingTop → paddingVertical → padding).

export type InsetEdge = 'top' | 'bottom' | 'left' | 'right'
export type Insets = Record<InsetEdge, number>
type StyleLike = Record<string, unknown> | null | undefined | false
type StyleInput = StyleLike | readonly StyleInput[]

/** Gộp style như `StyleSheet.flatten` (mảng lồng, bỏ giá trị rỗng; phần tử sau đè phần tử trước). */
export function flattenStyle(style: StyleInput): Record<string, unknown> {
  if (!style) return {}
  if (Array.isArray(style)) return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flattenStyle(s as StyleInput) }), {})
  return { ...(style as Record<string, unknown>) }
}

const KEYS: Record<InsetEdge, readonly string[]> = {
  top: ['paddingTop', 'paddingVertical', 'padding'],
  bottom: ['paddingBottom', 'paddingVertical', 'padding'],
  left: ['paddingLeft', 'paddingHorizontal', 'padding'],
  right: ['paddingRight', 'paddingHorizontal', 'padding'],
}

const PROP: Record<InsetEdge, string> = { top: 'paddingTop', bottom: 'paddingBottom', left: 'paddingLeft', right: 'paddingRight' }

/** Đệm riêng của màn ở một cạnh (số), theo thứ tự ưu tiên của Yoga; không có hoặc không phải số ⇒ 0. */
function ownPadding(flat: Record<string, unknown>, edge: InsetEdge): number {
  for (const k of KEYS[edge]) {
    const v = flat[k]
    if (typeof v === 'number') return v
    if (v != null) return 0 // phần trăm, chuỗi…: không cộng được, chỉ giữ inset
  }
  return 0
}

/**
 * Style đặt SAU `contentStyle`: chỉ ghi cạnh được chọn, giá trị = inset + đệm của màn.
 * Cạnh không chọn để nguyên (màn `edges={[]}` vẫn dùng `paddingHorizontal` của mình).
 */
export function insetPadding(edges: readonly InsetEdge[], insets: Insets, contentStyle?: StyleInput): Record<string, number> {
  const flat = flattenStyle(contentStyle)
  const out: Record<string, number> = {}
  for (const edge of edges) out[PROP[edge]] = insets[edge] + ownPadding(flat, edge)
  return out
}
