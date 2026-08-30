"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useTracking } from "@/hooks/useTracking";
import { getOnboardingRoute, getOnboardingMentor, getOnboardingMentorPreview, type OnboardingRouteData, type OnboardingMentorData } from "@/lib/profileApi";
import { getAccessToken } from "@/lib/authSession";
import { saveOnboardingDraft, readOnboardingDraft, clearOnboardingDraft, type OnboardingDraft } from "@/lib/onboardingDraft";
import { MENTOR_META } from "@/lib/mentorMeta";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useTranslations } from "next-intl";
import { GaBtn } from "@/components/ui-v2";
import { GaAuthShell } from "../authShared";

// ─────────────────────────────────────────────────────────────────────────────
// /v2/onboarding — Galerie 2.0 port of the legacy value-first funnel
// (src/app/(auth)/onboarding/page.tsx). LOGIC IS 1:1: same steps, same API calls
// (POST /onboarding/profile, /skill-tree/placement-test, GET /onboarding/route +
// /onboarding/mentor|preview/mentor), same guest draft replay, same PostHog events
// (dropping one would blind the funnel dashboards). Only the shell/tokens and the
// outbound routes change (/register → /v2/register, /student/roadmap →
// /v2/student/roadmap, /student/pricing → /v2/payment).
//
// This is a PUBLIC page: a GUEST (no account) runs the whole funnel here before
// signing up, so it wears GaAuthShell (the same chrome as /v2/login + /v2/register),
// NOT RoleShell — there is no role and no sidebar yet. Middleware exempts
// `/v2/onboarding` from the login bounce for exactly this reason.
// ─────────────────────────────────────────────────────────────────────────────

// Chỉ còn DỮ LIỆU. Nhãn/mô tả nằm ở messages/v2/onboarding.<locale>.json dưới khoá
// `level.<value>.label|desc` — hằng số ở đây không được mang copy nữa (GĐ 4).
const LEVELS = [
  { value: "A0", emoji: "🌱" },
  { value: "A1", emoji: "📗" },
  { value: "A2", emoji: "📘" },
  { value: "B1", emoji: "📙" },
  { value: "B2", emoji: "📕" },
];
// "Vì sao bạn học?" — the emotional anchor (Duolingo's first question, adapted for the
// Việt → Đức audience). Each maps to a coarse goalType the plan still uses (EXAM → CERT, else WORK).
const MOTIVATIONS = [
  { value: "JOB",         emoji: "💼", goal: "WORK" },
  { value: "AUSBILDUNG",  emoji: "🛠️", goal: "WORK" },
  { value: "STUDY",       emoji: "🎓", goal: "WORK" },
  { value: "IMMIGRATION", emoji: "🏠", goal: "WORK" },
  { value: "EXAM",        emoji: "📜", goal: "CERT" },
  { value: "HOBBY",       emoji: "✨", goal: "WORK" },
];
const EXAMS = ["GOETHE", "TELC", "TESTDAF"];
const WEEKLY = [
  { value: 3, emoji: "🔥" },
  { value: 5, emoji: "⚡" },
  { value: 7, emoji: "🚀" },
];
const INDUSTRIES = ["IT","Medizin","Gastronomie","Bildung","Handel","Sport","Andere"];

// Post-funnel destinations on the v2 surface (the legacy funnel pushed to /student/*).
const ROADMAP_ROUTE = "/v2/student/roadmap";
const PRICING_ROUTE = "/v2/payment";

interface PQ { id: number; skillSection: string; type: string; questionDe: string; questionVi: string; audioTranscript?: string; options?: string[]; }

