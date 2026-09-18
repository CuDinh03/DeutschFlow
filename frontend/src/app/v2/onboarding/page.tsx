"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useTracking } from "@/hooks/useTracking";
import { getOnboardingRoute, getOnboardingMentor, getOnboardingMentorPreview, type OnboardingRouteData, type OnboardingMentorData } from "@/lib/profileApi";
import { getAccessToken } from "@/lib/authSession";
import { saveOnboardingDraft, readOnboardingDraft, clearOnboardingDraft, type OnboardingDraft } from "@/lib/onboardingDraft";
import { MENTOR_META } from "@/lib/mentorMeta";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useLocale, useTranslations } from "next-intl";
import { usePlanHelpers } from "@/contexts/PlanContext";
import { claimGuestSession, ensureGuestSession, syncGuestSession, type GuestAnswers } from "@/features/onboarding/guestSession";
import { readGuestSessionCache } from "@/lib/guestSessionStore";
import { fetchOnboardingContext, needsLiteProfile, type OnboardingContext } from "@/features/onboarding/context";
import {
  DEFAULT_ANSWERS,
  WIZARD_STEP_COUNT,
  WIZARD_STEP_IDS,
  canLeaveStep,
  goalTypeFor,
  guestAnswersFrom,
  profilePayloadFrom,
  totalStepsFor,
  type WizardAnswers,
} from "@/features/onboarding/wizardModel";
import { nextAfterProfile, guestNeedsPathChoice, ROADMAP_ROUTE, type PostProfileContext } from "@/features/onboarding/postProfileRoute";
import type { PathChoice } from "@/features/onboarding/machine";
import { PathChoiceStep } from "@/features/onboarding/steps/PathChoiceStep";
import { CreatingPanel } from "@/features/onboarding/steps/CreatingPanel";
import { MotivationStep } from "@/features/onboarding/steps/MotivationStep";
import { LevelStep } from "@/features/onboarding/steps/LevelStep";
import { RhythmStep } from "@/features/onboarding/steps/RhythmStep";
import { FocusStep } from "@/features/onboarding/steps/FocusStep";
import { GaBtn, GaIcon } from "@/components/ui-v2";
import { GaAuthShell } from "../authShared";
import { OrgLiteWizard, type LiteProfilePayload } from "./OrgLiteWizard";

// ─────────────────────────────────────────────────────────────────────────────
// /v2/onboarding — phễu value-first Galerie 2.0.
//
// Đợt 4 (18/09/2026, kế hoạch 17/09 §4.4 W1–W4, W-12/W-13/W-18): wizard đổi thứ tự khớp mobile
// (mục tiêu → trình độ → nhịp phút/ngày → lĩnh vực/kỳ thi + mentor), bốn bước tách ra
// `features/onboarding/steps/*`, mô hình bước + payload ở `wizardModel.ts` (có test). Mỗi bước
// chuyển là focus về h1 + aria-live báo "Bước X trên Y"; progressbar đếm theo nhánh.
//
// Đợt 4 PR-2 (19/09/2026, W5b/W7/W8a): sau hồ sơ, đi đâu do `features/onboarding/postProfileRoute.ts`
// quyết (qua máy trạng thái chung, có test) — ma trận `/onboarding/route` chỉ còn cho analytics.
// A0 → Ngày 1 `/v2/student/beginner`; A1+ tự đăng ký → Chọn đường (`PathChoiceStep`: placement
// trong trang · nói thử 3′ `/v2/onboarding/mock-exam` · bỏ qua) — khách chọn TRƯỚC cổng tài khoản
// (I-9, ghi vào guest session + draft), người đăng ký thẳng được hỏi sau khi có plan (fixture R5).
// Màn "Đang tạo lộ trình…" (`CreatingPanel`) hiện cho mọi đường tới hồ sơ (I-10).
//
// Trang CÔNG KHAI: khách chạy trọn phễu trước khi đăng ký, nên mặc GaAuthShell (không RoleShell);
// middleware miễn /v2/onboarding khỏi cổng đăng nhập vì đúng lý do đó.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_SKILL_CHIP: Record<string, { icon: string; labelKey: string; cls: string }> = {
  HOEREN:    { icon: "headphones",         labelKey: "test.skillHoeren",    cls: "bg-ga-blue-soft text-ga-blue" },
  SPRECHEN:  { icon: "mic",                labelKey: "test.skillSprechen",  cls: "bg-ga-red-soft text-ga-red" },
  LESEN:     { icon: "menu_book",          labelKey: "test.skillLesen",     cls: "bg-ga-green-soft text-ga-green" },
  SCHREIBEN: { icon: "draw",               labelKey: "test.skillSchreiben", cls: "bg-ga-violet-soft text-ga-violet" },
};

/** Băng UPPER của ma trận `OnboardingTypeResolver` (B1+): nơi duy nhất web từng mời gói PRO. */
const UPPER_LEVELS = ["B1", "B2", "C1", "C2"];
const PRICING_ROUTE = "/v2/payment";

