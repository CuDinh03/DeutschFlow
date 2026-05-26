"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, ArrowRight, CheckCircle2, XCircle, Trophy, Loader2 } from "lucide-react";

interface JoinResult {
  quizId: number;
  title: string;
  status: string;
  quizType: string;
  pinCode: string;
  guestAccessToken?: string;
}

export default function StudentQuizPage() {
  const router = useRouter();
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();

  const [pinCode, setPinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"join" | "wait" | "playing" | "done">("join");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode.trim() || !nickname.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const { data } = await api.post<JoinResult>(`/quiz/${pinCode.trim().toUpperCase()}/join`, {
        nickname: nickname.trim(),
      });
      setJoinResult(data);
      if (data.status === "ACTIVE") {
        setPhase("playing");
      } else {
        setPhase("wait");
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Mã PIN không hợp lệ hoặc quiz đã kết thúc.");
    } finally {
      setJoining(false);
    }
  };

  const handleSubmitScore = async (finalScore: number) => {
    if (!joinResult) return;
    setSubmitting(true);
    try {
      await api.post(`/quiz/${joinResult.quizId}/submit`, {
        participant: nickname.trim(),
        totalScore: finalScore,
      });
      setScore(finalScore);
      setPhase("done");
    } catch {
      setScore(finalScore);
      setPhase("done");
    } finally {
      setSubmitting(false);
    }
  };

  if (meLoading || !me) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  );

  return (
    <StudentShell
      activeSection="quiz"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle="🎯 Tham gia Quiz"
      headerSubtitle="Nhập mã PIN từ giáo viên để tham gia"
    >
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <AnimatePresence mode="wait">
          {/* Phase: Join */}
          {phase === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <HelpCircle size={32} className="text-indigo-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800">Tham gia Quiz</h2>
                <p className="text-slate-500 text-sm mt-1">Nhập mã PIN do giáo viên cung cấp</p>
              </div>

              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mã PIN</label>
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.toUpperCase())}
                    placeholder="VD: ABC123"
                    maxLength={10}
                    className="w-full px-4 py-3 text-center text-2xl font-black tracking-widest rounded-2xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên hiển thị</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={me.displayName ?? "Tên của bạn"}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-semibold"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-semibold">
                    <XCircle size={16} /> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={joining || !pinCode.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-base transition-colors disabled:opacity-50"
                >
                  {joining ? <><Loader2 size={18} className="animate-spin" /> Đang tham gia...</> : <><ArrowRight size={18} /> Tham gia ngay</>}
                </button>
              </form>
            </motion.div>
          )}

          {/* Phase: Wait */}
          {phase === "wait" && joinResult && (
            <motion.div
              key="wait"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
                <Loader2 size={32} className="text-amber-500 animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">Đang chờ giáo viên bắt đầu</h2>
                <p className="text-slate-500 text-sm mt-2">
                  Bạn đã tham gia quiz <span className="font-bold text-indigo-600">{'"'}{joinResult.title}{'"'}</span> thành công!
                </p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-sm text-slate-500">Tên của bạn trong quiz</p>
                <p className="text-xl font-black text-slate-800 mt-1">{nickname || me.displayName}</p>
              </div>
              <p className="text-xs text-slate-400">Trang sẽ tự cập nhật khi quiz bắt đầu. Hãy giữ trang này mở.</p>
              <button
                onClick={() => { setPhase("playing"); }}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
              >
                Giáo viên đã bắt đầu? Vào làm bài
              </button>
            </motion.div>
          )}

          {/* Phase: Playing (Simple Score Submit) */}
          {phase === "playing" && joinResult && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6"
            >
              <div className="text-center">
                <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-3">🟢 Đang diễn ra</span>
                <h2 className="text-2xl font-black text-slate-800">{joinResult.title}</h2>
                <p className="text-slate-500 text-sm mt-1">Làm bài theo hướng dẫn của giáo viên, sau đó nhập điểm của bạn</p>
              </div>

              <div className="bg-indigo-50 rounded-2xl p-6 text-center">
                <p className="text-sm font-semibold text-slate-600 mb-3">Nhập điểm bạn đạt được</p>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0 – 100"
                  id="quiz-score-input"
                  className="w-full text-center text-4xl font-black text-indigo-600 bg-transparent border-b-4 border-indigo-300 focus:border-indigo-600 outline-none py-2 transition-colors"
                />
              </div>

              <button
                onClick={() => {
                  const input = document.getElementById("quiz-score-input") as HTMLInputElement;
                  handleSubmitScore(parseInt(input.value) || 0);
                }}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-base transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Nộp kết quả
              </button>
            </motion.div>
          )}

          {/* Phase: Done */}
          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-yellow-50 rounded-3xl flex items-center justify-center mx-auto">
                <Trophy size={40} className="text-yellow-500" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">Hoàn thành!</h2>
                <p className="text-slate-500 mt-2">Điểm của bạn đã được ghi nhận</p>
              </div>
              <div className="text-6xl font-black text-indigo-600">{score ?? 0}</div>
              <p className="text-sm text-slate-400">/ 100 điểm</p>
              <button
                onClick={() => router.push("/student")}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors"
              >
                Về trang chủ
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StudentShell>
  );
}
