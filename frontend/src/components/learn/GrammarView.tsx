"use client";

import { NodeContent, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useTranslations } from "next-intl";
import { VocabCard, VocabTag, AudioButton } from "./LearnComponents";
import { useState, useMemo, useEffect } from "react";

// ── Smart content renderer ──
function TheoryContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const goodLines: string[] = [];
  const badLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith("✅")) goodLines.push(line.slice(1).trim());
    else if (line.startsWith("❌")) badLines.push(line.slice(1).trim());
  });

  const hasSideBySide = goodLines.length > 0 || badLines.length > 0;

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("⚠️")) return (
          <div key={i} className="flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
            <span className="text-sm shrink-0">⚠️</span>
            <p className="text-xs text-red-700 leading-relaxed">{line.slice(2).trim()}</p>
          </div>
        );
        if (line.startsWith("💡")) return (
          <div key={i} className="flex items-start gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-2">
            <span className="text-sm shrink-0">💡</span>
            <p className="text-xs text-blue-700 leading-relaxed">{line.slice(2).trim()}</p>
          </div>
        );
        if (line.startsWith("✅") || line.startsWith("❌")) return null;
        if (line.includes(" → ") || line.includes(" = ")) {
          const parts = line.split(/( → | = )/);
          return (
            <p key={i} className="text-xs text-[#475569] leading-relaxed">
              {parts.map((part, j) =>
                part === " → " || part === " = " ? (
                  <span key={j} className="font-bold text-[#FFCD00] mx-0.5">{part.trim()}</span>
                ) : <span key={j}>{part}</span>
              )}
            </p>
          );
        }
        return line.trim() ? <p key={i} className="text-xs text-[#475569] leading-relaxed">{line}</p> : null;
      })}
      {hasSideBySide && (
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <div className="rounded-lg bg-green-50 border border-green-200 p-2 space-y-1">
            <p className="text-[10px] font-bold text-green-700 uppercase">✅ Đúng</p>
            {goodLines.map((l, i) => <p key={i} className="text-xs text-green-800">{l}</p>)}
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-2 space-y-1">
            <p className="text-[10px] font-bold text-red-700 uppercase">❌ Sai</p>
            {badLines.map((l, i) => <p key={i} className="text-xs text-red-800">{l}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Collapsible Theory Card ──
function TheoryCard({ card, index, total }: { card: NodeContent["theory_cards"][0]; index: number; total: number }) {
  const lines = (card.content.vi ?? card.content.de ?? "").split("\n").filter(Boolean);
  const isLong = lines.length > 5;
  const [expanded, setExpanded] = useState(!isLong);

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all duration-200 hover:shadow-md ${
      card.type === "RULE" ? "bg-gradient-to-br from-[#FFFBEB] to-white border-[#FCD34D]/40"
      : card.type === "EXAMPLE" ? "bg-gradient-to-br from-[#EFF6FF] to-white border-[#93C5FD]/40"
      : "bg-white border-[#E2E8F0]"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            card.type === "RULE" ? "bg-[#FFCD00] text-[#121212]"
            : card.type === "EXAMPLE" ? "bg-[#3B82F6] text-white"
            : "bg-[#94A3B8] text-white"
          }`}>
            {card.type === "RULE" ? "QUY TẮC" : card.type === "EXAMPLE" ? "VÍ DỤ" : card.type}
          </span>
          <span className="text-sm font-bold text-[#0F172A]">{card.title.vi ?? card.title.de}</span>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1 shrink-0 pt-0.5">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? "bg-[#121212]" : "bg-[#E2E8F0]"}`} />
          ))}
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[1000px]" : "max-h-[80px]"}`}>
        <TheoryContent text={card.content.vi ?? card.content.de ?? ""} />
      </div>
      {isLong && (
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-medium text-[#64748B] hover:text-[#121212] flex items-center gap-1 transition-colors">
          {expanded ? "▲ Thu gọn" : "▼ Xem thêm"}
        </button>
      )}
      {card.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GrammarView({ content }: { content: NodeContent }) {
  const tLearn = useTranslations("learn");
  const { markTabCompleted, tabCompletion } = useNodeSessionStore();
  const isCompleted = tabCompletion.grammar;

  const [activeTag, setActiveTag] = useState<string | null>(null);

  // ── Practice Quiz Logic ──
  const practiceItems = useMemo(
    () => (Array.isArray(content.exercises?.practice) ? content.exercises.practice : []),
    [content.exercises]
  );
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // ── Vocabulary Pagination Logic ──
  const [vocabPage, setVocabPage] = useState(1);
  const VOCAB_PAGE_SIZE = 10;

  const score = useMemo(() => {
    let correct = 0;
    practiceItems.forEach((item: any, i) => {
      if (answers[i] === item.answerIndex) correct++;
    });
    return correct;
  }, [answers, practiceItems]);

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    if (score === practiceItems.length && practiceItems.length > 0) {
      markTabCompleted("grammar");
    }
  };

  const allTags = Array.from(new Set([
    ...content.theory_cards.flatMap((c) => c.tags ?? []),
    ...content.vocabulary.flatMap((v) => v.tags ?? []),
  ])).sort();

  const filteredVocab = activeTag
    ? content.vocabulary.filter((v) => v.tags?.includes(activeTag))
    : content.vocabulary;

  // Reset page when tag changes
  useEffect(() => {
    setVocabPage(1);
  }, [activeTag]);

  const totalVocabPages = Math.ceil(filteredVocab.length / VOCAB_PAGE_SIZE);
  const paginatedVocab = filteredVocab.slice((vocabPage - 1) * VOCAB_PAGE_SIZE, vocabPage * VOCAB_PAGE_SIZE);

  return (
    <div className="space-y-6 pb-20">
      <section>
        <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-[#121212] text-white flex items-center justify-center text-xs">📖</span>
          Lý thuyết ({content.theory_cards.length})
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {content.theory_cards.map((card, i) => (
            <TheoryCard key={i} card={card} index={i} total={content.theory_cards.length} />
          ))}
        </div>
      </section>

      {allTags.length > 0 && (
        <section>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Lọc:</span>
            <VocabTag tag="Tất cả" active={!activeTag} onClick={() => setActiveTag(null)} />
            {allTags.slice(0, 10).map((t) => (
              <VocabTag key={t} tag={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-[#121212] text-white flex items-center justify-center text-xs">📚</span>
          {tLearn("vocabularyCount", { count: filteredVocab.length })}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {paginatedVocab.map((v, i) => (
            <VocabCard key={v.id} vocab={v} autoPlay={i === 0 && vocabPage === 1} />
          ))}
        </div>
        {totalVocabPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setVocabPage(p => Math.max(1, p - 1))}
              disabled={vocabPage === 1}
              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#121212] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-medium text-[#64748B]">
              Trang {vocabPage} / {totalVocabPages}
            </span>
            <button
              onClick={() => setVocabPage(p => Math.min(totalVocabPages, p + 1))}
              disabled={vocabPage === totalVocabPages}
              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#121212] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </section>

      {content.phrases?.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#121212] text-white flex items-center justify-center text-xs">💬</span>
            Cụm từ thường dùng
          </h2>
          <div className="space-y-2">
            {content.phrases.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
                <AudioButton text={p.speak_de} compact />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A]">{p.german}</p>
                  <p className="text-xs text-[#64748B]">{p.meaning}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.examples?.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#121212] text-white flex items-center justify-center text-xs">✨</span>
            Ví dụ thực tế
          </h2>
          <div className="space-y-2">
            {content.examples.map((ex, i) => (
              <div key={i} className="rounded-xl bg-gradient-to-r from-[#121212] to-[#1E293B] p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <AudioButton text={ex.speak_de} compact />
                  <p className="text-sm font-bold text-white">{ex.german}</p>
                </div>
                <p className="text-xs text-white/70">{ex.translation}</p>
                {ex.note && <p className="text-[10px] text-[#FFCD00]">💡 {ex.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Practice Quiz / Completion ── */}
      <section className="pt-6 border-t border-[#E2E8F0] mt-8">
        <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6 text-center space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide">
            Kiểm tra mức độ hiểu bài
          </h2>
          
          {practiceItems.length > 0 ? (
            <div className="space-y-6 text-left mt-4">
              {practiceItems.map((item: any, i: number) => (
                <div key={i} className="space-y-3 bg-white p-4 rounded-xl border border-[#E2E8F0]">
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
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${btnClass}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {!isCompleted && (
                <button
                  onClick={handleQuizSubmit}
                  disabled={Object.keys(answers).length < practiceItems.length}
                  className="w-full py-3 rounded-xl bg-[#121212] text-white text-sm font-bold disabled:opacity-50"
                >
                  Kiểm tra đáp án
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#64748B] mb-4">
              Không có bài tập thực hành cho phần này. Hãy đánh dấu hoàn thành nếu bạn đã hiểu rõ lý thuyết.
            </p>
          )}

          {(!practiceItems.length || (quizSubmitted && score === practiceItems.length)) ? (
            isCompleted ? (
              // Read-only badge — node already completed, no action needed
              <div className="w-full py-3 rounded-xl bg-green-500 text-white font-bold text-sm text-center cursor-default select-none flex items-center justify-center gap-2">
                <span>✅</span>
                <span>{tLearn("completed100")}</span>
              </div>
            ) : (
              <button
                onClick={() => markTabCompleted("grammar")}
                className="w-full py-3 rounded-xl font-bold text-sm bg-[#22C55E] hover:bg-[#16A34A] text-white transition-colors"
              >
                <span>{tLearn("readAndUnderstood")}</span>
              </button>
            )
          ) : quizSubmitted && score < practiceItems.length ? (
            <div className="text-red-500 text-sm font-bold mt-2">
              Bạn trả lời đúng {score}/{practiceItems.length}. Cần đúng 100% để qua bài!
              <button 
                onClick={() => { setQuizSubmitted(false); setAnswers({}); }}
                className="ml-3 text-blue-600 underline"
              >
                Làm lại
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
