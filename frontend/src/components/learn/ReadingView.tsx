"use client";

import { NodeContent, VocabItem, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useState, useCallback, useRef, useMemo } from "react";
import { GenderBadge, AudioButton } from "./LearnComponents";

// ── Tap-to-translate tooltip ──
function TranslateTooltip({
  vocab, position, onClose, onSaveFlashcard,
}: {
  vocab: VocabItem;
  position: { x: number; y: number };
  onClose: () => void;
  onSaveFlashcard: (vocabId: string) => void;
}) {
  return (
    <div
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-[#E2E8F0] p-3 space-y-2 min-w-[200px] max-w-[280px] animate-in fade-in zoom-in-95 duration-150"
      style={{ left: Math.min(position.x, window.innerWidth - 300), top: position.y + 10 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GenderBadge gender={vocab.gender} label={vocab.gender_label} />
          <span className="font-bold text-sm text-[#0F172A]">{vocab.german}</span>
        </div>
        <button type="button" onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] text-xs">✕</button>
      </div>
      <p className="text-sm text-[#475569]">{vocab.meaning}</p>
      {vocab.example_de && <p className="text-xs text-[#94A3B8] italic">"{vocab.example_de}"</p>}
      <div className="flex items-center gap-2 pt-1">
        <AudioButton text={vocab.speak_de} compact />
        <button
          type="button"
          onClick={() => onSaveFlashcard(vocab.id)}
          className="text-[10px] px-2 py-1 rounded-full bg-[#FFCD00] text-[#121212] font-bold hover:bg-[#FFCD00]/80 transition-colors"
        >
          💾 Lưu Flashcard
        </button>
      </div>
    </div>
  );
}

export default function ReadingView({ content }: { content: NodeContent }) {
  const { markTabCompleted, tabCompletion } = useNodeSessionStore();
  const isCompleted = tabCompletion.reading;

  const [tooltip, setTooltip] = useState<{ vocab: VocabItem; pos: { x: number; y: number } } | null>(null);
  const [savedFlashcards, setSavedFlashcards] = useState<Set<string>>(new Set());
  const textRef = useRef<HTMLDivElement>(null);

  const passage = content.reading_passage;
  
  // ── Practice Quiz Logic ──
  const practiceItems = Array.isArray(passage?.questions) ? passage.questions : [];
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const score = useMemo(() => {
    let correct = 0;
    practiceItems.forEach((item: any, i) => {
      // If it's old format (string), we can't grade it automatically, skip or treat as free text
      if (typeof item === "object" && answers[i] === item.answerIndex) correct++;
    });
    return correct;
  }, [answers, practiceItems]);

  const validMcqCount = practiceItems.filter((i: any) => typeof i === "object" && i.options).length;

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    if (score === validMcqCount && validMcqCount > 0) {
      markTabCompleted("reading");
    }
  };
  // Build vocab lookup from refs
  const vocabMap = useMemo(() => {
    const map = new Map<string, VocabItem>();
    for (const v of content.vocabulary) {
      map.set(v.id, v);
      const base = v.german.replace(/^(der|die|das|ein|eine)\s+/i, "").toLowerCase();
      map.set(base, v);
    }
    return map;
  }, [content.vocabulary]);

  // Handle text selection (Event Delegation + getSelection)
  const handleTextClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setTooltip(null);
      return;
    }

    const selectedText = selection.toString().trim().toLowerCase();
    if (!selectedText || selectedText.length > 30) return;

    const found = vocabMap.get(selectedText);
    if (found) {
      setTooltip({ vocab: found, pos: { x: e.clientX, y: e.clientY } });
    } else {
      setTooltip(null);
    }
  }, [vocabMap]);

  const handleSaveFlashcard = useCallback(async (vocabId: string) => {
    try {
      // POST to flashcard API
      await fetch("/api/flashcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabId }),
      });
      setSavedFlashcards((prev) => new Set(prev).add(vocabId));
    } catch { /* ignore */ }
  }, []);

  if (!passage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
        <span className="text-4xl mb-3">📚</span>
        <p className="text-sm text-[#64748B]">Bài đọc chưa có cho bài học này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Split-screen layout ── */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Text (60%) */}
        <div className="md:w-[60%] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded bg-[#121212] text-white flex items-center justify-center text-xs">📚</span>
            <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide">Bài đọc</h2>
          </div>

          <div
            ref={textRef}
            onClick={handleTextClick}
            className="bg-white rounded-xl border border-[#E2E8F0] p-5 text-[15px] leading-relaxed text-[#1E293B] cursor-text select-text"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {passage.text_de}
          </div>

          <p className="text-xs text-[#94A3B8] italic">💡 Bôi đen từ bất kỳ để xem nghĩa</p>
        </div>

        {/* Questions (40%) */}
        <div className="md:w-[40%] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded bg-[#FFCD00] text-[#121212] flex items-center justify-center text-xs font-bold">❓</span>
            <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide">Câu hỏi</h2>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-4 md:sticky md:top-4">
            {practiceItems.length > 0 ? (
              <div className="space-y-6 text-left">
                {practiceItems.map((item: any, i: number) => {
                  if (typeof item === "string") {
                    return (
                      <div key={i} className="space-y-2">
                        <p className="text-sm font-medium text-[#0F172A]">{item}</p>
                        <textarea
                          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FFCD00] focus:ring-1 focus:ring-[#FFCD00] outline-none resize-none"
                          rows={2}
                          placeholder="Viết câu trả lời (tự luận)..."
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={i} className="space-y-3">
                      <p className="text-sm font-bold text-[#0F172A]">{i + 1}. {item.question || "Câu hỏi..."}</p>
                      <div className="space-y-2">
                        {Array.isArray(item.options) && item.options.map((opt: string, j: number) => {
                          const isSelected = answers[i] === j;
                          const isCorrect = item.answerIndex === j;
                          const showResult = quizSubmitted;
                          
                          let btnClass = "border-[#E2E8F0] hover:border-[#CBD5E1] text-[#475569]";
                          if (isSelected && !showResult) btnClass = "border-[#FFCD00] bg-[#FFCD00]/10 text-[#121212]";
                          if (showResult && isCorrect) btnClass = "border-green-500 bg-green-50 text-green-700";
                          if (showResult && isSelected && !isCorrect) btnClass = "border-red-500 bg-red-50 text-red-700";

                          return (
                            <button
                              key={j}
                              onClick={() => !quizSubmitted && setAnswers(prev => ({ ...prev, [i]: j }))}
                              disabled={quizSubmitted}
                              className={`w-full text-left px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${btnClass}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {validMcqCount > 0 && !isCompleted && (
                  <button
                    onClick={handleQuizSubmit}
                    disabled={Object.keys(answers).length < validMcqCount}
                    className="w-full py-2.5 rounded-xl bg-[#121212] text-white text-xs font-bold disabled:opacity-50"
                  >
                    Kiểm tra đáp án
                  </button>
                )}

                {quizSubmitted && score < validMcqCount && (
                  <div className="text-red-500 text-xs font-bold mt-2 text-center">
                    Bạn trả lời đúng {score}/{validMcqCount}. Cần đúng 100% để qua bài!
                    <button 
                      onClick={() => { setQuizSubmitted(false); setAnswers({}); }}
                      className="ml-3 text-blue-600 underline"
                    >
                      Làm lại
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#94A3B8]">Chưa có câu hỏi cho bài đọc này.</p>
            )}

            {/* ── Completion Button ── */}
            <div className="pt-4 border-t border-[#E2E8F0] mt-4">
              {(!validMcqCount || (quizSubmitted && score === validMcqCount)) ? (
                <button
                  onClick={() => markTabCompleted("reading")}
                  disabled={isCompleted}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
                    isCompleted 
                      ? "bg-green-500 text-white" 
                      : "bg-[#22C55E] hover:bg-[#16A34A] text-white"
                  }`}
                >
                  {isCompleted ? "✅ Đã hoàn thành 100%" : "✅ Đã đọc & Hiểu (100%)"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTooltip(null)} />
          <TranslateTooltip
            vocab={tooltip.vocab}
            position={tooltip.pos}
            onClose={() => setTooltip(null)}
            onSaveFlashcard={handleSaveFlashcard}
          />
        </>
      )}
    </div>
  );
}
