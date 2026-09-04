import { describe, it, expect } from "vitest";
import { buildFeedbackDimensions, type FeedbackInput } from "@/lib/speaking/feedbackModel";
import type { ErrorItem, Suggestion } from "@/lib/aiSpeakingApi";
import type { PhonemeEvalResult } from "@/lib/phonemeApi";

function err(errorCode: string, severity = "MAJOR"): ErrorItem {
  return {
    errorCode,
    severity,
    confidence: 0.9,
    wrongSpan: "ich habe gegangen",
    correctedSpan: "ich bin gegangen",
    ruleViShort: "Động từ chuyển động dùng sein.",
    exampleCorrectDe: "Ich bin nach Hause gegangen.",
  };
}

function suggestion(text: string): Suggestion {
  return {
    german_text: text,
    vietnamese_translation: "dịch",
    level: "B1",
    why_to_use: "vì sao",
    usage_context: "ngữ cảnh",
    lego_structure: "S+V+O",
  };
}

function phoneme(score: number, weak = 0): PhonemeEvalResult {
  return {
    transcribed: "hallo",
    target: "hallo",
    score,
    emoji: "🙂",
    feedbackVi: "Khá rõ ràng.",
    words: Array.from({ length: weak }, (_, i) => ({
      word: `wort${i}`,
      correct: false,
      similarity: 0.4,
    })),
  } as PhonemeEvalResult;
}

const EMPTY: FeedbackInput = {
  analysedErrors: undefined,
  suggestions: [],
  suggestionsVisible: false,
  phonemeResult: null,
  turnStatus: null,
  turnNote: null,
};

const ids = (input: FeedbackInput) => buildFeedbackDimensions(input).map((d) => d.id);
const byId = (input: FeedbackInput, id: string) =>
  buildFeedbackDimensions(input).find((d) => d.id === id);

describe("buildFeedbackDimensions — chỉ dựng chiều CÓ dữ liệu thật (S-14)", () => {
  it("chưa có lượt nào được phân tích thì không dựng chiều nào", () => {
    expect(buildFeedbackDimensions(EMPTY)).toEqual([]);
  });

  it("phân biệt 'chưa phân tích' (undefined) với 'đã phân tích, sạch lỗi' ([])", () => {
    expect(ids({ ...EMPTY, analysedErrors: undefined })).not.toContain("grammar");
    expect(ids({ ...EMPTY, analysedErrors: [] })).toContain("grammar");
  });

  it("không dựng chiều phát âm khi chưa chấm phoneme", () => {
    expect(ids({ ...EMPTY, analysedErrors: [] })).not.toContain("pronunciation");
  });

  it("không dựng chiều phù hợp khi backend không trả status", () => {
    expect(ids({ ...EMPTY, analysedErrors: [], turnStatus: null })).not.toContain("relevance");
  });
});

describe("chiều Ngữ pháp", () => {
  it("sạch lỗi → mức tốt", () => {
    expect(byId({ ...EMPTY, analysedErrors: [] }, "grammar")?.level).toBe("good");
  });

  it("chỉ lỗi MINOR → mức khá", () => {
    const input = { ...EMPTY, analysedErrors: [err("CASE.PREP_DAT_MIT", "MINOR")] };
    expect(byId(input, "grammar")?.level).toBe("ok");
  });

  it("có lỗi MAJOR hoặc BLOCKING → mức cần sửa", () => {
    expect(
      byId({ ...EMPTY, analysedErrors: [err("VERB.PERFEKT_AUX", "MAJOR")] }, "grammar")?.level,
    ).toBe("attention");
    expect(
      byId({ ...EMPTY, analysedErrors: [err("VERB.PERFEKT_AUX", "BLOCKING")] }, "grammar")?.level,
    ).toBe("attention");
  });

  it("bằng chứng chỉ gồm lỗi thuộc nhóm ngữ pháp, không nuốt lỗi từ vựng", () => {
    const input = {
      ...EMPTY,
      analysedErrors: [err("WORD_ORDER.V2_MAIN_CLAUSE"), err("LEXICAL.WRONG_WORD")],
    };
    const grammar = byId(input, "grammar");
    expect(grammar?.errors).toHaveLength(1);
    expect(grammar?.errors?.[0].errorCode).toBe("WORD_ORDER.V2_MAIN_CLAUSE");
  });

  it("mã lỗi lạ ngoài danh mục vẫn được xếp vào ngữ pháp thay vì rơi mất", () => {
    const input = { ...EMPTY, analysedErrors: [err("SOMETHING.NEW_FROM_BACKEND")] };
    expect(byId(input, "grammar")?.errors).toHaveLength(1);
  });
});

