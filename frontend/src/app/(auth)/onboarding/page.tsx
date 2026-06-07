"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useTracking } from "@/hooks/useTracking";
import { getOnboardingRoute, getOnboardingMentor, type OnboardingRouteData, type OnboardingMentorData } from "@/lib/profileApi";
import { MENTOR_META } from "@/lib/mentorMeta";
import { useFeatureFlagEnabled } from "posthog-js/react";

const LEVELS = [
  { value: "A0", emoji: "🌱", label: "Chưa biết gì", desc: "Bắt đầu từ bảng chữ cái" },
  { value: "A1", emoji: "📗", label: "Cơ bản (A1)", desc: "Biết chào hỏi, giới thiệu" },
  { value: "A2", emoji: "📘", label: "Sơ cấp (A2)", desc: "Giao tiếp đơn giản" },
  { value: "B1", emoji: "📙", label: "Trung cấp (B1)", desc: "Thảo luận, diễn đạt ý kiến" },
  { value: "B2", emoji: "📕", label: "Cao cấp (B2)", desc: "Đọc hiểu phức tạp" },
];
// "Vì sao bạn học?" — the emotional anchor (Duolingo's first question, adapted for the
// Việt → Đức audience). Each maps to a coarse goalType the plan still uses (EXAM → CERT, else WORK).
const MOTIVATIONS = [
  { value: "JOB",         emoji: "💼", label: "Đi làm tại Đức",       goal: "WORK" },
  { value: "AUSBILDUNG",  emoji: "🛠️", label: "Học nghề (Ausbildung)", goal: "WORK" },
  { value: "STUDY",       emoji: "🎓", label: "Du học",               goal: "WORK" },
  { value: "IMMIGRATION", emoji: "🏠", label: "Định cư / đoàn tụ",    goal: "WORK" },
  { value: "EXAM",        emoji: "📜", label: "Thi chứng chỉ",        goal: "CERT" },
  { value: "HOBBY",       emoji: "✨", label: "Sở thích cá nhân",     goal: "WORK" },
];
const EXAMS = ["GOETHE", "TELC", "TESTDAF"];
const WEEKLY = [
  { value: 3, emoji: "🔥", label: "3 bài/tuần", desc: "~15 phút/ngày" },
  { value: 5, emoji: "⚡", label: "5 bài/tuần", desc: "~20 phút/ngày" },
  { value: 7, emoji: "🚀", label: "7 bài/tuần", desc: "Mỗi ngày một bài" },
];
const INDUSTRIES = ["IT","Medizin","Gastronomie","Bildung","Handel","Sport","Andere"];

interface PQ { id: number; skillSection: string; type: string; questionDe: string; questionVi: string; audioTranscript?: string; options?: string[]; }

