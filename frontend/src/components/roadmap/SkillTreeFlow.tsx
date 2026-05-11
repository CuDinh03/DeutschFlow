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
import { useTranslations } from "next-intl";

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
  onContinueLearning: (nodeId: number) => void;
  initialCurrentId: string | null;
}

function SkillTreeInner({ apiNodes, onSelectNode, onContinueLearning, initialCurrentId }: InnerProps) {
  const { fitView, fitBounds, getNode } = useReactFlow();
  const didInitialFit = useRef(false);
  const t = useTranslations("roadmap");

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
        defaultViewport={{ x: 360, y: 80, zoom: 0.85 }}
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
            className="px-4 py-2 bg-[#FFCD00] hover:bg-[#E5B800] text-black font-bold text-sm rounded-full shadow-lg transition-transform active:scale-95 whitespace-nowrap"
          >
            📍 {t("currentPosition")}
          </button>

          {/* Continue Learning */}
          {initialCurrentId && (
            <button
              type="button"
              onClick={() => {
                const num = parseInt(initialCurrentId.replace("node-", ""), 10);
                if (!isNaN(num)) onContinueLearning(num);
              }}
              className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-sm rounded-full shadow-lg transition-transform active:scale-95 whitespace-nowrap"
            >
              ▶ {t("continueLearning")}
            </button>
          )}

          {/* Fit all */}
          <button
            type="button"
            onClick={() => fitView({ padding: 0.1, duration: 600 })}
            title={t("all")}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-full shadow-lg transition-transform active:scale-95 whitespace-nowrap border border-white/20"
          >
            ⊡ {t("all")}
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
      <div className="absolute top-4 right-4 z-10 pointer-events-none opacity-50">
        <div className="bg-[#121212]/80 backdrop-blur-sm text-white/70 text-xs px-3 py-1.5 rounded-lg border border-white/10">
          🖱️ {t("scrollHint")}
        </div>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
interface Props {
  apiNodes: SkillTreeNodeData[];
  onSelectNode: (node: SkillTreeNodeData) => void;
  onContinueLearning: (nodeId: number) => void;
}

export default function SkillTreeFlow({ apiNodes, onSelectNode, onContinueLearning }: Props) {
  const { currentNodeId } = useMemo(() => computeTreeLayout(apiNodes), [apiNodes]);

  return (
    <SkillTreeInner
      apiNodes={apiNodes}
      onSelectNode={onSelectNode}
      onContinueLearning={onContinueLearning}
      initialCurrentId={currentNodeId}
    />
  );
}
