"use client";

/**
 * SSR-safe dynamic wrapper for SkillTreeFlow.
 * ReactFlow requires browser APIs (window, ResizeObserver) — must be loaded client-side only.
 * Using Next.js dynamic() with ssr:false prevents hydration errors on Amplify/Vercel.
 */

import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";
import type { SkillTreeNodeData } from "./treeLayout";

const SkillTreeFlowInner = dynamic(
  () => import("./SkillTreeFlow"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: "calc(100vh - 160px)",
          minHeight: 500,
          borderRadius: 20,
          background: "#0B1120",
          border: "1px solid #1E293B",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40, height: 40,
            border: "3px solid #FFCD00",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "#475569", fontSize: 13 }}>Đang tải sơ đồ lộ trình...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

interface Props {
  apiNodes: SkillTreeNodeData[];
  onSelectNode: (node: SkillTreeNodeData) => void;
}

export default function SkillTreeFlowWrapper({ apiNodes, onSelectNode }: Props) {
  return (
    <ReactFlowProvider>
      <SkillTreeFlowInner apiNodes={apiNodes} onSelectNode={onSelectNode} />
    </ReactFlowProvider>
  );
}