export default function V2OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("v2.onboarding");
  const { trackOnboardingStep, trackEvent } = useTracking();
  // A/B: the mentor PRO-upsell nudge is gated behind a PostHog feature flag. Default-on
  // (undefined = flag not configured → shown), so no regression until an experiment is run.
  const mentorUpsellEnabled = useFeatureFlagEnabled("onboarding-mentor-upsell") !== false;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentLevel, setCurrentLevel] = useState("A0");
  const [motivation, setMotivation] = useState("JOB");
  const [goalType, setGoalType] = useState("WORK");   // derived from motivation (EXAM → CERT, else WORK)
  const [industry, setIndustry] = useState("IT");
  const [examType, setExamType] = useState("GOETHE");
  const [targetLevel, setTargetLevel] = useState("B1");
  const [weeklyTarget, setWeeklyTarget] = useState(5);
  // Daily-goal minutes (the streak anchor) derived from the weekly cadence the user picks.
  const dailyGoalMinutes = weeklyTarget >= 7 ? 20 : weeklyTarget >= 5 ? 15 : 10;

  // Placement test state
  const [testId, setTestId] = useState<string|null>(null);
  const [questions, setQuestions] = useState<PQ[]>([]);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [testResult, setTestResult] = useState<{passed:boolean;scorePercent:number;correctCount:number;totalQuestions:number;weakModules?:number[];startingNodeId?:number;retryAfterDays?:number}|null>(null);
  const [route, setRoute] = useState<OnboardingRouteData | null>(null);
  const [mentor, setMentor] = useState<OnboardingMentorData | null>(null);
  // Value-first: A1+ are OFFERED a skippable placement test after they commit, not gated by it.
  const [placementOffer, setPlacementOffer] = useState(false);
  // Value-first auth inversion (Phase C): a guest runs the funnel + quick win BEFORE signing up.
  const [isGuest, setIsGuest] = useState(false);          // no access token on mount
  const [resuming, setResuming] = useState(false);        // authed, replaying a guest draft after signup
  const [quickWinChoice, setQuickWinChoice] = useState<string | null>(null);

  const fetchMentor = useCallback(async () => {
    try {
      // Guests use the public preview endpoint (no auth); authed users use the live one.
      const fetch = isGuest ? getOnboardingMentorPreview : getOnboardingMentor;
      setMentor(await fetch(goalType, industry, currentLevel));
    } catch { /* mentor preview is non-blocking */ }
  }, [isGuest, goalType, industry, currentLevel]);

  /**
   * Persist the onboarding profile. Returns true on success. Surfaces real
   * failures instead of silently swallowing them, so callers can BLOCK the
   * redirect and avoid leaving the user with an incomplete profile
   * (data-integrity fix, design §5 DI-3).
   *
   * 409 cũng trả true — hành vi có sẵn từ trước. Chú thích cũ giải thích nó là
   * "hồ sơ đã tồn tại, idempotent", điều đó SAI: endpoint UPSERT và trả 201, nên
   * 409 duy nhất có thể tới là optimistic-lock/data-integrity lúc commit, tức
   * ghi hỏng. Xử lý đúng phải là trả false; để lại làm nợ riêng vì đổi nó là đổi
   * hành vi điều hướng, ngoài phạm vi đợt quick-win này.
   */
  const saveProfile = useCallback(async (): Promise<boolean> => {
    try {
      await api.post("/onboarding/profile", {
        goalType, targetLevel, currentLevel, motivation,
        industry: goalType === "WORK" ? industry : undefined,
        examType: goalType === "CERT" ? examType : undefined,
        sessionsPerWeek: weeklyTarget, minutesPerSession: 15, dailyGoalMinutes,
        learningSpeed: weeklyTarget >= 7 ? "FAST" : weeklyTarget >= 5 ? "NORMAL" : "SLOW",
      });
      // Bất biến: hồ sơ đã nằm trên server ⇒ draft hết việc. Phải dọn ở ĐÂY chứ
      // không chỉ trong resumeFromDraft, vì đường phục hồi đi lối khác: resume
      // hỏng → giữ draft → người dùng làm lại bằng wizard → goRoadmap/startTest
      // → saveProfile thành công. Thiếu chỗ này thì draft cũ sống hết TTL 30
      // phút rồi bị replay đè lên đúng hồ sơ người dùng vừa sửa.
      clearOnboardingDraft();
      return true;
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      // ĐỪNG dọn draft ở đây. Endpoint này trả 201 và UPSERT hồ sơ — nó không bao
      // giờ phát 409 với nghĩa "hồ sơ đã tồn tại". 409 duy nhất có thể tới là
      // optimistic-lock / data-integrity từ GlobalExceptionHandler, và cả hai đều
      // nổ LÚC COMMIT của transaction saveProfileAndGeneratePlan ⇒ toàn bộ ghi đã
      // ROLLBACK. Xoá draft ở nhánh này là vứt bản sao cuối cùng đúng lúc server
      // KHÔNG lưu được gì. (Việc `return true` vẫn cho đi tiếp là hành vi có sẵn
      // từ trước, ngoài phạm vi đợt này — đã ghi vào phần nợ.)
      if (err?.response?.status === 409) return true;
      // api.ts already retried transient 5xx/429/network errors. Reaching here is a real
      // failure → surface it clearly and let the caller BLOCK the redirect (no silent skip).
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      const msg = err?.response?.data?.detail
        ?? (offline || !err?.response
          ? t("error.offline")
          : t("error.saveProfile"));
      toast.error(msg);
      return false;
    }
  }, [goalType, targetLevel, currentLevel, motivation, industry, examType, weeklyTarget, dailyGoalMinutes]);

  const startTest = useCallback(async () => {
    setLoading(true);
    if (!(await saveProfile())) { setLoading(false); return; }
    try {
      const { data } = await api.post("/skill-tree/placement-test", { claimedLevel: currentLevel });
      trackEvent('onboarding_placement_test_started', { level: currentLevel });
      setTestId(data.testId); setQuestions(data.questions ?? []); setAnswers({}); setCurrentQ(0); setStep(4);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || t("error.createTest"));
    }
    setLoading(false);
  }, [currentLevel, saveProfile, trackEvent]);

  const submitTest = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/skill-tree/placement-test/${testId}/submit`, { answers });
      setTestResult(data);
      trackEvent('onboarding_placement_test_completed', { passed: data.passed, score: data.scorePercent });
    }
    catch { toast.error(t("error.submitTest")); }
    setLoading(false);
  }, [testId, answers, trackEvent]);

  const goRoadmap = useCallback(async () => {
    setLoading(true);
    if (!(await saveProfile())) { setLoading(false); return; } // block redirect on a failed save
    trackEvent('onboarding_completed', { level: currentLevel, goal: goalType, industry: industry });
    router.push(ROADMAP_ROUTE);
  }, [saveProfile, router, trackEvent, currentLevel, goalType, industry]);

  /**
   * Resume after signup: a guest filled the funnel, we stored a draft, sent them to /v2/register,
   * and the register page bounced STUDENT back to /v2/onboarding. Replay the draft directly (not via
   * component state, which updates asynchronously) to save the profile, then continue.
   */
  const resumeFromDraft = useCallback(async (d: OnboardingDraft) => {
    setMotivation(d.motivation); setGoalType(d.goalType); setCurrentLevel(d.currentLevel);
    setTargetLevel(d.targetLevel); setIndustry(d.industry); setExamType(d.examType); setWeeklyTarget(d.weeklyTarget);
    setResuming(true);
    const daily = d.weeklyTarget >= 7 ? 20 : d.weeklyTarget >= 5 ? 15 : 10;
    try {
      await api.post("/onboarding/profile", {
        goalType: d.goalType, targetLevel: d.targetLevel, currentLevel: d.currentLevel, motivation: d.motivation,
        industry: d.goalType === "WORK" ? d.industry : undefined,
        examType: d.goalType === "CERT" ? d.examType : undefined,
        sessionsPerWeek: d.weeklyTarget, minutesPerSession: 15, dailyGoalMinutes: daily,
        learningSpeed: d.weeklyTarget >= 7 ? "FAST" : d.weeklyTarget >= 5 ? "NORMAL" : "SLOW",
      });
      // Draft chỉ được vứt SAU khi hồ sơ đã nằm trên server. Bản cũ xoá ngay lúc
      // đọc, nên bất kỳ lỗi POST nào (mạng chập, 5xx, timeout 8s của api.ts) là
      // mất trắng toàn bộ câu trả lời người dùng vừa điền, không có đường lấy lại.
      clearOnboardingDraft();
      trackEvent('onboarding_completed', { level: d.currentLevel, goal: d.goalType, industry: d.industry });
      let r: OnboardingRouteData | null = null;
      try {
        r = await getOnboardingRoute(d.currentLevel);
        setRoute(r);
        trackEvent('onboarding_type_assigned', { onboardingType: r.onboardingType, postAction: r.postAction, paywallAllowed: r.paywallAllowed, platform: 'web', currentLevel: d.currentLevel });
      } catch { /* matrix best-effort */ }
      if (r?.placementOptional) {
        trackEvent('onboarding_placement_offered', { currentLevel: d.currentLevel });
        setPlacementOffer(true); setStep(4); setResuming(false);
      } else {
        router.push(ROADMAP_ROUTE);
      }
    } catch (e: unknown) {
      // 409 ở đây KHÔNG phải "hồ sơ đã tồn tại" (endpoint UPSERT, trả 201) mà là
      // xung đột dữ liệu lúc commit ⇒ đã rollback. Giữ draft lại. Việc vẫn đẩy
      // sang roadmap là hành vi có sẵn từ trước, không đổi ở đợt này.
      if ((e as { response?: { status?: number } })?.response?.status === 409) {
        router.push(ROADMAP_ROUTE);
        return;
      }
      // Lỗi thật: GIỮ draft để lần thử sau còn dữ liệu. Draft có TTL 30 phút nên
      // một hồ sơ hỏng vĩnh viễn cũng chỉ replay trong cửa sổ đó rồi tự hết hạn.
      toast.error(t("error.resumeKeepsDraft"));
      setResuming(false); setStep(3);
    }
  }, [router, trackEvent]);

  // Trước đây lệnh xoá draft đồng bộ ngay tại useEffect kiêm luôn vai chống chạy
  // hai lần: StrictMode dev double-mount đọc lại thì draft đã rỗng. Nay draft
  // sống tới khi POST xong, nên phải có cờ riêng — không thì hai POST song song
  // và hai event `onboarding_completed` làm nhiễu funnel.
  const resumeStartedRef = useRef(false);

  // On mount: detect guest vs. authed. If authed with a stored draft, this is a post-signup resume.
  useEffect(() => {
    if (getAccessToken()) {
      if (resumeStartedRef.current) return;
      const draft = readOnboardingDraft();
      if (draft) { resumeStartedRef.current = true; void resumeFromDraft(draft); }
    } else {
      setIsGuest(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Guest signup gate: stash the funnel answers, then send the guest to /v2/register to save them. */
  const handleGuestSignup = useCallback(() => {
    saveOnboardingDraft({ motivation, goalType, currentLevel, targetLevel, industry, examType, weeklyTarget });
    trackEvent('onboarding_signup_prompted', { motivation, goalType, currentLevel });
    router.push("/v2/register");
  }, [motivation, goalType, currentLevel, targetLevel, industry, examType, weeklyTarget, router, trackEvent]);

  const nextStep = async () => {
    if (step === 1) trackOnboardingStep('Select Level', 1, { currentLevel });
    if (step === 2) {
      trackOnboardingStep('Select Goal', 2, { goalType, industry, targetLevel, motivation });
      trackEvent('onboarding_motivation_selected', { motivation, goalType });
      void fetchMentor();
    }
    if (step === 3) {
      trackOnboardingStep('Select Target', 3, { weeklyTarget });
      trackEvent('onboarding_daily_goal_set', { minutes: dailyGoalMinutes });
    }

    if (step === 3) {
      if (isGuest) {
        // Guest path: no account yet → quick win + signup gate. Nothing is saved server-side
        // until after signup (the answers are replayed from the draft in resumeFromDraft).
        setStep(4);
        return;
      }
      // Ask the backend matrix (single source of truth) which archetype this
      // (platform=web, level) cell maps to. Fall back to the level heuristic if it's unavailable.
      let r: OnboardingRouteData | null = null;
      try {
        r = await getOnboardingRoute(currentLevel);
        setRoute(r);
        trackEvent('onboarding_type_assigned', {
          onboardingType: r.onboardingType, postAction: r.postAction,
          paywallAllowed: r.paywallAllowed, platform: 'web', currentLevel,
        });
      } catch { /* matrix unavailable → fall back to the level heuristic */ }

      const forced = r ? r.placementRequired : currentLevel !== "A0";
      const optional = r ? r.placementOptional : false;
      if (forced) {
        await startTest();
      } else if (optional) {
        // Value-first: offer placement as a skippable shortcut instead of gating the roadmap.
        trackEvent('onboarding_placement_offered', { currentLevel });
        setPlacementOffer(true);
        setStep(4);
      } else {
        await goRoadmap();
      }
    } else setStep(s => s + 1);
  };

  const card = "rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6 shadow-ga-card-hover space-y-4";
  const sel = (v: boolean) => `w-full flex items-center gap-3 p-3 rounded-ga border text-left transition-colors duration-150 ${v ? "border-ga-gold bg-ga-yellow-soft" : "border-ga-line hover:border-ga-subtle"}`;
  const chip = (v: boolean) => `ga-ui text-[12px] px-3 py-1.5 min-h-[40px] lg:min-h-0 rounded-ga-pill border transition-colors ${v ? "bg-ga-yellow border-ga-gold text-ga-ink font-bold" : "border-ga-line text-ga-muted hover:border-ga-subtle"}`;
  // GaBtn ép whitespace-nowrap + h-11: nhãn CTA tiếng Việt dài tràn ngang ở khổ 320px.
  // Cho xuống dòng trên mobile, từ lg trả lại đúng một dòng/44px như bản gốc.
  const btnWrap = "h-auto min-h-[44px] whitespace-normal py-2.5 text-center lg:h-11 lg:whitespace-nowrap lg:py-0";

  // Post-signup resume: saving the guest's draft profile, then routing on. Avoids a funnel flash.
  if (resuming) {
    return (
      <GaAuthShell showBackToLanding={false}>
        <div className="text-center space-y-3">
          <Loader2 size={28} className="animate-spin mx-auto text-ga-gold" />
          <p className="ga-ui text-[14px] font-semibold text-ga-ink">{t("loader.title")}</p>
          <p className="text-[12.5px] text-ga-muted">{t("loader.sub")}</p>
        </div>
      </GaAuthShell>
    );
  }

  return (
    <GaAuthShell wide>
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-ga border border-ga-line bg-ga-card p-4 mb-4">
          <p className="ga-ui text-[14px] font-semibold text-ga-ink">{t("intro.title")}</p>
          <p className="mt-1 text-[12.5px] text-ga-muted">{t("intro.subtitle")}</p>
        </div>
        <div className="flex items-center justify-center gap-2 mb-6">
          {(isGuest ? [1,2,3,4,5] : [1,2,3,4]).map(s => <div key={s} className={`w-8 h-1.5 rounded-ga-pill ${s <= step ? "bg-ga-yellow" : "bg-ga-line"}`} />)}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{t("level.heading")}</h2>
              <p className="text-[13.5px] text-ga-muted">{t("level.sub")}</p>
              {LEVELS.map(l => (
                <button key={l.value} type="button" onClick={() => setCurrentLevel(l.value)} className={sel(currentLevel===l.value)}>
                  <span className="text-2xl">{l.emoji}</span>
                  <div className="min-w-0 flex-1"><p className="ga-ui text-[13.5px] font-bold text-ga-ink">{t(`level.${l.value}.label`)}</p><p className="text-[12px] text-ga-muted">{t(`level.${l.value}.desc`)}</p></div>
                  {currentLevel===l.value && <CheckCircle size={18} className="text-ga-gold" />}
                </button>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{t("goal.heading")}</h2>
              <p className="text-[13.5px] text-ga-muted">{t("goal.sub")}</p>
              <div className="grid grid-cols-2 gap-2">
                {MOTIVATIONS.map(m => (
                  <button key={m.value} type="button" onClick={() => { setMotivation(m.value); setGoalType(m.goal); }}
                    className={`p-3 rounded-ga border text-center transition-colors duration-150 ${motivation===m.value ? "border-ga-gold bg-ga-yellow-soft" : "border-ga-line hover:border-ga-subtle"}`}>
                    <span className="text-2xl block mb-1">{m.emoji}</span>
                    <p className="ga-ui text-[12px] font-bold leading-tight text-ga-ink">{t(`goal.${m.value}`)}</p>
                  </button>
                ))}
              </div>
              {goalType === "WORK" ? (
                <>
                  <label className="ga-ui block text-[13px] font-semibold text-ga-ink">{t("goal.industryLabel")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INDUSTRIES.map(ind => (
                      <button key={ind} type="button" onClick={() => setIndustry(ind)} className={chip(industry===ind)}>
                        {ind}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <label className="ga-ui block text-[13px] font-semibold text-ga-ink">{t("goal.examLabel")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMS.map(ex => (
                      <button key={ex} type="button" onClick={() => setExamType(ex)} className={chip(examType===ex)}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label className="ga-ui block text-[13px] font-semibold text-ga-ink">{t("goal.targetLevelLabel")}</label>
              <select value={targetLevel} onChange={e => setTargetLevel(e.target.value)}
                className="ga-ui block w-full rounded-ga border border-ga-line bg-ga-card px-[15px] py-2.5 text-[14px] text-ga-ink outline-none">
                {["A1","A2","B1","B2","C1","C2"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{t("pace.heading")}</h2>
              <p className="text-[13.5px] text-ga-muted">{t("pace.sub")}</p>
              {mentor && (
                <div className="space-y-1.5">
                  <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-ga-pill bg-ga-yellow flex items-center justify-center text-xl shrink-0">{MENTOR_META[mentor.code]?.emoji ?? "🧑‍🏫"}</div>
                    <div className="min-w-0">
                      <p className="ga-ui text-[10.5px] uppercase tracking-[0.08em] text-ga-muted font-semibold">{t("pace.mentorLabel")}</p>
                      <p className="ga-ui text-[13.5px] font-bold text-ga-ink">{mentor.displayName}</p>
                      <p className="text-[12px] text-ga-muted">{MENTOR_META[mentor.code]?.tagline ?? t("pace.mentorFallbackTagline")}</p>
                    </div>
                  </div>
                  {mentor.upsellCode && mentorUpsellEnabled && (
                    <button type="button"
                      onClick={() => { trackEvent('onboarding_mentor_upsell_clicked', { mentor: mentor.code, upsell: mentor.upsellCode }); router.push(PRICING_ROUTE); }}
                      className="w-full text-left text-[12px] text-ga-ink bg-ga-yellow-soft border border-dashed border-ga-gold rounded-ga px-3 py-2">
                      {t.rich("pace.upsell", {
                        name: mentor.upsellDisplayName ?? "",
                        tagline: MENTOR_META[mentor.upsellCode]?.tagline ? ` (${MENTOR_META[mentor.upsellCode].tagline})` : "",
                        b: (chunks) => <strong>{chunks}</strong>,
                      })}
                    </button>
                  )}
                </div>
              )}
              {WEEKLY.map(w => (
                <button key={w.value} type="button" onClick={() => setWeeklyTarget(w.value)} className={sel(weeklyTarget===w.value)}>
                  <span className="text-3xl">{w.emoji}</span>
                  <div className="min-w-0 flex-1"><p className="ga-ui text-[13.5px] font-bold text-ga-ink">{t(`pace.w${w.value}.label`)}</p><p className="text-[12px] text-ga-muted">{t(`pace.w${w.value}.desc`)}</p></div>
                </button>
              ))}
              {currentLevel === "A0"
                ? <div className="rounded-ga border border-ga-green bg-ga-green-soft p-3"><p className="text-[12px] text-ga-ink">{t.rich("pace.noteA0", { b: (chunks) => <strong>{chunks}</strong> })}</p></div>
                : <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3"><p className="text-[12px] text-ga-ink">{t.rich("pace.notePlacement", { b: (chunks) => <strong>{chunks}</strong> })}</p></div>
              }
            </motion.div>
          )}

          {step === 4 && isGuest && (
            <motion.div key="s4qw" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={`${card} text-center`}>
              <div className="inline-flex w-16 h-16 rounded-ga-pill items-center justify-center bg-ga-yellow-soft text-3xl mx-auto">🇩🇪</div>
              <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{t("quickWin.heading")}</h2>
              <p className="text-[13.5px] text-ga-muted">{t("quickWin.prompt")}</p>
              <div className="space-y-2 text-left">
                {["Guten Morgen","Gute Nacht","Auf Wiedersehen"].map(opt => {
                  const picked = quickWinChoice === opt;
                  const isCorrect = opt === "Guten Morgen";
                  const answered = quickWinChoice !== null;
                  const solved = quickWinChoice === "Guten Morgen";
                  return (
                    <button key={opt} type="button" disabled={solved}
                      onClick={() => { setQuickWinChoice(opt); if (isCorrect) trackEvent('onboarding_quickwin_completed', { correct: true }); }}
                      className={`ga-ui w-full text-left p-3 rounded-ga border text-[13.5px] transition-colors duration-150 disabled:cursor-default ${
                        answered && isCorrect ? "border-ga-green bg-ga-green-soft font-bold text-ga-ink"
                        : picked ? "border-ga-red bg-ga-red-soft text-ga-red"
                        : "border-ga-line text-ga-ink hover:border-ga-subtle"}`}>
                      {opt}{answered && isCorrect ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
              {quickWinChoice === "Guten Morgen" ? (
                <>
                  <p className="ga-ui text-[13.5px] font-bold text-ga-green">{t("quickWin.correct")}</p>
                  <GaBtn variant="ink" size="lg" className="w-full" onClick={() => setStep(5)}>{t("nav.continue")} <ArrowRight size={14}/></GaBtn>
                </>
              ) : quickWinChoice ? (
                <p className="text-[12px] text-ga-red">{t("quickWin.wrong")}</p>
              ) : null}
            </motion.div>
          )}

          {step === 5 && isGuest && (
            <motion.div key="s5" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={`${card} text-center`}>
              {mentor && (
                <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3 flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-ga-pill bg-ga-yellow flex items-center justify-center text-xl shrink-0">{MENTOR_META[mentor.code]?.emoji ?? "🧑‍🏫"}</div>
                  <div className="min-w-0">
                    <p className="ga-ui text-[10.5px] uppercase tracking-[0.08em] text-ga-muted font-semibold">{t("pace.mentorLabel")}</p>
                    <p className="ga-ui text-[13.5px] font-bold text-ga-ink">{mentor.displayName}</p>
                    <p className="text-[12px] text-ga-muted">{MENTOR_META[mentor.code]?.tagline ?? t("pace.mentorFallbackTagline")}</p>
                  </div>
                </div>
              )}
              <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{t("signup.heading")}</h2>
              <p className="text-[13.5px] text-ga-muted">
                {mentor ? t("signup.subWithMentor", { name: mentor.displayName }) : t("signup.sub")}
              </p>
              <GaBtn variant="yellow" size="lg" className={`w-full ${btnWrap}`} onClick={handleGuestSignup}>
                {t("signup.cta")} <ArrowRight size={14}/>
              </GaBtn>
              <p className="text-[12px] text-ga-muted">{t("signup.haveAccount")} <Link href="/v2/login" className="font-bold text-ga-ink underline">{t("signup.login")}</Link></p>
            </motion.div>
          )}

          {step === 4 && !isGuest && placementOffer && !testResult && questions.length === 0 && (
            <motion.div key="s4offer" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={`${card} text-center`}>
              <div className="inline-flex w-16 h-16 rounded-ga-pill items-center justify-center bg-ga-yellow-soft text-3xl mx-auto">🎯</div>
              <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{t("placementOffer.heading")}</h2>
              <p className="text-[13.5px] text-ga-muted">
                {t.rich("placementOffer.body", { level: currentLevel, b: (chunks) => <strong>{chunks}</strong> })}
              </p>
              <GaBtn variant="ink" size="lg" className="w-full" loading={loading} disabled={loading} onClick={startTest}>
                {t("placementOffer.take")}
              </GaBtn>
              <GaBtn variant="ghost" size="lg" className="w-full" disabled={loading}
                onClick={() => { trackEvent('onboarding_placement_skipped', { currentLevel }); void goRoadmap(); }}>
                {t("placementOffer.skip")}
              </GaBtn>
            </motion.div>
          )}

          {step === 4 && !testResult && questions.length > 0 && (
            <motion.div key="s4t" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="min-w-0 font-ga-display text-[20px] font-medium text-ga-ink lg:text-[24px]">{t("test.heading")}</h2>
                <span className="ga-ui shrink-0 text-[12px] text-ga-subtle">{currentQ+1}/{questions.length}</span>
              </div>
              <div className="flex gap-1">{questions.map((_,i) => <div key={i} className={`flex-1 h-1 rounded-ga-pill ${i<currentQ?"bg-ga-green":i===currentQ?"bg-ga-yellow":"bg-ga-line"}`} />)}</div>
              {/* Skill chip: same four sections as v1 (HOEREN/SPRECHEN/LESEN/SCHREIBEN), retokenized. */}
              <span className={`ga-ui inline-block text-[10px] font-bold px-2 py-0.5 rounded-ga-pill ${
                questions[currentQ].skillSection==="HOEREN"?"bg-ga-blue-soft text-ga-blue":
                questions[currentQ].skillSection==="SPRECHEN"?"bg-ga-red-soft text-ga-red":
                questions[currentQ].skillSection==="LESEN"?"bg-ga-green-soft text-ga-green":"bg-ga-violet-soft text-ga-violet"
              }`}>{questions[currentQ].skillSection==="HOEREN"?t("test.skillHoeren"):questions[currentQ].skillSection==="SPRECHEN"?t("test.skillSprechen"):questions[currentQ].skillSection==="LESEN"?t("test.skillLesen"):t("test.skillSchreiben")}</span>
              {questions[currentQ].audioTranscript && <div className="rounded-ga bg-ga-surface p-3 text-[12px] text-ga-muted italic">🔊 &quot;{questions[currentQ].audioTranscript}&quot;</div>}
              <p className="text-[13.5px] font-medium text-ga-ink whitespace-pre-line break-words">{questions[currentQ].questionDe}</p>
              {questions[currentQ].questionVi && <p className="text-[12px] text-ga-subtle">{questions[currentQ].questionVi}</p>}
              {questions[currentQ].options ? (
                <div className="space-y-2">{questions[currentQ].options!.map((opt,i) => (
                  <button key={i} type="button" onClick={() => setAnswers(a => ({...a,[questions[currentQ].id]:opt}))}
                    className={`ga-ui w-full text-left p-3 rounded-ga border text-[13.5px] transition-colors duration-150 ${answers[questions[currentQ].id]===opt?"border-ga-gold bg-ga-yellow-soft font-bold text-ga-ink":"border-ga-line text-ga-ink hover:border-ga-subtle"}`}>
                    {String.fromCharCode(65+i)}. {opt}
                  </button>
                ))}</div>
              ) : (
                <textarea value={answers[questions[currentQ].id]??""} onChange={e => setAnswers(a => ({...a,[questions[currentQ].id]:e.target.value}))}
                  placeholder={t("test.writePlaceholder")} className="ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13.5px] text-ga-ink outline-none resize-none" rows={3} />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 lg:flex-nowrap lg:gap-0">
                {currentQ > 0
                  ? <GaBtn variant="ghost" onClick={() => setCurrentQ(q=>q-1)}><ArrowLeft size={14}/> {t("test.prev")}</GaBtn>
                  : <div/>}
                {currentQ < questions.length-1
                  ? <GaBtn variant="ink" onClick={() => setCurrentQ(q=>q+1)}>{t("test.next")} <ArrowRight size={14}/></GaBtn>
                  : <GaBtn variant="yellow" loading={loading} disabled={loading} onClick={submitTest}>{t("test.submit")}</GaBtn>
                }
              </div>
            </motion.div>
          )}

          {step === 4 && testResult && (
            <motion.div key="s4r" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className={`${card} text-center`}>
              <div className={`inline-flex w-20 h-20 rounded-ga-pill items-center justify-center mx-auto ${testResult.passed?"bg-ga-green-soft text-ga-green":"bg-ga-red-soft text-ga-red"}`}>
                {testResult.passed ? <CheckCircle size={40}/> : <XCircle size={40}/>}
              </div>
              <h2 className="font-ga-display text-[24px] font-medium text-ga-ink">{testResult.passed ? t("result.passed") : t("result.failed")}</h2>
              <p className="text-[13.5px] text-ga-muted">
                {t.rich("result.score", {
                  correct: testResult.correctCount,
                  total: testResult.totalQuestions,
                  percent: testResult.scorePercent,
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
              {!testResult.passed && testResult.weakModules && (
                <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3 text-left">
                  <p className="text-[12px] text-ga-ink">{t("result.weakModules", { modules: testResult.weakModules.join(", ") })}</p>
                  <p className="mt-1 text-[10.5px] text-ga-muted">{t("result.retryAfter", { days: testResult.retryAfterDays ?? 3 })}</p>
                </div>
              )}
              <GaBtn variant="ink" size="lg" className={`w-full ${btnWrap}`} onClick={() => router.push(ROADMAP_ROUTE)}>
                {testResult.passed ? t("result.ctaPassed") : t("result.ctaFailed")}
              </GaBtn>
              {route?.paywallAllowed && route.postAction === "PRICING_CTA" && (
                <GaBtn variant="yellow" size="lg" className={`w-full ${btnWrap}`}
                  onClick={() => { trackEvent('onboarding_pricing_cta_clicked', { currentLevel }); router.push(PRICING_ROUTE); }}>
                  {t("result.pricingCta")}
                </GaBtn>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {step <= 3 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 lg:flex-nowrap lg:gap-0">
            {step > 1
              ? <GaBtn variant="ghost" onClick={() => setStep(s=>s-1)}><ArrowLeft size={14}/> {t("nav.back")}</GaBtn>
              : <div/>}
            <GaBtn variant="ink" size="lg" loading={loading} disabled={loading} onClick={nextStep}>
              {step===3 && !isGuest && currentLevel==="A0" ? t("nav.startRoadmap") : t("nav.continue")}
              <ArrowRight size={14}/>
            </GaBtn>
          </div>
        )}
      </div>
    </GaAuthShell>
  );
}
