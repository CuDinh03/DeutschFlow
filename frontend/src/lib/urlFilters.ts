/**
 * Bộ lọc lưu trên URL (query string) — dùng cho các trang danh sách của admin.
 *
 * Vì sao: bộ lọc nằm trong state cục bộ thì reload, bấm Back hay gửi link cho đồng nghiệp đều mất
 * hết. Đưa lên URL thì "Người dùng · vai MANAGER · trang 2" là một đường link dán được vào chat.
 *
 * Quy tắc:
 * - Mỗi field khai báo kiểu + giá trị mặc định. Giá trị mặc định KHÔNG ghi lên URL (URL gọn,
 *   và hai URL cùng nghĩa thì giống hệt nhau).
 * - Giá trị lạ (enum ngoài danh sách, số ngoài khoảng, số không hợp lệ) → quay về mặc định /
 *   kẹp vào khoảng. Không bao giờ ném lỗi vì URL do người dùng gõ tay.
 * - Tham số KHÔNG khai báo trong spec được giữ nguyên khi ghi (trang khác có thể đang dùng).
 */

export type FilterField =
  | { kind: 'string'; default: string }
  | { kind: 'enum'; values: readonly string[]; default: string }
  | { kind: 'int'; min: number; max: number; default: number }

export type FilterSpec = Record<string, FilterField>

export type FilterValues<S extends FilterSpec> = {
  [K in keyof S]: S[K] extends { kind: 'int' } ? number : string
}

/** Chỉ để suy kiểu (giữ literal của spec); không biến đổi gì. */
export function defineFilters<S extends FilterSpec>(spec: S): S {
  return spec
}

interface ReadableParams {
  get(name: string): string | null
}

function parseField(field: FilterField, raw: string | null): string | number {
  if (field.kind === 'int') {
    if (raw == null || raw.trim() === '') return field.default
    const n = Number(raw)
    if (!Number.isFinite(n)) return field.default
    return Math.min(field.max, Math.max(field.min, Math.trunc(n)))
  }
  if (raw == null) return field.default
  if (field.kind === 'enum') return field.values.includes(raw) ? raw : field.default
  return raw
}

export function parseFilters<S extends FilterSpec>(spec: S, params: ReadableParams): FilterValues<S> {
  const out: Record<string, string | number> = {}
  for (const key of Object.keys(spec)) {
    out[key] = parseField(spec[key], params.get(key))
  }
  return out as FilterValues<S>
}

/**
 * Ghi `values` vào một bản sao của `base` (mặc định rỗng). Field bằng mặc định hoặc chuỗi rỗng
 * bị xoá khỏi URL; tham số ngoài spec trong `base` giữ nguyên.
 */
export function serializeFilters<S extends FilterSpec>(
  spec: S,
  values: Partial<FilterValues<S>>,
  base?: ReadableParams & { toString(): string },
): URLSearchParams {
  const out = new URLSearchParams(base ? base.toString() : '')
  for (const key of Object.keys(spec)) {
    const field = spec[key]
    const v = (values as Record<string, string | number | undefined>)[key]
    const normalized = parseField(field, v == null ? null : String(v))
    if (normalized === field.default || normalized === '') out.delete(key)
    else out.set(key, String(normalized))
  }
  return out
}

/**
 * Áp một `patch` lên giá trị hiện tại. Nếu spec có field `pageKey` (mặc định 'page') và patch đổi
 * bất kỳ field NÀO KHÁC, trang quay về mặc định — đổi bộ lọc mà vẫn đứng ở trang 7 là trang rỗng.
 */
export function applyFilterPatch<S extends FilterSpec>(
  spec: S,
  current: FilterValues<S>,
  patch: Partial<FilterValues<S>>,
  pageKey = 'page',
): FilterValues<S> {
  const next = { ...current, ...patch } as Record<string, string | number>
  const changesOther = Object.keys(patch).some((k) => k !== pageKey)
  if (pageKey in spec && changesOther && !(pageKey in patch)) {
    next[pageKey] = spec[pageKey].default
  }
  return next as FilterValues<S>
}
