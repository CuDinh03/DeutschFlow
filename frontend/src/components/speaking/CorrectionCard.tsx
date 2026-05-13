"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Play, Pause, Sparkles, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { speakGerman } from "@/lib/speechDe";
import { Exchange, MINT, SPEAKING_LIGHT, glassLight } from "./types";
import { useGrammarCorrection } from "@/hooks/useLocalAi";

function userTextFromExchange(ex: Exchange): string {
  return ex.segments.map((s) => s.text).join('').trim();
}

const ERROR_TYPE_KEYS: Record<string, { tKey: string; color: string }> = {
  auxiliary:   { tKey: "errTypeAuxiliary",   color: "#F87171" },
  preposition: { tKey: "errTypePreposition", color: "#FB923C" },
  grammar:     { tKey: "errTypeGrammar",     color: "#FBBF24" },
  vocab:       { tKey: "errTypeVocab",       color: "#A78BFA" },
};

export function CorrectionCard({ exchange }: { exchange: Exchange }) {
  const t = useTranslations("speaking");
  const [view, setView]               = useState<"original" | "corrected" | "ai">("original");
  const [isPlayingOrig, setPlayingOrig] = useState(false);
  const [isPlayingCorr, setPlayingCorr] = useState(false);
  const { result: aiResult, loading: aiLoading, correct: aiCorrect } = useGrammarCorrection();

  const simulatePlay = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
    setTimeout(() => setter(false), 2200);
  };

  const handleAiTab = () => {
    setView("ai");
    // Only call AI if we haven't already and there's original text
    const userLine = userTextFromExchange(exchange);
    if (!aiResult && !aiLoading && userLine) {
      void aiCorrect(userLine);
    }
  };

  return (
    <motion.div
      className="rounded-[16px] overflow-hidden"
      style={{ ...glassLight, border: "1px solid rgba(248,113,113,0.35)" }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex border-b" style={{ borderColor: SPEAKING_LIGHT.line }}>
        {(["original", "corrected", "ai"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => tab === "ai" ? handleAiTab() : setView(tab)}
            className="flex-1 py-2.5 text-xs font-semibold transition-all relative"
            style={{ color: view === tab ? SPEAKING_LIGHT.ink : SPEAKING_LIGHT.inkFaint }}
          >
            {tab === "original" ? t("tabOriginal") : tab === "corrected" ? t("tabCorrected") : "AI"}
            {view === tab && (
              <motion.div
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ background: tab === "original" ? "#F87171" : tab === "corrected" ? MINT : "#A78BFA" }}
                layoutId="correctionTab"
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          {view === "original" ? (
            <motion.div
              key="original"
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 leading-relaxed">
                  <p className="text-[13px]" style={{ color: SPEAKING_LIGHT.ink }}>
                    {exchange.segments.map((seg, i) =>
                      seg.isError ? (
                        <span key={i} className="relative inline-block mx-0.5" style={{
                          textDecoration: "line-through", textDecorationColor: "#F87171",
                          textDecorationThickness: 2, color: "#FCA5A5",
                          background: "rgba(248,113,113,0.1)", borderRadius: 4, padding: "0 3px",
                        }}>{seg.text}</span>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )}
                  </p>
                </div>
                <button
                  onClick={() => simulatePlay(setPlayingOrig)}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: isPlayingOrig ? "rgba(248,113,113,0.2)" : "rgba(241,245,249,0.95)",
                    border: `1px solid ${SPEAKING_LIGHT.lineStrong}`,
                  }}
                >
                  {isPlayingOrig
                    ? <Pause size={11} className="text-red-300" />
                    : <Play size={11} style={{ color: SPEAKING_LIGHT.inkMuted }} fill="rgba(71,85,105,0.5)" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {exchange.segments.filter((s) => s.isError && s.errorType).map((s, i) => {
                  const conf = ERROR_TYPE_KEYS[s.errorType!];
                  return (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${conf.color}20`, color: conf.color, border: `1px solid ${conf.color}40` }}>
                      {`${t(conf.tKey)}: \u201c${s.text}\u201d \u2192 \u201c${s.correction}\u201d`}
                    </span>
                  );
                })}
              </div>
            </motion.div>
          ) : view === "corrected" ? (
            <motion.div
              key="corrected"
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-[13px] font-semibold leading-relaxed" style={{ color: MINT }}>
                    {exchange.corrected}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Check size={11} style={{ color: MINT }} />
                    <span className="text-[10px]" style={{ color: MINT }}>{t("grammarCorrect")}</span>
                  </div>
                </div>
                <button
                  onClick={() => { simulatePlay(setPlayingCorr); if (exchange.corrected) speakGerman(exchange.corrected); }}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: isPlayingCorr ? `${MINT}22` : "rgba(241,245,249,0.95)",
                    border: `1px solid ${isPlayingCorr ? MINT + "55" : SPEAKING_LIGHT.lineStrong}`,
                  }}
                >
                  {isPlayingCorr
                    ? <Pause size={11} style={{ color: MINT }} />
                    : <Play size={11} style={{ color: MINT }} fill={MINT} />}
                </button>
              </div>
              {isPlayingCorr && (
                <motion.div className="flex items-end gap-0.5 mt-2" style={{ height: 16 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {[4,7,12,9,14,10,6,9,13,8,5].map((h, i) => (
                    <motion.div key={i} className="w-1 rounded-full" style={{ background: MINT }}
                      animate={{ height: [h, h * 1.8, h] }}
                      transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }} />
                  ))}
                  <span className="ml-1.5 text-[10px] self-center" style={{ color: MINT }}>{t("playingPronunciation")}</span>
                </motion.div>
              )}
            </motion.div>
          ) : (
            // ── AI Explanation tab ────────────────────────────
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              {aiLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 size={14} className="animate-spin" style={{ color: "#A78BFA" }} />
                  <span className="text-[12px]" style={{ color: SPEAKING_LIGHT.inkSoft }}>
                    Đang phân tích với AI...
                  </span>
                </div>
              ) : aiResult ? (
                <div className="space-y-3">
                  {aiResult.hasErrors && (
                    <div className="rounded-lg p-3" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(124,58,237,0.28)" }}>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: "#6d28d9" }}>Câu đúng:</p>
                      <p className="text-[13px] font-semibold" style={{ color: "#5b21b6" }}>{aiResult.correctedText}</p>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={11} style={{ color: "#A78BFA" }} />
                      <span className="text-[11px] font-semibold" style={{ color: "#7c3aed" }}>Giải thích ngữ pháp:</span>
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: SPEAKING_LIGHT.inkMuted }}>
                      {aiResult.explanation}
                    </p>
                  </div>
                  {!aiResult.hasErrors && (
                    <div className="flex items-center gap-1.5">
                      <Check size={11} style={{ color: MINT }} />
                      <span className="text-[11px]" style={{ color: MINT }}>Câu của bạn đúng ngữ pháp!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <Sparkles size={14} style={{ color: "#A78BFA" }} />
                  <span className="text-[12px]" style={{ color: SPEAKING_LIGHT.inkSoft }}>
                    Nhấn tab AI để phân tích ngữ pháp
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
