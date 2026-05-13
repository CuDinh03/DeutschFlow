"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Headphones, Loader2, Mic, PenTool, FileText } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { logout } from "@/lib/authSession";
import GrammarView from "@/components/learn/GrammarView";
import ReadingView from "@/components/learn/ReadingView";
import ListeningView from "@/components/learn/ListeningView";
import SpeakingView from "@/components/learn/SpeakingView";
import WritingView from "@/components/learn/WritingView";
import SessionRecap from "@/components/learn/SessionRecap";
import PhonemeCoach from "@/components/learn/PhonemeCoach";
import { useTranslations } from "next-intl";

const VIEW_TABS = [
  { key: "grammar" as const, tKey: "grammar", icon: BookOpen, emoji: "📖" },
  { key: "reading" as const, tKey: "reading", icon: FileText, emoji: "📚" },
  { key: "listening" as const, tKey: "listening", icon: Headphones, emoji: "🎧" },
  { key: "speaking" as const, tKey: "speaking", icon: Mic, emoji: "🎤" },
  { key: "writing" as const, tKey: "writing", icon: PenTool, emoji: "✍️" },
  { key: "phoneme" as const, tKey: "phoneme", icon: Mic, emoji: "🗣️" },
];

export default function LearnNodePage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = Number(params?.nodeId);

  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const tLearn = useTranslations("learn");
  const { session, loading, error, activeView, setActiveView, fetchSession, reset, tabCompletion, tabScores, markTabCompleted, resetTabCompletion } = useNodeSessionStore();
  const [showRecap, setShowRecap] = useState(false);
  const [phonemeSuccessCount, setPhonemeSuccessCount] = useState<Set<number>>(new Set());

  // Score thresholds: reading/listening=100%, speaking/writing/phoneme=80%, grammar=completion only
  const getRequiredTabs = () => {
    if (!session?.content) return [];
    const c = session.content;
    const tabs: Array<{ tab: keyof typeof tabCompletion; threshold: number }> = [];
    if (c.theory_cards?.length > 0 || c.vocabulary?.length > 0) tabs.push({ tab: "grammar", threshold: 0 });
    if (c.reading_passage) tabs.push({ tab: "reading", threshold: 100 });
    if (c.audio_content) tabs.push({ tab: "listening", threshold: 100 });
    if (c.writing_prompt) tabs.push({ tab: "writing", threshold: 80 });
    if (c.phrases?.length > 0 || c.examples?.length > 0) tabs.push({ tab: "speaking", threshold: 80 });
    if (c.vocabulary?.length > 0) tabs.push({ tab: "phoneme", threshold: 80 });
    return tabs;
  };

  // Auto-complete logic (score-based)
  useEffect(() => {
    if (!session?.content || showRecap) return;
    const requiredTabs = getRequiredTabs();
    if (requiredTabs.length === 0) return;

    const allAttempted = requiredTabs.every(({ tab }) => tabCompletion[tab]);
    const allPassed = requiredTabs.every(({ tab, threshold }) =>
      threshold === 0 ? tabCompletion[tab] : tabScores[tab] >= threshold
    );

    if (allAttempted && allPassed) {
      setShowRecap(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tabCompletion, tabScores, showRecap]);

  useEffect(() => {
    if (!me || !nodeId) return;
    reset();
    fetchSession(nodeId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, nodeId]);

  if (meLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <Loader2 size={28} className="animate-spin text-[#121212]" />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="roadmap"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle={session?.titleVi ?? tLearn("lesson")}
      headerSubtitle={session?.moduleTitleVi ?? tLearn("loadingNode")}
    >
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ── Back button ── */}
        <button
          type="button"
          onClick={() => router.push("/student/roadmap")}
          className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#121212] transition-colors"
        >
          <ArrowLeft size={16} />
          {tLearn("backToRoadmap")}
        </button>

        {/* ── Header card ── */}
        {session && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 border-2 border-[#121212]/10"
            style={{ background: "linear-gradient(135deg, #121212 0%, #1E293B 100%)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                {session.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{session.titleVi}</p>
                <p className="text-white/60 text-xs">{session.titleDe}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFCD00] text-[#121212] font-bold">
                    {session.cefrLevel}
                  </span>
                  {session.moduleNumber !== null && (
                    <span className="text-[10px] text-white/50">
                      Module {session.moduleNumber} · {session.moduleTitleVi}
                    </span>
                  )}
                  <span className="text-[10px] text-white/40 ml-auto">+{session.xpReward} XP</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <Loader2 size={28} className="animate-spin text-[#121212]" />
            <p className="text-sm text-[#64748B]">{tLearn("loadingLesson")}</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center text-3xl">📚</div>
            <div className="text-center px-6">
              <p className="font-bold text-[#0F172A] mb-1">{tLearn("aiCreating")}</p>
              <p className="text-sm text-[#64748B]">{tLearn("comeBackLater")}</p>
            </div>
            <button onClick={() => router.push("/student/roadmap")}
              className="px-5 py-2.5 rounded-xl bg-[#121212] text-white text-sm font-semibold">
              ← {tLearn("backToRoadmap")}
            </button>
          </div>
        )}

        {/* ── No content (A2/B1 placeholder nodes) ── */}
        {session && !session.hasContent && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center text-4xl">
              {session.emoji || "📖"}
            </div>
            <div className="text-center px-6 space-y-2">
              <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFCD00] text-[#121212] mb-1">
                {session.cefrLevel}
              </span>
              <p className="font-bold text-[#0F172A] text-lg">{session.titleVi}</p>
              <p className="text-sm text-[#64748B] italic">{session.titleDe}</p>
              {session.descriptionVi && (
                <p className="text-sm text-[#94A3B8] mt-2 max-w-sm">{session.descriptionVi}</p>
              )}
            </div>
            <div className="rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] px-6 py-4 text-center max-w-sm">
              <p className="text-sm font-semibold text-[#92400E]">⚡ Nội dung đang được chuẩn bị</p>
              <p className="text-xs text-[#B45309] mt-1">
                Bài học {session.cefrLevel} sẽ sớm được cập nhật. Hãy hoàn thành các bài A1 trước!
              </p>
            </div>
            <button onClick={() => router.push("/student/roadmap")}
              className="px-5 py-2.5 rounded-xl bg-[#121212] text-white text-sm font-semibold">
              ← Quay lại Lộ trình
            </button>
          </div>
        )}


        {/* ── Content View Tabs ── */}
        {session?.hasContent && session.content && (
          <>
            <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 overflow-x-auto">
              {VIEW_TABS.map((tab) => {
                const isDone = tabCompletion[tab.key];
                const isActive = activeView === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveView(tab.key)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? "bg-[#121212] text-white shadow-sm"
                        : isDone
                        ? "text-green-600 bg-green-50 hover:bg-green-100"
                        : "text-[#64748B] hover:bg-white hover:text-[#121212]"
                    }`}
                  >
                    <span>{isDone ? "✅" : tab.emoji}</span>
                    <span className="hidden sm:inline">{tLearn(tab.tKey as any)}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Retry Banner (all attempted but not all passed) ── */}
            {(() => {
              const req = getRequiredTabs();
              const allAttempted = req.length > 0 && req.every(({ tab }) => tabCompletion[tab]);
              const allPassed = req.every(({ tab, threshold }) =>
                threshold === 0 ? tabCompletion[tab] : tabScores[tab] >= threshold
              );
              if (!allAttempted || allPassed || showRecap) return null;
              return (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-amber-800">⚠️ Chưa đủ điều kiện vượt node</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Nghe/Đọc yêu cầu 100% • Nói/Phát âm/Viết yêu cầu ≥ 80 điểm
                    </p>
                  </div>
                  <button
                    onClick={() => { resetTabCompletion(); setPhonemeSuccessCount(new Set()); }}
                    className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
                  >
                    🔄 Làm lại
                  </button>
                </div>
              );
            })()}

            {/* ── View Content ── */}
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === "grammar" && <GrammarView content={session.content} isLocked={tabCompletion.grammar} />}
              {activeView === "reading" && <ReadingView content={session.content} isLocked={tabCompletion.reading} />}
              {activeView === "listening" && <ListeningView content={session.content} isLocked={tabCompletion.listening} />}
              {activeView === "speaking" && <SpeakingView content={session.content} isLocked={tabCompletion.speaking} />}
              {activeView === "writing" && <WritingView content={session.content} isLocked={tabCompletion.writing} />}
              {activeView === "phoneme" && (() => {
                // Pick vocab items with German text as training phrases
                const vocab = session.content?.vocabulary ?? [];
                const firstVocab = vocab[0];
                const target = firstVocab?.german ?? session.titleDe ?? "Guten Tag";
                const meaning = firstVocab?.meaning ?? "";
                
                const handlePhonemeSuccess = (idx: number, score: number) => {
                  if (score >= 80) {
                    setPhonemeSuccessCount((prev) => {
                      const next = new Set(prev).add(idx);
                      const totalWords = Math.min(vocab.length, 5);
                      if (next.size >= totalWords * 0.8) {
                        markTabCompleted("phoneme", score);
                      }
                      return next;
                    });
                  }
                };

                return (
                  <div className="space-y-4">
                    <p className="text-xs text-[#64748B] text-center">
                      {tLearn("practicePronunciation")}
                    </p>
                    <PhonemeCoach
                      target={target}
                      meaningVi={meaning}
                      onSuccess={(score) => handlePhonemeSuccess(0, score)}
                    />
                    {vocab.length > 1 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{tLearn("otherWords")}</p>
                        {vocab.slice(1, 5).map((v, i) => (
                          <PhonemeCoach
                            key={i + 1}
                            target={v.german}
                            meaningVi={v.meaning}
                            onSuccess={(score) => handlePhonemeSuccess(i + 1, score)}
                          />
                        ))}
                      </div>
                    )}
                    {tabCompletion.phoneme && (
                      <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                        <p className="text-sm font-bold text-green-700">✅ {tLearn("phonemeSuccess")}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
        {/* ── Session Recap Modal ── */}
        {showRecap && session && (
          <SessionRecap
            xpEarned={session.xpReward ?? 150}
            vocabCount={session.content?.vocabulary?.length ?? 0}
            streakDays={streakDays}
            onBack={() => { setShowRecap(false); router.push("/student/roadmap"); }}
            onNext={() => { setShowRecap(false); router.push("/student/roadmap"); }}
          />
        )}
      </div>
        {/* ── Complete indicator ── */}
        {session?.hasContent && !showRecap && (
          <div className="px-4 pb-6 text-center">
            <p className="text-sm text-[#94A3B8]">
              {tLearn("completionHint")}
            </p>
          </div>
        )}
    </StudentShell>
  );
}
