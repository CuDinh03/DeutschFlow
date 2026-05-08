"use client";

import { useEffect } from "react";
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

const VIEW_TABS = [
  { key: "grammar" as const, label: "Ngữ pháp", icon: BookOpen, emoji: "📖" },
  { key: "reading" as const, label: "Đọc", icon: FileText, emoji: "📚" },
  { key: "listening" as const, label: "Nghe", icon: Headphones, emoji: "🎧" },
  { key: "speaking" as const, label: "Nói", icon: Mic, emoji: "🎤" },
  { key: "writing" as const, label: "Viết", icon: PenTool, emoji: "✍️" },
];

export default function LearnNodePage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = Number(params?.nodeId);

  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const { session, loading, error, activeView, setActiveView, fetchSession, reset } = useNodeSessionStore();

  useEffect(() => {
    if (!me || !nodeId) return;
    reset();
    fetchSession(nodeId);
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
      headerTitle={session?.titleVi ?? "Bài học"}
      headerSubtitle={session?.moduleTitleVi ?? "Đang tải..."}
    >
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ── Back button ── */}
        <button
          type="button"
          onClick={() => router.push("/student/roadmap")}
          className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#121212] transition-colors"
        >
          <ArrowLeft size={16} />
          Quay lại Lộ trình
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
            <p className="text-sm text-[#64748B]">Đang tải bài học...</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="text-center py-16 text-red-500 bg-white rounded-3xl border-2 border-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ── No content ── */}
        {session && !session.hasContent && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <div className="w-16 h-16 rounded-full bg-[#FFCD00]/10 flex items-center justify-center text-3xl">⚡</div>
            <p className="text-sm text-[#64748B]">Bài học đang được tạo bởi AI...</p>
            <p className="text-xs text-[#94A3B8]">Vui lòng quay lại sau vài phút.</p>
          </div>
        )}

        {/* ── Content View Tabs ── */}
        {session?.hasContent && session.content && (
          <>
            <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 overflow-x-auto">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveView(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    activeView === tab.key
                      ? "bg-[#121212] text-white shadow-sm"
                      : "text-[#64748B] hover:bg-white hover:text-[#121212]"
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── View Content ── */}
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === "grammar" && <GrammarView content={session.content} />}
              {activeView === "reading" && <ReadingView content={session.content} />}
              {activeView === "listening" && <ListeningView content={session.content} />}
              {activeView === "speaking" && <SpeakingView content={session.content} />}
              {activeView === "writing" && <WritingView content={session.content} />}
            </motion.div>
          </>
        )}
      </div>
    </StudentShell>
  );
}
