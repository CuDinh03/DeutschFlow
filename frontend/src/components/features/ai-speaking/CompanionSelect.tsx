"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, ArrowLeft, Briefcase, Clock, GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { PERSONA_LIST, PERSONA_GROUPS, PersonaId, PersonaGroup, PERSONA_TOKENS } from "@/lib/personas";
import { PersonaCard } from "./PersonaCard";
import { aiSpeakingApi, SpeakingSessionMode, ExperienceLevel } from "@/lib/aiSpeakingApi";
import { useChatStore } from "@/stores/useChatStore";

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
  const [activeGroup, setActiveGroup] = useState<PersonaGroup>('it');

  // Interview-specific state
  const [interviewPosition, setInterviewPosition] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [cefrLevel, setCefrLevel] = useState<string>("A1");
  // Lesson-specific state
  const [lessonScenario, setLessonScenario] = useState<string | null>(null);

  const selectedPersona = selected ? PERSONA_LIST.find((p) => p.id === selected) : null;

  // Filter personas by active group AND mode restrictions
  const filteredPersonas = useMemo(() => {
    let personas = PERSONA_LIST.filter(p => p.group === activeGroup);
    if (sessionMode === "INTERVIEW") {
      personas = personas.filter(p => p.supportsInterview);
    } else if (sessionMode === "LESSON") {
      personas = personas.filter(p => p.supportsLesson);
    }
    return personas;
  }, [activeGroup, sessionMode]);

  // Filter groups based on mode
  const filteredGroups = useMemo(() => {
    if (sessionMode === "INTERVIEW") {
      return PERSONA_GROUPS.filter(g => g.id !== 'special');
    }
    if (sessionMode === "LESSON") {
      return PERSONA_GROUPS.filter(g => g.id === 'special');
    }
    return PERSONA_GROUPS;
  }, [sessionMode]);

  // Check if setup is complete
  const isReady = useMemo(() => {
    if (!selected) return false;
    if (sessionMode === "INTERVIEW") return !!(interviewPosition && experienceLevel && cefrLevel);
    if (sessionMode === "LESSON") return !!lessonScenario;
    return true;
  }, [selected, sessionMode, interviewPosition, experienceLevel, cefrLevel, lessonScenario]);

  const handleConfirm = async () => {
    if (!selected || !selectedPersona || confirming || !isReady) return;
    setConfirming(true);

    try {
      const topicForApi = sessionMode === "LESSON" ? lessonScenario
        : sessionMode === "INTERVIEW" ? interviewPosition
        : "Alltag";

      const res = await aiSpeakingApi.createSession(
        topicForApi ?? "Alltag",
        cefrLevel,
        selected.toUpperCase(),
        "V1",
        sessionMode,
        sessionMode === "INTERVIEW" ? interviewPosition : (sessionMode === "LESSON" ? lessonScenario : null),
        sessionMode === "INTERVIEW" ? experienceLevel : null,
      );
      
      const session = res.data;
      const token = PERSONA_TOKENS[selected];
      
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

  const handleModeChange = (mode: SpeakingSessionMode) => {
    setSessionMode(mode);
    setSelected(null);
    setInterviewPosition(null);
    setExperienceLevel(null);
    setLessonScenario(null);
    // Auto-switch to correct group tab
    if (mode === "LESSON") setActiveGroup('special');
    else if (mode === "INTERVIEW" && activeGroup === 'special') setActiveGroup('it');
  };

  return (
    <div className="min-h-screen flex flex-col w-full" style={{ background: "#080818", color: "#fff" }}>
      <div className="max-w-[520px] mx-auto w-full flex flex-col min-h-screen">
        {/* ── Header ── */}
        <div className="px-5 pt-14 pb-3 flex-shrink-0">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <motion.button onClick={() => router.push("/")} className="flex items-center gap-2 mb-4" style={{ color: "rgba(255,255,255,0.5)" }} whileTap={{ scale: 0.92 }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <ArrowLeft size={15} />
              </div>
              <span className="text-sm">Trang chủ</span>
            </motion.button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} style={{ color: "#FFCD00" }} />
              <span className="text-[11px] font-black tracking-widest uppercase" style={{ color: "#FFCD00" }}>DeutschFlow AI</span>
            </div>
            <h1 className="font-black text-2xl leading-tight text-white">Wähle deinen</h1>
            <h1 className="font-black text-2xl leading-tight" style={{ color: "#FFCD00" }}>Begleiter</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>Ai sẽ đồng hành cùng bạn hôm nay?</p>
          </motion.div>
        </div>

        {/* ── Mode Selection (3 tabs) ── */}
        <div className="px-5 pb-3">
          <motion.div className="flex bg-white/5 p-1 rounded-2xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {([
              { mode: "COMMUNICATION" as SpeakingSessionMode, label: "Hội thoại" },
              { mode: "INTERVIEW" as SpeakingSessionMode, label: "Phỏng vấn" },
              { mode: "LESSON" as SpeakingSessionMode, label: "Luyện tập" },
            ]).map(({ mode, label }) => (
              <button key={mode} onClick={() => handleModeChange(mode)}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                  sessionMode === mode ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
                }`}
                style={sessionMode === mode && mode === "LESSON" ? { color: "#FFCD00" } : sessionMode === mode && mode === "INTERVIEW" ? { color: "#FFCD00" } : {}}
              >
                {label}
              </button>
            ))}
          </motion.div>
        </div>

        {/* ── Group Tabs ── */}
        <div className="px-4 pb-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {filteredGroups.map((g) => (
              <motion.button key={g.id} onClick={() => { setActiveGroup(g.id); setSelected(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeGroup === g.id ? "bg-white/15 text-white" : "bg-white/5 text-white/40 hover:text-white/60"
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <span>{g.icon}</span>
                <span>{g.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Persona Cards ── */}
        <div className="flex-1 px-4 overflow-y-auto pb-4">
          <div className="flex gap-3 flex-wrap">
            {filteredPersonas.map((persona, idx) => (
              <PersonaCard key={persona.id} persona={persona} isSelected={selected === persona.id} index={idx}
                onClick={() => { setSelected(persona.id); setInterviewPosition(null); setLessonScenario(null); }}
              />
            ))}
            {filteredPersonas.length === 0 && (
              <p className="text-center w-full text-white/30 text-sm py-8">
                Không có nhân vật nào cho chế độ này trong nhóm đã chọn.
              </p>
            )}
          </div>
        </div>

        {/* ── Interview Setup ── */}
        <AnimatePresence>
          {sessionMode === "INTERVIEW" && selectedPersona && (
            <motion.div className="px-5 pb-3 space-y-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              {/* Position */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>Vị trí ứng tuyển</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(selectedPersona.interviewPositions || []).map((pos) => (
                    <motion.button key={pos.id} onClick={() => setInterviewPosition(pos.label)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                      style={{
                        background: interviewPosition === pos.label ? `${selectedPersona.accent}22` : "rgba(255,255,255,0.04)",
                        border: interviewPosition === pos.label ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid rgba(255,255,255,0.06)",
                      }} whileTap={{ scale: 0.98 }}>
                      <div>
                        <span className="text-sm font-semibold text-white">{pos.label}</span>
                        <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{pos.labelDe}</span>
                      </div>
                      {interviewPosition === pos.label && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: selectedPersona.accent }}>
                          <span className="text-white text-xs">✓</span>
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
              {/* Experience */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>Kinh nghiệm</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_LEVELS.map((exp) => (
                    <motion.button key={exp.id} onClick={() => setExperienceLevel(exp.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: experienceLevel === exp.id ? `${selectedPersona.accent}22` : "rgba(255,255,255,0.04)",
                        border: experienceLevel === exp.id ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid rgba(255,255,255,0.06)",
                        color: experienceLevel === exp.id ? selectedPersona.accent : "rgba(255,255,255,0.6)",
                      }} whileTap={{ scale: 0.95 }}>{exp.label}</motion.button>
                  ))}
                </div>
              </div>
              {/* CEFR */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>Trình độ</span>
                </div>
                <div className="flex gap-2">
                  {CEFR_LEVELS.map((lvl) => (
                    <motion.button key={lvl} onClick={() => setCefrLevel(lvl)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: cefrLevel === lvl ? `${selectedPersona.accent}22` : "rgba(255,255,255,0.04)",
                        border: cefrLevel === lvl ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid rgba(255,255,255,0.06)",
                        color: cefrLevel === lvl ? selectedPersona.accent : "rgba(255,255,255,0.5)",
                      }} whileTap={{ scale: 0.95 }}>{lvl}</motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Lesson Setup ── */}
        <AnimatePresence>
          {sessionMode === "LESSON" && selectedPersona && (
            <motion.div className="px-5 pb-3 space-y-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>Chủ đề bài học</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(selectedPersona.lessonScenarios || []).map((sc) => (
                    <motion.button key={sc.id} onClick={() => setLessonScenario(sc.label)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                      style={{
                        background: lessonScenario === sc.label ? `${selectedPersona.accent}22` : "rgba(255,255,255,0.04)",
                        border: lessonScenario === sc.label ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid rgba(255,255,255,0.06)",
                      }} whileTap={{ scale: 0.98 }}>
                      <div>
                        <span className="text-sm font-semibold text-white">{sc.label}</span>
                        <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{sc.labelDe}</span>
                      </div>
                      {lessonScenario === sc.label && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: selectedPersona.accent }}>
                          <span className="text-white text-xs">✓</span>
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CTA ── */}
        <div className="px-4 pb-10 flex-shrink-0 mt-2">
          <AnimatePresence mode="wait">
            {isReady && selectedPersona ? (
              <motion.button key="cta-active"
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[18px] font-black text-base text-white"
                style={{ background: `linear-gradient(135deg, ${selectedPersona.ctaFrom}, ${selectedPersona.ctaTo})`, boxShadow: selectedPersona.ctaShadow }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                whileTap={{ scale: 0.97, y: 3 }} onClick={handleConfirm} disabled={confirming}>
                {confirming ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}>
                    <Sparkles size={18} />
                  </motion.div>
                ) : (
                  <>
                    {sessionMode === "INTERVIEW" ? `Phỏng vấn với ${selectedPersona.name}`
                      : sessionMode === "LESSON" ? `Luyện tập với ${selectedPersona.name}`
                      : `Bắt đầu với ${selectedPersona.name}`}
                    <ChevronRight size={18} />
                  </>
                )}
              </motion.button>
            ) : (
              <motion.p key="cta-hint" className="text-center text-sm" style={{ color: "rgba(255,255,255,0.25)" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!selected ? "Vui lòng chọn một nhân vật"
                  : sessionMode === "INTERVIEW" ? "Chọn vị trí, kinh nghiệm và trình độ"
                  : sessionMode === "LESSON" ? "Chọn chủ đề bài học"
                  : ""}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
