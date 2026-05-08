"use client";

import { NodeContent, VocabItem } from "@/stores/useNodeSessionStore";
import { useState, useCallback, useRef } from "react";
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
  const [tooltip, setTooltip] = useState<{ vocab: VocabItem; pos: { x: number; y: number } } | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [savedFlashcards, setSavedFlashcards] = useState<Set<string>>(new Set());
  const textRef = useRef<HTMLDivElement>(null);

  const passage = content.reading_passage;
  if (!passage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
        <span className="text-4xl mb-3">📚</span>
        <p className="text-sm text-[#64748B]">Bài đọc chưa có cho bài học này.</p>
      </div>
    );
  }

  // Build vocab lookup from refs
  const vocabMap = new Map<string, VocabItem>();
  for (const v of content.vocabulary) {
    vocabMap.set(v.id, v);
    // Also index by base word (lowercase) for getSelection matching
    const base = v.german.replace(/^(der|die|das|ein|eine)\s+/i, "").toLowerCase();
    vocabMap.set(base, v);
  }

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
            {passage.questions && passage.questions.length > 0 ? (
              passage.questions.map((q: unknown, i: number) => (
                <div key={i} className="space-y-2">
                  <p className="text-sm font-medium text-[#0F172A]">{String(q)}</p>
                  <textarea
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FFCD00] focus:ring-1 focus:ring-[#FFCD00] outline-none resize-none"
                    rows={2}
                    placeholder="Viết câu trả lời..."
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-[#94A3B8]">Chưa có câu hỏi cho bài đọc này.</p>
            )}
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
