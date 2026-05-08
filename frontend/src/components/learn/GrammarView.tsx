"use client";

import { NodeContent } from "@/stores/useNodeSessionStore";
import { VocabCard, VocabTag, AudioButton } from "./LearnComponents";
import { useState } from "react";

export default function GrammarView({ content }: { content: NodeContent }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(
    new Set([
      ...content.theory_cards.flatMap((c) => c.tags ?? []),
      ...content.vocabulary.flatMap((v) => v.tags ?? []),
    ])
  ).sort();

  // Filter vocabulary by active tag
  const filteredVocab = activeTag
    ? content.vocabulary.filter((v) => v.tags?.includes(activeTag))
    : content.vocabulary;

  return (
    <div className="space-y-6">
      {/* ── Theory Cards Grid ── */}
      <section>
        <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-[#121212] text-white flex items-center justify-center text-xs">📖</span>
          Lý thuyết
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {content.theory_cards.map((card, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 space-y-2 transition-all duration-200 hover:shadow-md ${
                card.type === "RULE"
                  ? "bg-gradient-to-br from-[#FFFBEB] to-white border-[#FCD34D]/30"
                  : card.type === "EXAMPLE"
                  ? "bg-gradient-to-br from-[#EFF6FF] to-white border-[#93C5FD]/30"
                  : "bg-white border-[#E2E8F0]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  card.type === "RULE"
                    ? "bg-[#FFCD00] text-[#121212]"
                    : card.type === "EXAMPLE"
                    ? "bg-[#3B82F6] text-white"
                    : "bg-[#94A3B8] text-white"
                }`}>
                  {card.type === "RULE" ? "QUY TẮC" : card.type === "EXAMPLE" ? "VÍ DỤ" : card.type}
                </span>
                <span className="text-sm font-bold text-[#0F172A]">{card.title.vi ?? card.title.de}</span>
              </div>

              <pre className="text-xs text-[#475569] whitespace-pre-wrap font-sans leading-relaxed">
                {card.content.vi ?? card.content.de}
              </pre>

              {card.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {card.tags.map((t) => (
                    <VocabTag
                      key={t}
                      tag={t}
                      active={activeTag === t}
                      onClick={() => setActiveTag(activeTag === t ? null : t)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Tag Filter Bar ── */}
      {allTags.length > 0 && (
        <section>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Lọc theo:</span>
            <VocabTag tag="Tất cả" active={!activeTag} onClick={() => setActiveTag(null)} />
            {allTags.slice(0, 10).map((t) => (
              <VocabTag key={t} tag={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Vocabulary Grid ── */}
      <section>
        <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-[#121212] text-white flex items-center justify-center text-xs">📚</span>
          Từ vựng ({filteredVocab.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {filteredVocab.map((v) => (
            <VocabCard key={v.id} vocab={v} />
          ))}
        </div>
      </section>

      {/* ── Phrases ── */}
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

      {/* ── Examples ── */}
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
    </div>
  );
}
