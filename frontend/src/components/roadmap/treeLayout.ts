import type { Node, Edge } from "@xyflow/react";

// ── Types ─────────────────────────────────────────────────────────────────────
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
  [key: string]: unknown;
}

// ── Layout constants ──────────────────────────────────────────────────────────
//
//   LEFT WING           CENTER SPINE           RIGHT WING
//  ─────────────    ─────────────────────    ─────────────
//   [Sat L1]            [WeekMarker]           [Sat R1]
//   [Sat L2]            [Core node 1]          [Sat R2]
//                       [Core node 2]
//
const CORE_X        = 0;          // horizontal center of spine
const NODE_W        = 220;        // skill card width
const NODE_H        = 110;        // skill card height
const WEEK_PILL_W   = 170;        // week pill width
const WEEK_PILL_H   = 60;         // week pill height
const CORE_GAP_V    = 14;         // vertical gap between consecutive core cards
const SAT_GAP_V     = 14;         // vertical gap between satellite cards on same side
const WEEK_TO_CORE  = 20;         // gap between week pill and first core card
const SAT_X_OFFSET  = 340;        // horizontal distance from spine center to satellite center
const WEEK_SECTION_GAP = 80;      // extra gap between week sections

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  /** nodeId of the first IN_PROGRESS or UNLOCKED node, for auto-jump */
  currentNodeId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function edgeStroke(status: string) {
  if (status === "COMPLETED")   return { color: "#22C55E", width: 2.5, opacity: 1 };
  if (status === "IN_PROGRESS") return { color: "#FFCD00", width: 2.5, opacity: 1 };
  if (status === "UNLOCKED")    return { color: "#FB923C", width: 2,   opacity: 0.85 };
  return { color: "#1E293B", width: 1.5, opacity: 0.35 };
}

