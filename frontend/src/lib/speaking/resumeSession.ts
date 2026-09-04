import type { AiMessage } from "@/lib/aiSpeakingApi";
import { PERSONA_TOKENS } from "@/lib/personas";
import type { ChatMessage } from "@/stores/useChatStore";
import type { AiCompanion } from "@/types/ai-speaking";

/**
 * Dựng lại lịch sử một phiên nói từ `GET /ai-speaking/sessions/{id}/messages` sang đúng hình dạng
 * mà engine đang chạy tạo ra trong `useChatStore` (S-06 AC-2, nửa UI của "Tiếp tục").
 *
 * **Vì sao không map một-một.** Backend gắn `errors` vào lượt **ASSISTANT** — `getMessages` chỉ
 * gộp `UserGrammarError` cho `MessageRole.ASSISTANT`, lượt USER luôn nhận `List.of()`. Nhưng những
 * lỗi đó mô tả câu NGƯỜI HỌC vừa nói, và phiên đang chạy đặt chúng lên lượt USER
 * (`updateLastUserMessage({ errors })`) đồng thời giữ một bản trong `feedback` của lượt AI. Map
 * thẳng thì sau khi bấm "Tiếp tục", bảng phản hồi trống trơn dù lượt đó có lỗi.
 *
 * **Phân biệt `undefined` với `[]` được giữ nguyên** — `lib/speaking/feedbackModel` dựa vào đúng
 * phân biệt này: một lượt USER đã có AI trả lời thì ĐÃ được phân tích, nên nhận `[]` kể cả khi
 * sạch lỗi; lượt USER cuối chưa có ai trả lời thì để `undefined`. Đổ đồng về `[]` sẽ khiến màn
 * hình báo "Ngữ pháp: Tốt" cho một câu chưa ai chấm.
 *
 * `status` để `null` vì `AiSpeakingMessageDto` **không có** trường đó (chỉ `assistantFeedback`).
 * Hệ quả có chủ ý: sau khi khôi phục, chiều "Phù hợp" không dựng cho các lượt cũ — thà thiếu một
 * chiều còn hơn suy ra một phán đoán mà API không trả về.
 */
export function aiMessagesToChatMessages(messages: AiMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];

  for (const m of messages) {
    const isUser = String(m.role ?? "").toUpperCase() === "USER";

    if (isUser) {
      out.push({ id: String(m.id), role: "user", contentDe: m.userText ?? "" });
      continue;
    }

    const errors = m.errors ?? [];
    out.push({
      id: String(m.id),
      role: "ai",
      contentDe: m.aiSpeechDe ?? "",
      feedback: {
        errors,
        explanationVi: m.explanationVi ?? "",
        suggestions: [],
        correction: m.correction ?? null,
        grammarPoint: m.grammarPoint ?? null,
        action: m.assistantAction ?? null,
        status: null,
        feedbackText: m.assistantFeedback ?? null,
      },
    });

    // Dồn ngược về lượt USER gần nhất: chính lượt AI này LÀ phép phân tích của nó.
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i].role !== "user") continue;
      if (out[i].errors === undefined) out[i] = { ...out[i], errors };
      break;
    }
  }

  return out;
}

/**
 * Dựng lại `AiCompanion` từ persona id mà API trả về.
 *
 * API lưu/trả persona dạng CHỮ HOA (`"LUKAS"`) còn `PERSONA_TOKENS` khoá bằng chữ thường — quên
 * hạ chữ là tra trượt, engine không thấy `selectedCompanion` và đá thẳng người dùng về màn chọn
 * nhân vật, đúng cái bẫy mà `speakingSessionBootstrap` được lập ra để chặn.
 *
 * Trả `null` cho persona lạ thay vì đắp một nhân vật mặc định: bảo người học họ đang nói với Lukas
 * trong khi phiên thuộc về người khác thì tệ hơn là không cho khôi phục. Nút "Tiếp tục" ẩn đi ở
 * nhánh đó, còn báo cáo của phiên vẫn xem được như thường.
 */
export function companionFromPersonaId(
  persona: string | null | undefined,
  cefrLevel: string | null | undefined,
): AiCompanion | null {
  if (!persona) return null;
  const token = PERSONA_TOKENS[persona.toLowerCase() as keyof typeof PERSONA_TOKENS];
  if (!token) return null;

  return {
    id: token.id,
    name: token.name,
    avatarUrl: `/companions/${token.id}.png`,
    voiceId: token.id.toUpperCase(),
    personality: token.desc,
    cefrLevel: cefrLevel ?? "B1",
  };
}
