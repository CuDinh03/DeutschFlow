"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { computeTreeLayout, type SkillTreeNodeData } from "./treeLayout";
import { SkillNode, WeekMarkerNode, StartFinishNode } from "./SkillTreeNodes";

const NODE_TYPES = {
  skillNode:   SkillNode,
  weekMarker:  WeekMarkerNode,
  startNode:   StartFinishNode,
};

// ── MiniMap node color ────────────────────────────────────────────────────────
function miniMapColor(node: { type?: string; data?: Record<string, unknown> }) {
  if (node.type === "weekMarker") return "#FFCD00";
  if (node.type === "startNode")  return "#FFCD00";
  const status = node.data?.user_status as string | undefined;
  if (status === "COMPLETED")   return "#22C55E";
  if (status === "IN_PROGRESS") return "#FFCD00";
  const isSat = node.data?.isSatellite as boolean | undefined;
  if (isSat) return "#6366F1";
  return "#1E293B";
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  apiNodes: SkillTreeNodeData[];
  onSelectNode: (node: SkillTreeNodeData) => void;
}

// ── FitButton helper (needs ReactFlow context) ────────────────────────────────
function FitButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      type="button"
      onClick={() => fitView({ padding: 0.12, duration: 600 })}
      title="Nhìn toàn bộ"
      style={{
        position: "absolute", bottom: 108, right: 12, zIndex: 5,
        width: 32, height: 32, borderRadius: 8,
        background: "#1E293B", border: "1px solid #334155",
        color: "#94A3B8", display: "flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer", fontSize: 16,
      }}
    >
      ⊡
    </button>
  );
}

// ── Main SkillTreeFlow ────────────────────────────────────────────────────────
export default function SkillTreeFlow({ apiNodes, onSelectNode }: Props) {
  // Compute layout once from props
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => computeTreeLayout(apiNodes),
    [apiNodes]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Node click → open detail panel
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { type?: string; data?: Record<string, unknown> }) => {
      if (node.type === "skillNode") {
        onSelectNode(node.data as unknown as SkillTreeNodeData);
      }
    },
    [onSelectNode]
  );

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100vh - 160px)",
        minHeight: 500,
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid #1E293B",
        background: "#0B1120",
        position: "relative",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick as Parameters<typeof ReactFlow>[0]["onNodeClick"]}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.08}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        panOnScroll={false}
        zoomOnScroll
        panOnDrag
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        {/* Dark dot grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="#1E293B"
        />

        {/* Zoom + pan controls (bottom-left) */}
        <Controls
          showInteractive={false}
          style={{
            background: "#1E293B",
            border: "1px solid #334155",
            borderRadius: 10,
            boxShadow: "none",
          }}
        />

        {/* Fit-all button */}
        <FitButton />

        {/* Mini-map (bottom-right) */}
        <MiniMap
          nodeColor={miniMapColor}
          maskColor="rgba(11,17,32,0.85)"
          style={{
            background: "#0F172A",
            border: "1px solid #1E293B",
            borderRadius: 10,
          }}
          nodeStrokeWidth={0}
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Hint */}
      <div
        style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)", zIndex: 10,
          background: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)",
          border: "1px solid #1E293B", borderRadius: 999,
          padding: "5px 14px", fontSize: 11, color: "#64748B",
          pointerEvents: "none",
        }}
      >
        🖱️ Scroll để zoom · Kéo để di chuyển · Click node để học
      </div>
    </div>
  );
}
