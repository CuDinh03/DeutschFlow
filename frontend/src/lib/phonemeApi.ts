import api from "./api";

export interface PhonemeWordResult {
  word: string;
  correct: boolean;
  similarity: number;
}

export interface PhonemeEvalResult {
  transcribed: string;
  target: string;
  score: number;
  emoji: string;
  feedbackVi: string;
  words: PhonemeWordResult[];
}

function blobExtension(blob: Blob): string {
  const t = blob.type || "";
  if (t.includes("mp4")) return "m4a";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}

/** Deterministic pronunciation scoring via backend PhonemeService (Levenshtein). */
export async function evaluatePhoneme(
  audio: Blob,
  target: string,
): Promise<PhonemeEvalResult> {
  const form = new FormData();
  const ext = blobExtension(audio);
  form.append("audio", audio, `recording.${ext}`);
  form.append("target", target.trim());

  const res = await api.post<PhonemeEvalResult>("/phoneme/evaluate", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
