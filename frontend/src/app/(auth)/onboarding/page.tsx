"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";

const LEVELS = [
  { value: "A0", emoji: "🌱", label: "Chưa biết gì", desc: "Bắt đầu từ bảng chữ cái" },
  { value: "A1", emoji: "📗", label: "Cơ bản (A1)", desc: "Biết chào hỏi, giới thiệu" },
  { value: "A2", emoji: "📘", label: "Sơ cấp (A2)", desc: "Giao tiếp đơn giản" },
  { value: "B1", emoji: "📙", label: "Trung cấp (B1)", desc: "Thảo luận, diễn đạt ý kiến" },
  { value: "B2", emoji: "📕", label: "Cao cấp (B2)", desc: "Đọc hiểu phức tạp" },
];
const GOALS = [
  { value: "WORK", emoji: "💼", label: "Công việc", desc: "Phát triển sự nghiệp" },
  { value: "CERT", emoji: "📜", label: "Chứng chỉ", desc: "Luyện thi Goethe / TestDaF" },
];
const WEEKLY = [
  { value: 3, emoji: "🔥", label: "3 bài/tuần", desc: "~15 phút/ngày" },
  { value: 5, emoji: "⚡", label: "5 bài/tuần", desc: "~20 phút/ngày" },
  { value: 7, emoji: "🚀", label: "7 bài/tuần", desc: "Mỗi ngày một bài" },
];
const INDUSTRIES = ["IT","Medizin","Gastronomie","Bildung","Handel","Sport","Andere"];

