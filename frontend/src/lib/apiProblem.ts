import { apiMessage, isAxiosErr } from '@/lib/api'

/**
 * Lỗi API "có chỉ dẫn" (backend `GuidedException`, owner yêu cầu 13/11/2026): ngoài câu chữ `detail`, thân lỗi
 * mang `extensions` gồm mã lỗi, đối tượng liên quan và từng mục chưa đạt (chuyện gì – ở đâu – làm gì – đường dẫn).
 * Lỗi kiểu cũ (chỉ có `detail`) vẫn đọc được: `issues` rỗng, `message` là câu chữ như `apiMessage`.
 */
export type ApiProblemIssue = {
  code: string | null
  /** Ở đâu, đúng tên giao diện đang dùng — vd. "Hören T2 · bản nháp #103". */
  label: string | null
  /** Chuyện gì. */
  what: string
  /** Phải làm gì. */
  action: string | null
  /** Đường dẫn trong web tới chỗ sửa. */
  url: string | null
  where: Record<string, unknown>
}

export type ApiProblem = {
  /** Câu chữ đầy đủ, đứng riêng vẫn hiểu (dùng cho toast và trình đọc màn hình). */
  message: string
  code: string | null
  title: string | null
  where: Record<string, unknown>
  issues: ApiProblemIssue[]
  /** Việc làm sau khi đã sửa xong các mục. */
  next: string | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/** Chỉ nhận đường dẫn nội bộ ("/v2/…"): thân lỗi không được đưa admin ra trang ngoài. */
const internalUrl = (v: unknown): string | null => {
  const s = str(v)
  return s && s.startsWith('/') && !s.startsWith('//') ? s : null
}

export function apiProblem(e: unknown): ApiProblem {
  const message = apiMessage(e)
  const ext = isAxiosErr(e) ? obj(obj(e.response?.data).extensions) : {}
  const rawIssues = Array.isArray(ext.issues) ? ext.issues : []
  const issues: ApiProblemIssue[] = []
  for (const raw of rawIssues) {
    const i = obj(raw)
    const what = str(i.what)
    if (!what) continue
    issues.push({
      code: str(i.code), label: str(i.label), what, action: str(i.action), url: internalUrl(i.url), where: obj(i.where),
    })
  }
  return { message, code: str(ext.code), title: str(ext.title), where: obj(ext.where), issues, next: str(ext.next) }
}

/** Lỗi có đủ phần cấu trúc để dựng khung "chuyện gì – ở đâu – làm gì" (không thì hiện toast như cũ). */
export function isGuided(p: ApiProblem): boolean {
  return p.title != null && p.issues.length > 0
}