describe("chiều Từ vựng — kênh gợi ý, KHÔNG phải kênh chấm điểm", () => {
  it("đã phân tích nhưng không có lỗi từ vựng lẫn gợi ý → không dựng chiều (không phán 'Tốt' khống)", () => {
    expect(ids({ ...EMPTY, analysedErrors: [] })).not.toContain("vocabulary");
  });

  it("có gợi ý đang hiện → dựng chiều ở mức khá, đính gợi ý làm bằng chứng", () => {
    const input = {
      ...EMPTY,
      analysedErrors: [],
      suggestions: [suggestion("Mir geht es gut."), suggestion("Heute war anstrengend.")],
      suggestionsVisible: true,
    };
    const vocab = byId(input, "vocabulary");
    expect(vocab?.level).toBe("ok");
    expect(vocab?.suggestions).toHaveLength(2);
  });

  it("gợi ý chưa tới lúc hiện thì không dựng chiều", () => {
    const input = { ...EMPTY, analysedErrors: [], suggestions: [suggestion("x")], suggestionsVisible: false };
    expect(ids(input)).not.toContain("vocabulary");
  });

  it("có lỗi LEXICAL → mức cần sửa, đứng trên cả gợi ý", () => {
    const input = {
      ...EMPTY,
      analysedErrors: [err("LEXICAL.WRONG_WORD")],
      suggestions: [suggestion("x")],
      suggestionsVisible: true,
    };
    expect(byId(input, "vocabulary")?.level).toBe("attention");
  });
});

describe("chiều Phát âm", () => {
  it.each([
    [82, "good"],
    [70, "good"],
    [58, "ok"],
    [50, "ok"],
    [31, "attention"],
  ])("điểm %i → mức %s", (score, level) => {
    expect(byId({ ...EMPTY, phonemeResult: phoneme(score) }, "pronunciation")?.level).toBe(level);
  });

  it("đính nguyên kết quả phoneme làm bằng chứng", () => {
    const result = phoneme(64, 2);
    expect(byId({ ...EMPTY, phonemeResult: result }, "pronunciation")?.phoneme).toBe(result);
  });
});

describe("chiều Phù hợp — lấy từ status của lượt, không bịa", () => {
  it.each([
    ["EXCELLENT", "good"],
    ["ON_TOPIC_NEEDS_IMPROVEMENT", "ok"],
    ["OFF_TOPIC", "attention"],
  ] as const)("status %s → mức %s", (turnStatus, level) => {
    expect(byId({ ...EMPTY, turnStatus }, "relevance")?.level).toBe(level);
  });

  it("mang theo lời nhận xét tiếng Việt của backend làm bằng chứng", () => {
    const input = { ...EMPTY, turnStatus: "EXCELLENT" as const, turnNote: "Câu trả lời rõ ý." };
    expect(byId(input, "relevance")?.note).toBe("Câu trả lời rõ ý.");
  });
});

describe("thứ tự trình bày", () => {
  it("xếp chiều cần sửa lên trước, giữ thứ tự khai báo khi cùng mức", () => {
    const input: FeedbackInput = {
      analysedErrors: [err("CASE.PREP_DAT_MIT", "MINOR")],
      suggestions: [suggestion("x")],
      suggestionsVisible: true,
      phonemeResult: phoneme(30),
      turnStatus: "EXCELLENT",
      turnNote: null,
    };
    expect(ids(input)[0]).toBe("pronunciation");
    expect(ids(input)).toHaveLength(4);
  });
});