// Bước ngoài wizard (sau 4 bước). Khách: quick win → (A1+) Chọn đường → cổng tài khoản.
// Đã đăng nhập: (A1+ chưa chọn) Chọn đường → placement trong trang. Số thứ tự chỉ để phân biệt
// màn; progressbar hiện `shownStep` đã quy đổi theo nhánh (A0 khách không có bước Chọn đường).
const STEP_TASTE = WIZARD_STEP_COUNT + 1;        // 5 — khách: quick win (TASTE)
const STEP_PATH_CHOICE = WIZARD_STEP_COUNT + 2;  // 6 — A1+: Chọn đường (PATH_CHOICE)
const STEP_AUTH_GATE = WIZARD_STEP_COUNT + 3;    // 7 — khách: cổng tài khoản (AUTH_GATE)
const STEP_PLACEMENT = WIZARD_STEP_COUNT + 4;    // 8 — đã đăng nhập: làm/kết quả placement

interface PQ { id: number; skillSection: string; type: string; questionDe: string; questionVi: string; audioTranscript?: string; options?: string[]; }

export default function V2OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("v2.onboarding");
  const locale = useLocale();
  // Tagline mentor theo locale (onboarding.mentorTaglines.<mã> — đợt 3 audit i18n 06/09/2026):
  // mã chưa có trong catalog rơi về bảng MENTOR_META (tiếng Việt); không có nốt → câu chung.
  const mentorTagline = (code: string | null | undefined): string | null => {
    if (!code) return null;
    if (t.has(`mentorTaglines.${code}`)) return t(`mentorTaglines.${code}`);
    return MENTOR_META[code]?.tagline ?? null;
  };
  const mentorTaglineSuffix = (code: string): string => {
    const tagline = mentorTagline(code);
    return tagline ? ` (${tagline})` : "";
  };
  const { trackOnboardingStep, trackEvent } = useTracking();
  // A/B: the mentor PRO-upsell nudge is gated behind a PostHog feature flag. Default-on
  // (undefined = flag not configured → shown), so no regression until an experiment is run.
  const mentorUpsellEnabled = useFeatureFlagEnabled("onboarding-mentor-upsell") !== false;
  // Quyền lợi thật của người dùng (GĐ 2 + Đợt 0): người đã trả tiền hoặc đang dùng thử
  // KHÔNG thấy lời mời nâng cấp nào trong phễu. Khách chưa đăng nhập → plan null → không ẩn.
  const { hideUpsell } = usePlanHelpers();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<WizardAnswers>(DEFAULT_ANSWERS);
  const { motivation, currentLevel, targetLevel, dailyGoalMinutes, industry, examType } = answers;
  const goalType = goalTypeFor(motivation);
  const patch = useCallback((p: Partial<WizardAnswers>) => setAnswers((a) => ({ ...a, ...p })), []);

  // Placement test state
  const [testId, setTestId] = useState<string|null>(null);
  const [questions, setQuestions] = useState<PQ[]>([]);
  const [testAnswers, setTestAnswers] = useState<Record<string,string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [testResult, setTestResult] = useState<{passed:boolean;scorePercent:number;correctCount:number;totalQuestions:number;weakModules?:number[];startingNodeId?:number;retryAfterDays?:number}|null>(null);
  const [route, setRoute] = useState<OnboardingRouteData | null>(null);
  const [mentor, setMentor] = useState<OnboardingMentorData | null>(null);
  // Đợt 4 PR-2: lựa chọn đường của A1+ (PATH_CHOICE). Khách: ghi trước tài khoản (guest session +
  // draft) rồi mới qua cổng; đã đăng nhập: thực thi ngay qua `goAfterProfile`.
  const [pathChoice, setPathChoice] = useState<PathChoice | null>(null);
  // Value-first auth inversion (Phase C): a guest runs the funnel + quick win BEFORE signing up.
  const [isGuest, setIsGuest] = useState(false);          // no access token on mount
  const totalSteps = totalStepsFor(isGuest, currentLevel);
  const [resuming, setResuming] = useState(false);        // authed, replaying a guest draft after signup
  const [quickWinChoice, setQuickWinChoice] = useState<string | null>(null);
  // Đợt 5 (17/09): học viên trung tâm (ORG_ROSTER | ORG_INVITE) chưa có plan đi bản rút gọn
  // PROFILE_LITE thay vì wizard 4 bước. Chỉ tin `accountSource` từ GET /onboarding/context;
  // lỗi mạng / backend cũ ⇒ null ⇒ phễu thường như trước (không chặn ai).
  const [orgContext, setOrgContext] = useState<OnboardingContext | null>(null);

  // A11y (W-12): mỗi lần đổi bước, focus về h1 của bước mới để đầu đọc màn hình đọc từ đầu.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [step]);
  // AnimatePresence mode="wait": bước mới chỉ mount SAU khi bước cũ thoát xong (~300 ms), lúc đó
  // effect [step] đã chạy rồi và focus rơi về body. Focus lại khi hiệu ứng vào của bước mới kết thúc.
  const focusHeading = () => { headingRef.current?.focus(); };

  const fetchMentor = useCallback(async () => {
    try {
      // Guests use the public preview endpoint (no auth); authed users use the live one.
      const fetch = isGuest ? getOnboardingMentorPreview : getOnboardingMentor;
      setMentor(await fetch(goalType, industry ?? "", currentLevel));
    } catch { /* mentor preview is non-blocking */ }
  }, [isGuest, goalType, industry, currentLevel]);

  // Mentor reveal sống ở bước 4 (và cổng tài khoản): xem trước cập nhật theo lĩnh vực đang chọn.
  useEffect(() => {
    if (step >= WIZARD_STEP_COUNT) void fetchMentor();
  }, [step, fetchMentor]);

  /**
   * Persist the onboarding profile. Returns true on success. Surfaces real failures instead of
   * silently swallowing them, so callers can BLOCK the redirect (design §5 DI-3).
   *
   * 409 cũng là THẤT BẠI (Q-B, owner chốt 28/08; thi công Đợt 0 17/09): endpoint UPSERT và trả 201,
   * nên 409 duy nhất có thể tới là optimistic-lock/data-integrity nổ lúc commit ⇒ toàn bộ ghi đã
   * rollback, người dùng KHÔNG có learning plan.
   */
  const postProfile = useCallback(async (payload: Record<string, unknown>): Promise<boolean> => {
    try {
      await api.post("/onboarding/profile", payload);
      // Bất biến: hồ sơ đã nằm trên server ⇒ draft hết việc. Phải dọn ở ĐÂY chứ không chỉ trong
      // resumeFromDraft, vì đường phục hồi đi lối khác: resume hỏng → giữ draft → làm lại bằng
      // wizard → saveProfile thành công. Thiếu chỗ này thì draft cũ sống hết TTL rồi bị replay đè.
      clearOnboardingDraft();
      return true;
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      // ĐỪNG dọn draft ở đây: 409 = commit hỏng ⇒ server không lưu gì; draft là bản sao cuối cùng.
      if (err?.response?.status === 409) {
        toast.error(err.response?.data?.detail ?? t("error.saveProfile"));
        return false;
      }
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      const msg = err?.response?.data?.detail
        ?? (offline || !err?.response
          ? t("error.offline")
          : t("error.saveProfile"));
      toast.error(msg);
      return false;
    }
  }, [t]);

  const saveProfile = useCallback((): Promise<boolean> => postProfile(profilePayloadFrom(answers)), [postProfile, answers]);

  /**
   * Bài kiểm tra đầu vào 10 câu — chỉ gọi khi hồ sơ ĐÃ nằm trên server (sau Chọn đường / claim /
   * replay draft có `pathChoice=placement`). Tạo bài hỏng (cooldown 400, mất mạng) → báo lý do và
   * vào lộ trình: hồ sơ không mất gì, làm lại sau (W-1 tinh thần: không kẹt, không ép).
   */
  const startTest = useCallback(async (level: string) => {
    setLoading(true);
    try {
      const { data } = await api.post("/skill-tree/placement-test", { claimedLevel: level });
      trackEvent('onboarding_placement_test_started', { level });
      setTestId(data.testId); setQuestions(data.questions ?? []); setTestAnswers({}); setCurrentQ(0);
      setResuming(false); setStep(STEP_PLACEMENT);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || t("error.createTest"));
      router.push(ROADMAP_ROUTE);
    }
    setLoading(false);
  }, [router, trackEvent, t]);

  /**
   * Hồ sơ đã lưu ⇒ đi đâu: MỘT điểm rẽ (`postProfileRoute.ts`, qua máy trạng thái, có test) cho cả
   * bốn đường vào — đăng ký thẳng, claim, replay draft, PROFILE_LITE. Không đọc ma trận route.
   */
  const goAfterProfile = useCallback(async (ctx: PostProfileContext) => {
    const dest = nextAfterProfile(ctx);
    if (dest.kind === 'path_choice') {
      trackEvent('onboarding_placement_offered', { currentLevel: ctx.level, surface: 'path_choice' });
      setPathChoice(null); setResuming(false); setLoading(false); setStep(STEP_PATH_CHOICE);
      return;
    }
    if (dest.kind === 'placement') { await startTest(ctx.level ?? currentLevel); return; }
    router.push(dest.href);
  }, [router, startTest, trackEvent, currentLevel]);

  /**
   * PROFILE_LITE (Đợt 5): học viên trung tâm lưu nhịp học (+ trình độ nếu thiếu) rồi đi THẲNG bài
   * đầu — không hỏi ma trận, không mời placement (I-11).
   */
  const saveLiteProfile = useCallback(async (payload: LiteProfilePayload): Promise<boolean> => {
    setLoading(true);
    const ok = await postProfile(payload);
    if (!ok) { setLoading(false); return false; }
    const base = { level: payload.currentLevel, goal: payload.goalType, industry: null, lite: true, accountSource: orgContext?.accountSource ?? null };
    trackEvent('onboarding_completed', base);
    trackEvent('onboarding_profile_saved', base);
    trackEvent('onboarding_daily_goal_set', { minutes: payload.dailyGoalMinutes });
    // Đợt 4 PR-2: A0 → Ngày 1, A1+ → lộ trình (I-11: không hỏi đường, không placement).
    await goAfterProfile({ level: payload.currentLevel, accountSource: orgContext?.accountSource ?? 'ORG_ROSTER', pathChoice: null });
    return true;
  }, [postProfile, goAfterProfile, trackEvent, orgContext]);



  const submitTest = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/skill-tree/placement-test/${testId}/submit`, { answers: testAnswers });
      setTestResult(data);
      trackEvent('onboarding_placement_test_completed', { passed: data.passed, score: data.scorePercent });
      trackEvent('placement_completed', { level: currentLevel, passed: data.passed, score: data.scorePercent });
    }
    catch { toast.error(t("error.submitTest")); }
    setLoading(false);
  }, [testId, testAnswers, trackEvent, currentLevel, t]);

  /**
   * Hồ sơ ĐÃ nằm trên server (đăng ký thẳng / replay draft / claim): hỏi ma trận CHỈ để bắn
   * analytics (`onboarding_type_assigned`, `paywallAllowed` cho màn kết quả), rồi rẽ theo máy trạng
   * thái. Mất mạng lúc hỏi ma trận không đổi đường đi (W-1).
   */
  const continueAfterProfileSaved = useCallback(async (level: string, chosen: PathChoice | null = null) => {
    try {
      const r = await getOnboardingRoute(level);
      setRoute(r);
      trackEvent('onboarding_type_assigned', { onboardingType: r.onboardingType, paywallAllowed: r.paywallAllowed, platform: 'web', currentLevel: level });
    } catch { /* matrix best-effort */ }
    await goAfterProfile({ level, pathChoice: chosen });
  }, [goAfterProfile, trackEvent]);

  /**
   * Resume after signup: a guest filled the funnel, we stored a draft, sent them to /v2/register,
   * and the register page bounced STUDENT back here. Replay the draft directly (not via component
   * state, which updates asynchronously) to save the profile, then continue.
   */
  const resumeFromDraft = useCallback(async (d: OnboardingDraft) => {
    const restored: WizardAnswers = {
      motivation: d.motivation, currentLevel: d.currentLevel, targetLevel: d.targetLevel,
      industry: d.industry, examType: d.examType, dailyGoalMinutes: d.dailyGoalMinutes,
    };
    setAnswers(restored);
    setResuming(true);
    try {
      await api.post("/onboarding/profile", profilePayloadFrom(restored));
      // Draft chỉ được vứt SAU khi hồ sơ đã nằm trên server (QW-3): lỗi POST nào cũng phải giữ.
      clearOnboardingDraft();
      const goal = goalTypeFor(d.motivation);
      trackEvent('onboarding_completed', { level: d.currentLevel, goal, industry: d.industry });
      trackEvent('onboarding_profile_saved', { level: d.currentLevel, goal, industry: d.industry, resumed: true });
      await continueAfterProfileSaved(d.currentLevel, d.pathChoice ?? null);
    } catch (e: unknown) {
      // 409 ở đây KHÔNG phải "hồ sơ đã tồn tại" (endpoint UPSERT) mà là xung đột lúc commit ⇒ đã
      // rollback ⇒ hồ sơ CHƯA có trên server. Giữ draft, hiện `detail`, trả về bước cuối để bấm lại.
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      const detail = err?.response?.status === 409 ? err.response?.data?.detail : undefined;
      toast.error(detail ?? t("error.resumeKeepsDraft"));
      setResuming(false); setStep(WIZARD_STEP_COUNT);
    }
  }, [continueAfterProfileSaved, trackEvent, t]);

  /**
   * Đợt 2 (17/09): sau đăng nhập/đăng ký, CLAIM phiên khách trên server TRƯỚC, draft localStorage
   * chỉ còn là đường lùi. Server phát lại hồ sơ (UPSERT) trong claim, nên nhánh 'claimed' KHÔNG
   * POST /profile nữa. I-7: 'foreign' (phiên của người khác) thì draft cũng đã bị vứt ⇒ wizard trống.
   */
  const resumeAfterAuth = useCallback(async () => {
    if (!readGuestSessionCache() && !readOnboardingDraft()) return;
    setResuming(true);
    const outcome = await claimGuestSession();
    if (outcome.status === 'claimed') {
      const hasPlan = await api.get<{ hasPlan: boolean }>('/onboarding/status')
        .then((res) => res.data?.hasPlan === true, () => false);
      trackEvent('onboarding_session_claimed', { alreadyClaimed: outcome.alreadyClaimed, hasPlan });
      if (hasPlan) {
        const a: GuestAnswers = outcome.answers ?? {};
        const level = a.currentLevel ?? 'A0';
        setAnswers((prev) => ({
          ...prev,
          motivation: a.motivation ?? prev.motivation,
          currentLevel: level,
          targetLevel: a.targetLevel ?? prev.targetLevel,
          industry: a.industry ?? prev.industry,
          examType: a.examType ?? prev.examType,
          dailyGoalMinutes: a.dailyGoalMinutes ?? prev.dailyGoalMinutes,
        }));
        trackEvent('onboarding_completed', { level, goal: a.goalType, industry: a.industry });
        trackEvent('onboarding_profile_saved', { level, goal: a.goalType, industry: a.industry, resumed: true, via: 'claim' });
        await continueAfterProfileSaved(level, a.pathChoice ?? null);
        return;
      }
      // Phiên claim được nhưng chưa có hồ sơ (khách rời phễu trước bước trình độ) → thử draft.
    } else if (outcome.status === 'foreign') {
      setResuming(false);
      return;
    }
    const draft = readOnboardingDraft();
    if (draft) { await resumeFromDraft(draft); return; }
    setResuming(false);
  }, [continueAfterProfileSaved, resumeFromDraft, trackEvent]);

  // Draft sống tới khi POST xong, nên cần cờ riêng chống StrictMode chạy resume hai lần.
  const resumeStartedRef = useRef(false);

  // On mount: detect guest vs. authed. If authed with a stored draft, this is a post-signup resume.
  useEffect(() => {
    const authed = !!getAccessToken();
    trackEvent('onboarding_started', { guest: !authed });
    if (authed) {
      if (resumeStartedRef.current) return;
      resumeStartedRef.current = true;
      void resumeAfterAuth();
      // Song song với claim: học viên trung tâm thường đăng nhập thẳng, không có phiên khách nào.
      void fetchOnboardingContext().then((ctx) => { if (needsLiteProfile(ctx)) setOrgContext(ctx); });
    } else {
      setIsGuest(true);
      // Phiên khách trên server (72 h) — best-effort, không chặn wizard nếu server từ chối.
      void ensureGuestSession(locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Guest signup gate: stash the funnel answers, then send the guest to /v2/register to save them. */
  const handleGuestSignup = useCallback(() => {
    // Server trước (claim sẽ phát lại từ đây), draft sau (đường lùi khi server hỏng).
    void syncGuestSession('AUTH_GATE', guestAnswersFrom(answers, pathChoice));
    saveOnboardingDraft({ motivation, currentLevel, targetLevel, industry, examType, dailyGoalMinutes, goalType, pathChoice });
    trackEvent('onboarding_signup_prompted', { motivation, goalType, currentLevel, pathChoice });
    router.push("/v2/register");
  }, [answers, motivation, goalType, currentLevel, targetLevel, industry, examType, dailyGoalMinutes, pathChoice, router, trackEvent]);

  /** Khách vừa giải quick win: A1+ sang Chọn đường (fixture T3/T4), A0 thẳng cổng tài khoản (T1/T2). */
  const afterQuickWin = useCallback(() => {
    if (guestNeedsPathChoice(currentLevel)) {
      void syncGuestSession('PATH_CHOICE', guestAnswersFrom(answers));
      trackEvent('onboarding_placement_offered', { currentLevel, surface: 'guest' });
      setStep(STEP_PATH_CHOICE);
      return;
    }
    setStep(STEP_AUTH_GATE);
  }, [answers, currentLevel, trackEvent]);

  /** Chọn đường xong: khách ghi lựa chọn rồi qua cổng (I-9, C1/C2); đã đăng nhập thực thi ngay (C3–C5). */
  const handlePathPick = useCallback((choice: PathChoice) => {
    trackEvent('onboarding_path_selected', { path: choice, level: currentLevel, guest: isGuest });
    if (choice === 'skip') trackEvent('onboarding_placement_skipped', { currentLevel, at: 'path_choice' });
    setPathChoice(choice);
    if (isGuest) {
      void syncGuestSession('PATH_CHOICE', guestAnswersFrom(answers, choice));
      setStep(STEP_AUTH_GATE);
      return;
    }
    void goAfterProfile({ level: currentLevel, pathChoice: choice });
  }, [answers, currentLevel, isGuest, goAfterProfile, trackEvent]);

  const stepId = WIZARD_STEP_IDS[step - 1];
  const isLastWizardStep = step === WIZARD_STEP_COUNT;

  const nextStep = async () => {
    if (stepId && !canLeaveStep(stepId, answers)) return;
    // Khách: mỗi lần rời bước là một PATCH lên phiên server (best-effort); rời bước cuối là sang TASTE.
    if (isGuest) void syncGuestSession(isLastWizardStep ? 'TASTE' : 'PROFILE', guestAnswersFrom(answers));
    if (step === 1) {
      trackOnboardingStep('Select Goal', 1, { motivation, goalType });
      trackEvent('onboarding_motivation_selected', { motivation, goalType });
    }
    if (step === 2) trackOnboardingStep('Select Level', 2, { currentLevel, targetLevel });
    if (step === 3) {
      trackOnboardingStep('Select Target', 3, { dailyGoalMinutes });
      trackEvent('onboarding_daily_goal_set', { minutes: dailyGoalMinutes });
    }
    if (step === 4) trackOnboardingStep('Select Focus', 4, { goalType, industry, examType, targetLevel });

    if (!isLastWizardStep) { setStep((s) => s + 1); return; }

    if (isGuest) {
      // Guest path: no account yet → quick win + signup gate. Nothing is saved server-side
      // until after signup (claim phát lại, draft là đường lùi).
      setStep(STEP_TASTE);
      return;
    }
    // Khoá nút NGAY từ đây: bấm hai lần là hai POST /profile song song và bên thua đụng
    // `uq_profile_user` → chính là nguồn 409 đáng chặn từ gốc. W7: màn "Đang tạo lộ trình…" hiện cho
    // cả người đăng ký thẳng (I-10), không chỉ đường replay draft.
    setLoading(true);
    setResuming(true);
    if (!(await saveProfile())) { setLoading(false); setResuming(false); return; } // block redirect on a failed save
    trackEvent('onboarding_completed', { level: currentLevel, goal: goalType, industry });
    // Di trú spec §6.3: `onboarding_completed` thực chất là "đã lưu hồ sơ" — bắn song song tên
    // đúng nghĩa ≥2 tuần rồi mới gỡ tên cũ. ĐỪNG đổi nghĩa tên đang chạy.
    trackEvent('onboarding_profile_saved', { level: currentLevel, goal: goalType, industry });
    await continueAfterProfileSaved(currentLevel, null);
  };

  const card = "rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6 shadow-ga-card-hover space-y-4";
  // GaBtn ép whitespace-nowrap + h-11: nhãn CTA tiếng Việt dài tràn ngang ở khổ 320px.
  const btnWrap = "h-auto min-h-[44px] whitespace-normal py-2.5 text-center lg:h-11 lg:whitespace-nowrap lg:py-0";

  const mentorCard = mentor ? (
    <div className="space-y-1.5">
      <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3 flex items-center gap-3">
        <div className="w-11 h-11 rounded-ga-pill bg-ga-yellow flex items-center justify-center shrink-0"><GaIcon name="school" size={22} className="text-ga-ink" /></div>
        <div className="min-w-0">
          <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{t("pace.mentorLabel")}</p>
          <p className="ga-ui text-ga-small font-bold text-ga-ink">{mentor.displayName}</p>
          <p className="text-ga-caption text-ga-muted">{mentorTagline(mentor.code) ?? t("mentorTaglines.fallback")}</p>
        </div>
      </div>
      {mentor.upsellCode && mentorUpsellEnabled && !hideUpsell && (
        <button type="button"
          onClick={() => { trackEvent('onboarding_mentor_upsell_clicked', { mentor: mentor.code, upsell: mentor.upsellCode }); router.push(PRICING_ROUTE); }}
          className="w-full text-left text-ga-caption text-ga-ink bg-ga-yellow-soft border border-dashed border-ga-gold rounded-ga px-3 py-2">
          {t.rich("pace.upsell", {
            name: mentor.upsellDisplayName ?? "",
            tagline: mentorTaglineSuffix(mentor.upsellCode),
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </button>
      )}
    </div>
  ) : null;

  // CREATING (W7): replay draft / claim sau đăng ký, VÀ người đăng ký thẳng bấm lưu — cùng một màn (I-10).
  if (resuming) {
    return (
      <GaAuthShell showBackToLanding={false}>
        <CreatingPanel />
      </GaAuthShell>
    );
  }

  // PROFILE_LITE (Đợt 5): học viên trung tâm — không hỏi mục tiêu/lĩnh vực, mentor do trung tâm quyết.
  if (orgContext) {
    return (
      <GaAuthShell wide>
        <OrgLiteWizard ctx={orgContext} loading={loading} onSubmit={saveLiteProfile} />
      </GaAuthShell>
    );
  }

  // Khách A0 không có bước Chọn đường: cổng tài khoản là bước 6 chứ không phải 7 (W-13).
  const skipsPathChoice = isGuest && !guestNeedsPathChoice(currentLevel);
  const shownStep = Math.min(skipsPathChoice && step >= STEP_AUTH_GATE ? step - 1 : step, totalSteps);
  const stepTitle = stepId === "motivation" ? t("goal.heading")
    : stepId === "level" ? t("level.heading")
    : stepId === "rhythm" ? t("rhythm.heading")
    : stepId === "focus" ? (goalType === "WORK" ? t("focus.industryHeading") : t("focus.examHeading"))
    : step === STEP_TASTE && isGuest ? t("quickWin.heading")
    : step === STEP_PATH_CHOICE ? t("pathChoice.heading")
    : step === STEP_AUTH_GATE && isGuest ? t("signup.heading")
    : t("test.heading");

  return (
    <GaAuthShell wide>
      <div className="mx-auto w-full max-w-lg overflow-x-clip">
        <div className="rounded-ga border border-ga-line bg-ga-card p-4 mb-4">
          <p className="ga-ui text-ga-body font-semibold text-ga-ink">{t("intro.title")}</p>
          <p className="mt-1 text-ga-small text-ga-muted">{t("intro.subtitle")}</p>
        </div>
        <div
          role="progressbar"
          aria-label={t("nav.progressAria")}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={shownStep}
          className="mb-6 flex items-center justify-center gap-2"
        >
          {Array.from({ length: totalSteps }, (_, index) => index + 1).map(s => (
            <span aria-hidden="true" key={s} className={`h-1.5 w-8 rounded-ga-pill ${s <= shownStep ? "bg-ga-yellow" : "bg-ga-line"}`} />
          ))}
        </div>
        {/* W-12: đầu đọc màn hình nghe "Bước X trên Y: <tiêu đề>" mỗi lần đổi bước. */}
        <div aria-live="polite" className="sr-only">{t("nav.stepAnnounce", { step: shownStep, total: totalSteps, title: stepTitle })}</div>

        <AnimatePresence mode="wait">
          {stepId === "motivation" && (
            <motion.div key="s1" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading}>
              <MotivationStep value={motivation} onChange={(m) => patch({ motivation: m })} headingRef={headingRef} />
            </motion.div>
          )}

          {stepId === "level" && (
            <motion.div key="s2" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading}>
              <LevelStep
                currentLevel={currentLevel}
                targetLevel={targetLevel}
                onChangeCurrent={(l) => patch({ currentLevel: l })}
                onChangeTarget={(l) => patch({ targetLevel: l })}
                headingRef={headingRef}
              />
            </motion.div>
          )}

          {stepId === "rhythm" && (
            <motion.div key="s3" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading}>
              <RhythmStep value={dailyGoalMinutes} onChange={(m) => patch({ dailyGoalMinutes: m })} currentLevel={currentLevel} headingRef={headingRef} />
            </motion.div>
          )}

          {stepId === "focus" && (
            <motion.div key="s4" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading}>
              <FocusStep
                goalType={goalType}
                industry={industry}
                examType={examType}
                onChangeIndustry={(i) => patch({ industry: i })}
                onChangeExam={(e) => patch({ examType: e })}
                mentorCard={mentorCard}
                headingRef={headingRef}
              />
            </motion.div>
          )}

          {step === STEP_TASTE && isGuest && (
            <motion.div key="s5qw" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading} className={`${card} text-center`}>
              <div className="inline-flex w-16 h-16 rounded-ga-pill items-center justify-center bg-ga-yellow-soft text-ga-gold mx-auto"><GaIcon name="record_voice_over" size={30} /></div>
              <h1 ref={headingRef} tabIndex={-1} className="font-ga-display text-ga-h1-m text-ga-ink outline-none">{t("quickWin.heading")}</h1>
              <p className="text-ga-small text-ga-muted">{t("quickWin.prompt")}</p>
              <div className="space-y-2 text-left" role="group" aria-label={t("quickWin.prompt")}>
                {["Guten Morgen","Gute Nacht","Auf Wiedersehen"].map(opt => {
                  const picked = quickWinChoice === opt;
                  const isCorrect = opt === "Guten Morgen";
                  const answered = quickWinChoice !== null;
                  const solved = quickWinChoice === "Guten Morgen";
                  return (
                    <button key={opt} type="button" disabled={solved}
                      onClick={() => {
                        setQuickWinChoice(opt);
                        // Bản cũ chỉ bắn khi ĐÚNG ⇒ không đo được tỷ lệ sai. Tên mới bắn cả hai.
                        trackEvent('guest_activity_completed', { kind: 'quick_win', correct: isCorrect });
                        void syncGuestSession('TASTE', undefined, { quickWin: { correct: isCorrect, choice: opt } });
                        if (isCorrect) trackEvent('onboarding_quickwin_completed', { correct: true });
                      }}
                      className={`ga-ui w-full text-left p-3 rounded-ga border text-ga-small transition-colors duration-150 disabled:cursor-default ${
                        answered && isCorrect ? "border-ga-green bg-ga-green-soft font-bold text-ga-ink"
                        : picked ? "border-ga-red bg-ga-red-soft text-ga-red"
                        : "border-ga-line text-ga-ink hover:border-ga-subtle"}`}>
                      <span className="inline-flex items-center gap-1.5">{opt}{answered && isCorrect ? <GaIcon name="check" size={14} /> : null}</span>
                    </button>
                  );
                })}
              </div>
              <div aria-live="polite">
                {quickWinChoice === "Guten Morgen" ? (
                  <>
                    <p className="ga-ui text-ga-small font-bold text-ga-green">{t("quickWin.correct")}</p>
                    <GaBtn variant="ink" size="lg" className="w-full mt-3" onClick={afterQuickWin}>{t("nav.continue")} <ArrowRight size={14}/></GaBtn>
                  </>
                ) : quickWinChoice ? (
                  <p className="text-ga-caption text-ga-red">{t("quickWin.wrong")}</p>
                ) : null}
              </div>
            </motion.div>
          )}

          {step === STEP_AUTH_GATE && isGuest && (
            <motion.div key="s6" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading} className={`${card} text-center`}>
              {mentor && (
                <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3 flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-ga-pill bg-ga-yellow flex items-center justify-center shrink-0"><GaIcon name="school" size={22} className="text-ga-ink" /></div>
                  <div className="min-w-0">
                    <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{t("pace.mentorLabel")}</p>
                    <p className="ga-ui text-ga-small font-bold text-ga-ink">{mentor.displayName}</p>
                    <p className="text-ga-caption text-ga-muted">{mentorTagline(mentor.code) ?? t("mentorTaglines.fallback")}</p>
                  </div>
                </div>
              )}
              <h1 ref={headingRef} tabIndex={-1} className="font-ga-display text-ga-h1-m text-ga-ink outline-none">{t("signup.heading")}</h1>
              <p className="text-ga-small text-ga-muted">
                {mentor ? t("signup.subWithMentor", { name: mentor.displayName }) : t("signup.sub")}
              </p>
              <GaBtn variant="yellow" size="lg" className={`w-full ${btnWrap}`} onClick={handleGuestSignup}>
                {t("signup.cta")} <ArrowRight size={14}/>
              </GaBtn>
              <p className="text-ga-caption text-ga-muted">{t("signup.haveAccount")} <Link href="/v2/login" className="font-bold text-ga-ink underline">{t("signup.login")}</Link></p>
            </motion.div>
          )}

          {step === STEP_PATH_CHOICE && (
            <motion.div key="s5pc" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading}>
              <PathChoiceStep level={currentLevel} loading={loading} onPick={handlePathPick} headingRef={headingRef} />
            </motion.div>
          )}

          {step === STEP_PLACEMENT && !isGuest && !testResult && questions.length > 0 && (
            <motion.div key="s5t" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} onAnimationComplete={focusHeading} className={card}>
              <div className="flex items-center justify-between gap-2">
                <h2 ref={headingRef} tabIndex={-1} className="min-w-0 font-ga-display text-ga-h2 text-ga-ink outline-none lg:text-ga-h1-m">{t("test.heading")}</h2>
                <span className="ga-ui shrink-0 text-ga-caption text-ga-subtle">{currentQ+1}/{questions.length}</span>
              </div>
              <div className="flex gap-1" aria-hidden="true">{questions.map((_,i) => <div key={i} className={`flex-1 h-1 rounded-ga-pill ${i<currentQ?"bg-ga-green":i===currentQ?"bg-ga-yellow":"bg-ga-line"}`} />)}</div>
              <span className={`ga-ui inline-flex items-center gap-1 text-ga-eyebrow px-2 py-0.5 rounded-ga-pill ${
                (TEST_SKILL_CHIP[questions[currentQ].skillSection] ?? TEST_SKILL_CHIP.SCHREIBEN).cls
              }`}>
                <GaIcon name={(TEST_SKILL_CHIP[questions[currentQ].skillSection] ?? TEST_SKILL_CHIP.SCHREIBEN).icon} size={11} />
                {t((TEST_SKILL_CHIP[questions[currentQ].skillSection] ?? TEST_SKILL_CHIP.SCHREIBEN).labelKey as never)}
              </span>
              {questions[currentQ].audioTranscript && <div className="flex items-start gap-1.5 rounded-ga bg-ga-surface p-3 text-ga-caption text-ga-muted italic"><GaIcon name="volume_up" size={13} className="mt-[2px]" /><span>&quot;{questions[currentQ].audioTranscript}&quot;</span></div>}
              <p className="text-ga-small font-medium text-ga-ink whitespace-pre-line break-words">{questions[currentQ].questionDe}</p>
              {questions[currentQ].questionVi && <p className="text-ga-caption text-ga-subtle">{questions[currentQ].questionVi}</p>}
              {questions[currentQ].options ? (
                <div className="space-y-2" role="radiogroup" aria-label={questions[currentQ].questionDe}>{questions[currentQ].options!.map((opt,i) => (
                  <button key={i} type="button" role="radio" aria-checked={testAnswers[questions[currentQ].id]===opt} onClick={() => setTestAnswers(a => ({...a,[questions[currentQ].id]:opt}))}
                    className={`ga-ui w-full text-left p-3 rounded-ga border text-ga-small transition-colors duration-150 ${testAnswers[questions[currentQ].id]===opt?"border-ga-gold bg-ga-yellow-soft font-bold text-ga-ink":"border-ga-line text-ga-ink hover:border-ga-subtle"}`}>
                    {String.fromCharCode(65+i)}. {opt}
                  </button>
                ))}</div>
              ) : (
                <textarea value={testAnswers[questions[currentQ].id]??""} onChange={e => setTestAnswers(a => ({...a,[questions[currentQ].id]:e.target.value}))}
                  aria-label={questions[currentQ].questionDe}
                  placeholder={t("test.writePlaceholder")} className="ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink outline-none resize-none" rows={3} />
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

          {step === STEP_PLACEMENT && !isGuest && testResult && (
            <motion.div key="s5r" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} onAnimationComplete={focusHeading} className={`${card} text-center`} aria-live="polite">
              <div className={`inline-flex w-20 h-20 rounded-ga-pill items-center justify-center mx-auto ${testResult.passed?"bg-ga-green-soft text-ga-green":"bg-ga-red-soft text-ga-red"}`}>
                {testResult.passed ? <CheckCircle size={40}/> : <XCircle size={40}/>}
              </div>
              <h1 ref={headingRef} tabIndex={-1} className="font-ga-display text-ga-h1-m text-ga-ink outline-none">{testResult.passed ? t("result.passed") : t("result.failed")}</h1>
              <p className="text-ga-small text-ga-muted">
                {t.rich("result.score", {
                  correct: testResult.correctCount,
                  total: testResult.totalQuestions,
                  percent: testResult.scorePercent,
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
              {!testResult.passed && testResult.weakModules && (
                <div className="rounded-ga border border-ga-gold bg-ga-yellow-soft p-3 text-left">
                  <p className="text-ga-caption text-ga-ink">{t("result.weakModules", { modules: testResult.weakModules.join(", ") })}</p>
                  <p className="mt-1 text-ga-eyebrow normal-case tracking-normal font-normal text-ga-muted">{t("result.retryAfter", { days: testResult.retryAfterDays ?? 3 })}</p>
                </div>
              )}
              <GaBtn variant="ink" size="lg" className={`w-full ${btnWrap}`} onClick={() => router.push(ROADMAP_ROUTE)}>
                {testResult.passed ? t("result.ctaPassed") : t("result.ctaFailed")}
              </GaBtn>
              {/* Q-A (28/08): client thôi đọc `postAction`; PRICING_CTA = WEB × B1+ suy từ trình độ +
                  `paywallAllowed`; đang dùng thử / đã PRO thì ẩn (GĐ 2). */}
              {route?.paywallAllowed && UPPER_LEVELS.includes(currentLevel) && !hideUpsell && (
                <GaBtn variant="yellow" size="lg" className={`w-full ${btnWrap}`}
                  onClick={() => { trackEvent('onboarding_pricing_cta_clicked', { currentLevel }); router.push(PRICING_ROUTE); }}>
                  {t("result.pricingCta")}
                </GaBtn>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {step <= WIZARD_STEP_COUNT && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 lg:flex-nowrap lg:gap-0">
            {step > 1
              ? <GaBtn variant="ghost" onClick={() => setStep(s=>s-1)}><ArrowLeft size={14}/> {t("nav.back")}</GaBtn>
              : <div/>}
            <GaBtn variant="ink" size="lg" loading={loading} disabled={loading || (stepId ? !canLeaveStep(stepId, answers) : false)} onClick={nextStep}>
              {isLastWizardStep && !isGuest && currentLevel==="A0" ? t("nav.startRoadmap") : t("nav.continue")}
              <ArrowRight size={14}/>
            </GaBtn>
          </div>
        )}
      </div>
    </GaAuthShell>
  );
}