// ── Main layout ───────────────────────────────────────────────────────────────
export function computeTreeLayout(apiNodes: SkillTreeNodeData[]): LayoutResult {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];
  let currentNodeId: string | null = null;
  let firstUnlockedId: string | null = null; // fallback if no IN_PROGRESS

  // 1. Group by week
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

  const weeks = Array.from(coreByWeek.keys()).sort((a, b) => a - b);

  // 2. START sentinel
  rfNodes.push({
    id: "start",
    type: "startNode",
    position: { x: CORE_X - 70, y: -150 },
    data: { label: "START 🇩🇪" },
    draggable: false,
  });

  let prevId: string = "start";
  let spineY = 0; // top of current week section

  // 3. Process each week
  for (const week of weeks) {
    const cores = (coreByWeek.get(week) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const sats  = (satByWeek.get(week)  ?? []).sort((a, b) => a.sort_order - b.sort_order);

    const leftSats  = sats.filter((_, i) => i % 2 === 0);  // even index → left
    const rightSats = sats.filter((_, i) => i % 2 === 1);  // odd index  → right

    // ── Week pill ──
    const weekId        = `week-${week}`;
    const weekCompleted = cores.every(n => n.user_status === "COMPLETED");
    const weekCurrent   = !weekCompleted && cores.some(
      n => n.user_status === "IN_PROGRESS" || n.user_status === "UNLOCKED"
    );

    rfNodes.push({
      id: weekId,
      type: "weekMarker",
      position: { x: CORE_X - WEEK_PILL_W / 2, y: spineY },
      data: { week, label: `Tuần ${week}`, phase: cores[0]?.phase ?? "", completed: weekCompleted, current: weekCurrent },
      draggable: false,
    });

    // Edge: prev → week pill
    const spineStroke = weekCompleted ? "#22C55E" : weekCurrent ? "#FFCD00" : "#1E293B";
    rfEdges.push({
      id: `e-${prevId}-${weekId}`,
      source: prevId, target: weekId,
      type: "smoothstep",
      animated: weekCurrent,
      style: { stroke: spineStroke, strokeWidth: weekCompleted || weekCurrent ? 3 : 2, opacity: weekCompleted || weekCurrent ? 1 : 0.4 },
    });
    prevId = weekId;

    // ── Core nodes below pill ──
    let coreY = spineY + WEEK_PILL_H + WEEK_TO_CORE;
    const coreNodeIds: string[] = [];

    for (const cn of cores) {
      const nid = `node-${cn.id}`;
      coreNodeIds.push(nid);

      // Track current learning position: IN_PROGRESS takes priority, UNLOCKED as fallback
      if (!currentNodeId && cn.user_status === "IN_PROGRESS") {
        currentNodeId = nid;
      }
      if (!firstUnlockedId && (cn.user_status === "IN_PROGRESS" || cn.user_status === "UNLOCKED")) {
        firstUnlockedId = nid;
      }

      rfNodes.push({
        id: nid, type: "skillNode",
        position: { x: CORE_X - NODE_W / 2, y: coreY },
        data: cn, draggable: false,
      });

      const es = edgeStroke(cn.user_status);
      rfEdges.push({
        id: `e-${weekId}-${nid}`, source: weekId, target: nid,
        type: "smoothstep", animated: cn.user_status === "IN_PROGRESS",
        style: { stroke: es.color, strokeWidth: es.width, opacity: es.opacity },
      });

      coreY += NODE_H + CORE_GAP_V;
    }

    const coreTotalH = cores.length * NODE_H + Math.max(0, cores.length - 1) * CORE_GAP_V;

    // ── Satellite wings ──
    // Satellites are centred on the core block, not on the week pill
    const coreBlockCenterY = spineY + WEEK_PILL_H + WEEK_TO_CORE + coreTotalH / 2;

    const placeSat = (sat: SkillTreeNodeData, side: "left" | "right", idx: number, total: number) => {
      const nid  = `node-${sat.id}`;
      const sign = side === "left" ? -1 : 1;
      const x    = CORE_X + sign * (SAT_X_OFFSET + NODE_W / 2) - NODE_W / 2;

      // Centre the column of satellites on coreBlockCenterY
      const columnH = total * NODE_H + Math.max(0, total - 1) * SAT_GAP_V;
      const y = coreBlockCenterY - columnH / 2 + idx * (NODE_H + SAT_GAP_V);

      if (!currentNodeId && sat.user_status === "IN_PROGRESS") {
        currentNodeId = nid;
      }
      if (!firstUnlockedId && (sat.user_status === "IN_PROGRESS" || sat.user_status === "UNLOCKED")) {
        firstUnlockedId = nid;
      }

      rfNodes.push({
        id: nid, type: "skillNode",
        position: { x, y },
        data: { ...sat, isSatellite: true },
        draggable: false,
      });

      // Connect from the closest core node in this week (or weekId if no cores)
      const sourceId = coreNodeIds[Math.min(idx, coreNodeIds.length - 1)] ?? weekId;
      rfEdges.push({
        id: `e-${sourceId}-${nid}`, source: sourceId, target: nid,
        type: "smoothstep",
        style: {
          stroke: "#6366F1", strokeWidth: 1.5,
          strokeDasharray: "6 3",
          opacity: sat.user_status === "LOCKED" ? 0.25 : 0.65,
        },
        animated: sat.user_status === "IN_PROGRESS",
      });
    };

    leftSats.forEach((s, i)  => placeSat(s, "left",  i, leftSats.length));
    rightSats.forEach((s, i) => placeSat(s, "right", i, rightSats.length));

    // ── Advance spineY ──
    const satColH = Math.max(leftSats.length, rightSats.length) * (NODE_H + SAT_GAP_V);
    const sectionH = WEEK_PILL_H + WEEK_TO_CORE + Math.max(coreTotalH, satColH);
    spineY += sectionH + WEEK_SECTION_GAP;
  }

  // 4. FINISH sentinel
  rfNodes.push({
    id: "finish", type: "startNode",
    position: { x: CORE_X - 80, y: spineY },
    data: { label: "🏆 Hoàn thành!" },
    draggable: false,
  });
  rfEdges.push({
    id: `e-${prevId}-finish`, source: prevId, target: "finish",
    type: "smoothstep",
    style: { stroke: "#FFCD00", strokeWidth: 2, opacity: 0.4 },
  });

  // Use firstUnlockedId as fallback when no IN_PROGRESS node was found
  if (!currentNodeId && firstUnlockedId) {
    currentNodeId = firstUnlockedId;
  }

  return { nodes: rfNodes, edges: rfEdges, currentNodeId };
}
