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

export default function WritingView({ content, isLocked = false }: { content: NodeContent; isLocked?: boolean }) {
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
      markTabCompleted("writing", correction.score);
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
      <div className="flex flex-col items-center justify-center py-16 bg-ga-card rounded-ga border border-ga-line space-y-4">
        <span className="text-4xl mb-3">✍️</span>
        <p className="text-sm text-ga-muted">Bài viết chưa có cho bài học này.</p>
        <button
          onClick={() => markTabCompleted("writing")}
          disabled={isCompleted}
          className={`px-6 py-2.5 rounded-ga font-bold text-sm transition-colors ${
            isCompleted 
              ? "bg-ga-green text-white"
              : "bg-ga-green hover:bg-ga-green text-white"
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
      <div className="rounded-ga bg-gradient-to-br from-ga-ink to-ga-ink p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-ga-yellow text-ga-ink flex items-center justify-center text-xs font-bold">✍️</span>
          <span className="text-sm font-bold text-white">Aufgabe</span>
        </div>
        <p className="text-sm text-white/90">{prompt.task_de}</p>
        <p className="text-xs text-white/50">{prompt.task_vi}</p>

        {prompt.bullet_points?.length > 0 && (
          <ul className="space-y-1">
            {prompt.bullet_points.map((bp, i) => (
              <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                <span className="text-ga-yellow mt-0.5">•</span>
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
      <div className="rounded-ga bg-ga-card border-2 border-ga-line focus-within:border-ga-gold transition-colors">
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Viết bài tiếng Đức tại đây..."
          disabled={submitted || isLocked}
          className="w-full min-h-[200px] p-4 text-sm text-ga-ink outline-none resize-y rounded-ga font-sans leading-relaxed placeholder:text-ga-subtle"
          style={{ fontFamily: "'Inter', sans-serif" }}
        />

        {/* Footer bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-ga-line">
          <div className="flex items-center gap-3">
            {/* Word count */}
            <span className={`text-xs font-mono ${wordCount >= minWords ? "text-ga-green" : "text-ga-subtle"}`}>
              {wordCount}/{minWords} từ
            </span>
            {/* Progress bar */}
            <div className="w-20 h-1.5 bg-ga-surface rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[background-color,border-color,color,box-shadow,transform,max-height,width] duration-300 ${wordCount >= minWords ? "bg-ga-green" : "bg-ga-yellow"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {correcting && (
              <span className="flex items-center gap-1 text-xs text-ga-subtle">
                <Loader2 size={12} className="animate-spin" /> Đang kiểm tra...
              </span>
            )}
            {correction && !correcting && (
              <span className="flex items-center gap-1 text-xs text-ga-green">
                <CheckCircle size={12} /> Đã kiểm tra
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Live corrections ── */}
      {correction && correction.errors.length > 0 && (
        <div className="rounded-ga bg-ga-card border border-ga-line p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-ga-orange" />
            <h3 className="text-sm font-bold text-ga-ink">
              Phát hiện {correction.errors.length} lỗi
            </h3>
          </div>

          <div className="space-y-2">
            {correction.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-3 rounded-ga bg-ga-surface p-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  err.type === "grammar" ? "bg-ga-red-soft text-ga-red" :
                  err.type === "spelling" ? "bg-ga-yellow-soft text-ga-orange" :
                  "bg-ga-blue-soft text-ga-blue"
                }`}>
                  {err.type === "grammar" ? "Ngữ pháp" : err.type === "spelling" ? "Chính tả" : "Phong cách"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs break-words">
                    <span className="line-through text-ga-red">{err.original}</span>
                    <span className="mx-1">→</span>
                    <span className="font-bold text-ga-green">{err.corrected}</span>
                  </p>
                  <p className="text-[11px] text-ga-muted mt-0.5">{err.explanation_vi}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Score (after submit) ── */}
      {submitted && correction && (
        <div className="rounded-ga bg-gradient-to-r from-ga-ink to-ga-ink p-5 text-center space-y-2">
          <div className={`inline-flex w-16 h-16 rounded-full items-center justify-center text-2xl font-bold ${
            correction.score >= 80 ? "bg-ga-green-soft text-ga-green" :
            correction.score >= 50 ? "bg-ga-yellow-soft text-ga-orange" :
            "bg-ga-red-soft text-ga-red"
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
          className="w-full py-3 rounded-ga bg-ga-ink text-white text-sm font-bold hover:bg-ga-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Nộp bài viết
        </button>
      )}

      {/* ── Completion status ── */}
      {isCompleted && (
        <div className="mt-4 rounded-ga bg-ga-green-soft border border-ga-green/40 p-4 text-center">
          <p className="text-sm font-bold text-ga-green">✅ Đã hoàn thành phần Viết (≥ 80 điểm)</p>
        </div>
      )}
    </div>
  );
}
