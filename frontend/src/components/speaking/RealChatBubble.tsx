"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { speakGerman } from "@/lib/speechDe";
import { AiMessageBubble, CYAN, PURPLE } from "./types";

export function RealChatBubble({ msg }: { msg: AiMessageBubble }) {
  if (msg.role === "USER") {
    return (
      <motion.div className="flex justify-end"
        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
        <div className="max-w-[82%]">
          <p className="text-[10px] mb-1.5 text-right font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Du</p>
          <div className="rounded-[14px] rounded-tr-[4px] px-4 py-3"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>{msg.userText}</p>
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
        <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>KI-Tutor</p>

        {/* Main German response */}
        <div className="rounded-[14px] rounded-tl-[4px] px-4 py-3"
          style={{ background: "rgba(34,211,238,0.09)", border: `1px solid rgba(34,211,238,0.2)` }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] leading-relaxed flex-1" style={{ color: "rgba(255,255,255,0.85)" }}>
              {msg.aiSpeechDe}
            </p>
            {msg.aiSpeechDe && (
              <button onClick={() => speakGerman(msg.aiSpeechDe!)}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Volume2 size={11} style={{ color: CYAN }} />
              </button>
            )}
          </div>
        </div>

        {/* Grammar correction */}
        {msg.correction && (
          <div className="rounded-[12px] px-3 py-2.5 flex items-start gap-2"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
              style={{ background: "#F87171", color: "white" }}>Korrektur</span>
            <p className="text-[12px] leading-relaxed" style={{ color: "#FCA5A5" }}>{msg.correction}</p>
          </div>
        )}

        {/* Vietnamese explanation */}
        {msg.explanationVi && (
          <div className="rounded-[12px] px-3 py-2.5 flex items-start gap-2"
            style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
              style={{ background: CYAN, color: "#0A1628" }}>Giải thích</span>
            <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{msg.explanationVi}</p>
          </div>
        )}

        {/* Grammar point */}
        {msg.grammarPoint && (
          <div className="rounded-[12px] px-3 py-2.5 flex items-start gap-2"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}>
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
              style={{ background: PURPLE, color: "white" }}>Ngữ pháp</span>
            <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{msg.grammarPoint}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
