import type { ErrorItem, Suggestion } from "@/lib/aiSpeakingApi";
import type { PhonemeEvalResult } from "@/lib/phonemeApi";

/**
 * Mô hình phản hồi 4 chiều của phiên luyện nói (S-07 / B-16 lô 4).
 *
 * **Chỉ dựng chiều nào CÓ dữ liệu thật.** Plan vẽ bốn chiều
 * `Aussprache · Grammatik · Wortschatz · Natürlichkeit`, nhưng backend không cấp bốn kênh ngang
 * nhau, nên bốn ô luôn-hiện sẽ có ô rỗng phải bịa nội dung. Cùng lý do đã bỏ waveform giả (D-3) và
 * đã đổi "Câu 3/8" thành tiến độ theo pha (D-4): thà thiếu một ô còn hơn in một con số không có
 * nguồn. Ánh xạ thực tế:
 *
 * | Chiều | Nguồn thật | Khi nào có |
 * |---|---|---|
 * | Phát âm | `PhonemeEvalResult` (dịch vụ phoneme, tất định) | chỉ khi lượt đó được chấm phát âm |
 * | Ngữ pháp | `errors[]` do AI trả kèm lượt nói | mọi lượt ĐÃ được phân tích |
 * | Từ vựng | lỗi `LEXICAL.*` + `suggestions[]` | khi có lỗi dùng từ hoặc có gợi ý đang hiện |
 * | Phù hợp | `status` + `feedback` của lượt | khi backend trả `status` |
 *
 * **Vì sao là "Phù hợp" chứ không phải "Natürlichkeit".** Trường duy nhất gần với "tự nhiên" là
 * `status` — prompt định nghĩa `ON_TOPIC_NEEDS_IMPROVEMENT` là *"đúng chủ đề nhưng yếu về ngôn ngữ
 * hoặc quá ngắn"*. Đó là phán đoán **đúng chủ đề + đủ mạnh**, không phải phép đo độ tự nhiên. Gắn
 * nhãn "Tự nhiên" lên nó là nói quá dữ liệu, nên chiều này mang đúng tên nó có.
 *
 * **Vì sao Từ vựng không bao giờ báo "Tốt".** Danh mục lỗi chỉ có một mã `LEXICAL.*`, tức AI hầu
 * như không chấm từ vựng. Suy ra "không có lỗi ⇒ từ vựng tốt" là kết luận từ sự im lặng. Chiều này
 * vì thế là kênh **đề nghị** (có cách nói giàu hơn) chứ không phải kênh chấm.
 */

export type FeedbackLevel = "good" | "ok" | "attention";

export type FeedbackDimensionId = "pronunciation" | "grammar" | "vocabulary" | "relevance";

export type TurnStatus = "OFF_TOPIC" | "ON_TOPIC_NEEDS_IMPROVEMENT" | "EXCELLENT";

export interface FeedbackDimension {
  id: FeedbackDimensionId;
  level: FeedbackLevel;
  /** Khoá i18n dưới `speaking.chat` cho dòng tóm tắt. */
  summaryKey: string;
  summaryValues?: Record<string, string | number>;
  /** Bằng chứng — chỉ mở khi người dùng yêu cầu. */
  errors?: ErrorItem[];
  suggestions?: Suggestion[];
  phoneme?: PhonemeEvalResult;
  note?: string | null;
}

export interface FeedbackInput {
  /**
   * Lỗi trên lượt nói gần nhất của người học.
   * `undefined` = **chưa phân tích** (lượt vừa gửi, AI chưa trả lời).
   * `[]` = **đã phân tích, sạch lỗi**. Hai thứ này khác nhau và không được gộp: store gán
   * `errors` cho lượt USER đúng một lần, ở nhánh `onDone` của luồng chat.
   */
  analysedErrors: ErrorItem[] | undefined;
  suggestions: Suggestion[];
  /** Bộ đếm gợi ý đã tới lúc hiện chưa — gợi ý chưa hiện thì chưa phải phản hồi. */
  suggestionsVisible: boolean;
  phonemeResult: PhonemeEvalResult | null;
  turnStatus: TurnStatus | null;
  turnNote: string | null;
}

/** Mã lỗi từ vựng; mọi mã khác (kể cả mã lạ backend mới thêm) được coi là ngữ pháp. */
const LEXICAL_PREFIX = "LEXICAL.";

const PHONEME_GOOD = 70;
const PHONEME_OK = 50;

