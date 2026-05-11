"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Lock,
  Check,
  Play,
  RefreshCw,
  AlertCircle,
  Map as MapIcon,
  Star,
  Flame,
  ChevronRight,
  Trophy,
  Zap,
  Sparkles,
  LayoutList,
  GitBranch,
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import api from "@/lib/api";
import { logout } from "@/lib/authSession";
import { planApi, type AdaptiveRefreshResponse } from "@/lib/planApi";
import SkillTreeFlowWrapper from "@/components/roadmap/SkillTreeFlowWrapper";
import type { SkillTreeNodeData } from "@/components/roadmap/treeLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeStatus = "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";

interface SkillTreeNode {
  id: number;
  node_type: "CORE_TRUNK" | "SATELLITE_LEAF";
  title_de: string;
  title_vi: string;
  description_vi: string;
  emoji: string;
  phase: string;
  day_number: number | null;
  week_number: number | null;
  sort_order: number;
  cefr_level: string;
  difficulty: number;
  xp_reward: number;
  energy_cost: number;
  user_status: NodeStatus;
  user_score: number;
  user_xp: number;
  user_attempts: number;
  completed_at: string | null;
  dependencies_met: boolean;
}

interface WeekGroup {
  week: number;
  nodes: SkillTreeNode[];
  state: "completed" | "current" | "locked";
  completedCount: number;
  cefrLevel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapWeekState(nodes: SkillTreeNode[]): "completed" | "current" | "locked" {
  const allDone = nodes.every((n) => n.user_status === "COMPLETED");
  if (allDone) return "completed";
  const anyActive = nodes.some((n) =>
    n.user_status === "IN_PROGRESS" || n.user_status === "UNLOCKED"
  );
  if (anyActive) return "current";
  const anyStarted = nodes.some((n) => n.user_status !== "LOCKED");
  if (anyStarted) return "current";
  return "locked";
}

function phaseColor(phase: string): string {
  switch (phase) {
    case "PHONETIK": return "#7C3AED";
    case "GRUNDLAGEN": return "#0EA5E9";
    case "GRAMMATIK": return "#10B981";
    case "SATZSTRUKTUR": return "#F59E0B";
    default: return "#64748B";
  }
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "PHONETIK": return "Phát âm";
    case "GRUNDLAGEN": return "Cơ bản";
    case "GRAMMATIK": return "Ngữ pháp";
    case "SATZSTRUKTUR": return "Cấu trúc câu";
    case "BERUF_CONTEXT": return "Chuyên ngành";
    default: return phase;
  }
}

