"use client";

import { NodeContent, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface CorrectionResult {
  corrected_text: string;
  errors: Array<{
    original: string;
    corrected: string;
    type: string; // "grammar" | "spelling" | "style"
    explanation_vi: string;
  }>;
  score: number;
  feedback_vi: string;
}

export default function WritingView({ content }: { content: NodeContent }) {
  const { markTabCompleted, tabCompletion } = useNodeSessionStore();
  const isCompleted = tabCompletion.writing;

  const prompt = content.writing_prompt;
  const [text, setText] = useState("");
  const [correction, setCorrection] = useState<CorrectionResult | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Check completion when correction updates
  useEffect(() => {
    if (correction && correction.score >= 80) {
      markTabCompleted("writing");
    }
  }, [correction, markTabCompleted]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minWords = prompt?.min_words ?? 30;
  const progressPct = Math.min(100, (wordCount / minWords) * 100);

  // Debounced correction (2s after stop typing)
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    setCorrection(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (newText.trim().split(/\s+/).length < 5) return; // min 5 words

    debounceRef.current = setTimeout(async () => {
      setCorrecting(true);
      try {
        const { data } = await api.post<CorrectionResult>("/skill-tree/correct-writing", {
          text: newText,
          taskDe: prompt?.task_de ?? "",
          rubric: prompt?.ai_grading_rubric,
        });
        setCorrection(data);
      } catch { /* ignore */ }
      finally { setCorrecting(false); }
    }, 2000);
  }, [prompt]);

  // Cleanup debounce
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (wordCount < minWords) return;
    setSubmitted(true);
    // Final correction
    setCorrecting(true);
    try {
      const { data } = await api.post<CorrectionResult>("/skill-tree/correct-writing", {
        text, taskDe: prompt?.task_de ?? "", rubric: prompt?.ai_grading_rubric, final: true,
      });
      setCorrection(data);
    } catch { /* ignore */ }
    finally { setCorrecting(false); }
  }, [text, wordCount, minWords, prompt]);

  if (!prompt) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-[#E2E8F0] space-y-4">
        <span className="text-4xl mb-3">✍️</span>
        <p className="text-sm text-[#64748B]">Bài viết chưa có cho bài học này.</p>
        <button
          onClick={() => markTabCompleted("writing")}
          disabled={isCompleted}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            isCompleted 
              ? "bg-green-500 text-white" 
              : "bg-[#22C55E] hover:bg-[#16A34A] text-white"
          }`}
        >
          {isCompleted ? "✅ Đã hoàn thành" : "✅ Bỏ qua & Đánh dấu hoàn thành"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Prompt card ── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#121212] to-[#1E293B] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-[#FFCD00] text-[#121212] flex items-center justify-center text-xs font-bold">✍️</span>
          <span className="text-sm font-bold text-white">Aufgabe</span>
        </div>
        <p className="text-sm text-white/90">{prompt.task_de}</p>
        <p className="text-xs text-white/50">{prompt.task_vi}</p>

        {prompt.bullet_points?.length > 0 && (
          <ul className="space-y-1">
            {prompt.bullet_points.map((bp, i) => (
              <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                <span className="text-[#FFCD00] mt-0.5">•</span>
                {bp}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <span>Yêu cầu tối thiểu: {minWords} từ</span>
        </div>
      </div>

      {/* ── Editor ── */}
      <div className="rounded-xl bg-white border-2 border-[#E2E8F0] focus-within:border-[#FFCD00] transition-colors">
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Viết bài tiếng Đức tại đây..."
          disabled={submitted}
          className="w-full min-h-[200px] p-4 text-sm text-[#1E293B] outline-none resize-y rounded-xl font-sans leading-relaxed placeholder:text-[#CBD5E1]"
          style={{ fontFamily: "'Inter', sans-serif" }}
        />

        {/* Footer bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#F1F5F9]">
          <div className="flex items-center gap-3">
            {/* Word count */}
            <span className={`text-xs font-mono ${wordCount >= minWords ? "text-green-600" : "text-[#94A3B8]"}`}>
              {wordCount}/{minWords} từ
            </span>
            {/* Progress bar */}
            <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${wordCount >= minWords ? "bg-green-500" : "bg-[#FFCD00]"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {correcting && (
              <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                <Loader2 size={12} className="animate-spin" /> Đang kiểm tra...
              </span>
            )}
            {correction && !correcting && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={12} /> Đã kiểm tra
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Live corrections ── */}
      {correction && correction.errors.length > 0 && (
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[#F59E0B]" />
            <h3 className="text-sm font-bold text-[#0F172A]">
              Phát hiện {correction.errors.length} lỗi
            </h3>
          </div>

          <div className="space-y-2">
            {correction.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-[#F8FAFC] p-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  err.type === "grammar" ? "bg-red-100 text-red-600" :
                  err.type === "spelling" ? "bg-yellow-100 text-yellow-600" :
                  "bg-blue-100 text-blue-600"
                }`}>
                  {err.type === "grammar" ? "Ngữ pháp" : err.type === "spelling" ? "Chính tả" : "Phong cách"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="line-through text-red-400">{err.original}</span>
                    <span className="mx-1">→</span>
                    <span className="font-bold text-green-600">{err.corrected}</span>
                  </p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">{err.explanation_vi}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Score (after submit) ── */}
      {submitted && correction && (
        <div className="rounded-xl bg-gradient-to-r from-[#121212] to-[#1E293B] p-5 text-center space-y-2">
          <div className={`inline-flex w-16 h-16 rounded-full items-center justify-center text-2xl font-bold ${
            correction.score >= 80 ? "bg-green-500/20 text-green-400" :
            correction.score >= 50 ? "bg-yellow-500/20 text-yellow-400" :
            "bg-red-500/20 text-red-400"
          }`}>
            {correction.score}
          </div>
          <p className="text-white text-sm">{correction.feedback_vi}</p>
        </div>
      )}

      {/* ── Submit button ── */}
      {!submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={wordCount < minWords || correcting}
          className="w-full py-3 rounded-xl bg-[#121212] text-white text-sm font-bold hover:bg-[#1E293B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Nộp bài viết
        </button>
      )}

      {/* ── Completion status ── */}
      {isCompleted && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-sm font-bold text-green-700">✅ Đã hoàn thành phần Viết (≥ 80 điểm)</p>
        </div>
      )}
    </div>
  );
}
