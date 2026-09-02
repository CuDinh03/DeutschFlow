import api, { apiMessage } from '@/lib/api'

/**
 * Ghi nhận HOÀN THÀNH một node lý thuyết lên máy chủ.
 *
 * QA 2026-09-01 (F-19): trang `/v2/student/learn/[nodeId]` đánh dấu hoàn thành hoàn toàn trong
 * state trình duyệt (`useNodeSessionStore.markTabCompleted`) rồi mở màn tổng kết — nhưng KHÔNG gọi
 * máy chủ lần nào. Backend đã có sẵn `POST /skill-tree/{nodeId}/complete` (docstring của
 * `markNodeComplete` ghi rõ nó sinh ra để học viên "không bị kẹt ở ngay bài đầu tiên"), mobile đã
 * dùng, riêng bản port web v2 đánh rơi lời gọi.
 *
 * Hậu quả đo trên prod: học viên mới đọc hết lý thuyết Ngày 1, bấm "Đã đọc & Hiểu (100%)", quay ra
 * lộ trình thì vẫn `0/46 đã xong`. Toàn bộ tiến độ cây khi đó chỉ đến từ bài luyện sinh bằng AI,
 * nên hôm model AI hỏng là cả lộ trình 46 ngày đóng băng, không còn đường nào tiến lên.
 */

export type TheoryCompletionOutcome =
  /** Máy chủ đã ghi nhận — cây lộ trình tiến lên. */
  | 'saved'
  /** Node vốn đã hoàn thành từ trước; với người dùng thì không có gì sai. */
  | 'alreadyDone'
  /** Hỏng thật: chưa đủ điều kiện tiên quyết, mất mạng, máy chủ lỗi… Phải cho học viên thấy. */
  | 'failed'

export interface TheoryCompletionResult {
  outcome: TheoryCompletionOutcome
  /** Câu giải thích để hiển thị khi `outcome === 'failed'`; lấy nguyên văn từ backend. */
  message: string | null
}

/**
 * Phân loại lỗi theo `detail` của backend.
 *
 * Chỉ "node đã hoàn thành từ trước" là im lặng — với người dùng thì không có gì sai.
 *
 * ⚠️ Trước đây còn một nhánh im lặng nữa cho 400 "Bài này có bài tập chấm điểm", vì tôi cho rằng
 * node đó "hoàn thành qua đường nộp bài". Kiểm lại (QA 2026-09-02, F-22) thì trên web KHÔNG có
 * đường đó — im lặng ở đấy là che giấu đúng blocker cần thấy, tức lặp lại bẫy F-18 vừa mới vá.
 * Nay hàm gọi phải tự chọn đúng đường: node có mục chấm được thì đi `submitNodeExercises`, chỉ node
 * lý thuyết thuần mới gọi đây. Nếu vẫn ăn 400 đó nghĩa là nhận diện sai — và ta MUỐN thấy nó.
 *
 * ⚠️ Khớp theo chuỗi nên mong manh: backend đổi câu chữ thì nhánh im lặng rơi xuống `failed`.
 * Chấp nhận có ý thức — hỏng ồn ào an toàn hơn nuốt lỗi. Khi backend có mã lỗi ổn định thì thay.
 */
export function classifyTheoryCompletionError(status: number, detail: string): TheoryCompletionResult {
  if (status === 400) {
    const d = detail.toLowerCase()
    if (d.includes('đã hoàn thành')) return { outcome: 'alreadyDone', message: null }
  }
  return { outcome: 'failed', message: detail || null }
}

/** Gọi máy chủ. Không bao giờ ném — người gọi đọc `outcome` để quyết định hiển thị gì. */
export async function completeTheoryNode(nodeId: number): Promise<TheoryCompletionResult> {
  try {
    await api.post(`/skill-tree/${nodeId}/complete`)
    return { outcome: 'saved', message: null }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status ?? 0
    return classifyTheoryCompletionError(status, apiMessage(err))
  }
}
