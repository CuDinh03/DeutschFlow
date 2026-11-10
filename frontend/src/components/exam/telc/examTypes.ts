/**
 * Hình dạng `mock_exams.sections_json` phía client (đề đã gỡ đáp án). Tách khỏi trình thi cũ
 * `/mock-exam/run/ExamTaking.tsx` khi trình đó bị bỏ (06/11/2026) — các phép thuần telc còn dùng.
 */
import type { AudioScript } from '@/components/exam/audioScript'
import type { WritingStimulus as WritingStimulusData } from './writingTask'

export interface ExamQuestionItem {
  id: string
  question?: string
  text?: string
  person?: string
  audio_script?: AudioScript
  /** Câu dẫn tình huống đọc trước bài (HV Teil 3 telc): „Im Radio hören Sie folgenden Hinweis." */
  lead_in_de?: string
  /** Giọng của người nói bài này (HV Teil 1 telc: năm người, nam nữ xen kẽ). */
  speaker?: string
  options?: Record<string, string>
  /**
   * Non-revealing question type sent by the backend so we can pick the answer widget
   * without the correct answer. Preferred over `correct` (see answerWidget).
   */
  type?: 'MULTIPLE_CHOICE' | 'RICHTIG_FALSCH' | 'MATCHING' | 'UNKNOWN' | string
  /**
   * Legacy correct answer. The backend no longer sends this for in-progress exams
   * (it was an answer leak); kept only as a fallback for older API responses.
   */
  correct?: string
}

export interface ExamTeil {
  teil: number
  instruction_vi?: string
  instruction_de?: string
  context?: string
  /**
   * Bài đọc dài kiểu đề thật (LV Teil 2 telc, 17/09/2026): tiêu đề, Vorspann in đậm, thân bài
   * đánh số dòng mỗi 5 dòng, chú thích từ khó cuối bài. Đề không khai ⇒ `context` dựng như cũ.
   */
  title_de?: string
  vorspann_de?: string
  context_lines?: boolean
  glossary?: Array<{ term: string; explanation_de: string }>
  /**
   * Nguồn của bài đọc (Xưởng đề, V376): `quelle` là dòng ghi nguồn bắt buộc theo giấy phép (CC BY:
   * tác giả + giấy phép + "bearbeitet"; báo: "Daten: …"), hiện nhỏ dưới bài. Đề viết tay không khai.
   */
  source?: { quelle?: string | null }
  audio_script?: AudioScript
  /** Số lần được phép nghe (telc: 1 ở HV Teil 1, 2 ở Teil 2–3). Bỏ trống = không giới hạn. */
  max_plays?: number
  /**
   * Nghi thức bài nghe telc (17/09/2026): Ansage nguyên văn, giây đọc câu hỏi trước khi phát
   * (30 / 60 / 0), câu khung của Teil 1. Đề không khai ⇒ không có cổng, phát ngay như trước.
   */
  ansage_de?: string
  reading_seconds?: number
  framing_de?: string
  items?: ExamQuestionItem[]
  form_fields?: Array<{ field: string; instruction_vi: string }>
  /** Đề bài phần Viết/Nói của các đề B1+ (seed dùng `prompt` thay cho `input_email`). */
  prompt?: string
  input_email?: string
  writing_points?: string[]
  /**
   * Phần Viết kiểu telc (17/09/2026): văn bản mà bài viết trả lời (E-Mail của bạn / mẩu tin / thư)
   * in phía trên, và cờ xáo thứ tự Leitpunkte khi in (seed lưu thứ tự hợp lý cho AI chấm).
   * Đề Goethe không khai ⇒ khối đề bài dựng như cũ.
   */
  stimulus?: WritingStimulusData
  shuffle_points?: boolean
  prompt_words?: string[]
  /** Thẻ chủ đề phần Nói (seed A1/A2): trước đây chỉ dùng để bật simulator, nội dung không hiện. */
  topic_cards?: Array<{ card?: string; question_to_ask?: string }>
  /** Thẻ tình huống phần Nói Teil 3 của seed A1 — không có nhánh render nên Teil 3 ra ô trống. */
  scenario_cards?: Array<{ situation?: string; request?: string }>
  /**
   * Dạng bài ở cấp Teil. Đề telc khai bốn dạng riêng (`MATCH_HEADLINE`, `MATCH_AD_X`, `GAP_MC`,
   * `GAP_WORDBANK`) mà `answerWidget` KHÔNG suy ra được từ hình dạng câu hỏi — xem
   * `components/exam/telc/telcTeil.ts`.
   */
  type?: string
  headlines?: Record<string, string>
  ads?: Record<string, string>
  word_bank?: Record<string, string>
  gapped_text?: string
  single_use?: boolean
  allow_none?: boolean
}

export interface ExamSection {
  name: string
  label_vi: string
  time_minutes: number
  max_points: number
  teile?: ExamTeil[]
}

export interface ActiveExamData {
  sections: ExamSection[]
  /** Khoá gốc của `sections_json` (`TELC` …) — LT2 tra chiến thuật theo nhà tổ chức × bậc. */
  format?: string
  /** Bậc của đề (`cefr_level` ở hàng đề, không nằm trong `sections_json`). */
  level?: string
}
