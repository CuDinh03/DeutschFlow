"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { SkillTreeNodeData } from "./treeLayout";

// ── Status styling ────────────────────────────────────────────────────────────
function nodeStyle(status: string, isSatellite: boolean) {
  if (isSatellite) {
    return {
      bg: status === "COMPLETED" ? "#F5F3FF" : status === "IN_PROGRESS" ? "#EDE9FE" : "#1E1B4B",
      border: status === "COMPLETED" ? "#A78BFA" : status === "IN_PROGRESS" ? "#7C3AED" : "#3730A3",
      text: status === "LOCKED" ? "#6366F1" : "#312E81",
      opacity: status === "LOCKED" ? 0.55 : 1,
    };
  }
  switch (status) {
    case "COMPLETED":   return { bg: "#F0FDF4", border: "#86EFAC", text: "#14532D", opacity: 1 };
    case "IN_PROGRESS": return { bg: "#FEFCE8", border: "#FFCD00", text: "#713F12", opacity: 1 };
    case "UNLOCKED":    return { bg: "#FFF7ED", border: "#FED7AA", text: "#7C2D12", opacity: 1 };
    default:            return { bg: "#0F172A", border: "#1E293B", text: "#94A3B8", opacity: 0.6 };
  }
}

function difficultyDots(difficulty: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span
      key={i}
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: i < difficulty ? "#FFCD00" : "#334155" }}
    />
  ));
}

// ── SkillNode — main learning node card ───────────────────────────────────────
export const SkillNode = memo(({ data }: NodeProps) => {
  const d = data as SkillTreeNodeData;
  const isSat = !!d.isSatellite;
  const s = nodeStyle(d.user_status, isSat);

  const statusIcon =
    d.user_status === "COMPLETED"   ? "✅"
    : d.user_status === "IN_PROGRESS" ? "🔥"
    : d.user_status === "UNLOCKED"    ? "▶️"
    : "🔒";

  return (
    <div
      style={{
        background: s.bg,
        border: `2px solid ${s.border}`,
        borderRadius: 16,
        width: 220,
        padding: "10px 14px",
        opacity: s.opacity,
        boxShadow: d.user_status === "IN_PROGRESS"
          ? `0 0 16px ${s.border}88`
          : "0 2px 8px rgba(0,0,0,0.2)",
        cursor: "pointer",
        transition: "box-shadow 0.2s, transform 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow overlay for active */}
      {d.user_status === "IN_PROGRESS" && (
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(255,205,0,0.06) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Top row: emoji + status icon */}
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: 22 }}>{d.emoji ?? "📘"}</span>
        <div className="flex items-center gap-1">
          <span
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
              background: "#FFCD00", color: "#121212",
              borderRadius: 4, padding: "1px 5px",
            }}
          >
            {d.cefr_level}
          </span>
          <span style={{ fontSize: 14 }}>{statusIcon}</span>
        </div>
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 12, fontWeight: 800, color: s.text,
          lineHeight: "1.3", marginBottom: 2,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
        }}
      >
        {d.title_vi}
      </p>
      <p
        style={{
          fontSize: 10, color: isSat ? "#6366F1" : "#64748B",
          fontStyle: "italic", marginBottom: 6,
          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}
      >
        {d.title_de}
      </p>

      {/* Difficulty + score */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">{difficultyDots(d.difficulty)}</div>
        {d.user_status === "COMPLETED" && d.user_score > 0 && (
          <span style={{ fontSize: 10, color: "#22C55E", fontWeight: 700 }}>
            {d.user_score}%
          </span>
        )}
      </div>

      {/* Progress bar for IN_PROGRESS */}
      {d.user_status === "IN_PROGRESS" && (
        <div
          style={{
            marginTop: 6, height: 3, borderRadius: 999,
            background: "#1E293B", overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%", borderRadius: 999,
              background: "#FFCD00",
              width: `${Math.max(10, d.user_score ?? 20)}%`,
            }}
          />
        </div>
      )}

      {/* Satellite badge */}
      {isSat && (
        <div
          style={{
            position: "absolute", top: 8, left: -1,
            background: "#6366F1", borderRadius: "0 4px 4px 0",
            padding: "1px 5px", fontSize: 8, fontWeight: 700, color: "white",
          }}
        >
          SATELLITE
        </div>
      )}

      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} id="left" />
      <Handle type="target" position={Position.Right}  style={{ opacity: 0 }} id="right" />
    </div>
  );
});
SkillNode.displayName = "SkillNode";

// ── WeekMarker — week header pill ─────────────────────────────────────────────
export const WeekMarkerNode = memo(({ data }: NodeProps) => {
  const d = data as {
    week: number; label: string; phase: string;
    completed: boolean; current: boolean;
  };

  const bg     = d.completed ? "#14532D" : d.current ? "#1A1A1A" : "#0F172A";
  const border = d.completed ? "#22C55E"  : d.current ? "#FFCD00" : "#1E293B";
  const icon   = d.completed ? "✅" : d.current ? "🔥" : "🔒";

  return (
    <div
      style={{
        background: bg, border: `2px solid ${border}`,
        borderRadius: 999, padding: "8px 20px",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: d.current ? `0 0 20px ${border}66` : "0 2px 8px rgba(0,0,0,0.4)",
        minWidth: 160, justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
          {d.label}
        </p>
        {d.phase && (
          <p style={{ fontSize: 9, color: "#94A3B8", margin: 0 }}>
            {d.phase === "PHASE_1" ? "Phase 1 · Ngày 1–14" : "Phase 2 · Ngày 15–28"}
          </p>
        )}
      </div>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});
WeekMarkerNode.displayName = "WeekMarkerNode";

// ── StartFinishNode ────────────────────────────────────────────────────────────
export const StartFinishNode = memo(({ data }: NodeProps) => {
  const d = data as { label: string };
  const isFinish = d.label.includes("Hoàn thành");
  return (
    <div
      style={{
        background: isFinish
          ? "linear-gradient(135deg, #854D0E, #713F12)"
          : "linear-gradient(135deg, #1A1A1A, #121212)",
        border: `2px solid ${isFinish ? "#FBBF24" : "#FFCD00"}`,
        borderRadius: 999, padding: "10px 24px",
        color: "#FFCD00", fontWeight: 900, fontSize: 14,
        textAlign: "center",
        boxShadow: `0 0 24px ${isFinish ? "#FBBF2466" : "#FFCD0044"}`,
        pointerEvents: "none",
      }}
    >
      {d.label}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
    </div>
  );
});
StartFinishNode.displayName = "StartFinishNode";
