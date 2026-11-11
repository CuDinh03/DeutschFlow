/**
 * Quyết định của bộ đếm gợi ý trả lời trong phiên luyện nói.
 *
 * Luật (11/11/2026, theo phản hồi của owner khi thử trên production):
 * - Gợi ý thuộc về MỘT lượt của AI. Sang lượt mới (hoặc AI đang trả lời) thì ẩn.
 * - Mở micro KHÔNG ẩn gợi ý đang hiện: người học bấm ghi âm chính là để nói theo câu gợi ý, ẩn đi
 *   là lấy mất thứ họ đang đọc. Micro chỉ tạm dừng đồng hồ, để gợi ý không TỰ bật lên giữa lúc họ
 *   đang tự nói (lý do gốc của điều kiện `!isListening`).
 * - Đóng micro cũng không ẩn: bản ghi còn nằm trong ô nhập, người học có thể muốn nói lại.
 */
export interface SuggestionStepInput {
  /** AI đã nói xong lượt gần nhất và không có luồng trả lời nào đang chạy. */
  awaitingLearner: boolean;
  /** Khoá nhận diện lượt hiện tại; đổi khi có tin nhắn mới hoặc trạng thái luồng đổi. */
  turnKey: string;
  /** Khoá của lần chạy trước. */
  previousTurnKey: string;
  isListening: boolean;
}

export interface SuggestionStep {
  /** Ẩn gợi ý đang hiện. */
  hide: boolean;
  /** Bắt đầu (lại) đồng hồ tự bật gợi ý. */
  startTimer: boolean;
}

export function suggestionStep(input: SuggestionStepInput): SuggestionStep {
  if (!input.awaitingLearner) return { hide: true, startTimer: false };
  const newTurn = input.turnKey !== input.previousTurnKey;
  return { hide: newTurn, startTimer: !input.isListening };
}
