"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, ArrowLeft, Briefcase, BookOpen, Lock, MessageCircle, GraduationCap, Check } from "lucide-react";
import { PERSONA_LIST, PERSONA_GROUPS, PersonaId, PersonaGroup, PERSONA_TOKENS } from "@/lib/personas";
import { GaIcon } from "@/components/ui-v2";
import { personaInk, personaSoft } from "@/lib/personaPaper";
import { PersonaCard } from "./PersonaCard";
import { usePersonaText } from "./personaText";
import { aiSpeakingApi, SpeakingSessionMode } from "@/lib/aiSpeakingApi";
import { interviewDomainApi, InterviewPersonaInfo } from "@/lib/interviewDomainApi";
import { getMyLearningProfile } from "@/lib/profileApi";
import { apiMessage, httpStatus } from "@/lib/api";
import { toastApiError } from "@/lib/toastApiError";
import { useLocale, useTranslations } from "next-intl";
import { useAiSpeakingQuota } from "@/hooks/useAiSpeakingQuota";
import { SpeakingQuotaBlockedBanner } from "./SpeakingQuotaBlockedBanner";
import { useChatStore } from "@/stores/useChatStore";
import { loadSpeakingSessionIntoStore } from "@/lib/speakingSessionBootstrap";
import { toast } from "sonner";
import { spring } from "@/lib/motion";
import { useStatusBarStyle } from "@/lib/statusBar";
import { lightImpact, mediumImpact } from "@/lib/haptics";


// Nhãn tra catalog v2.student.companionSelect lúc render (không gọi hook ngoài component).
const MODE_TABS = [
  { mode: "COMMUNICATION" as SpeakingSessionMode, labelKey: "modes.communication", icon: MessageCircle },
  { mode: "INTERVIEW" as SpeakingSessionMode, labelKey: "modes.interview", icon: Briefcase },
  { mode: "LESSON" as SpeakingSessionMode, labelKey: "modes.lesson", icon: GraduationCap },
];

// `id` là giá trị gửi API (experienceLevel) — giữ nguyên, chỉ nhãn đi qua catalog.
const EXPERIENCE_LEVELS = [
  { id: "0-6M", labelKey: "experience.upTo6Months" },
  { id: "6-12M", labelKey: "experience.sixTo12Months" },
  { id: "1-2Y", labelKey: "experience.oneToTwoYears" },
  { id: "3Y", labelKey: "experience.threeYears" },
  { id: "5Y", labelKey: "experience.fivePlusYears" },
];

export interface CompanionSelectProps {
  /** Live conversation engine to enter once the session is created. */
  chatHref?: string;
  /** Upgrade surface for the ADVANCED-persona paywall. */
  pricingHref?: string;
  /** "Back" target when the store carries no `returnPath`. */
  homeHref?: string;
  /**
   * "page"  — legacy full-viewport route.
   * "shell" — embedded in the /v2 GaShell `<main>` (already bounded) → fill it instead of
   *           stacking a second 100vh block inside the scroll container.
   */
  layout?: "page" | "shell";
}

