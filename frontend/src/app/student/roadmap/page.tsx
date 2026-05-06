"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Lock,
  Check,
  Star,
  Flame,
  Trophy,
  ChevronLeft,
  Play,
  BookOpen,
  Zap,
  Map as MapIcon,
  Target,
  Users,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type LevelState = "completed" | "current" | "locked";

interface Level {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  state: LevelState;
  xpReward: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  category: string;
  description: string;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function getNodeColors(state: LevelState) {
  switch (state) {
    case "completed":
      return { color: "#10B981", shadowColor: "#059669" };
    case "current":
      return { color: "#FFCE00", shadowColor: "#C9A200" };
    case "locked":
    default:
      return { color: "#94A3B8", shadowColor: "#64748B" };
  }
}

// ─── Node Component ───────────────────────────────────────────────────────────

function LevelNode({
  level,
  index,
  isLeft,
  onClick,
  selected,
}: {
  level: Level;
  index: number;
  isLeft: boolean;
  onClick: () => void;
  selected: boolean;
}) {
  const isCompleted = level.state === "completed";
  const isCurrent = level.state === "current";
  const isLocked = level.state === "locked";
  const { color, shadowColor } = getNodeColors(level.state);

  const nodeSize = isCurrent ? 76 : isCompleted ? 68 : 64;

  return (
    <motion.div
      className="flex items-center w-full"
      initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex-1 flex justify-end pr-5">
        {isLeft && <InfoCard level={level} onClick={onClick} selected={selected} />}
      </div>

      <div className="flex flex-col items-center relative z-10">
        <motion.button
          onClick={!isLocked ? onClick : undefined}
          className="relative flex items-center justify-center rounded-full transition-all"
          style={{
            width: nodeSize,
            height: nodeSize,
            background: isCompleted
              ? "linear-gradient(145deg, #34D399, #10B981)"
              : isCurrent
              ? "linear-gradient(145deg, #FFD940, #FFCE00)"
              : "linear-gradient(145deg, #E2E8F0, #CBD5E1)",
            boxShadow: isCompleted
              ? `0 6px 0 0 ${shadowColor}, 0 10px 28px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.4)`
              : isCurrent
              ? `0 6px 0 0 ${shadowColor}, 0 10px 28px rgba(255,206,0,0.4), inset 0 1px 0 rgba(255,206,0,0.5)`
              : `0 4px 0 0 #94A3B8, 0 6px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)`,
            border: selected ? "3px solid white" : "3px solid rgba(255,255,255,0.3)",
            cursor: isLocked ? "not-allowed" : "pointer",
          }}
          whileHover={!isLocked ? { scale: 1.06, y: -2 } : {}}
          whileTap={!isLocked ? { scale: 0.96, y: 4 } : {}}
        >
          {isCompleted && <Check size={28} className="text-white" strokeWidth={3} />}
          {isCurrent && <span className="text-2xl">{level.emoji}</span>}
          {isLocked && <Lock size={20} className="text-[#94A3B8]" />}
        </motion.button>
      </div>

      <div className="flex-1 pl-5">
        {!isLeft && <InfoCard level={level} onClick={onClick} selected={selected} />}
      </div>
    </motion.div>
  );
}

function InfoCard({
  level,
  onClick,
  selected,
}: {
  level: Level;
  onClick: () => void;
  selected: boolean;
}) {
  const isLocked = level.state === "locked";
  const isCurrent = level.state === "current";
  const isCompleted = level.state === "completed";
  const { color } = getNodeColors(level.state);

  return (
    <motion.div
      onClick={!isLocked ? onClick : undefined}
      className="rounded-[16px] p-4 max-w-[210px] w-full transition-all duration-200 bg-white border-2 border-[#E2E8F0] shadow-sm"
      style={{
        background: selected ? (isCurrent ? "#FFF8E1" : isCompleted ? "#ECFDF5" : "white") : "white",
        borderColor: selected ? color : "#E2E8F0",
        opacity: isLocked ? 0.6 : 1,
        cursor: isLocked ? "pointer" : "pointer",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{level.emoji}</span>
        <div>
          <p className="font-bold text-sm leading-tight text-[#0F172A]">{level.title}</p>
          <p className="text-[10px] text-[#94A3B8]">{level.subtitle}</p>
        </div>
      </div>
      <p className="text-xs mb-3 text-[#64748B]">{level.description}</p>
    </motion.div>
  );
}

function Connector({ fromState, toState }: { fromState: LevelState; toState: LevelState }) {
  const bothDone = fromState === "completed" && toState === "completed";
  return (
    <div className="flex flex-col items-center h-9 relative z-0">
      <div className={`w-0.5 h-full ${bothDone ? "bg-[#10B981]" : "bg-[#E2E8F0]"}`} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();

  const fetchRoadmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Level[]>("/roadmap/me");
      setLevels(Array.isArray(data) ? data : []);
      // Auto-select the "current" node
      const currentNode = (Array.isArray(data) ? data : []).find((l: Level) => l.state === "current");
      if (currentNode) setSelectedLevel(currentNode.id);
    } catch (err: unknown) {
      console.error("[Roadmap] Failed to fetch:", err);
      setError("Không thể tải lộ trình. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me) void fetchRoadmap();
  }, [me, fetchRoadmap]);

  const selected = levels.find((l) => l.id === selectedLevel);

  if (meLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-[#00305E] border-t-transparent rounded-full"
        />
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
      onLogout={() => { logout() }}
      headerTitle="Lộ trình học tập"
      headerSubtitle="A1 → C1 Roadmap"
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-6 border-2 border-[#E2E8F0] shadow-xl">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-4 border-[#00305E] border-t-transparent rounded-full"
              />
              <p className="text-sm text-[#64748B]">Đang tạo lộ trình cá nhân hóa...</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle size={40} className="text-red-400" />
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => void fetchRoadmap()}
                className="flex items-center gap-2 px-4 py-2 bg-[#00305E] text-white rounded-xl text-sm font-medium hover:bg-[#004080] transition-colors"
              >
                <RefreshCw size={14} />
                Thử lại
              </button>
            </div>
          )}

          {/* Roadmap nodes */}
          {!loading && !error && levels.length > 0 && (
            <div className="flex flex-col items-stretch">
              {levels.map((level, i) => (
                <div key={level.id}>
                  <LevelNode
                    level={level}
                    index={i}
                    isLeft={i % 2 === 0}
                    onClick={() => setSelectedLevel(level.id === selectedLevel ? null : level.id)}
                    selected={selectedLevel === level.id}
                  />
                  {i < levels.length - 1 && <Connector fromState={level.state} toState={levels[i + 1].state} />}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && levels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <MapIcon size={40} className="text-[#94A3B8]" />
              <p className="text-sm text-[#64748B]">Chưa có lộ trình. Hãy hoàn thành Onboarding trước.</p>
            </div>
          )}

          {/* Selected level detail */}
          {selected && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-5 rounded-2xl border-2 border-yellow-200 bg-yellow-50">
               <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{selected.emoji}</span>
                  <div>
                    <h3 className="font-bold text-lg">{selected.title}</h3>
                    <p className="text-sm text-slate-600">{selected.description}</p>
                  </div>
               </div>
               <button onClick={() => router.push("/lesson")} className="w-full py-4 bg-[#00305E] text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">
                  {selected.state === "completed" ? "Ôn tập" : "Bắt đầu bài học"}
               </button>
            </motion.div>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