/** Thứ tự trình bày khi cùng mức — theo hệ phân cấp của plan. */
const DECLARATION_ORDER: FeedbackDimensionId[] = [
  "pronunciation",
  "grammar",
  "vocabulary",
  "relevance",
];

const LEVEL_WEIGHT: Record<FeedbackLevel, number> = { attention: 0, ok: 1, good: 2 };

function isLexical(e: ErrorItem): boolean {
  return e.errorCode?.toUpperCase().startsWith(LEXICAL_PREFIX) ?? false;
}

function severityLevel(errors: ErrorItem[]): FeedbackLevel {
  if (errors.length === 0) return "good";
  const severe = errors.some((e) => {
    const s = e.severity?.toUpperCase();
    return s === "BLOCKING" || s === "MAJOR";
  });
  return severe ? "attention" : "ok";
}

function pronunciationDimension(result: PhonemeEvalResult): FeedbackDimension {
  const weak = result.words?.filter((w) => !w.correct) ?? [];
  const score = Math.round(result.score);
  return {
    id: "pronunciation",
    level: score >= PHONEME_GOOD ? "good" : score >= PHONEME_OK ? "ok" : "attention",
    summaryKey: weak.length > 0 ? "fbPronunciationWeak" : "fbPronunciationClean",
    summaryValues: { score, n: weak.length },
    phoneme: result,
    note: result.feedbackVi || null,
  };
}

function grammarDimension(analysed: ErrorItem[]): FeedbackDimension {
  const errors = analysed.filter((e) => !isLexical(e));
  return {
    id: "grammar",
    level: severityLevel(errors),
    summaryKey: errors.length > 0 ? "fbGrammarIssues" : "fbGrammarClean",
    summaryValues: { n: errors.length },
    errors,
  };
}

function vocabularyDimension(
  analysed: ErrorItem[] | undefined,
  suggestions: Suggestion[],
): FeedbackDimension | null {
  const lexical = (analysed ?? []).filter(isLexical);
  if (lexical.length > 0) {
    return {
      id: "vocabulary",
      level: "attention",
      summaryKey: "fbVocabLexical",
      summaryValues: { n: lexical.length },
      errors: lexical,
      suggestions,
    };
  }
  if (suggestions.length > 0) {
    return {
      id: "vocabulary",
      level: "ok",
      summaryKey: "fbVocabSuggestions",
      summaryValues: { n: suggestions.length },
      suggestions,
    };
  }
  return null;
}

const RELEVANCE_LEVEL: Record<TurnStatus, FeedbackLevel> = {
  EXCELLENT: "good",
  ON_TOPIC_NEEDS_IMPROVEMENT: "ok",
  OFF_TOPIC: "attention",
};

const RELEVANCE_SUMMARY: Record<TurnStatus, string> = {
  EXCELLENT: "fbRelevanceExcellent",
  ON_TOPIC_NEEDS_IMPROVEMENT: "fbRelevanceNeedsWork",
  OFF_TOPIC: "fbRelevanceOffTopic",
};

function relevanceDimension(status: TurnStatus, note: string | null): FeedbackDimension {
  return {
    id: "relevance",
    level: RELEVANCE_LEVEL[status],
    summaryKey: RELEVANCE_SUMMARY[status],
    note,
  };
}

/**
 * Dựng danh sách chiều phản hồi cho lượt gần nhất, đã sắp xếp: cần sửa trước, tốt sau; cùng mức
 * thì giữ thứ tự khai báo. Chiều không có nguồn dữ liệu bị bỏ hẳn, không render ô rỗng.
 */
export function buildFeedbackDimensions(input: FeedbackInput): FeedbackDimension[] {
  const { analysedErrors, suggestions, suggestionsVisible, phonemeResult, turnStatus, turnNote } =
    input;

  const visibleSuggestions = suggestionsVisible ? suggestions : [];
  const dimensions: FeedbackDimension[] = [];

  if (phonemeResult) dimensions.push(pronunciationDimension(phonemeResult));
  if (analysedErrors !== undefined) dimensions.push(grammarDimension(analysedErrors));

  const vocabulary = vocabularyDimension(analysedErrors, visibleSuggestions);
  if (vocabulary) dimensions.push(vocabulary);

  if (turnStatus) dimensions.push(relevanceDimension(turnStatus, turnNote));

  return [...dimensions].sort((a, b) => {
    const byLevel = LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level];
    if (byLevel !== 0) return byLevel;
    return DECLARATION_ORDER.indexOf(a.id) - DECLARATION_ORDER.indexOf(b.id);
  });
}
