"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, ArrowLeft, Briefcase, BookOpen, Lock } from "lucide-react";
import { PERSONA_LIST, PERSONA_GROUPS, PersonaId, PersonaGroup, PERSONA_TOKENS } from "@/lib/personas";
import { PersonaCard } from "./PersonaCard";
import { aiSpeakingApi, SpeakingSessionMode } from "@/lib/aiSpeakingApi";
import { interviewDomainApi, InterviewPersonaInfo } from "@/lib/interviewDomainApi";
import { apiMessage, httpStatus } from "@/lib/api";
import { toastApiError } from "@/lib/toastApiError";
import { useTranslations } from "next-intl";
import { useAiSpeakingQuota } from "@/hooks/useAiSpeakingQuota";
import { SpeakingQuotaBlockedBanner } from "./SpeakingQuotaBlockedBanner";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";
import { spring } from "@/lib/motion";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];

export function CompanionSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("speaking");
  const { quota, quotaBlocked, quotaLoading } = useAiSpeakingQuota();
  const {
    setSessionId,
    setSelectedCompanion,
    setResponseSchema,
    clearChat,
    addMessage,
    setSessionMode: storeSetSessionMode,
    setExperienceLevel: storeSetExperienceLevel,
    setSessionTopic,
    setAdaptiveMeta,
    setPendingRepairGate,
    setInterviewUiHints,
  } = useChatStore();
  
  const [selected, setSelected] = useState<PersonaId | null>(null);
  const [sessionMode, setSessionMode] = useState<SpeakingSessionMode>("COMMUNICATION");
  const [confirming, setConfirming] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<PersonaGroup>('it');

  // Interview-specific state
  const [interviewPosition, setInterviewPosition] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>("1-2Y");
  const [cefrLevel, setCefrLevel] = useState<string>("B1");
  const [dbPersonas, setDbPersonas] = useState<InterviewPersonaInfo[]>([]);
  const [lockedNudge, setLockedNudge] = useState(false);
  // Lesson-specific state
  const [lessonScenario, setLessonScenario] = useState<string | null>(null);

  useEffect(() => {
    const topic = searchParams.get('topic')
    const cefr = searchParams.get('cefr')
    if (topic) setLessonScenario(topic)
    if (cefr && ['A1', 'A2', 'B1', 'B2'].includes(cefr)) setCefrLevel(cefr)
  }, [searchParams])

  useEffect(() => {
    if (sessionMode === "INTERVIEW" && dbPersonas.length === 0) {
      interviewDomainApi.listPersonas().then(setDbPersonas).catch(() => {});
    }
  }, [sessionMode, dbPersonas.length])

  // Auto-set interview position from DB persona when a persona is selected
  useEffect(() => {
    if (sessionMode !== "INTERVIEW" || !selected) return;
    const match = dbPersonas.find(p => p.code === selected.toUpperCase());
    if (match) setInterviewPosition(match.roleTitle);
  }, [selected, dbPersonas, sessionMode])

  const isPersonaLocked = (personaId: string) => {
    if (!quota || quota.planCode !== "FREE") return false;
    const dbP = dbPersonas.find(p => p.code === personaId.toUpperCase());
    return dbP?.difficulty === "ADVANCED";
  };

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
    if (sessionMode === "INTERVIEW") return !!(interviewPosition && experienceLevel);
    if (sessionMode === "LESSON") return !!lessonScenario;
    return true;
  }, [selected, sessionMode, interviewPosition, experienceLevel, lessonScenario]);

  const handleConfirm = async () => {
    if (!selected || !selectedPersona || confirming || !isReady) return;
    if (quotaBlocked) {
      toast.error(t("errorQuota"));
      return;
    }
    setConfirming(true);
    setCreateSessionError(null);

    try {
      const topicForApi = sessionMode === "LESSON" ? lessonScenario
        : sessionMode === "INTERVIEW" ? interviewPosition
        : "Alltag";

      const res = await aiSpeakingApi.createSession(
        topicForApi ?? "Alltag",
        sessionMode === "INTERVIEW" ? "C1" : cefrLevel,
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
        cefrLevel: sessionMode === "INTERVIEW" ? "C1" : cefrLevel,
      };

      clearChat();
      setSessionId(session.id);
      setResponseSchema(
        (session.responseSchema === "V2" ? "V2" : "V1")
      );
      setSelectedCompanion(companion);
      storeSetSessionMode(sessionMode);
      setSessionTopic(topicForApi ?? null);
      if (sessionMode === "INTERVIEW") {
        storeSetExperienceLevel(experienceLevel);
      }

      if (session.initialAiMessage?.adaptive) {
        setAdaptiveMeta(session.initialAiMessage.adaptive);
        const a = session.initialAiMessage.adaptive;
        if (a.forceRepairBeforeContinue && a.primaryRepairErrorCode) {
          const err = session.initialAiMessage.errors?.find(
            (e) => e.errorCode === a.primaryRepairErrorCode
          );
          setPendingRepairGate({
            code: a.primaryRepairErrorCode,
            exampleCorrectDe: err?.exampleCorrectDe ?? undefined,
            ruleViShort: err?.ruleViShort ?? undefined,
          });
        }
      }

      if (session.initialAiMessage) {
        const init = session.initialAiMessage;
        if (init.interviewPhaseKey || init.interviewHintKey) {
          setInterviewUiHints(init.interviewPhaseKey ?? null, init.interviewHintKey ?? null);
        }
        addMessage({
          id: String(init.messageId || Date.now()),
          role: "ai",
          contentDe: init.aiSpeechDe,
          feedback: {
            errors: init.errors || [],
            explanationVi: init.explanationVi || "",
            suggestions: init.suggestions || [],
            correction: init.correction || null,
            grammarPoint: init.grammarPoint || null,
            action: init.action || null,
            status: init.status ?? null,
            feedbackText: init.feedback ?? null,
          },
        });
      }

      router.push("/speaking/chat");
    } catch (error) {
      console.error("Failed to create session", error);

      const status = httpStatus(error);
      const message = apiMessage(error);

      if (status === 401) {
        setCreateSessionError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }, 1500);
      } else if (status === 403) {
        setCreateSessionError(message || "Bạn không có quyền tạo phiên luyện nói.");
      } else if (status === 409) {
        setCreateSessionError(message || "Vui lòng chờ vài giây trước khi tạo phiên mới.");
      } else if (status === 429) {
        setCreateSessionError(t("errorQuota"));
        toastApiError(error, { quotaMessage: t("errorQuota") });
      } else if (status >= 500) {
        setCreateSessionError("Máy chủ đang gặp sự cố. Vui lòng thử lại sau.");
      } else {
        setCreateSessionError(message || "Không thể tạo phiên luyện nói. Vui lòng thử lại!");
      }

      setConfirming(false);
    }
  };

  const handleModeChange = (mode: SpeakingSessionMode) => {
    setSessionMode(mode);
    setSelected(null);
    setInterviewPosition(null);
    setExperienceLevel("1-2Y");
    setLessonScenario(null);
    setLockedNudge(false);
    // Auto-switch to correct group tab
    if (mode === "LESSON") setActiveGroup('special');
    else if (mode === "INTERVIEW" && activeGroup === 'special') setActiveGroup('it');
  };

  const quickPick = useMemo(() => {
    if (sessionMode !== 'LESSON') return null
    const topic = searchParams.get('topic')
    return topic ? `Chủ đề đề xuất: ${topic}` : null
  }, [sessionMode, searchParams])

  return (
    <div className="min-h-screen flex flex-col w-full" style={{ background: "#080818", color: "#fff" }}>
      <div className="max-w-[520px] mx-auto w-full flex flex-col min-h-screen">
        {/* ── Header ── */}
        <div className="px-5 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-3 flex-shrink-0">
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

        {quickPick && (
          <div className="px-5 pb-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              {quickPick}
            </div>
          </div>
        )}

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
            {filteredPersonas.map((persona, idx) => {
              const locked = sessionMode === "INTERVIEW" && isPersonaLocked(persona.id);
              return (
                <div key={persona.id} className="relative" style={{ width: "calc(50% - 6px)" }}>
                  <PersonaCard persona={persona} isSelected={selected === persona.id} index={idx}
                    onClick={() => {
                      if (locked) { setLockedNudge(true); return; }
                      setLockedNudge(false);
                      setSelected(persona.id);
                      setInterviewPosition(null);
                      setLessonScenario(null);
                    }}
                  />
                  {locked && (
                    <div className="absolute inset-0 rounded-3xl flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}>
                      <Lock size={20} className="text-yellow-400" />
                    </div>
                  )}
                </div>
              );
            })}
            {filteredPersonas.length === 0 && (
              <p className="text-center w-full text-white/30 text-sm py-8">
                Không có nhân vật nào cho chế độ này trong nhóm đã chọn.
              </p>
            )}
          </div>

          {/* PRO paywall nudge */}
          <AnimatePresence>
            {lockedNudge && sessionMode === "INTERVIEW" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="mt-3 rounded-2xl px-4 py-3 flex items-start gap-3"
                style={{ background: "rgba(255,205,0,0.08)", border: "1px solid rgba(255,205,0,0.25)" }}
              >
                <Lock size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-yellow-200 font-semibold">Nhân vật PRO</p>
                  <p className="text-xs text-white/50 mt-0.5">Nhân vật cấp độ ADVANCED chỉ dành cho gói PRO/ULTRA. Nâng cấp để luyện phỏng vấn chuyên sâu.</p>
                </div>
                <button
                  onClick={() => router.push("/student/pricing")}
                  className="shrink-0 text-xs font-black text-yellow-400 hover:text-yellow-300 transition-colors whitespace-nowrap"
                >
                  Nâng cấp →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Interview Setup ── */}
        <AnimatePresence>
          {sessionMode === "INTERVIEW" && selectedPersona && (
            <motion.div className="px-5 pb-3 space-y-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.gentle}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>Vị trí ứng tuyển</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    return (selectedPersona.interviewPositions || []).map((pos) => (
                      <motion.button
                        key={pos.id}
                        onClick={() => setInterviewPosition(pos.label)}
                        className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                        style={{
                          background: interviewPosition === pos.label ? `${selectedPersona.accent}22` : "rgba(255,255,255,0.04)",
                          border: interviewPosition === pos.label ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid rgba(255,255,255,0.06)",
                        }}
                        whileTap={{ scale: 0.98 }}
                      >
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
                    ));
                  })()}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={14} style={{ color: selectedPersona.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: selectedPersona.accent }}>Số năm kinh nghiệm</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "0-6M", label: "0–6 tháng" },
                    { id: "6-12M", label: "6–12 tháng" },
                    { id: "1-2Y", label: "1–2 năm" },
                    { id: "3Y", label: "3 năm" },
                    { id: "5Y", label: "5+ năm" },
                  ].map((exp) => (
                    <motion.button
                      key={exp.id}
                      onClick={() => setExperienceLevel(exp.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: experienceLevel === exp.id ? `${selectedPersona.accent}22` : "rgba(255,255,255,0.04)",
                        border: experienceLevel === exp.id ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid rgba(255,255,255,0.06)",
                        color: experienceLevel === exp.id ? selectedPersona.accent : "rgba(255,255,255,0.6)",
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {exp.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Lesson Setup ── */}
        <AnimatePresence>
          {sessionMode === "LESSON" && selectedPersona && (
            <motion.div className="px-5 pb-3 space-y-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.gentle}>
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
        <div className="px-4 pb-10 flex-shrink-0 mt-2 space-y-3">
          {quotaBlocked && <SpeakingQuotaBlockedBanner compact />}
          <AnimatePresence mode="wait">
            {isReady && selectedPersona ? (
              <motion.button key="cta-active"
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[18px] font-black text-base text-white disabled:opacity-40 disabled:pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${selectedPersona.ctaFrom}, ${selectedPersona.ctaTo})`, boxShadow: selectedPersona.ctaShadow }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                transition={spring.gentle}
                whileTap={{ scale: 0.97, y: 3 }} onClick={handleConfirm} disabled={confirming || quotaBlocked || quotaLoading}>
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
                  : sessionMode === "INTERVIEW" ? "Chọn vị trí và kinh nghiệm"
                  : sessionMode === "LESSON" ? "Chọn chủ đề bài học"
                  : ""}
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {createSessionError && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                role="alert"
              >
                {createSessionError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
