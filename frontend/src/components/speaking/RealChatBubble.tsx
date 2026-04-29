"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { speakGerman } from "@/lib/speechDe";
import { AiMessageBubble, CYAN, PURPLE, MINT } from "./types";

interface Props {
  msg: AiMessageBubble;
  showExplanations: boolean;
}

export function RealChatBubble({ msg, showExplanations }: Props) {
  const t = useTranslations("speaking");

  if (msg.role === "USER") {
    return (
      <motion.div className="flex justify-end"
        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
        <div className="max-w-[82%]">
          <p className="text-[10px] mb-1.5 text-right font-medium"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            {t("bubbleYou")}
          </p>
          <div className="rounded-[14px] rounded-tr-[4px] px-4 py-3"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
              {msg.userText}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="flex items-start gap-2.5"
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
        style={{ background: `linear-gradient(145deg, ${CYAN}, ${PURPLE})`, boxShadow: `0 4px 12px rgba(34,211,238,0.3)` }}>
        🤖
      </div>

      <div className="flex-1 max-w-[82%] space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
            {t("bubbleAi")}
          </p>
          {/* New word badge */}
          {msg.newWord && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${MINT}25`, color: MINT, border: `1px solid ${MINT}50` }}>
              {t("newWordBadge")}: {msg.newWord}
            </span>
          )}
          {/* Interest detected badge */}
          {msg.userInterestDetected && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}>
              ✨ {msg.userInterestDetected}
            </span>
          )}
        </div>

        {/* Main German response (with ghost text cursor while streaming) */}
        <div className="rounded-[14px] rounded-tl-[4px] px-4 py-3"
          style={{ background: "rgba(34,211,238,0.09)", border: `1px solid rgba(34,211,238,0.2)` }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.85)" }}>
              {msg.aiSpeechDe}
              {msg.isStreaming && (
                <motion.span
                  className="inline-block w-[2px] h-[13px] ml-0.5 rounded-full align-middle"
                  style={{ background: CYAN }}
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}
            </p>
            {msg.aiSpeechDe && !msg.isStreaming && (
              <button onClick={() => speakGerman(msg.aiSpeechDe!)}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Volume2 size={11} style={{ color: CYAN }} />
              </button>
            )}
          </div>
        </div>

        {/* Correction, explanation, grammar point — hidden when showExplanations is false */}
        {showExplanations && (
          <>
            {msg.correction && (
              <div className="rounded-[12px] px-3 py-2.5 flex items-start gap-2"
                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                  style={{ background: "#F87171", color: "white" }}>
                  {t("labelCorrection")}
                </span>
                <p className="text-[12px] leading-relaxed" style={{ color: "#FCA5A5" }}>{msg.correction}</p>
              </div>
            )}

            {msg.explanationVi && (
              <div className="rounded-[12px] px-3 py-2.5 flex items-start gap-2"
                style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                  style={{ background: CYAN, color: "#0A1628" }}>
                  {t("labelExplanation")}
                </span>
                <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{msg.explanationVi}</p>
              </div>
            )}

            {msg.grammarPoint && (
              <div className="rounded-[12px] px-3 py-2.5 flex items-start gap-2"
                style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}>
                <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                  style={{ background: PURPLE, color: "white" }}>
                  {t("labelGrammar")}
                </span>
                <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{msg.grammarPoint}</p>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
