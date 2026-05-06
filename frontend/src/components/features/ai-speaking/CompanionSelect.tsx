"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, ArrowLeft, Briefcase, Clock, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { PERSONA_LIST, PersonaId, PERSONA_TOKENS } from "@/lib/personas";
import { PersonaCard } from "./PersonaCard";
import { aiSpeakingApi, SpeakingSessionMode, ExperienceLevel } from "@/lib/aiSpeakingApi";
import { useChatStore } from "@/store/useChatStore";

const EXPERIENCE_LEVELS: { id: ExperienceLevel; label: string; labelDe: string }[] = [
  { id: "0-6M", label: "0–6 tháng", labelDe: "0–6 Monate" },
  { id: "6-12M", label: "6–12 tháng", labelDe: "6–12 Monate" },
  { id: "1-2Y", label: "1–2 năm", labelDe: "1–2 Jahre" },
  { id: "3Y", label: "3 năm", labelDe: "3 Jahre" },
  { id: "5Y", label: "5+ năm", labelDe: "5+ Jahre" },
];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];

export function CompanionSelect() {
  const router = useRouter();
  const { setSessionId, setSelectedCompanion, clearChat, addMessage, setSessionMode: storeSetSessionMode, setExperienceLevel: storeSetExperienceLevel } = useChatStore();
  
  const [selected, setSelected] = useState<PersonaId | null>(null);
  const [sessionMode, setSessionMode] = useState<SpeakingSessionMode>("COMMUNICATION");
  const [confirming, setConfirming] = useState(false);

  // Interview-specific state
  const [interviewPosition, setInterviewPosition] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [cefrLevel, setCefrLevel] = useState<string>("A1");

  const selectedPersona = selected ? PERSONA_LIST.find((p) => p.id === selected) : null;

  // Check if interview setup is complete
  const isInterviewReady = sessionMode === "INTERVIEW" 
    ? !!(selected && interviewPosition && experienceLevel && cefrLevel) 
    : !!selected;

  const handleConfirm = async () => {
    if (!selected || !selectedPersona || confirming) return;
    if (sessionMode === "INTERVIEW" && (!interviewPosition || !experienceLevel)) return;
    setConfirming(true);

    try {
      const res = await aiSpeakingApi.createSession(
        sessionMode === "INTERVIEW" ? interviewPosition ?? "Alltag" : "Alltag",
        cefrLevel,
        selected.toUpperCase(),
        "V1",
        sessionMode,
        sessionMode === "INTERVIEW" ? interviewPosition : null,
        sessionMode === "INTERVIEW" ? experienceLevel : null,
      );
      
      const session = res.data;
      const token = PERSONA_TOKENS[selected] || PERSONA_TOKENS.lukas;
      
      const companion = {
        id: token.id,
        name: token.name,
        avatarUrl: `/companions/${token.id}.png`,
        voiceId: token.id.toUpperCase(),
        voiceFile: token.voiceFile ?? null,
        personality: token.desc,
        cefrLevel: cefrLevel,
      };

      clearChat();
      setSessionId(session.id);
      setSelectedCompanion(companion);
      storeSetSessionMode(sessionMode);
      if (sessionMode === "INTERVIEW") {
        storeSetExperienceLevel(experienceLevel);
      }

      if (session.initialAiMessage) {
        addMessage({
          id: String(session.initialAiMessage.messageId || Date.now()),
          role: "ai",
          contentDe: session.initialAiMessage.aiSpeechDe,
        });
      }

      setTimeout(() => router.push("/speaking/chat"), 450);
    } catch (error) {
      console.error("Failed to create session", error);
      toast.error("Không thể tạo phiên luyện nói. Vui lòng thử lại!");
      setConfirming(false);
    }
  };

  // Reset interview fields when switching mode
  const handleModeChange = (mode: SpeakingSessionMode) => {
    setSessionMode(mode);
    if (mode === "COMMUNICATION") {
      setInterviewPosition(null);
      setExperienceLevel(null);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col w-full"
      style={{ background: "#080818", color: "#fff" }}
    >
      <div className="max-w-[460px] mx-auto w-full flex flex-col min-h-screen">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="px-5 pt-14 pb-4 flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Back button */}
            <motion.button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 mb-5"
              style={{ color: "rgba(255,255,255,0.5)" }}
              whileTap={{ scale: 0.92 }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <ArrowLeft size={15} />
              </div>
              <span className="text-sm">Trang chủ</span>
            </motion.button>

            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} style={{ color: "#FFCE00" }} />
              <span
                className="text-[11px] font-black tracking-widest uppercase"
                style={{ color: "#FFCE00" }}
              >
                DeutschFlow AI
              </span>
            </div>
            <h1 className="font-black text-2xl leading-tight text-white">
              Wähle deinen
            </h1>
            <h1 className="font-black text-2xl leading-tight" style={{ color: "#FFCE00" }}>
              Begleiter
            </h1>
            <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              Ai sẽ đồng hành cùng bạn hôm nay?
            </p>
          </motion.div>
        </div>

        {/* ── Mode Selection ────────────────────────────────────────── */}
        <div className="px-5 pb-4">
          <motion.div 
            className="flex bg-white/5 p-1 rounded-2xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={() => handleModeChange("COMMUNICATION")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                sessionMode === "COMMUNICATION" 
                  ? "bg-white/10 text-white shadow-sm" 
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Hội thoại thường
            </button>
            <button
              onClick={() => handleModeChange("INTERVIEW")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                sessionMode === "INTERVIEW" 
                  ? "bg-white/10 text-[#FFCE00] shadow-sm" 
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Luyện phỏng vấn
            </button>
          </motion.div>
        </div>

        {/* ── Persona Cards ────────────────────────────────────────── */}
        <div className="flex-1 px-4 flex gap-3 pb-4">
          {PERSONA_LIST.map((persona, idx) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              isSelected={selected === persona.id}
              index={idx}
              onClick={() => {
                setSelected(persona.id);
                setInterviewPosition(null); // Reset position when changing persona
              }}
            />
          ))}
        </div>

        {/* ── Interview Setup (only when INTERVIEW mode + persona selected) ── */}
        <AnimatePresence>
          {sessionMode === "INTERVIEW" && selectedPersona && (
            <motion.div
              className="px-5 pb-4 space-y-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Position Selection */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>
                    Vị trí ứng tuyển
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(selectedPersona.interviewPositions || []).map((pos) => (
                    <motion.button
                      key={pos.id}
                      onClick={() => setInterviewPosition(pos.label)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                      style={{
                        background: interviewPosition === pos.label 
                          ? `${selectedPersona.accent}22` 
                          : "rgba(255,255,255,0.04)",
                        border: interviewPosition === pos.label 
                          ? `1.5px solid ${selectedPersona.accent}` 
                          : "1.5px solid rgba(255,255,255,0.06)",
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div>
                        <span className="text-sm font-semibold text-white">{pos.label}</span>
                        <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {pos.labelDe}
                        </span>
                      </div>
                      {interviewPosition === pos.label && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: selectedPersona.accent }}
                        >
                          <span className="text-white text-xs">✓</span>
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>
                    Kinh nghiệm
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_LEVELS.map((exp) => (
                    <motion.button
                      key={exp.id}
                      onClick={() => setExperienceLevel(exp.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: experienceLevel === exp.id 
                          ? `${selectedPersona.accent}22` 
                          : "rgba(255,255,255,0.04)",
                        border: experienceLevel === exp.id 
                          ? `1.5px solid ${selectedPersona.accent}` 
                          : "1.5px solid rgba(255,255,255,0.06)",
                        color: experienceLevel === exp.id ? selectedPersona.accent : "rgba(255,255,255,0.6)",
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {exp.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* CEFR Level */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>
                    Trình độ tiếng Đức
                  </span>
                </div>
                <div className="flex gap-2">
                  {CEFR_LEVELS.map((lvl) => (
                    <motion.button
                      key={lvl}
                      onClick={() => setCefrLevel(lvl)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: cefrLevel === lvl 
                          ? `${selectedPersona.accent}22` 
                          : "rgba(255,255,255,0.04)",
                        border: cefrLevel === lvl 
                          ? `1.5px solid ${selectedPersona.accent}` 
                          : "1.5px solid rgba(255,255,255,0.06)",
                        color: cefrLevel === lvl ? selectedPersona.accent : "rgba(255,255,255,0.5)",
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {lvl}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <div className="px-4 pb-10 flex-shrink-0 mt-2">
          <AnimatePresence mode="wait">
            {isInterviewReady && selectedPersona ? (
              <motion.button
                key="cta-active"
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[18px] font-black text-base text-white"
                style={{
                  background: `linear-gradient(135deg, ${selectedPersona.ctaFrom}, ${selectedPersona.ctaTo})`,
                  boxShadow: selectedPersona.ctaShadow,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                whileTap={{ scale: 0.97, y: 3 }}
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles size={18} />
                  </motion.div>
                ) : (
                  <>
                    {sessionMode === "INTERVIEW" 
                      ? `Bắt đầu phỏng vấn với ${selectedPersona.name}`
                      : `Bắt đầu với ${selectedPersona.name}`
                    }
                    <ChevronRight size={18} />
                  </>
                )}
              </motion.button>
            ) : (
              <motion.p
                key="cta-hint"
                className="text-center text-sm"
                style={{ color: "rgba(255,255,255,0.25)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {sessionMode === "INTERVIEW" && selected 
                  ? "Vui lòng chọn vị trí, kinh nghiệm và trình độ"
                  : "Vui lòng chọn một nhân vật để bắt đầu"
                }
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
