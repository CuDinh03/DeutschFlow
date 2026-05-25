export type ArticleDe = "der" | "die" | "das" | null;
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface VocabWord {
  id: string;
  wordDe: string;
  article: ArticleDe;
  plural: string | null;
  meaningVi: string;
  exampleSentenceDe: string;
  exampleSentenceVi: string;
  partOfSpeech: string; // VD: "noun", "verb", "adjective"
  cefrLevel: CefrLevel;
  audioUrl?: string; // URL file mp3 nếu không dùng TTS trình duyệt
  imageUrl?: string | null; // Ảnh minh họa từ S3 (admin upload)
  lastPracticedAt?: string; // ISO Date String
  masteryLevel: number; // Thang đo độ ghi nhớ (0 - 100)
}