export function CompanionSelect({
  chatHref = "/speaking/chat",
  pricingHref = "/student/pricing",
  homeHref = "/",
  layout = "page",
}: CompanionSelectProps = {}) {
  // Warm paper → dark glyphs in the iOS status bar.
  useStatusBarStyle("light");
  const router = useRouter();
  const searchParams = useSearchParams();
  const minHeightClass = layout === "shell" ? "min-h-full" : "min-h-screen";
  const t = useTranslations("speaking");
  const tc = useTranslations("v2.student.companionSelect");
  const tCommon = useTranslations("v2.common");
  const locale = useLocale();
  // Nhãn persona/nhóm/vị trí/kịch bản: lớp phủ dịch trên dữ liệu lib/personas.ts (không đổi dữ liệu
  // vì `desc` còn gửi làm personality cho AI và `label` là giá trị gửi API).
  const personaText = usePersonaText();
  const { quota, quotaBlocked, quotaLoading } = useAiSpeakingQuota();
  const { returnPath, setReturnPath } = useChatStore();
  
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
    if (cefr && ['A1', 'A2', 'B1', 'B2'].includes(cefr)) {
      cefrFromUrlRef.current = true
      setCefrLevel(cefr)
    }
  }, [searchParams])

  // Mặc định CEFR theo trình độ THẬT trong hồ sơ thay vì hằng "B1" (QA 09/08 mục F):
  // màn này không có bộ chọn CEFR nên giá trị mặc định là thứ duy nhất học viên nhận được.
  // URL ?cefr= (deep-link từ lộ trình) vẫn được ưu tiên.
  const cefrFromUrlRef = useRef(false)
  useEffect(() => {
    getMyLearningProfile()
      .then((p) => {
        if (cefrFromUrlRef.current || !p.currentLevel) return
        const clamped = p.currentLevel === 'A0' ? 'A1'
          : ['A1', 'A2', 'B1', 'B2'].includes(p.currentLevel) ? p.currentLevel
          : 'B2' // C1/C2 trong hồ sơ — trần luyện tập của app là B2
        setCefrLevel(clamped)
      })
      .catch(() => {}) // giữ mặc định B1 khi chưa có hồ sơ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mode from the URL (?mode=INTERVIEW|LESSON). The /v2 speaking launcher has one card per mode,
  // so the card can land directly on the right tab. Applied ONCE on mount — otherwise every
  // re-render would snap the user back to the URL's mode after they switch tabs.
  const urlModeAppliedRef = useRef(false);
  useEffect(() => {
    if (urlModeAppliedRef.current) return;
    const m = (searchParams.get('mode') ?? '').toUpperCase();
    if (m !== 'INTERVIEW' && m !== 'LESSON') return;
    urlModeAppliedRef.current = true;
    setSessionMode(m as SpeakingSessionMode);
    if (m === 'LESSON') setActiveGroup('special');
  }, [searchParams])

  // Remember where the user came from (e.g. the v2 launcher) so back / exit can
  // return them into v2 instead of the legacy home. Only set when present so the
  // value survives intra-flow navigation (re-pick companion, restart).
  useEffect(() => {
    const rp = searchParams.get('return')
    if (rp) setReturnPath(rp)
  }, [searchParams, setReturnPath])

  useEffect(() => {
    if (sessionMode === "INTERVIEW" && dbPersonas.length === 0) {
      interviewDomainApi.listPersonas().then(setDbPersonas).catch(() => {});
    }
  }, [sessionMode, dbPersonas.length])

  // QA 09/08 mục E: KHÔNG auto-gán vị trí ứng tuyển. Bản cũ gán roleTitle của NGƯỜI PHỎNG VẤN
  // ("Senior Tech Lead") — ngược vai với vị trí ỨNG VIÊN ứng tuyển, vượt qua cổng isReady và
  // ghi sai vào lịch sử. Học viên phải tự chọn; chưa chọn thì CTA giữ trạng thái nhắc.

  const isPersonaLocked = (personaId: string) => {
    if (!quota || quota.planCode !== "FREE") return false;
    const dbP = dbPersonas.find(p => p.code === personaId.toUpperCase());
    return dbP?.difficulty === "ADVANCED";
  };

  const selectedPersona = selected ? PERSONA_LIST.find((p) => p.id === selected) : null;
  // Persona accents were picked for the old dark surface; on paper they only carry text
  // after being darkened to AA (lib/personaPaper).
  const selectedInk = selectedPersona ? personaInk(selectedPersona.accent) : "var(--ga-ink)";

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
    mediumImpact();
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

      // QA 09/08 mục H: mọi persona LESSON (Tuấn/Lan/Minh) dạy band A1 cho người mới —
      // phiên LESSON chốt A1 thay vì cefrLevel hồ sơ (header từng ghi "· B1" trong bài A1).
      const sessionCefr = sessionMode === "LESSON" ? "A1" : cefrLevel;

      const res = await aiSpeakingApi.createSession(
        topicForApi ?? "Alltag",
        // QA 09/08 mục F: bản cũ hardcode "C1" cho mọi phiên phỏng vấn — học viên B1 bị hỏi ở
        // mức C1 (mức không thể tự chọn) và kết quả kém làm ô nhiễm SpeakingUserState.
        sessionCefr,
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
        personality: token.desc,
        cefrLevel: sessionCefr,
      };

      // Same store bootstrap as the class-assignment entry point (lib/speakingSessionBootstrap).
      loadSpeakingSessionIntoStore({
        session,
        companion,
        sessionMode,
        topic: topicForApi ?? null,
        experienceLevel: sessionMode === "INTERVIEW" ? experienceLevel : null,
      });

      router.push(chatHref);
    } catch (error) {
      console.error("Failed to create session", error);

      const status = httpStatus(error);
      const message = apiMessage(error);

      if (status === 401) {
        setCreateSessionError(tc("errors.sessionExpired"));
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            // Component này dùng chung cho /speaking (v1) và ba trang /v2/student/speaking*,
            // /v2/student/interviews. Bề mặt đăng nhập DUY NHẤT giờ là /v2/login (next.config đá
            // /login sang đây) → trỏ thẳng, để trang v2 không còn đường nào rơi ngược vào cây v1.
            window.location.href = '/v2/login';
          }
        }, 1500);
      } else if (status === 403) {
        setCreateSessionError(message || tc("errors.forbidden"));
      } else if (status === 409) {
        setCreateSessionError(message || tc("errors.tooSoon"));
      } else if (status === 429) {
        setCreateSessionError(t("errorQuota"));
        toastApiError(error, { quotaMessage: t("errorQuota") });
      } else if (status >= 500) {
        setCreateSessionError(tc("errors.server"));
      } else {
        setCreateSessionError(message || tc("errors.generic"));
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
    return topic ? tc("suggestedTopic", { topic }) : null
  }, [sessionMode, searchParams, tc])

  return (
    <div data-native-page className={`${minHeightClass} flex flex-col w-full bg-ga-bg text-ga-ink`}>
      <div className={`max-w-[520px] mx-auto w-full flex flex-col ${minHeightClass}`}>
        {/* ── Header ── */}
        <div className="px-5 pt-6 pb-3 flex-shrink-0">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <motion.button onClick={() => router.push(returnPath || homeHref)} className="ga-ui flex items-center gap-2 mb-4 text-ga-muted transition-colors hover:text-ga-ink" whileTap={{ scale: 0.92 }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-full border border-ga-line bg-ga-card">
                <ArrowLeft size={15} />
              </div>
              <span className="text-sm">{returnPath ? tCommon("back") : tc("home")}</span>
            </motion.button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-ga-gold" />
              <span className="ga-ui text-[11px] font-semibold tracking-[0.08em] uppercase text-ga-gold">DeutschFlow AI</span>
            </div>
            {/* Same title as the mobile screen so both platforms read identically. */}
            <h1 className="font-ga-display text-[28px] font-medium leading-tight text-ga-ink">{tc("title")}</h1>
            <p className="ga-ui text-sm mt-1 text-ga-muted">{tc("subtitle")}</p>
          </motion.div>
        </div>

        {/* ── Mode Selection (3 tabs) — same shape as the mobile picker ── */}
        <div className="px-5 pb-3">
          <motion.div className="flex gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {MODE_TABS.map(({ mode, labelKey, icon: ModeIcon }) => {
              const active = sessionMode === mode;
              return (
                <button key={mode} onClick={() => handleModeChange(mode)}
                  className={`ga-ui flex-1 flex flex-col items-center gap-1 py-3 rounded-ga border text-sm font-semibold transition-colors ${
                    active
                      ? "border-ga-yellow bg-ga-yellow text-ga-ink"
                      : "border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink"
                  }`}
                >
                  <ModeIcon size={20} />
                  {tc(labelKey)}
                </button>
              );
            })}
          </motion.div>
        </div>

        {quickPick && (
          <div className="px-5 pb-2">
            <div className="ga-ui rounded-ga border border-ga-line bg-ga-card px-4 py-3 text-sm text-ga-muted">
              {quickPick}
            </div>
          </div>
        )}

        {/* ── Group Tabs ── */}
        <div className="px-4 pb-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {filteredGroups.map((g) => (
              <motion.button key={g.id} onClick={() => { setActiveGroup(g.id); setSelected(null); }}
                aria-label={personaText.groupLabel(g.id)}
                aria-pressed={activeGroup === g.id}
                className={`ga-ui flex items-center gap-1.5 px-3 py-1.5 rounded-ga-pill border text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeGroup === g.id
                    ? "border-ga-yellow bg-ga-yellow-soft text-ga-gold"
                    : "border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink"
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <GaIcon name={g.icon} size={13} />
                <span>{personaText.groupLabel(g.id)}</span>
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
                      lightImpact();
                      setLockedNudge(false);
                      setSelected(persona.id);
                      setInterviewPosition(null);
                      setLessonScenario(null);
                    }}
                  />
                  {locked && (
                    <div className="absolute inset-0 rounded-ga flex items-center justify-center" style={{ background: "rgba(251,250,247,0.65)", backdropFilter: "blur(2px)" }}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ga-line bg-ga-card">
                        <Lock size={18} className="text-ga-gold" />
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredPersonas.length === 0 && (
              <p className="ga-ui text-center w-full text-ga-subtle text-sm py-8">
                {tc("emptyGroup")}
              </p>
            )}
          </div>

          {/* PRO paywall nudge */}
          <AnimatePresence>
            {lockedNudge && sessionMode === "INTERVIEW" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="mt-3 rounded-ga border border-ga-yellow bg-ga-yellow-soft px-4 py-3 flex items-start gap-3"
              >
                <Lock size={16} className="text-ga-gold mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="ga-ui text-sm text-ga-ink font-semibold">{tc("pro.title")}</p>
                  <p className="ga-ui text-xs text-ga-muted mt-0.5">{tc("pro.desc")}</p>
                </div>
                <button
                  onClick={() => router.push(pricingHref)}
                  className="ga-ui shrink-0 text-xs font-bold text-ga-gold hover:text-ga-ink transition-colors whitespace-nowrap"
                >
                  {tc("pro.upgrade")}
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
                  <Briefcase size={14} style={{ color: selectedInk }} />
                  <span className="ga-ui text-xs font-bold uppercase tracking-[0.08em]" style={{ color: selectedInk }}>{tc("positionLabel")}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    return (selectedPersona.interviewPositions || []).map((pos) => (
                      <motion.button
                        key={pos.id}
                        onClick={() => setInterviewPosition(pos.label)}
                        className="flex items-center justify-between px-4 py-3 rounded-ga text-left transition-colors"
                        style={{
                          background: interviewPosition === pos.label ? personaSoft(selectedPersona.accent, 0.13) : "var(--ga-card)",
                          border: interviewPosition === pos.label ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid var(--ga-line)",
                        }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="min-w-0 break-words">
                          <span className="ga-ui text-sm font-semibold text-ga-ink">{personaText.positionLabel(selectedPersona.id, pos.id)}</span>
                          {/* Với locale de nhãn chính đã là labelDe → không lặp lại phụ đề tiếng Đức. */}
                          {locale !== "de" && <span className="ga-ui text-xs ml-2 text-ga-muted">{pos.labelDe}</span>}
                        </div>
                        {interviewPosition === pos.label && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: selectedInk }}>
                            <Check size={12} className="text-white" aria-hidden />
                          </motion.div>
                        )}
                      </motion.button>
                    ));
                  })()}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={14} style={{ color: selectedInk }} />
                  <span className="ga-ui text-xs font-bold uppercase tracking-[0.08em]" style={{ color: selectedInk }}>{tc("experienceLabel")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_LEVELS.map((exp) => (
                    <motion.button
                      key={exp.id}
                      onClick={() => setExperienceLevel(exp.id)}
                      className="ga-ui px-3.5 py-2 rounded-ga-pill text-xs font-semibold transition-colors"
                      style={{
                        background: experienceLevel === exp.id ? personaSoft(selectedPersona.accent, 0.13) : "var(--ga-card)",
                        border: experienceLevel === exp.id ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid var(--ga-line)",
                        color: experienceLevel === exp.id ? selectedInk : "var(--ga-muted)",
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {tc(exp.labelKey)}
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
                  <BookOpen size={14} style={{ color: selectedInk }} />
                  <span className="ga-ui text-xs font-bold uppercase tracking-[0.08em]" style={{ color: selectedInk }}>{tc("scenarioLabel")}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(selectedPersona.lessonScenarios || []).map((sc) => (
                    <motion.button key={sc.id} onClick={() => setLessonScenario(sc.label)}
                      className="flex items-center justify-between px-4 py-3 rounded-ga text-left transition-colors"
                      style={{
                        background: lessonScenario === sc.label ? personaSoft(selectedPersona.accent, 0.13) : "var(--ga-card)",
                        border: lessonScenario === sc.label ? `1.5px solid ${selectedPersona.accent}` : "1.5px solid var(--ga-line)",
                      }} whileTap={{ scale: 0.98 }}>
                      <div className="min-w-0 break-words">
                        <span className="ga-ui text-sm font-semibold text-ga-ink">{personaText.scenarioLabel(selectedPersona.id, sc.id)}</span>
                        {locale !== "de" && <span className="ga-ui text-xs ml-2 text-ga-muted">{sc.labelDe}</span>}
                      </div>
                      {lessonScenario === sc.label && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: selectedInk }}>
                          <Check size={12} className="text-white" aria-hidden />
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
          {quotaBlocked && <SpeakingQuotaBlockedBanner compact upgradeHref={pricingHref} />}
          <AnimatePresence mode="wait">
            {isReady && selectedPersona ? (
              <motion.button key="cta-active"
                className="ga-ui w-full flex items-center justify-center gap-2.5 py-4 rounded-ga font-bold text-base text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                // Flat ink fill instead of the old neon gradient + drop shadow: on paper the
                // persona hue reads as a solid block, matching the mobile start button.
                style={{ background: selectedInk }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                transition={spring.gentle}
                whileTap={{ scale: 0.97, y: 3 }} onClick={handleConfirm} disabled={confirming || quotaBlocked || quotaLoading}>
                {confirming ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}>
                    <Sparkles size={18} />
                  </motion.div>
                ) : (
                  <>
                    {sessionMode === "INTERVIEW" ? tc("cta.interview", { name: selectedPersona.name })
                      : sessionMode === "LESSON" ? tc("cta.lesson", { name: selectedPersona.name })
                      : tc("cta.start", { name: selectedPersona.name })}
                    <ChevronRight size={18} />
                  </>
                )}
              </motion.button>
            ) : (
              <motion.p key="cta-hint" className="ga-ui text-center text-sm text-ga-subtle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!selected ? tc("hint.pickPersona")
                  : sessionMode === "INTERVIEW" ? tc("hint.pickPosition")
                  : sessionMode === "LESSON" ? tc("hint.pickScenario")
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
                className="ga-ui mt-3 rounded-ga border border-ga-red bg-ga-red-soft px-4 py-3 text-sm text-ga-red"
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
