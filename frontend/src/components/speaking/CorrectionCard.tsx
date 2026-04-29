"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Play, Pause } from "lucide-react";
import { useTranslations } from "next-intl";
import { speakGerman } from "@/lib/speechDe";
import { Exchange, MINT, glass } from "./types";

const ERROR_TYPE_KEYS: Record<string, { tKey: string; color: string }> = {
  auxiliary:   { tKey: "errTypeAuxiliary",   color: "#F87171" },
  preposition: { tKey: "errTypePreposition", color: "#FB923C" },
  grammar:     { tKey: "errTypeGrammar",     color: "#FBBF24" },
  vocab:       { tKey: "errTypeVocab",       color: "#A78BFA" },
};

export function CorrectionCard({ exchange }: { exchange: Exchange }) {
  const t = useTranslations("speaking");
  const [view, setView]               = useState<"original" | "corrected">("original");
  const [isPlayingOrig, setPlayingOrig] = useState(false);
  const [isPlayingCorr, setPlayingCorr] = useState(false);

  const simulatePlay = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
    setTimeout(() => setter(false), 2200);
  };

  return (
    <motion.div
      className="rounded-[16px] overflow-hidden"
      style={{ ...glass, border: "1px solid rgba(255,75,75,0.25)" }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {(["original", "corrected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="flex-1 py-2.5 text-xs font-semibold transition-all relative"
            style={{ color: view === tab ? "white" : "rgba(255,255,255,0.4)" }}
          >
            {tab === "original" ? t("tabOriginal") : t("tabCorrected")}
            {view === tab && (
              <motion.div
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ background: tab === "original" ? "#F87171" : MINT }}
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
                  <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>
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
                    background: isPlayingOrig ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {isPlayingOrig
                    ? <Pause size={11} className="text-red-300" />
                    : <Play size={11} className="text-white/60" fill="rgba(255,255,255,0.6)" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {exchange.segments.filter((s) => s.isError && s.errorType).map((s, i) => {
                  const conf = ERROR_TYPE_KEYS[s.errorType!];
                  return (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${conf.color}20`, color: conf.color, border: `1px solid ${conf.color}40` }}>
                      {t(conf.tKey)}: "{s.text}" → "{s.correction}"
                    </span>
                  );
                })}
              </div>
            </motion.div>
          ) : (
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
                    background: isPlayingCorr ? `${MINT}30` : "rgba(255,255,255,0.08)",
                    border: `1px solid ${isPlayingCorr ? MINT + "60" : "rgba(255,255,255,0.12)"}`,
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
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
