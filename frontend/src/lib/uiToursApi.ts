import api from '@/lib/api'

/**
 * Hướng dẫn lần đầu đã xem (đợt (e) làm mới Luyện thi, 07/11/2026) — `GET/PUT /api/auth/me/tours`.
 * Lưu theo tài khoản; máy cũng giữ một bản để mất mạng hoặc lỗi máy chủ không làm hướng dẫn tự mở lại.
 * Đọc một lần mỗi lần tải trang, các màn dùng chung kết quả.
 */
const LOCAL_KEY = 'df.tours.seen'
let cache: Promise<Set<string>> | null = null

function readLocal(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeLocal(keys: Set<string>) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.from(keys)))
  } catch {
    /* bỏ qua */
  }
}

export function loadSeenTours(): Promise<Set<string>> {
  if (!cache) {
    const local = readLocal()
    cache = Promise.resolve()
      .then(() => api.get<{ seen?: string[] }>('/auth/me/tours'))
      .then((r) => new Set([...(r?.data?.seen ?? []), ...local]))
      .catch(() => new Set(local))
  }
  return cache
}

/** Đánh dấu đã xem: ghi máy ngay, gửi máy chủ ngầm (lỗi thì lần sau vẫn đọc bản trên máy). */
export async function markTourSeen(key: string): Promise<void> {
  const seen = await loadSeenTours()
  seen.add(key)
  writeLocal(seen)
  try {
    await api.put(`/auth/me/tours/${encodeURIComponent(key)}`)
  } catch {
    /* bản trên máy đủ để không tự mở lại */
  }
}

/** Chỉ dùng trong test. */
export function resetTourCache() {
  cache = null
}
