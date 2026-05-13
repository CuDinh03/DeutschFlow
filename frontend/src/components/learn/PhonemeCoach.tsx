"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Play, RefreshCw, Volume2 } from "lucide-react";
import { playTTS } from "@/lib/tts";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WordResult {
  word: string;
  correct: boolean;
  similarity: number;
}

interface EvalResult {
  transcribed: string;
  target: string;
  score: number;
  emoji: string;
  feedbackVi: string;
  words: WordResult[];
}

interface PhonemeCoachProps {
  /** The German phrase user should pronounce */
  target: string;
  /** Vietnamese meaning (shown as hint) */
  meaningVi?: string;
  /** Called when score >= 70 (good pronunciation) */
  onSuccess?: (score: number) => void;
}

// ── Score ring colour ──────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return "#10B981";
  if (score >= 70) return "#FFCD00";
  if (score >= 50) return "#F97316";
  return "#EF4444";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhonemeCoach({ target, meaningVi, onSuccess }: PhonemeCoachProps) {
  const [state, setState] = useState<"idle" | "recording" | "processing" | "result">("idle");
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Recording logic ─────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const getSupportedMimeType = () => {
        const types = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg;codecs=opus"
        ];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return "";
      };
      
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, options);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blobType = mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        const extension = blobType.includes("mp4") ? "m4a" : "webm";
        await evaluate(blob, extension);
      };

      mediaRef.current = mr;
      mr.start();
      setState("recording");
    } catch {
      setError("Không thể truy cập microphone. Hãy kiểm tra quyền trình duyệt.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const stopRecording = useCallback(() => {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
      setState("processing");
    }
  }, []);

  // ── Evaluate ────────────────────────────────────────────────────────────────

  const evaluate = useCallback(async (blob: Blob, extension: string = "webm") => {
    setState("processing");
    try {
      const form = new FormData();
      form.append("audio", blob, `recording.${extension}`);
      form.append("target", target);

      const res = await api.post<EvalResult>("/phoneme/evaluate", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setState("result");
      if (res.data.score >= 70) onSuccess?.(res.data.score);
    } catch {
      setError("Không thể đánh giá phát âm. Vui lòng thử lại.");
      setState("idle");
    }
  }, [target, onSuccess]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setState("idle");
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border-2 border-[#E2E8F0] bg-white overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-3">
        <span className="text-lg">🎤</span>
        <div className="flex-1">
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Phoneme Coach</p>
          <p className="text-sm font-bold text-[#0F172A]">Luyện phát âm</p>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* Target phrase */}
        <div className="text-center space-y-2">
          <p className="text-2xl font-black text-[#0F172A]">{target}</p>
          {meaningVi && <p className="text-sm text-[#64748B]">{meaningVi}</p>}
          <button
            type="button"
            onClick={() => playTTS(target, 0.8)}
            className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#121212] bg-[#F1F5F9] hover:bg-[#E2E8F0] px-3 py-1.5 rounded-full transition-colors"
          >
            <Volume2 size={12} /> Nghe mẫu (chậm)
          </button>
        </div>

        {/* Main action area */}
        <div className="flex flex-col items-center gap-4">

          {/* Mic button */}
          {(state === "idle" || state === "recording") && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={state === "idle" ? startRecording : stopRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                state === "recording"
                  ? "bg-red-500 text-white"
                  : "bg-[#121212] text-white"
              }`}
            >
              {state === "recording" ? (
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <MicOff size={28} />
                </motion.div>
              ) : (
                <Mic size={28} />
              )}
            </motion.button>
          )}

          {state === "recording" && (
            <p className="text-xs text-red-500 font-bold animate-pulse">● Đang ghi âm... Nhấn để dừng</p>
          )}

          {/* Processing spinner */}
          {state === "processing" && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-[#121212] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#64748B]">Đang phân tích phát âm...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="w-full rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Result */}
        <AnimatePresence>
          {state === "result" && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Score ring */}
              <div className="flex items-center justify-center gap-5">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                    <circle
                      cx="40" cy="40" r="32"
                      fill="none"
                      stroke={scoreColor(result.score)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - result.score / 100)}`}
                      style={{ transition: "stroke-dashoffset 0.8s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-[#0F172A]">{result.score}</span>
                    <span className="text-[9px] text-[#64748B]">/ 100</span>
                  </div>
                </div>

                <div>
                  <p className="text-2xl">{result.emoji}</p>
                  <p className="text-sm font-bold text-[#0F172A] mt-1">{result.feedbackVi}</p>
                  {result.transcribed ? (
                    <p className="text-xs text-[#64748B] mt-1">
                      Nghe được: <em>&ldquo;{result.transcribed}&rdquo;</em>
                    </p>
                  ) : (
                    <p className="text-xs text-red-500 mt-1 font-medium">
                      Nghe được: [Trống / Không thu được tiếng]
                    </p>
                  )}
                </div>
              </div>

              {/* Word-level breakdown */}
              {result.words.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Phân tích từng từ</p>
                  <div className="flex flex-wrap gap-2">
                    {result.words.map((w, i) => (
                      <span
                        key={i}
                        className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${
                          w.correct
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-red-50 border-red-200 text-red-700"
                        }`}
                      >
                        {w.correct ? "✓" : "✗"} {w.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-[#E2E8F0] text-sm font-bold text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                >
                  <RefreshCw size={14} /> Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => playTTS(target, 0.8)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-[#E2E8F0] text-sm font-bold text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                >
                  <Play size={14} /> Nghe lại
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