export default function OnboardingPage() {
  const router = useRouter();
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

  const fetchMentor = useCallback(async () => {
    try {
      setMentor(await getOnboardingMentor(goalType, industry, currentLevel));
    } catch { /* mentor preview is non-blocking */ }
  }, [goalType, industry, currentLevel]);

  /**
   * Persist the onboarding profile. Returns true on success (incl. 409 "already
   * exists" — idempotent). Surfaces real failures instead of silently swallowing
   * them, so callers can BLOCK the redirect and avoid leaving the user with an
   * incomplete profile (data-integrity fix, design §5 DI-3).
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
      return true;
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      if (err?.response?.status === 409) return true; // profile already exists → safe to proceed
      // api.ts already retried transient 5xx/429/network errors. Reaching here is a real
      // failure → surface it clearly and let the caller BLOCK the redirect (no silent skip).
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      const msg = err?.response?.data?.detail
        ?? (offline || !err?.response
          ? "Mất kết nối — hồ sơ chưa được lưu. Kiểm tra mạng rồi thử lại."
          : "Không lưu được hồ sơ học tập. Vui lòng thử lại.");
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
      toast.error(msg || "Không thể tạo bài test.");
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
    catch { toast.error("Nộp bài thất bại."); }
    setLoading(false);
  }, [testId, answers, trackEvent]);

  const goRoadmap = useCallback(async () => {
    setLoading(true);
    if (!(await saveProfile())) { setLoading(false); return; } // block redirect on a failed save
    trackEvent('onboarding_completed', { level: currentLevel, goal: goalType, industry: industry });
    router.push("/student/roadmap");
  }, [saveProfile, router, trackEvent, currentLevel, goalType, industry]);

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

  const card = "bg-white rounded-2xl p-6 shadow-lg border border-[#E2E8F0] space-y-4";
  const sel = (v: boolean) => `w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${v ? "border-[#FFCD00] bg-[#FFCD00]/5 shadow-sm" : "border-[#E2E8F0] hover:border-[#CBD5E1]"}`;
  const firstWin = currentLevel === "A0" ? "Bắt đầu với bảng chữ cái, phát âm và những câu chào đầu tiên" : "Làm bài test xếp lớp để nhận lộ trình phù hợp ngay";

  return (
    <div className="min-h-screen bg-[#F1F4F9] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#FFCD00] flex items-center justify-center"><span className="text-[#121212] font-black text-base">D</span></div>
          <span className="font-bold text-xl text-[#0F172A]">DeutschFlow<span className="text-[#FFCD00]">.</span></span>
        </div>
        <div className="rounded-2xl bg-white border border-[#E2E8F0] shadow-lg p-4 mb-4">
          <p className="text-sm font-semibold text-[#0F172A]">Bắt đầu trong 2 phút</p>
          <p className="text-xs text-[#64748B] mt-1">Chọn trình độ, mục tiêu và nhịp học để nhận lộ trình cá nhân hóa ngay.</p>
        </div>
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1,2,3,4].map(s => <div key={s} className={`w-8 h-1.5 rounded-full ${s <= step ? "bg-[#FFCD00]" : "bg-[#E2E8F0]"}`} />)}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <h2 className="text-lg font-bold text-[#0F172A]">Bạn đang ở trình độ nào?</h2>
              <p className="text-sm text-[#64748B]">Chọn trình độ phù hợp nhất.</p>
              {LEVELS.map(l => (
                <button key={l.value} type="button" onClick={() => setCurrentLevel(l.value)} className={sel(currentLevel===l.value)}>
                  <span className="text-2xl">{l.emoji}</span>
                  <div className="flex-1"><p className="text-sm font-bold text-[#0F172A]">{l.label}</p><p className="text-xs text-[#64748B]">{l.desc}</p></div>
                  {currentLevel===l.value && <CheckCircle size={18} className="text-[#FFCD00]" />}
                </button>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <h2 className="text-lg font-bold text-[#0F172A]">Vì sao bạn học tiếng Đức?</h2>
              <p className="text-sm text-[#64748B]">Để chúng mình chọn đúng mentor và lộ trình cho bạn.</p>
              <div className="grid grid-cols-2 gap-2">
                {MOTIVATIONS.map(m => (
                  <button key={m.value} type="button" onClick={() => { setMotivation(m.value); setGoalType(m.goal); }}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${motivation===m.value ? "border-[#FFCD00] bg-[#FFCD00]/5 shadow-sm" : "border-[#E2E8F0] hover:border-[#CBD5E1]"}`}>
                    <span className="text-2xl block mb-1">{m.emoji}</span>
                    <p className="text-xs font-bold leading-tight text-[#0F172A]">{m.label}</p>
                  </button>
                ))}
              </div>
              {goalType === "WORK" ? (
                <>
                  <label className="text-sm font-medium text-[#0F172A]">Ngành nghề</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INDUSTRIES.map(ind => (
                      <button key={ind} type="button" onClick={() => setIndustry(ind)}
                        className={`text-xs px-3 py-1.5 rounded-full border ${industry===ind ? "bg-[#FFCD00] border-[#FFCD00] text-[#121212] font-bold" : "border-[#E2E8F0] text-[#64748B]"}`}>
                        {ind}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <label className="text-sm font-medium text-[#0F172A]">Loại chứng chỉ</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMS.map(ex => (
                      <button key={ex} type="button" onClick={() => setExamType(ex)}
                        className={`text-xs px-3 py-1.5 rounded-full border ${examType===ex ? "bg-[#FFCD00] border-[#FFCD00] text-[#121212] font-bold" : "border-[#E2E8F0] text-[#64748B]"}`}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label className="text-sm font-medium text-[#0F172A]">Trình độ mục tiêu</label>
              <select value={targetLevel} onChange={e => setTargetLevel(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FFCD00] outline-none">
                {["A1","A2","B1","B2","C1","C2"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <h2 className="text-lg font-bold text-[#0F172A]">Bạn muốn học bao nhiêu?</h2>
              <p className="text-sm text-[#64748B]">Weekly target ảnh hưởng đến chủ đề mở rộng cá nhân hóa.</p>
              {mentor && (
                <div className="space-y-1.5">
                  <div className="rounded-xl border-2 border-[#FFCD00]/50 bg-[#FFFBEB] p-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#FFCD00] flex items-center justify-center text-xl shrink-0">{MENTOR_META[mentor.code]?.emoji ?? "🧑‍🏫"}</div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-[#92400E]/80 font-semibold">Mentor của bạn</p>
                      <p className="text-sm font-bold text-[#0F172A]">{mentor.displayName}</p>
                      <p className="text-xs text-[#92400E]">{MENTOR_META[mentor.code]?.tagline ?? "Người đồng hành học tập"}</p>
                    </div>
                  </div>
                  {mentor.upsellCode && mentorUpsellEnabled && (
                    <button type="button"
                      onClick={() => { trackEvent('onboarding_mentor_upsell_clicked', { mentor: mentor.code, upsell: mentor.upsellCode }); router.push("/student/pricing"); }}
                      className="w-full text-left text-xs text-[#92400E] bg-[#FFFBEB] border border-dashed border-[#FCD34D] rounded-lg px-3 py-2">
                      🔓 Mở khoá mentor <strong>{mentor.upsellDisplayName}</strong>
                      {MENTOR_META[mentor.upsellCode]?.tagline ? ` (${MENTOR_META[mentor.upsellCode].tagline})` : ""} với PRO →
                    </button>
                  )}
                </div>
              )}
              {WEEKLY.map(w => (
                <button key={w.value} type="button" onClick={() => setWeeklyTarget(w.value)} className={sel(weeklyTarget===w.value)}>
                  <span className="text-3xl">{w.emoji}</span>
                  <div className="flex-1"><p className="text-sm font-bold">{w.label}</p><p className="text-xs text-[#64748B]">{w.desc}</p></div>
                </button>
              ))}
              {currentLevel === "A0"
                ? <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3"><p className="text-xs text-[#15803D]">🌱 Bước đầu tiên của bạn sẽ là <strong>Bảng chữ cái, Phát âm và Chào hỏi</strong>.</p></div>
                : <div className="rounded-xl bg-[#FFFBEB] border border-[#FCD34D] p-3"><p className="text-xs text-[#92400E]">📝 Có thể làm <strong>bài kiểm tra 5 phút (tùy chọn)</strong> để vào đúng trình độ — hoặc bắt đầu học ngay.</p></div>
              }
            </motion.div>
          )}

          {step === 4 && placementOffer && !testResult && questions.length === 0 && (
            <motion.div key="s4offer" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={`${card} text-center`}>
              <div className="inline-flex w-16 h-16 rounded-full items-center justify-center bg-[#FFFBEB] text-3xl mx-auto">🎯</div>
              <h2 className="text-lg font-bold text-[#0F172A]">Vào đúng trình độ của bạn?</h2>
              <p className="text-sm text-[#64748B]">Bạn tự đánh giá <strong>{currentLevel}</strong>. Làm bài kiểm tra ~5 phút để lộ trình khớp chính xác — hoặc bắt đầu học ngay rồi tinh chỉnh sau.</p>
              <button type="button" onClick={startTest} disabled={loading}
                className="w-full py-3 rounded-xl bg-[#121212] text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {loading && <Loader2 size={14} className="animate-spin"/>} Làm bài kiểm tra 5 phút
              </button>
              <button type="button" onClick={() => { trackEvent('onboarding_placement_skipped', { currentLevel }); void goRoadmap(); }} disabled={loading}
                className="w-full py-2.5 rounded-xl border-2 border-[#E2E8F0] text-[#64748B] text-sm font-bold disabled:opacity-50">
                Bắt đầu học ngay →
              </button>
            </motion.div>
          )}

          {step === 4 && !testResult && questions.length > 0 && (
            <motion.div key="s4t" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} className={card}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Bài kiểm tra xếp lớp</h2>
                <span className="text-xs text-[#94A3B8]">{currentQ+1}/{questions.length}</span>
              </div>
              <div className="flex gap-1">{questions.map((_,i) => <div key={i} className={`flex-1 h-1 rounded-full ${i<currentQ?"bg-[#22C55E]":i===currentQ?"bg-[#FFCD00]":"bg-[#E2E8F0]"}`} />)}</div>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                questions[currentQ].skillSection==="HOEREN"?"bg-blue-100 text-blue-700":
                questions[currentQ].skillSection==="SPRECHEN"?"bg-red-100 text-red-700":
                questions[currentQ].skillSection==="LESEN"?"bg-green-100 text-green-700":"bg-purple-100 text-purple-700"
              }`}>{questions[currentQ].skillSection==="HOEREN"?"🎧 Nghe":questions[currentQ].skillSection==="SPRECHEN"?"🎤 Nói":questions[currentQ].skillSection==="LESEN"?"📚 Đọc":"✍️ Viết"}</span>
              {questions[currentQ].audioTranscript && <div className="rounded-lg bg-[#F1F5F9] p-3 text-xs text-[#475569] italic">🔊 &quot;{questions[currentQ].audioTranscript}&quot;</div>}
              <p className="text-sm font-medium text-[#0F172A] whitespace-pre-line">{questions[currentQ].questionDe}</p>
              {questions[currentQ].questionVi && <p className="text-xs text-[#94A3B8]">{questions[currentQ].questionVi}</p>}
              {questions[currentQ].options ? (
                <div className="space-y-2">{questions[currentQ].options!.map((opt,i) => (
                  <button key={i} type="button" onClick={() => setAnswers(a => ({...a,[questions[currentQ].id]:opt}))}
                    className={`w-full text-left p-3 rounded-xl border-2 text-sm ${answers[questions[currentQ].id]===opt?"border-[#FFCD00] bg-[#FFCD00]/5 font-bold":"border-[#E2E8F0]"}`}>
                    {String.fromCharCode(65+i)}. {opt}
                  </button>
                ))}</div>
              ) : (
                <textarea value={answers[questions[currentQ].id]??""} onChange={e => setAnswers(a => ({...a,[questions[currentQ].id]:e.target.value}))}
                  placeholder="Viết câu trả lời bằng tiếng Đức..." className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FFCD00] outline-none resize-none" rows={3} />
              )}
              <div className="flex items-center justify-between pt-2">
                {currentQ > 0 ? <button type="button" onClick={() => setCurrentQ(q=>q-1)} className="text-sm text-[#64748B] flex items-center gap-1"><ArrowLeft size={14}/> Trước</button> : <div/>}
                {currentQ < questions.length-1
                  ? <button type="button" onClick={() => setCurrentQ(q=>q+1)} className="text-sm bg-[#121212] text-white px-4 py-2 rounded-xl flex items-center gap-1">Tiếp <ArrowRight size={14}/></button>
                  : <button type="button" onClick={submitTest} disabled={loading} className="text-sm bg-[#FFCD00] text-[#121212] px-4 py-2 rounded-xl font-bold flex items-center gap-1 disabled:opacity-50">
                      {loading && <Loader2 size={14} className="animate-spin"/>} Nộp bài
                    </button>
                }
              </div>
            </motion.div>
          )}

          {step === 4 && testResult && (
            <motion.div key="s4r" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className={`${card} text-center`}>
              <div className={`inline-flex w-20 h-20 rounded-full items-center justify-center ${testResult.passed?"bg-green-100 text-green-600":"bg-red-100 text-red-600"}`}>
                {testResult.passed ? <CheckCircle size={40}/> : <XCircle size={40}/>}
              </div>
              <h2 className="text-lg font-bold">{testResult.passed ? "Tốt rồi, bạn đã sẵn sàng!" : "Mình đã tìm ra chỗ cần ôn"}</h2>
              <p className="text-sm text-[#64748B]">Kết quả: <strong>{testResult.correctCount}/{testResult.totalQuestions}</strong> ({testResult.scorePercent}%)</p>
              {!testResult.passed && testResult.weakModules && (
                <div className="rounded-xl bg-[#FFFBEB] border border-[#FCD34D] p-3 text-left">
                  <p className="text-xs text-[#92400E]">📋 Module cần ôn: {testResult.weakModules.join(", ")}</p>
                  <p className="text-[10px] text-[#92400E]/70 mt-1">Làm lại sau {testResult.retryAfterDays ?? 3} ngày.</p>
                </div>
              )}
              <button type="button" onClick={() => router.push("/student/roadmap")} className="w-full py-3 rounded-xl bg-[#121212] text-white text-sm font-bold">
                {testResult.passed ? "Bắt đầu lộ trình cá nhân hóa →" : "Xem lộ trình phù hợp →"}
              </button>
              {route?.paywallAllowed && route.postAction === "PRICING_CTA" && (
                <button type="button"
                  onClick={() => { trackEvent('onboarding_pricing_cta_clicked', { currentLevel }); router.push("/student/pricing"); }}
                  className="w-full py-2.5 rounded-xl border-2 border-[#FFCD00] text-[#92400E] text-sm font-bold">
                  Khám phá gói PRO để mở khóa toàn bộ →
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {step <= 3 && (
          <div className="flex items-center justify-between mt-4">
            {step > 1 ? <button type="button" onClick={() => setStep(s=>s-1)} className="text-sm text-[#64748B] flex items-center gap-1"><ArrowLeft size={14}/> Quay lại</button> : <div/>}
            <button type="button" onClick={nextStep} disabled={loading}
              className="text-sm bg-[#121212] text-white px-6 py-2.5 rounded-xl flex items-center gap-1.5 disabled:opacity-50">
              {loading && <Loader2 size={14} className="animate-spin"/>}
              {step===3 && currentLevel==="A0" ? "Bắt đầu lộ trình" : "Tiếp tục"}
              <ArrowRight size={14}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
