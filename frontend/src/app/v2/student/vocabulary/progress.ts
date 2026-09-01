import api from '@/lib/api'

/**
 * Ghi tiến độ của các bài luyện từ vựng về server.
 *
 * <p>Trước 02/09/2026 ba bài luyện không gọi endpoint nào: vuốt phải "đã thuộc" chỉ nằm trong state React
 * và mất sạch khi tải lại trang. Hệ quả là bảng lịch ôn không bao giờ có dữ liệu, nên trục "Trạng thái học"
 * ở hub luôn hiện toàn bộ "Chưa học" và bậc "đến hạn ôn" của bộ bài không bao giờ kích hoạt.
 */

/** Số lần lưu thành công và thất bại trong một lượt luyện. */
export interface SaveTally {
  saved: number
  failed: number
}

export const EMPTY_TALLY: SaveTally = { saved: 0, failed: 0 }

/**
 * Đánh dấu một mục từ là đã thuộc.
 *
 * <p>Không ném ra ngoài — người học đang giữa lượt vuốt, một lần lưu hỏng không được chặn họ. Nhưng cũng
 * KHÔNG nuốt: trả về `false` để người gọi cộng dồn và báo ở màn hình kết thúc lượt.
 */
export async function markWordLearned(wordId: number): Promise<boolean> {
  try {
    await api.post(`/vocabulary/${wordId}/learn`)
    return true
  } catch {
    return false
  }
}

/** Cộng dồn một kết quả lưu vào bảng đếm. Thuần, để test được mà không cần mạng. */
export function tally(state: SaveTally, ok: boolean): SaveTally {
  return ok ? { ...state, saved: state.saved + 1 } : { ...state, failed: state.failed + 1 }
}

/** True khi có ít nhất một lần lưu hỏng — màn hình kết thúc lượt phải nói ra. */
export function hasUnsaved(state: SaveTally): boolean {
  return state.failed > 0
}
