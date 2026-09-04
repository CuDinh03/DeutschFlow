import { describe, it, expect } from "vitest";
import { aiMessagesToChatMessages } from "@/lib/speaking/resumeSession";
import type { AiMessage } from "@/lib/aiSpeakingApi";

function user(id: number, text: string): AiMessage {
  return {
    id,
    role: "USER",
    userText: text,
    aiSpeechDe: null,
    correction: null,
    explanationVi: null,
    grammarPoint: null,
    newWord: null,
    userInterestDetected: null,
    createdAt: "2026-08-28T10:00:00",
    errors: [], // backend LUÔN trả rỗng cho lượt USER — lỗi nằm ở lượt ASSISTANT
  };
}

function assistant(id: number, text: string, errorCodes: string[] = []): AiMessage {
  return {
    id,
    role: "ASSISTANT",
    userText: null,
    aiSpeechDe: text,
    correction: errorCodes.length ? "Ich bin gegangen." : null,
    explanationVi: "giải thích",
    grammarPoint: "Perfekt",
    newWord: null,
    userInterestDetected: null,
    assistantAction: "Frag weiter",
    assistantFeedback: "Tốt lắm",
    createdAt: "2026-08-28T10:00:05",
    errors: errorCodes.map((errorCode) => ({
      errorCode,
      severity: "MAJOR",
      confidence: 0.9,
      wrongSpan: "habe gegangen",
      correctedSpan: "bin gegangen",
      ruleViShort: "dùng sein",
      exampleCorrectDe: "Ich bin gegangen.",
    })),
  };
}

describe("aiMessagesToChatMessages — khôi phục phiên dở", () => {
  it("không có lượt nào thì trả mảng rỗng", () => {
    expect(aiMessagesToChatMessages([])).toEqual([]);
  });

  it("giữ đúng thứ tự và vai của từng lượt", () => {
    const out = aiMessagesToChatMessages([
      assistant(1, "Hallo!"),
      user(2, "Guten Tag."),
      assistant(3, "Schön!"),
    ]);
    expect(out.map((m) => m.role)).toEqual(["ai", "user", "ai"]);
    expect(out.map((m) => m.contentDe)).toEqual(["Hallo!", "Guten Tag.", "Schön!"]);
  });

  it("dồn lỗi của lượt ASSISTANT ngược về lượt USER ngay trước nó", () => {
    const out = aiMessagesToChatMessages([
      user(1, "Ich habe gegangen."),
      assistant(2, "Fast!", ["VERB.PERFEKT_AUX"]),
    ]);
    expect(out[0].errors).toHaveLength(1);
    expect(out[0].errors?.[0].errorCode).toBe("VERB.PERFEKT_AUX");
    // Lượt AI vẫn giữ bản sao trong feedback — đúng hình dạng mà phiên đang chạy tạo ra.
    expect(out[1].feedback?.errors).toHaveLength(1);
  });

  it("lượt USER đã được trả lời mà sạch lỗi thì nhận [] — KHÔNG phải undefined", () => {
    const out = aiMessagesToChatMessages([user(1, "Guten Tag."), assistant(2, "Schön!")]);
    expect(out[0].errors).toEqual([]);
  });

  it("lượt USER cuối chưa có AI trả lời thì để undefined — chưa ai phân tích", () => {
    const out = aiMessagesToChatMessages([
      user(1, "Guten Tag."),
      assistant(2, "Schön!"),
      user(3, "Und du?"),
    ]);
    expect(out[2].errors).toBeUndefined();
  });

  it("chỉ dồn về lượt USER GẦN NHẤT, không chạm lượt user cũ hơn", () => {
    const out = aiMessagesToChatMessages([
      user(1, "Erste."),
      assistant(2, "Ok."),
      user(3, "Zweite."),
      assistant(4, "Fast!", ["CASE.PREP_DAT_MIT"]),
    ]);
    expect(out[0].errors).toEqual([]);
    expect(out[2].errors).toHaveLength(1);
  });

  it("status để null vì API lịch sử KHÔNG trả trường đó — không bịa chiều Phù hợp", () => {
    const out = aiMessagesToChatMessages([user(1, "x"), assistant(2, "y")]);
    expect(out[1].feedback?.status).toBeNull();
    expect(out[1].feedback?.feedbackText).toBe("Tốt lắm");
  });

  it("chịu được lượt thiếu chữ và thiếu mảng errors", () => {
    const broken = [
      { id: 1, role: "USER", userText: null, createdAt: "x" },
      { id: 2, role: "ASSISTANT", aiSpeechDe: null, createdAt: "x" },
    ] as unknown as AiMessage[];
    const out = aiMessagesToChatMessages(broken);
    expect(out.map((m) => m.contentDe)).toEqual(["", ""]);
    expect(out[0].errors).toEqual([]);
  });
});

describe("companionFromPersonaId", () => {
  it("hạ chữ persona của API (LUKAS) để tra đúng bảng token chữ thường", async () => {
    const { companionFromPersonaId } = await import("@/lib/speaking/resumeSession");
    const c = companionFromPersonaId("LUKAS", "B1");
    expect(c?.id).toBe("lukas");
    expect(c?.name).toBe("Lukas");
    expect(c?.avatarUrl).toBe("/companions/lukas.png");
    expect(c?.cefrLevel).toBe("B1");
  });

  it("persona lạ hoặc rỗng trả null — thà không cho khôi phục còn hơn gán nhầm nhân vật", async () => {
    const { companionFromPersonaId } = await import("@/lib/speaking/resumeSession");
    expect(companionFromPersonaId("GHOST", "B1")).toBeNull();
    expect(companionFromPersonaId(null, "B1")).toBeNull();
    expect(companionFromPersonaId("", "B1")).toBeNull();
  });

  it("thiếu cefrLevel thì rơi về B1 chứ không để undefined lọt vào engine", async () => {
    const { companionFromPersonaId } = await import("@/lib/speaking/resumeSession");
    expect(companionFromPersonaId("emma", null)?.cefrLevel).toBe("B1");
  });
});
