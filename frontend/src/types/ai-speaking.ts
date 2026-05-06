// Lỗi ngữ pháp, phát âm trả về từ AI
export interface AiSpeakingError {
  errorCode: string;      // VD: "GRAMMAR_CASE", "VOCAB_CHOICE"
  wrongSpan: string;      // Cụm từ sai (VD: "mit der Mann")
  ruleViShort: string;    // Giải thích ngắn bằng tiếng Việt (VD: "Dativ sau 'mit'")
}

// Schema JSON chính xác nhận từ backend sau khi parse
export interface AiSpeakingChatResponse {
  aiSpeechDe: string;           // Câu nói phản hồi bằng tiếng Đức của AI
  errors: AiSpeakingError[];    // Danh sách các lỗi trong câu của người dùng (nếu có)
  explanationVi: string;        // Giải thích chung bằng tiếng Việt
}

// Thông tin về Companion (Nhân vật AI)
export interface AiCompanion {
  id: string;             // VD: "lukas", "emma"
  name: string;           // VD: "Lukas", "Emma"
  avatarUrl: string;      // URL hình ảnh nhân vật
  voiceId: string;        // ID giọng đọc cho TTS (browser fallback)
  voiceFile?: string | null; // Local voice file name (e.g. "lukas.wav") under /public/voices/
  personality: string;    // Tính cách (VD: "Nghiêm túc, hay sửa lỗi", "Thân thiện, động viên")
  cefrLevel: string;      // VD: "A1-A2", "B1-B2"
}

// Trạng thái streaming để hiển thị trên UI
export type StreamStatus = "idle" | "listening" | "processing" | "streaming" | "fallback" | "error";
