import type { Node, Edge } from "@xyflow/react";

// ── Type mirrors SkillTreeNode from roadmap/page.tsx ─────────────────────────
export interface SkillTreeNodeData {
  id: number;
  node_type: "CORE_TRUNK" | "SATELLITE_LEAF";
  title_de: string;
  title_vi: string;
  emoji: string;
  phase: string;
  day_number: number | null;
  week_number: number | null;
  sort_order: number;
  cefr_level: string;
  difficulty: number;
  xp_reward: number;
  user_status: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";
  user_score: number;
  dependencies_met: boolean;
  industry?: string | null;
  // React Flow requires [key: string]: unknown
  [key: string]: unknown;
}

export interface TreeNode extends Node {
  data: SkillTreeNodeData;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const VERTICAL_GAP   = 200;   // px between core weeks
const CORE_X         = 0;     // center x for core spine
const SAT_X_GAP      = 320;   // horizontal distance from core to satellite
const NODE_WIDTH     = 220;
const NODE_HEIGHT    = 110;
const WEEK_NODE_W    = 160;
const WEEK_NODE_H    = 70;

// ── Main layout function ──────────────────────────────────────────────────────
/**
 * Converts a flat SkillTreeNode[] from the API into ReactFlow nodes + edges.
 * Layout:
 *   - CORE_TRUNK: grouped by week, placed vertically at x=0
 *   - SATELLITE_LEAF: branching left/right from their week row
 *   - Week "header" nodes are synthesis markers, not clickable
 */
export function computeTreeLayout(
  apiNodes: SkillTreeNodeData[]
): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  // Group by week
  const coreByWeek = new Map<number, SkillTreeNodeData[]>();
  const satByWeek  = new Map<number, SkillTreeNodeData[]>();

  for (const n of apiNodes) {
    const week = n.week_number ?? 0;
    if (n.node_type === "CORE_TRUNK") {
      if (!coreByWeek.has(week)) coreByWeek.set(week, []);
      coreByWeek.get(week)!.push(n);
    } else {
      if (!satByWeek.has(week)) satByWeek.set(week, []);
      satByWeek.get(week)!.push(n);
    }
  }

  const sortedWeeks = Array.from(coreByWeek.keys()).sort((a, b) => a - b);

  // START node
  rfNodes.push({
    id: "start",
    type: "startNode",
    position: { x: CORE_X - 60, y: -160 },
    data: { label: "START 🇩🇪" },
    draggable: false,
  });

  let prevWeekMarkerId: string | null = "start";
  let weekY = 0;

  for (const week of sortedWeeks) {
    const coreNodes = coreByWeek.get(week) ?? [];
    const satNodes  = satByWeek.get(week)  ?? [];

    // ── Week marker node (W1, W2…) ──
    const weekId = `week-${week}`;
    const weekCompleted = coreNodes.every((n) => n.user_status === "COMPLETED");
    const weekCurrent   = !weekCompleted && coreNodes.some(
      (n) => n.user_status === "IN_PROGRESS" || n.user_status === "UNLOCKED"
    );

    rfNodes.push({
      id: weekId,
      type: "weekMarker",
      position: { x: CORE_X - WEEK_NODE_W / 2, y: weekY },
      data: {
        week,
        label: `Tuần ${week}`,
        phase: coreNodes[0]?.phase ?? "",
        completed: weekCompleted,
        current: weekCurrent,
      },
      draggable: false,
    });

    // Edge: previous week marker → this week marker
    if (prevWeekMarkerId) {
      const prevStatus = weekCompleted ? "completed" : weekCurrent ? "current" : "locked";
      rfEdges.push({
        id: `e-${prevWeekMarkerId}-${weekId}`,
        source: prevWeekMarkerId,
        target: weekId,
        type: "smoothstep",
        animated: weekCurrent,
        style: {
          stroke: weekCompleted ? "#22C55E" : weekCurrent ? "#FFCD00" : "#334155",
          strokeWidth: weekCompleted || weekCurrent ? 3 : 2,
          opacity: weekCompleted || weekCurrent ? 1 : 0.4,
        },
      });
    }
    prevWeekMarkerId = weekId;

    // ── Core content nodes (inline below week marker) ──
    let coreY = weekY + WEEK_NODE_H + 20;
    for (const cn of coreNodes.sort((a, b) => a.sort_order - b.sort_order)) {
      const nid = `node-${cn.id}`;
      rfNodes.push({
        id: nid,
        type: "skillNode",
        position: { x: CORE_X - NODE_WIDTH / 2, y: coreY },
        data: cn,
        draggable: false,
      });
      rfEdges.push({
        id: `e-${weekId}-${nid}`,
        source: weekId,
        target: nid,
        type: "smoothstep",
        style: {
          stroke: cn.user_status === "COMPLETED" ? "#22C55E"
               : cn.user_status === "IN_PROGRESS" ? "#FFCD00"
               : "#334155",
          strokeWidth: 2,
          opacity: cn.user_status === "LOCKED" ? 0.35 : 0.8,
        },
        animated: cn.user_status === "IN_PROGRESS",
      });
      coreY += NODE_HEIGHT + 16;
    }

    // ── Satellite nodes (branch left/right) ──
    const leftSats  = satNodes.filter((_, i) => i % 2 === 0);
    const rightSats = satNodes.filter((_, i) => i % 2 === 1);

    const placeSat = (sat: SkillTreeNodeData, side: "left" | "right", idx: number) => {
      const xSign = side === "left" ? -1 : 1;
      const nid   = `node-${sat.id}`;
      const satY  = weekY + (idx * (NODE_HEIGHT + 24));

      rfNodes.push({
        id: nid,
        type: "skillNode",
        position: {
          x: CORE_X + xSign * SAT_X_GAP - NODE_WIDTH / 2,
          y: satY,
        },
        data: { ...sat, isSatellite: true },
        draggable: false,
      });

      rfEdges.push({
        id: `e-${weekId}-${nid}`,
        source: weekId,
        target: nid,
        type: "bezier",
        style: {
          stroke: "#6366F1",
          strokeWidth: 1.5,
          strokeDasharray: "6 4",
          opacity: sat.user_status === "LOCKED" ? 0.3 : 0.7,
        },
        animated: sat.user_status === "IN_PROGRESS",
      });
    };

    leftSats.forEach((s, i)  => placeSat(s, "left",  i));
    rightSats.forEach((s, i) => placeSat(s, "right", i));

    // Advance weekY — enough for core nodes + satellite height
    const coreTotalH = coreNodes.length * (NODE_HEIGHT + 16);
    const satTotalH  = Math.max(leftSats.length, rightSats.length) * (NODE_HEIGHT + 24);
    weekY += WEEK_NODE_H + Math.max(coreTotalH, satTotalH) + VERTICAL_GAP;
  }

  // FINISH node
  rfNodes.push({
    id: "finish",
    type: "startNode",
    position: { x: CORE_X - 60, y: weekY },
    data: { label: "🏆 Hoàn thành!" },
    draggable: false,
  });
  if (prevWeekMarkerId) {
    rfEdges.push({
      id: `e-${prevWeekMarkerId}-finish`,
      source: prevWeekMarkerId,
      target: "finish",
      type: "smoothstep",
      style: { stroke: "#FFCD00", strokeWidth: 2, opacity: 0.5 },
    });
  }

  return { nodes: rfNodes, edges: rfEdges };
}