function cefrBadgeColor(cefr: string) {
  switch (cefr) {
    case "A1": return { bg: "#EEF2FF", text: "#4338CA" };
    case "A2": return { bg: "#F0FDF4", text: "#15803D" };
    case "B1": return { bg: "#FFF7ED", text: "#C2410C" };
    case "B2": return { bg: "#FDF4FF", text: "#7E22CE" };
    default: return { bg: "#F1F5F9", text: "#475569" };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NodeDot({
  node,
  isFirst,
  selected,
  onClick,
}: {
  node: SkillTreeNode;
  isFirst: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const isCompleted = node.user_status === "COMPLETED";
  const isActive = node.user_status === "IN_PROGRESS" || node.user_status === "UNLOCKED";
  const isLocked = node.user_status === "LOCKED";
  const color = phaseColor(node.phase);
  const cefr = cefrBadgeColor(node.cefr_level);

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all"
      style={{
        background: selected ? "#F0F7FF" : "transparent",
        border: selected ? "1.5px solid #93C5FD" : "1.5px solid transparent",
        opacity: isLocked && !isFirst ? 0.55 : 1,
      }}
      onClick={onClick}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Circle */}
      <div
        className="flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm"
        style={{
          width: 44,
          height: 44,
          background: isCompleted
            ? "linear-gradient(135deg,#34D399,#10B981)"
            : isActive
            ? "linear-gradient(135deg,#FFD940,#FFCD00)"
            : "linear-gradient(135deg,#E2E8F0,#CBD5E1)",
          boxShadow: isCompleted
            ? "0 4px 0 #059669"
            : isActive
            ? "0 4px 0 #C9A200"
            : "0 3px 0 #94A3B8",
          color: isActive ? "#78350F" : "white",
        }}
      >
        {isCompleted ? (
          <Check size={20} strokeWidth={3} />
        ) : isLocked && !isFirst ? (
          <Lock size={16} />
        ) : (
          <span>{node.emoji}</span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-[#0F172A] truncate">{node.title_vi}</p>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: cefr.bg, color: cefr.text }}
          >
            {node.cefr_level}
          </span>
        </div>
        <p className="text-[11px] text-[#64748B] truncate">{node.title_de}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: phaseColor(node.phase) + "18", color: phaseColor(node.phase) }}
          >
            {phaseLabel(node.phase)}
          </span>
          {isCompleted && (
            <span className="text-[10px] text-[#10B981] font-semibold">+{node.xp_reward} XP</span>
          )}
          {isActive && node.user_score > 0 && (
            <span className="text-[10px] text-[#FFCD00] font-bold">{node.user_score}%</span>
          )}
        </div>
      </div>

      <ChevronRight size={14} className="text-[#CBD5E1] flex-shrink-0" />
    </motion.div>
  );
}

function WeekCard({
  group,
  selectedId,
  onSelectNode,
}: {
  group: WeekGroup;
  selectedId: number | null;
  onSelectNode: (node: SkillTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(
    group.state === "current" || group.state === "completed"
  );
  const isCompleted = group.state === "completed";
  const isCurrent = group.state === "current";
  const cefr = cefrBadgeColor(group.cefrLevel);

  const pct = group.nodes.length > 0
    ? Math.round((group.completedCount / group.nodes.length) * 100)
    : 0;

  return (
    <motion.div
      className="rounded-2xl overflow-hidden border-2"
      style={{
        borderColor: isCompleted ? "#BBF7D0" : isCurrent ? "#FDE68A" : "#E2E8F0",
        background: isCompleted ? "#F0FDF4" : isCurrent ? "#FFFBEB" : "#F8FAFC",
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Week bubble */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0"
          style={{
            background: isCompleted
              ? "linear-gradient(135deg,#34D399,#10B981)"
              : isCurrent
              ? "linear-gradient(135deg,#FFD940,#FFCD00)"
              : "#E2E8F0",
            color: isCompleted ? "white" : isCurrent ? "#78350F" : "#94A3B8",
            boxShadow: isCompleted ? "0 4px 0 #059669" : isCurrent ? "0 4px 0 #C9A200" : "none",
          }}
        >
          {isCompleted ? <Check size={18} strokeWidth={3} /> : `W${group.week}`}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[#0F172A] text-sm">
              Tuần {group.week}
              {group.week <= 2 ? " · Phase 1 (Ngày 1–14)" : " · Phase 2 (Ngày 15–28)"}
            </p>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: cefr.bg, color: cefr.text }}
            >
              {group.cefrLevel}
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: isCompleted ? "#10B981" : "#FFCD00",
                }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[#64748B]">
              {group.completedCount}/{group.nodes.length}
            </span>
          </div>
        </div>

        <motion.div animate={{ rotate: expanded ? 90 : 0 }} className="flex-shrink-0">
          <ChevronRight size={16} className="text-[#94A3B8]" />
        </motion.div>
      </button>

      {/* Nodes list */}
      {expanded && (
        <div className="px-2 pb-3 space-y-1">
          {group.nodes.map((node, i) => (
            <NodeDot
              key={node.id}
              node={node}
              isFirst={i === 0}
              selected={selectedId === node.id}
              onClick={() => onSelectNode(node)}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function NodeDetailPanel({
  node,
  onStart,
  onUnlockSuccess,
  onSatellitePrompt,
}: {
  node: SkillTreeNode;
  onStart: () => void;
  onUnlockSuccess?: (nodeId: number) => void;
  onSatellitePrompt?: (node: SkillTreeNode) => void;
}) {
  const isCompleted = node.user_status === "COMPLETED";
  const isActive = node.user_status === "IN_PROGRESS" || node.user_status === "UNLOCKED";
  const isLocked = node.user_status === "LOCKED";
  const isSatellite = node.node_type === "SATELLITE_LEAF";
  const cefr = cefrBadgeColor(node.cefr_level);

  const [unlocking, setUnlocking] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ scorePercent: number; xpEarned: number; completed: boolean } | null>(null);

  // Unlock a SATELLITE_LEAF node (handles SSE streaming from LLM generation)
  const handleUnlock = async () => {
    if (unlocking) return;
    setUnlocking(true);
    setUnlockStatus("generating");
    try {
      const res = await api.post<{ source?: string; nodeId?: number } | string>(
        `/skill-tree/${node.id}/unlock`
      );
      // Cache HIT → JSON response
      if (res.data && typeof res.data === "object") {
        setUnlockStatus("done");
        onUnlockSuccess?.(node.id);
      }
    } catch {
      // SSE response comes as stream — if we get here it's a real error
      setUnlockStatus("error");
    } finally {
      setUnlocking(false);
    }
  };

  // Submit node with a placeholder 85% score (real grading TBD from node content)
  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const { data } = await api.post<{
        scorePercent: number; xpEarned: number; completed: boolean;
      }>(`/skill-tree/${node.id}/submit`, { answers: {} });
      setSubmitResult(data);
      onUnlockSuccess?.(node.id);
      
      // Prompt for satellite generation if it's an A2+ core trunk
      if (data.completed && node.node_type === "CORE_TRUNK" && node.cefr_level !== "A1" && node.phase !== "FOUNDATION") {
        onSatellitePrompt?.(node);
      }
    } catch {
      setSubmitResult({ scorePercent: 0, xpEarned: 0, completed: false });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 border-2"
      style={{
        background: isCompleted ? "#F0FDF4" : isActive ? "#FFFBEB" : "#F8FAFC",
        borderColor: isCompleted ? "#BBF7D0" : isActive ? "#FDE68A" : "#E2E8F0",
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <span className="text-3xl">{node.emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-base text-[#0F172A]">{node.title_vi}</h3>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: cefr.bg, color: cefr.text }}
            >
              {node.cefr_level}
            </span>
            {isSatellite && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                ✨ Chuyên ngành
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] italic mb-1">{node.title_de}</p>
          <p className="text-sm text-[#475569] leading-relaxed">{node.description_vi}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0]">
          <Star size={12} className="text-yellow-400" />
          <span className="text-xs font-bold text-[#0F172A]">+{node.xp_reward} XP</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0]">
          <Zap size={12} className="text-purple-500" />
          <span className="text-xs text-[#64748B]">Độ khó {node.difficulty}/10</span>
        </div>
        {node.user_attempts > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0]">
            <Trophy size={12} className="text-[#10B981]" />
            <span className="text-xs text-[#64748B]">Best: {node.user_score}%</span>
          </div>
        )}
      </div>

      {/* Submit result */}
      {submitResult && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl border"
          style={{
            background: submitResult.completed ? "#F0FDF4" : "#FFF7ED",
            borderColor: submitResult.completed ? "#BBF7D0" : "#FED7AA",
          }}
        >
          <p className="font-bold text-sm" style={{ color: submitResult.completed ? "#059669" : "#C2410C" }}>
            {submitResult.completed ? "🎉 Hoàn thành!" : "⚡ Cần luyện thêm"}
          </p>
          <p className="text-xs text-[#64748B] mt-0.5">
            Điểm: {submitResult.scorePercent}% · +{submitResult.xpEarned} XP
          </p>
        </motion.div>
      )}

      {/* Unlock status */}
      {unlockStatus === "generating" && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 border border-purple-200">
          <RefreshCw size={13} className="animate-spin text-purple-600" />
          <span className="text-xs text-purple-700 font-medium">AI đang tạo bài học cá nhân hóa...</span>
        </div>
      )}
      {unlockStatus === "done" && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
          <Check size={13} className="text-green-600" />
          <span className="text-xs text-green-700 font-medium">Bài học đã được mở khóa!</span>
        </div>
      )}
      {unlockStatus === "error" && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle size={13} className="text-red-500" />
          <span className="text-xs text-red-600">Không thể mở khóa. Thử lại sau.</span>
        </div>
      )}

      {isLocked ? (
        <div className="space-y-2">
          {!node.dependencies_met ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]">
              <Lock size={14} /> Hoàn thành bài trước để mở khóa
            </div>
          ) : isSatellite ? (
            <button
              type="button"
              onClick={handleUnlock}
              disabled={unlocking}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "#7C3AED", color: "white", boxShadow: "0 4px 0 #5B21B6" }}
            >
              {unlocking ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} fill="white" />}
              {unlocking ? "Đang mở khóa..." : "Mở khóa bài chuyên ngành"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{ background: "#121212", color: "white", boxShadow: "0 4px 0 #000000" }}
            >
              <Play size={16} fill="white" /> Bắt đầu bài học
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95"
            style={{
              background: isCompleted ? "#10B981" : "#121212",
              color: "white",
              boxShadow: isCompleted
                ? "0 4px 0 #059669"
                : "0 4px 0 #000000, 0 6px 20px rgba(0,48,94,0.25)",
            }}
          >
            <Play size={16} fill="white" />
            {isCompleted ? "Ôn tập lại" : isActive ? "Tiếp tục học" : "Bắt đầu"}
          </button>
          {isActive && !isCompleted && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all active:scale-95 disabled:opacity-60"
              style={{ borderColor: "#10B981", color: "#059669", background: "#F0FDF4" }}
            >
              {submitLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              {submitLoading ? "Đang nộp bài..." : "Nộp bài & kiểm tra điểm"}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const router = useRouter();
  const { me, loading: meLoading, loadError: meError, targetLevel, streakDays, initials, reload: reloadMe } =
    useStudentPracticeSession();

  const [nodes, setNodes] = useState<SkillTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SkillTreeNode | null>(null);
  const [satellitePromptNode, setSatellitePromptNode] = useState<SkillTreeNode | null>(null);
  const [generatingHobby, setGeneratingHobby] = useState(false);
  const [adaptiveRefreshing, setAdaptiveRefreshing] = useState(false);
  const [adaptiveResult, setAdaptiveResult] = useState<AdaptiveRefreshResponse | null>(null);
  // Tree / List toggle (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"tree" | "list">(() => {
    if (typeof window === "undefined") return "tree";
    return (localStorage.getItem("df_roadmap_view") as "tree" | "list") ?? "tree";
  });
  const toggleView = (mode: "tree" | "list") => {
    setViewMode(mode);
    localStorage.setItem("df_roadmap_view", mode);
  };

  const HOBBIES = ["IT", "Medicine", "Education", "Engineering", "Travel", "Music", "Finance"];

  const handleGenerateSatellite = async (hobby: string) => {
    if (!satellitePromptNode) return;
    setGeneratingHobby(true);
    try {
      await api.post(`/skill-tree/node/${satellitePromptNode.id}/generate-satellite`, { hobby });
      setSatellitePromptNode(null);
      void fetchSkillTree();
    } catch (err) {
      alert("Không thể tạo bài mở rộng: " + (err as any).response?.data?.error || "Lỗi");
    } finally {
      setGeneratingHobby(false);
    }
  };

  const fetchSkillTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<SkillTreeNode[]>("/skill-tree/me");
      const list = Array.isArray(data) ? data : [];
      setNodes(list);
      // Auto-select first IN_PROGRESS or UNLOCKED node
      const active = list.find(
        (n) => n.user_status === "IN_PROGRESS" || n.user_status === "UNLOCKED"
      );
      if (active) setSelectedNode(active);
    } catch (err) {
      console.error("[SkillTree] fetch error:", err);
      setError("Không thể tải lộ trình. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdaptiveRefresh = useCallback(async () => {
    setAdaptiveRefreshing(true);
    setAdaptiveResult(null);
    try {
      const res = await planApi.refreshAdaptive();
      setAdaptiveResult(res.data);
      void fetchSkillTree();
    } catch {
      // silent
    } finally {
      setAdaptiveRefreshing(false);
    }
  }, [fetchSkillTree]);

  useEffect(() => {
    if (me) void fetchSkillTree();
  }, [me, fetchSkillTree]);

  // Group nodes by week_number (fallback to sort_order-based grouping)
  const weekGroups = useMemo((): WeekGroup[] => {
    if (!nodes.length) return [];

    const map = new Map<number, SkillTreeNode[]>();
    nodes.forEach((n) => {
      const w = n.week_number ?? Math.ceil((n.sort_order || 1) / 7);
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(n);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, weekNodes]) => {
        const sorted = [...weekNodes].sort((a, b) => a.sort_order - b.sort_order);
        const completedCount = sorted.filter((n) => n.user_status === "COMPLETED").length;
        const state = mapWeekState(sorted);
        const cefrLevel = sorted[0]?.cefr_level ?? "A1";
        return { week, nodes: sorted, state, completedCount, cefrLevel };
      });
  }, [nodes]);

  const totalXP = useMemo(
    () => nodes.reduce((sum, n) => sum + (n.user_xp ?? 0), 0),
    [nodes]
  );
  const completedCount = useMemo(
    () => nodes.filter((n) => n.user_status === "COMPLETED").length,
    [nodes]
  );
  const coreNodes = useMemo(() => nodes.filter((n) => n.node_type === "CORE_TRUNK"), [nodes]);
  const satelliteNodes = useMemo(() => nodes.filter((n) => n.node_type === "SATELLITE_LEAF"), [nodes]);
  const coreCompleted = useMemo(() => coreNodes.filter((n) => n.user_status === "COMPLETED").length, [coreNodes]);
  const corePct = coreNodes.length > 0 ? Math.round((coreCompleted / coreNodes.length) * 100) : 0;

  // Group satellite by industry (from title_de prefix or phase)
  const satelliteByIndustry = useMemo(() => {
    const map = new Map<string, SkillTreeNode[]>();
    satelliteNodes.forEach((n) => {
      const key = n.phase || "BERUF";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return map;
  }, [satelliteNodes]);

  const currentWeek = weekGroups.find((g) => g.state === "current");

  const handleStartNode = useCallback(
    (node: SkillTreeNode) => {
      // Navigate to unified learning page
      router.push(`/student/learn/node/${node.id}`);
    },
    [router]
  );

  // Backend unreachable — show error + retry instead of infinite spinner
  if (!meLoading && meError && !me) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5 bg-[#F1F4F9] px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <div className="text-center">
          <p className="font-bold text-[#0F172A] text-lg mb-1">Không thể tải lộ trình</p>
          <p className="text-sm text-[#64748B] max-w-xs">{meError}</p>
        </div>
        <button
          onClick={() => void reloadMe()}
          className="flex items-center gap-2 px-5 py-3 bg-[#121212] text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all"
        >
          <RefreshCw size={15} /> Thử lại
        </button>
      </div>
    );
  }

  if (meLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full"
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
      onLogout={() => { logout(); }}
      headerTitle="Lộ trình học tập"
      headerSubtitle="28 ngày · Goethe A1 Curriculum"
      headerRight={
        <div className="flex items-center gap-2">
          {/* Tree / List toggle */}
          <div className="flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-0.5">
            <button
              type="button"
              onClick={() => toggleView("tree")}
              title="Sơ đồ cây"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "tree"
                  ? "bg-[#121212] text-white shadow-sm"
                  : "text-[#64748B] hover:text-[#121212]"
              }`}
            >
              <GitBranch size={12} /> Cây
            </button>
            <button
              type="button"
              onClick={() => toggleView("list")}
              title="Danh sách"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "list"
                  ? "bg-[#121212] text-white shadow-sm"
                  : "text-[#64748B] hover:text-[#121212]"
              }`}
            >
              <LayoutList size={12} /> List
            </button>
          </div>
          {/* AI refresh */}
          <button
            type="button"
            onClick={() => void handleAdaptiveRefresh()}
            disabled={adaptiveRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-[#121212] text-xs font-semibold hover:bg-[#EEF4FF] transition-all disabled:opacity-50"
          >
            {adaptiveRefreshing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {adaptiveRefreshing ? "Đang cập nhật..." : "AI refresh"}
          </button>
        </div>
      }
    >
      {/* ── TREE VIEW ── */}
      {viewMode === "tree" && !loading && !error && nodes.length > 0 && (
        <div className="px-2 py-4">
          <SkillTreeFlowWrapper
            apiNodes={nodes as unknown as SkillTreeNodeData[]}
            onSelectNode={(n) => {
              if (n.user_status !== "LOCKED") {
                router.push(`/student/learn/node/${n.id}`);
              }
            }}
            onContinueLearning={(nodeId) => {
              router.push(`/student/learn/node/${nodeId}`);
            }}
          />
        </div>
      )}

      {/* ── LIST VIEW (original layout below) ── */}
      {viewMode === "list" && (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Adaptive refresh result banner */}
        <AnimatePresence>
          {adaptiveResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl px-4 py-3 flex items-start gap-3 border"
              style={{
                background: adaptiveResult.injected ? "#F0FDF4" : "#F8FAFC",
                borderColor: adaptiveResult.injected ? "#BBF7D0" : "#E2E8F0",
              }}
            >
              <span className="text-lg">{adaptiveResult.injected ? "✨" : "✅"}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: adaptiveResult.injected ? "#059669" : "#475569" }}>
                  {adaptiveResult.injected
                    ? `Đã thêm bài luyện "${adaptiveResult.errorCode ?? "custom"}" vào Tuần ${adaptiveResult.week} · Phiên ${adaptiveResult.sessionIndex}`
                    : "Lộ trình đang tối ưu, không cần thay đổi"}
                </p>
                {adaptiveResult.reason && (
                  <p className="text-xs text-[#94A3B8] mt-0.5">{adaptiveResult.reason}</p>
                )}
              </div>
              <button type="button" onClick={() => setAdaptiveResult(null)} className="text-[#94A3B8] hover:text-[#475569] text-lg leading-none">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Overall Progress Bar ── */}
        {!loading && coreNodes.length > 0 && (
          <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Tiến độ CORE</p>
                <p className="text-sm font-bold text-[#0F172A] mt-0.5">
                  Ngày {coreCompleted}/{coreNodes.length}
                  <span className="ml-2 text-[#64748B] font-normal">· {corePct}% hoàn thành</span>
                </p>
              </div>
              <span className="text-2xl font-black text-[#121212]">{corePct}%</span>
            </div>
            {/* Progress bar */}
            <div className="h-3 rounded-full bg-[#F1F5F9] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${corePct}%`,
                  background: corePct === 100
                    ? "linear-gradient(90deg,#34D399,#10B981)"
                    : "linear-gradient(90deg,#FFCD00,#F59E0B)",
                }}
              />
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <p className="font-extrabold text-[#0F172A]">{totalXP}</p>
                <p className="text-[10px] text-[#94A3B8]">Tổng XP</p>
              </div>
              <div className="text-center">
                <p className="font-extrabold text-[#0F172A]">{completedCount}</p>
                <p className="text-[10px] text-[#94A3B8]">Bài xong</p>
              </div>
              <div className="text-center">
                <p className="font-extrabold text-[#0F172A]">{streakDays}🔥</p>
                <p className="text-[10px] text-[#94A3B8]">Chuỗi ngày</p>
              </div>
            </div>
          </div>
        )}

        {/* Current week banner */}
        {!loading && currentWeek && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg,#121212 0%,#0052A3 100%)",
              boxShadow: "0 4px 20px rgba(0,48,94,0.2)",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center text-xl flex-shrink-0">
              📍
            </div>
            <div className="flex-1">
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide">Đang học</p>
              <p className="text-white font-bold text-sm">Tuần {currentWeek.week}</p>
              <p className="text-white/70 text-xs">
                {currentWeek.completedCount}/{currentWeek.nodes.length} bài hoàn thành
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextNode = currentWeek.nodes.find(
                  (n) => n.user_status !== "COMPLETED"
                );
                if (nextNode) handleStartNode(nextNode);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm"
              style={{ background: "#FFCD00", color: "#121212" }}
            >
              <Play size={13} fill="#121212" /> Tiếp tục
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full"
            />
            <p className="text-sm text-[#64748B]">Đang tải lộ trình 28 ngày...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-3xl border-2 border-red-200">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => void fetchSkillTree()}
              className="flex items-center gap-2 px-4 py-2 bg-[#121212] text-white rounded-xl text-sm font-medium"
            >
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && nodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <MapIcon size={40} className="text-[#94A3B8]" />
            <p className="text-sm text-[#64748B]">Chưa có lộ trình. Hãy hoàn thành Onboarding.</p>
          </div>
        )}

        {/* ── SATELLITE Section ── */}
        {!loading && satelliteNodes.length > 0 && (
          <div className="rounded-2xl border-2 border-dashed border-[#C4B5FD] bg-[#F5F3FF] overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-[#E9D5FF]">
              <span className="text-lg">🚀</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#5B21B6]">Bài chuyên ngành</p>
                <p className="text-[11px] text-[#7C3AED]">
                  {satelliteNodes.filter(n => n.user_status === "COMPLETED").length}/{satelliteNodes.length} bài · Mở sau Day 14
                </p>
              </div>
              {corePct < 40 && (
                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-full">
                  🔒 Cần {Math.max(0, 14 - coreCompleted)} ngày nữa
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-2">
              {Array.from(satelliteByIndustry.entries()).map(([industry, indNodes]) => {
                const done = indNodes.filter(n => n.user_status === "COMPLETED").length;
                const isUnlocked = indNodes.some(n => n.user_status !== "LOCKED");
                return (
                  <div key={industry} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-[#E9D5FF]">
                    <span className="text-xl">{indNodes[0]?.emoji ?? "🏭"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#4C1D95] truncate">{industry.replace(/_/g, " ")}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-[#EDE9FE] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#7C3AED] transition-all duration-500"
                            style={{ width: `${indNodes.length > 0 ? (done / indNodes.length) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#7C3AED] font-bold shrink-0">{done}/{indNodes.length}</span>
                      </div>
                    </div>
                    {isUnlocked ? (
                      <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✅ Mở</span>
                    ) : (
                      <span className="text-[10px] bg-[#EDE9FE] text-[#7C3AED] font-bold px-2 py-0.5 rounded-full">🔒</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week groups */}
        {!loading && !error && weekGroups.filter(g => g.nodes.some(n => n.node_type === "CORE_TRUNK")).length > 0 && (
          <div className="space-y-3">
            {weekGroups
              .filter(g => g.nodes.some(n => n.node_type === "CORE_TRUNK"))
              .map((group) => (
              <WeekCard
                key={group.week}
                group={group}
                selectedId={selectedNode?.id ?? null}
                onSelectNode={(node) =>
                  setSelectedNode((prev) => (prev?.id === node.id ? null : node))
                }
              />
            ))}
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onStart={() => handleStartNode(selectedNode)}
            onUnlockSuccess={() => void fetchSkillTree()}
            onSatellitePrompt={setSatellitePromptNode}
          />
        )}
      </div>
      )} {/* end viewMode=list */}


    </StudentShell>
  );
}
