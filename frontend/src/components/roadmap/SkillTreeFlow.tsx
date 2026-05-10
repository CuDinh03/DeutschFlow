"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { computeTreeLayout, type SkillTreeNodeData } from "./treeLayout";
import { SkillNode, WeekMarkerNode, StartFinishNode } from "./SkillTreeNodes";

const NODE_TYPES = {
  skillNode:  SkillNode,
  weekMarker: WeekMarkerNode,
  startNode:  StartFinishNode,
};

// ── MiniMap colour helper ─────────────────────────────────────────────────────
function miniMapColor(node: { type?: string; data?: Record<string, unknown> }) {
  if (node.type === "weekMarker") return "#FFCD00";
  if (node.type === "startNode")  return "#FFCD00";
  const status = node.data?.user_status as string | undefined;
  if (status === "COMPLETED")   return "#22C55E";
  if (status === "IN_PROGRESS") return "#FFCD00";
  if (status === "UNLOCKED")    return "#FB923C";
  const isSat = node.data?.isSatellite as boolean | undefined;
  return isSat ? "#6366F1" : "#1E293B";
}

// ── Inner component (needs ReactFlow context) ─────────────────────────────────
interface InnerProps {
  apiNodes: SkillTreeNodeData[];
  onSelectNode: (node: SkillTreeNodeData) => void;
  initialCurrentId: string | null;
}

function SkillTreeInner({ apiNodes, onSelectNode, initialCurrentId }: InnerProps) {
  const { fitView, fitBounds, getNode } = useReactFlow();
  const didInitialFit = useRef(false);

  // Compute layout
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => computeTreeLayout(apiNodes),
    [apiNodes]
  );

  const [nodes, , onNodesChange] = useNodesState(layoutNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutEdges);

  // Jump to a specific node by id
  const jumpToNode = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        fitView({ padding: 0.1, duration: 700 });
        return;
      }
      const target = getNode(nodeId);
      if (target) {
        const { x, y } = target.position;
        const w = (target.measured?.width  as number | undefined) ?? 220;
        const h = (target.measured?.height as number | undefined) ?? 110;
        fitBounds(
          { x, y, width: w, height: h },
          { padding: 2.5, duration: 700 }
        );
      } else {
        fitView({ padding: 0.1, duration: 700 });
      }
    },
    [fitView, fitBounds, getNode]
  );

  // Auto-fit on first render
  useEffect(() => {
    if (!didInitialFit.current && nodes.length > 0) {
      didInitialFit.current = true;
      // Small delay so ReactFlow has measured nodes
      const timer = setTimeout(() => {
        if (initialCurrentId) {
          jumpToNode(initialCurrentId);
        } else {
          fitView({ padding: 0.12, duration: 500 });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nodes, initialCurrentId, jumpToNode, fitView]);

  // Node click → detail panel
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
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
        height: "calc(100vh - 168px)",
        minHeight: 500,
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid #1E293B",
        background: "#080E1A",
        position: "relative",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={NODE_TYPES}
        fitView={false}          // we handle fitView manually
        minZoom={0.06}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        panOnScroll={false}
        zoomOnScroll
        panOnDrag
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        {/* Subtle dot grid */}
        <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="#1A2540" />

        {/* Standard zoom controls (bottom-left) */}
        <Controls
          showInteractive={false}
          style={{
            background: "#111827", border: "1px solid #1E293B",
            borderRadius: 10, boxShadow: "none",
          }}
        />

        {/* ── Custom action buttons ── */}

        {/* "Vị trí hiện tại" button */}
        <div
          style={{
            position: "absolute", bottom: 16, left: "50%",
            transform: "translateX(-50%)", zIndex: 20,
            display: "flex", gap: 8,
          }}
        >
          {/* Go to current node */}
          <button
            type="button"
            onClick={() => jumpToNode(initialCurrentId)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "linear-gradient(135deg,#FFCD00,#F59E0B)",
              border: "none", borderRadius: 999,
              padding: "8px 18px", cursor: "pointer",
              fontWeight: 800, fontSize: 12, color: "#121212",
              boxShadow: "0 4px 16px rgba(255,205,0,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            📍 Vị trí đang học
          </button>

          {/* Fit all */}
          <button
            type="button"
            onClick={() => fitView({ padding: 0.1, duration: 600 })}
            title="Nhìn toàn bộ"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#1E293B", border: "1px solid #334155",
              borderRadius: 999, padding: "8px 16px",
              cursor: "pointer", fontWeight: 700, fontSize: 12,
              color: "#94A3B8",
            }}
          >
            ⊡ Toàn bộ
          </button>
        </div>

        {/* Mini-map */}
        <MiniMap
          nodeColor={miniMapColor}
          maskColor="rgba(8,14,26,0.88)"
          style={{
            background: "#0F172A", border: "1px solid #1E293B",
            borderRadius: 10,
          }}
          nodeStrokeWidth={0}
          pannable zoomable
        />
      </ReactFlow>

      {/* Hint bar */}
      <div
        style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)", zIndex: 10,
          background: "rgba(8,14,26,0.85)", backdropFilter: "blur(8px)",
          border: "1px solid #1E293B", borderRadius: 999,
          padding: "5px 16px", fontSize: 11, color: "#475569",
          pointerEvents: "none", whiteSpace: "nowrap",
        }}
      >
        🖱️ Scroll để zoom · Kéo để di chuyển · Click node để học
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
interface Props {
  apiNodes: SkillTreeNodeData[];
  onSelectNode: (node: SkillTreeNodeData) => void;
}

export default function SkillTreeFlow({ apiNodes, onSelectNode }: Props) {
  const { currentNodeId } = useMemo(() => computeTreeLayout(apiNodes), [apiNodes]);

  return (
    <SkillTreeInner
      apiNodes={apiNodes}
      onSelectNode={onSelectNode}
      initialCurrentId={currentNodeId}
    />
  );
}
