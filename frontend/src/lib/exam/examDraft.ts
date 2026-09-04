/**
 * examDraft — bản nháp bài thi lưu TRÊN THIẾT BỊ (S-09 / B-14).
 *
 * B-13 đã đo và chứng minh: engine thi không ghi gì lên server cho tới `/finish`, nên tải lại
 * trang hay rớt mạng là mất trắng, còn nút "Tiếp tục" thì cấp lại đồng hồ đầy. Endpoint lưu tạm
 * ở backend là việc riêng (đã tách sang backlog backend). Module này bịt lỗ hổng ở phần client
 * làm được ngay, và bịt đúng những kịch bản hỏng thật: tải lại, đóng nhầm tab, điều hướng đi,
 * rớt mạng giữa bài.
 *
 * PHẠM VI PHẢI NÓI ĐÚNG: đây là `localStorage` của MỘT trình duyệt. Đổi máy, đổi trình duyệt hay
 * xoá dữ liệu site là không còn. Vì vậy UI tuyệt đối không được nói "Đã lưu" trống không — phải
 * nói rõ "trên thiết bị này" (ràng buộc S-14: cấm nói dối trạng thái).
 *
 * `deadlineAt` là mốc thời gian tuyệt đối chứ không phải số giây còn lại. Lưu số giây thì mỗi lần
 * tải lại người thi lại được cấp thêm giờ — đúng lỗi B-13 đo được ở nút "Tiếp tục".
 */

const KEY_PREFIX = 'df.exam.draft.v1.'

/** Bản nháp quá hạn lâu thì dọn — không giữ rác vô thời hạn trong storage của người dùng. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export interface ExamDraft {
  attemptId: number
  answers: Record<string, string>
  /** Epoch ms lúc hết giờ. Nguồn DUY NHẤT của đồng hồ. */
  deadlineAt: number
  sectionIdx: number
  /** Epoch ms của lần ghi gần nhất — để hiển thị "đã lưu lúc mấy giờ" đúng sự thật. */
  savedAt: number
}

function key(attemptId: number): string {
  return `${KEY_PREFIX}${attemptId}`
}

/**
 * `localStorage` có thể NÉM ngay ở bước truy cập (Safari private mode, site data bị chặn), chứ
 * không chỉ ở bước ghi — nên mọi lối vào đều phải bọc try/catch, kể cả phép đọc `window.localStorage`.
 */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Đọc nháp của một attempt. Trả `null` khi không có, hỏng, hoặc lệch attempt. */
export function readDraft(attemptId: number): ExamDraft | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(key(attemptId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ExamDraft>
    // Dữ liệu trong storage là thứ NGOÀI tầm kiểm soát của code (người dùng sửa được, bản cũ có
    // thể khác hình dạng) — kiểm từng trường thay vì tin vào kiểu.
    if (
      typeof parsed?.attemptId !== 'number' ||
      parsed.attemptId !== attemptId ||
      typeof parsed.deadlineAt !== 'number' ||
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.answers !== 'object' ||
      parsed.answers === null
    ) {
      return null
    }
    const answers: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed.answers)) {
      if (typeof v === 'string') answers[k] = v
    }
    return {
      attemptId,
      answers,
      deadlineAt: parsed.deadlineAt,
      sectionIdx: typeof parsed.sectionIdx === 'number' ? parsed.sectionIdx : 0,
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

/** Ghi nháp. Trả `false` khi storage không dùng được — caller PHẢI nói thật điều đó với người thi. */
export function writeDraft(draft: ExamDraft): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(key(draft.attemptId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

/** Xoá nháp — gọi sau khi nộp thành công, để lần thi sau không nhặt lại bài cũ. */
export function clearDraft(attemptId: number): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(key(attemptId))
  } catch {
    /* storage không dùng được thì cũng không có gì để xoá */
  }
}

/**
 * Dọn nháp đã quá hạn lâu. Chạy khi vào màn thi: giữ storage của người dùng sạch mà không cần
 * một cơ chế hết hạn riêng.
 */
export function pruneStaleDrafts(now: number): number {
  const store = storage()
  if (!store) return 0
  let removed = 0
  try {
    // Gom key trước rồi mới xoá: xoá trong lúc duyệt theo chỉ số sẽ làm lệch chỉ số và bỏ sót.
    const keys: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      if (k?.startsWith(KEY_PREFIX)) keys.push(k)
    }
    for (const k of keys) {
      try {
        const parsed = JSON.parse(store.getItem(k) ?? 'null') as Partial<ExamDraft> | null
        const stamp = typeof parsed?.savedAt === 'number' ? parsed.savedAt : 0
        if (now - stamp > STALE_AFTER_MS) {
          store.removeItem(k)
          removed += 1
        }
      } catch {
        store.removeItem(k) // nháp hỏng cũng là rác
        removed += 1
      }
    }
  } catch {
    return removed
  }
  return removed
}

/**
 * Số giây còn lại tới `deadlineAt`, kẹp về 0. Làm tròn LÊN để đồng hồ không nhảy cóc mất một giây
 * ngay khi vào bài.
 */
export function remainingSeconds(deadlineAt: number, now: number): number {
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000))
}