interface PQ { id: number; skillSection: string; type: string; questionDe: string; questionVi: string; audioTranscript?: string; options?: string[]; }

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentLevel, setCurrentLevel] = useState("A0");
  const [goalType, setGoalType] = useState("WORK");
  const [industry, setIndustry] = useState("IT");
  const [targetLevel, setTargetLevel] = useState("B1");
  const [weeklyTarget, setWeeklyTarget] = useState(5);

  // Placement test state
  const [testId, setTestId] = useState<string|null>(null);
  const [questions, setQuestions] = useState<PQ[]>([]);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [testResult, setTestResult] = useState<{passed:boolean;scorePercent:number;correctCount:number;totalQuestions:number;weakModules?:number[];startingNodeId?:number;retryAfterDays?:number}|null>(null);

  const saveProfile = useCallback(async () => {
    try {
      await api.post("/onboarding/profile", {
        goalType, targetLevel, currentLevel, industry,
        sessionsPerWeek: weeklyTarget, minutesPerSession: 15,
        learningSpeed: weeklyTarget >= 7 ? "FAST" : weeklyTarget >= 5 ? "NORMAL" : "SLOW",
      });
    } catch { /* may already exist */ }
  }, [goalType, targetLevel, currentLevel, industry, weeklyTarget]);

  const startTest = useCallback(async () => {
    setLoading(true);
    try {
      await saveProfile();
      const { data } = await api.post("/skill-tree/placement-test", { claimedLevel: currentLevel });
      setTestId(data.testId); setQuestions(data.questions ?? []); setAnswers({}); setCurrentQ(0); setStep(4);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(msg || "Không thể tạo bài test.");
    }
    setLoading(false);
  }, [currentLevel, saveProfile]);

  const submitTest = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    try { const { data } = await api.post(`/skill-tree/placement-test/${testId}/submit`, { answers }); setTestResult(data); }
    catch { alert("Nộp bài thất bại."); }
    setLoading(false);
  }, [testId, answers]);

  const goRoadmap = useCallback(async () => { setLoading(true); await saveProfile(); router.push("/student/roadmap"); }, [saveProfile, router]);

  const nextStep = async () => {
    if (step === 3) { currentLevel === "A0" ? await goRoadmap() : await startTest(); }
    else setStep(s => s + 1);
  };

  const card = "bg-white rounded-2xl p-6 shadow-lg border border-[#E2E8F0] space-y-4";
  const sel = (v: boolean) => `w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${v ? "border-[#FFCD00] bg-[#FFCD00]/5 shadow-sm" : "border-[#E2E8F0] hover:border-[#CBD5E1]"}`;

  return (
    <div className="min-h-screen bg-[#F1F4F9] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#FFCD00] flex items-center justify-center"><span className="text-[#121212] font-black text-base">D</span></div>
          <span className="font-bold text-xl text-[#0F172A]">DeutschFlow<span className="text-[#FFCD00]">.</span></span>
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
              <h2 className="text-lg font-bold text-[#0F172A]">Mục tiêu của bạn?</h2>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button key={g.value} type="button" onClick={() => setGoalType(g.value)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${goalType===g.value ? "border-[#FFCD00] bg-[#FFCD00]/5" : "border-[#E2E8F0]"}`}>
                    <span className="text-3xl block mb-1">{g.emoji}</span>
                    <p className="text-sm font-bold">{g.label}</p><p className="text-[10px] text-[#64748B]">{g.desc}</p>
                  </button>
                ))}
              </div>
              <label className="text-sm font-medium text-[#0F172A]">Ngành nghề</label>
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRIES.map(ind => (
                  <button key={ind} type="button" onClick={() => setIndustry(ind)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${industry===ind ? "bg-[#FFCD00] border-[#FFCD00] text-[#121212] font-bold" : "border-[#E2E8F0] text-[#64748B]"}`}>
                    {ind}
                  </button>
                ))}
              </div>
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
              {WEEKLY.map(w => (
                <button key={w.value} type="button" onClick={() => setWeeklyTarget(w.value)} className={sel(weeklyTarget===w.value)}>
                  <span className="text-3xl">{w.emoji}</span>
                  <div className="flex-1"><p className="text-sm font-bold">{w.label}</p><p className="text-xs text-[#64748B]">{w.desc}</p></div>
                </button>
              ))}
              {currentLevel === "A0"
                ? <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3"><p className="text-xs text-[#15803D]">🌱 Bạn sẽ bắt đầu từ <strong>Bảng chữ cái &amp; Phát âm</strong></p></div>
                : <div className="rounded-xl bg-[#FFFBEB] border border-[#FCD34D] p-3"><p className="text-xs text-[#92400E]">📝 Trình độ <strong>{currentLevel}</strong> → làm bài kiểm tra xếp lớp (10 câu, 15 phút)</p></div>
              }
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
              <h2 className="text-lg font-bold">{testResult.passed ? "Chúc mừng! 🎉" : "Cần ôn lại thêm"}</h2>
              <p className="text-sm text-[#64748B]">Kết quả: <strong>{testResult.correctCount}/{testResult.totalQuestions}</strong> ({testResult.scorePercent}%)</p>
              {!testResult.passed && testResult.weakModules && (
                <div className="rounded-xl bg-[#FFFBEB] border border-[#FCD34D] p-3 text-left">
                  <p className="text-xs text-[#92400E]">📋 Module cần ôn: {testResult.weakModules.join(", ")}</p>
                  <p className="text-[10px] text-[#92400E]/70 mt-1">Làm lại sau {testResult.retryAfterDays ?? 3} ngày.</p>
                </div>
              )}
              <button type="button" onClick={() => router.push("/student/roadmap")} className="w-full py-3 rounded-xl bg-[#121212] text-white text-sm font-bold">
                {testResult.passed ? "Bắt đầu học →" : "Xem Lộ trình →"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {step <= 3 && (
          <div className="flex items-center justify-between mt-4">
            {step > 1 ? <button type="button" onClick={() => setStep(s=>s-1)} className="text-sm text-[#64748B] flex items-center gap-1"><ArrowLeft size={14}/> Quay lại</button> : <div/>}
            <button type="button" onClick={nextStep} disabled={loading}
              className="text-sm bg-[#121212] text-white px-6 py-2.5 rounded-xl flex items-center gap-1.5 disabled:opacity-50">
              {loading && <Loader2 size={14} className="animate-spin"/>}
              {step===3 && currentLevel==="A0" ? "Bắt đầu học" : step===3 ? "Làm bài test" : "Tiếp tục"}
              <ArrowRight size={14}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
