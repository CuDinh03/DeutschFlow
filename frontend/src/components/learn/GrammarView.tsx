"use client";

import { NodeContent, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useTranslations } from "next-intl";
import { BookOpen, Library, MessagesSquare, Sparkles, TriangleAlert, Lightbulb, CircleCheck, CircleX } from "lucide-react";
import { VocabCard, VocabTag, AudioButton } from "./LearnComponents";
import { useState, useMemo, useEffect } from "react";
import { lightImpact, mediumImpact, heavyImpact } from "@/lib/haptics";
import SelfCheckCard from "./SelfCheckCard";
import {
  buildItemAnswers,
  scoredExercises,
  selfCheckExercises,
  correctIndexOf,
  gradeItems,
  questionTextOf,
  MULTIPLE_CHOICE,
  type AnswerMap,
} from "@/lib/nodeExercises";

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
          <div key={i} className="flex items-start gap-1.5 rounded-ga bg-ga-red-soft border border-ga-red/40 px-2.5 py-2">
            <TriangleAlert size={14} className="mt-[1px] shrink-0" aria-hidden />
            <p className="text-xs text-ga-red leading-relaxed">{line.slice(2).trim()}</p>
          </div>
        );
        if (line.startsWith("💡")) return (
          <div key={i} className="flex items-start gap-1.5 rounded-ga bg-ga-blue-soft border border-ga-blue/40 px-2.5 py-2">
            <Lightbulb size={14} className="mt-[1px] shrink-0" aria-hidden />
            <p className="text-xs text-ga-blue leading-relaxed">{line.slice(2).trim()}</p>
          </div>
        );
        if (line.startsWith("✅") || line.startsWith("❌")) return null;
        if (line.includes(" → ") || line.includes(" = ")) {
          const parts = line.split(/( → | = )/);
          return (
            <p key={i} className="text-xs text-ga-muted leading-relaxed">
              {parts.map((part, j) =>
                part === " → " || part === " = " ? (
                  <span key={j} className="font-bold text-ga-yellow mx-0.5">{part.trim()}</span>
                ) : <span key={j}>{part}</span>
              )}
            </p>
          );
        }
        return line.trim() ? <p key={i} className="text-xs text-ga-muted leading-relaxed">{line}</p> : null;
      })}
      {hasSideBySide && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
          <div className="min-w-0 rounded-ga bg-ga-green-soft border border-ga-green/40 p-2 space-y-1">
            <p className="flex items-center gap-1 text-[10px] font-bold text-ga-green uppercase"><CircleCheck size={12} aria-hidden /> Đúng</p>
            {goodLines.map((l, i) => <p key={i} className="text-xs text-ga-green break-words">{l}</p>)}
          </div>
          <div className="min-w-0 rounded-ga bg-ga-red-soft border border-ga-red/40 p-2 space-y-1">
            <p className="flex items-center gap-1 text-[10px] font-bold text-ga-red uppercase"><CircleX size={12} aria-hidden /> Sai</p>
            {badLines.map((l, i) => <p key={i} className="text-xs text-ga-red break-words">{l}</p>)}
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
    <div className={`rounded-ga border p-4 space-y-3 transition-[background-color,border-color,color,box-shadow,transform,max-height,width] duration-200 hover:shadow-ga-card-hover ${
      card.type === "RULE" ? "bg-gradient-to-br from-ga-yellow-soft to-ga-card border-ga-gold/40"
      : card.type === "EXAMPLE" ? "bg-gradient-to-br from-ga-blue-soft to-ga-card border-ga-blue/40"
      : "bg-ga-card border-ga-line"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            card.type === "RULE" ? "bg-ga-yellow text-ga-ink"
            : card.type === "EXAMPLE" ? "bg-ga-blue text-white"
            : "bg-ga-subtle text-white"
          }`}>
            {card.type === "RULE" ? "QUY TẮC" : card.type === "EXAMPLE" ? "VÍ DỤ" : card.type}
          </span>
          <span className="text-sm font-bold text-ga-ink break-words">{card.title.vi ?? card.title.de}</span>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1 shrink-0 pt-0.5">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? "bg-ga-ink" : "bg-ga-line"}`} />
          ))}
        </div>
      </div>
      <div className={`overflow-hidden transition-[background-color,border-color,color,box-shadow,transform,max-height,width] duration-300 ${expanded ? "max-h-[1000px]" : "max-h-[80px]"}`}>
        <TheoryContent text={card.content.vi ?? card.content.de ?? ""} />
      </div>
      {isLong && (
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-medium text-ga-muted hover:text-ga-ink flex items-center gap-1 transition-colors">
          {expanded ? "▲ Thu gọn" : "▼ Xem thêm"}
        </button>
      )}
      {card.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-ga-surface text-ga-muted">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GrammarView({ content, isLocked = false }: { content: NodeContent; isLocked?: boolean }) {
  const tLearn = useTranslations("learn");
  const { markTabCompleted, tabCompletion, recordItemAnswers } = useNodeSessionStore();
  const isCompleted = tabCompletion.grammar;

  const [activeTag, setActiveTag] = useState<string | null>(null);

  // ── Practice Quiz Logic ──
  // Gộp theory_gate + practice: backend chấm CẢ HAI, web trước đây chỉ đọc `practice` nên vừa
  // thiếu câu vừa nộp thiếu (F-21/F-22).
  const practiceItems = useMemo(() => scoredExercises(content.exercises), [content.exercises]);
  // TRANSLATE/REORDER: máy chủ không chấm, nên tách riêng — hiện dạng tự kiểm tra, KHÔNG tính điểm
  // và KHÔNG chặn nút nộp bài (đúng cách mobile làm).
  const selfChecks = useMemo(() => selfCheckExercises(content.exercises), [content.exercises]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // ── Vocabulary Pagination Logic ──
  const [vocabPage, setVocabPage] = useState(1);
  const VOCAB_PAGE_SIZE = 10;

  // Trước đây so `answers[i] === item.answerIndex`, nhưng nội dung thật dùng khoá `correct`
  // (406 lần trong migration, `answerIndex` chỉ 2) ⇒ điểm LUÔN bằng 0 và không ai qua nổi node.
  const graded = useMemo(() => gradeItems(practiceItems, answers), [practiceItems, answers]);
  const score = graded.correct;

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    // Đáp án thô đi kèm lên `POST /skill-tree/{nodeId}/submit` để MÁY CHỦ chấm — điểm client chỉ
    // để hiển thị. Đây là ý đồ sẵn có của backend (chống client tự khai 100% để mở khoá node).
    recordItemAnswers(buildItemAnswers(practiceItems, answers));
    if (graded.scored > 0 && graded.correct === graded.scored) {
      mediumImpact();
      markTabCompleted("grammar", graded.percent);
    } else {
      heavyImpact();
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
        <h2 className="text-sm font-bold text-ga-ink uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-ga-ink text-white flex items-center justify-center"><BookOpen size={13} aria-hidden /></span>
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
            <span className="text-[10px] font-bold text-ga-subtle uppercase">Lọc:</span>
            <VocabTag tag="Tất cả" active={!activeTag} onClick={() => setActiveTag(null)} />
            {allTags.slice(0, 10).map((t) => (
              <VocabTag key={t} tag={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-ga-ink uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-ga-ink text-white flex items-center justify-center"><Library size={13} aria-hidden /></span>
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
              className="flex min-h-[40px] min-w-[40px] items-center justify-center lg:min-h-0 lg:min-w-0 p-1.5 rounded-ga border border-ga-line text-ga-muted hover:bg-ga-surface hover:text-ga-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-medium text-ga-muted">
              Trang {vocabPage} / {totalVocabPages}
            </span>
            <button
              onClick={() => setVocabPage(p => Math.min(totalVocabPages, p + 1))}
              disabled={vocabPage === totalVocabPages}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center lg:min-h-0 lg:min-w-0 p-1.5 rounded-ga border border-ga-line text-ga-muted hover:bg-ga-surface hover:text-ga-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <h2 className="text-sm font-bold text-ga-ink uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-ga-ink text-white flex items-center justify-center"><MessagesSquare size={13} aria-hidden /></span>
            Cụm từ thường dùng
          </h2>
          <div className="space-y-2">
            {content.phrases.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-ga border border-ga-line bg-ga-card p-3">
                <AudioButton text={p.speak_de} compact />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ga-ink">{p.german}</p>
                  <p className="text-xs text-ga-muted">{p.meaning}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.examples?.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-ga-ink uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-ga-ink text-white flex items-center justify-center"><Sparkles size={13} aria-hidden /></span>
            Ví dụ thực tế
          </h2>
          <div className="space-y-2">
            {content.examples.map((ex, i) => (
              <div key={i} className="rounded-ga bg-gradient-to-r from-ga-ink to-ga-ink p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <AudioButton text={ex.speak_de} compact />
                  <p className="text-sm font-bold text-white">{ex.german}</p>
                </div>
                <p className="text-xs text-white/70">{ex.translation}</p>
                {ex.note && <p className="flex items-start gap-1 text-[10px] text-ga-yellow"><Lightbulb size={11} className="mt-[2px] shrink-0" aria-hidden /> {ex.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Practice Quiz / Completion ── */}
      <section className="pt-6 border-t border-ga-line mt-8">
        <div className="bg-ga-surface rounded-ga border border-ga-line p-4 lg:p-6 text-center space-y-4">
          <h2 className="text-sm font-bold text-ga-ink uppercase tracking-wide">
            Kiểm tra mức độ hiểu bài
          </h2>
          
          {practiceItems.length > 0 ? (
            <div className="space-y-6 text-left mt-4">
              {practiceItems.map((item: any, i: number) => (
                <div key={i} className="space-y-3 bg-ga-card p-4 rounded-ga border border-ga-line">
                  <p className="text-sm font-bold text-ga-ink break-words">{i + 1}. {questionTextOf(item) ?? item.sentence_de ?? ""}</p>
                  {item.type !== MULTIPLE_CHOICE ? (
                    <input
                      type="text"
                      value={typeof answers[i] === "string" ? (answers[i] as string) : ""}
                      onChange={(e) => { if (!quizSubmitted) setAnswers((prev) => ({ ...prev, [i]: e.target.value })); }}
                      disabled={quizSubmitted}
                      placeholder={item.hint_vi ?? "Nhập câu trả lời"}
                      aria-label={questionTextOf(item) ?? `Câu ${i + 1}`}
                      className="w-full rounded-ga border-2 border-ga-line px-4 py-3 text-sm focus:border-ga-yellow focus:outline-none disabled:opacity-60"
                    />
                  ) : (
                  <div className="space-y-2">
                    {Array.isArray(item.options) && item.options.map((opt: string, j: number) => {
                      const isSelected = answers[i] === j;
                      const isCorrect = correctIndexOf(item) === j;
                      const showResult = quizSubmitted;
                      
                      let btnClass = "border-ga-line hover:border-ga-line text-ga-muted";
                      if (isSelected && !showResult) btnClass = "border-ga-yellow bg-ga-yellow/10 text-ga-ink";
                      if (showResult && isCorrect) btnClass = "border-ga-green bg-ga-green-soft text-ga-green";
                      if (showResult && isSelected && !isCorrect) btnClass = "border-ga-red bg-ga-red-soft text-ga-red";

                      return (
                        <button
                          key={j}
                          onClick={() => { if (!quizSubmitted) { lightImpact(); setAnswers(prev => ({ ...prev, [i]: j })); } }}
                          disabled={quizSubmitted}
                          className={`w-full text-left px-4 py-3 rounded-ga border-2 text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform,max-height,width] ${btnClass}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
              ))}
              
              {selfChecks.length > 0 && (
                <div className="space-y-3 pt-2">
                  {selfChecks.map((sc, i) => (
                    <SelfCheckCard key={sc.id} item={sc} index={practiceItems.length + i + 1} />
                  ))}
                </div>
              )}

              {!isCompleted && (
                <button
                  onClick={handleQuizSubmit}
                  disabled={
                    practiceItems.filter((_, i) => {
                      const v = answers[i]
                      return typeof v === "number" || (typeof v === "string" && v.trim() !== "")
                    }).length < practiceItems.length
                  }
                  className="w-full py-3 rounded-ga bg-ga-ink text-white text-sm font-bold disabled:opacity-50"
                >
                  Kiểm tra đáp án
                </button>
              )}
            </div>
          ) : selfChecks.length > 0 ? (
            <div className="space-y-3 text-left mt-4">
              {selfChecks.map((sc, i) => (
                <SelfCheckCard key={sc.id} item={sc} index={i + 1} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ga-muted mb-4">
              Không có bài tập thực hành cho phần này. Hãy đánh dấu hoàn thành nếu bạn đã hiểu rõ lý thuyết.
            </p>
          )}

          {(!practiceItems.length || (quizSubmitted && score === practiceItems.length)) ? (
            isCompleted ? (
              // Read-only badge — node already completed, no action needed
              <div className="w-full py-3 rounded-ga bg-ga-green text-white font-bold text-sm text-center cursor-default select-none flex items-center justify-center gap-2">
                <CircleCheck size={16} aria-hidden />
                <span>{tLearn("completed100")}</span>
              </div>
            ) : (
              <button
                onClick={() => { recordItemAnswers({}); markTabCompleted("grammar"); }}
                className="w-full py-3 rounded-ga font-bold text-sm bg-ga-green hover:bg-ga-green text-white transition-colors"
              >
                <span>{tLearn("readAndUnderstood")}</span>
              </button>
            )
          ) : quizSubmitted && score < practiceItems.length ? (
            <div className="text-ga-red text-sm font-bold mt-2">
              Bạn trả lời đúng {score}/{practiceItems.length}. Cần đúng 100% để qua bài!
              <button 
                onClick={() => { setQuizSubmitted(false); setAnswers({}); }}
                className="ml-3 text-ga-blue underline"
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
