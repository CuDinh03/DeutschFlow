// ============================================================================
// params.ts — DEFAULT_PARAMS + frozen algorithm constants.
//
// IMPORTANT: the Claude Design prototype and every renderer (web/RN/SwiftUI)
// MUST import this SAME DEFAULT_PARAMS object. Any aesthetic retune is a single
// shared edit here, so design and code never drift.
// ============================================================================

import type { Skill, TreeParams, MilestoneState, NodeState } from "./types";

export const DEFAULT_PARAMS: TreeParams = {
  // angular fan (DEGREES, deviation from vertical)
  gmin: 18,
  gmax: 52,
  upwardBias: 1.5,
  balancePullMax: 4,
  shootFanHalf: 18,
  shootJitterFrac: 0.6,
  // trunk
  seedSegH: 60,
  trunkSegBase: 90,
  trunkBaseThick: 26,
  trunkTipThick: 8,
  levelNodeR: 11,
  milestoneNodeR: 17,
  // branches
  branchBaseLen: 70,
  branchPerNode: 9,
  branchMinLen: 50,
  branchMaxLen: 200,
  branchBaseThick: 12,
  branchTipThick: 4,
  // shoots
  shootTMin: 0.18,
  shootTMax: 0.92,
  shootBaseLen: 34,
  shootPerCompleted: 11,
  shootMinLen: 18,
  shootMaxLen: 160,
  shootThickRatio: 0.45,
  shootTipThick: 2,
  // leaves
  leafR: 7,
  leafPerpOffset: 3,
  budR: 4,
  // layout / determinism
  nodeCap: 10,
  bboxPad: 24,
  targetPx: 720,
};

// ---- Frozen algorithm constants (NOT user-tunable params) ----

/** Canonical skill order — geometry ignores data array order for stability. */
export const CANON_SKILLS: readonly Skill[] = ["hoeren", "sprechen", "lesen", "schreiben"];

/** Fixed side map — guarantees branches never cross the trunk. */
export const SIDE: Readonly<Record<Skill, "left" | "right">> = {
  hoeren: "left",
  sprechen: "right",
  lesen: "left",
  schreiben: "right",
};

/** Position within a side: 0 = outer (first), 1 = inner (second). */
export const SIDE_INDEX: Readonly<Record<Skill, 0 | 1>> = {
  hoeren: 0,
  sprechen: 0,
  lesen: 1,
  schreiben: 1,
};

/** Milestone-gated growth: how far the CURRENT level's trunk segment extends. */
export const MS_FRAC: Readonly<Record<MilestoneState, number>> = {
  passed: 1,
  in_progress: 0.66,
  ready: 0.5,
  locked: 0.34,
};

/** Leaf radius multiplier by node state. */
export const LEAF_SIZE_MULT: Readonly<Record<NodeState, number>> = {
  completed: 1.0,
  in_progress: 0.92,
  available: 0.8,
  locked: 0.7,
};
