// ============================================================================
// types.ts — DeutschFlow deterministic learning-tree layout (canonical v1.0)
//
// PURE, platform-independent data contract + output model. No React, no DOM,
// no SVG strings, no hex, no screen coordinates. The layout returns positioned
// PRIMITIVES (numbers + enums + style tokens) that any renderer (web SVG,
// RN-SVG, SwiftUI Path) can draw with `line` + `circle` + a slot→hex palette.
// ============================================================================

// ---------- INPUT MODEL (mirrors the JSON data contract `path[]`) ----------
export type CefrLevel = "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type LevelStatus = "completed" | "current" | "locked";
export type MilestoneState = "locked" | "ready" | "in_progress" | "passed";
export type Skill = "hoeren" | "sprechen" | "lesen" | "schreiben";
export type BranchStatus = "locked" | "growing" | "matured";
export type TopicGroup = "daily" | "work" | "travel" | "medical" | "culture" | "exam";
export type NodeState = "locked" | "available" | "in_progress" | "completed";

export interface NodeInput {
  id: string;
  title?: string;
  state: NodeState;
}

export interface ShootInput {
  topicId: string;
  topicLabel?: string;
  topicGroup: TopicGroup;
  unlockOrder: number;
  chosenByUser?: boolean;
  nodes: NodeInput[];
}

export interface BranchInput {
  skill: Skill;
  label?: string;
  status: BranchStatus;
  nodeCap?: number;
  shoots: ShootInput[];
}

export interface MilestoneInput {
  id: string;
  title?: string;
  state: MilestoneState;
  passedAt?: string;
  unlocksWhen?: string;
}

export interface PathLevel {
  level: CefrLevel;
  status: LevelStatus;
  note?: string;
  milestone: MilestoneInput;
  branches: BranchInput[];
}

/** The function accepts the `path[]` array directly, or the whole root object. */
export type PathInput = PathLevel[];

export interface PathRoot {
  schemaVersion?: string;
  user?: Record<string, unknown>;
  path: PathInput;
}

// ---------- OUTPUT MODEL ----------
export interface Pt {
  x: number;
  y: number;
}

/** Renderer-agnostic color slot. NEVER a hex value. */
export type ColorSlot = `group:${TopicGroup}` | "trunk" | "level" | "milestone";

/** Closed style-token vocabulary so a renderer can switch exhaustively. */
export type StateToken =
  | `state:${"completed" | "current" | "locked" | "ready" | "in_progress" | "passed"}`
  | `branch:${"matured" | "growing" | "locked"}`
  | `leaf:${"locked" | "available" | "in_progress" | "completed"}`;

export type ElementKind =
  | "trunkSegment"
  | "levelNode"
  | "milestone"
  | "skillBranch"
  | "dormantBud"
  | "shoot"
  | "leaf"
  | "shootTipBud";

export interface ElementBase {
  id: string;
  colorSlot: ColorSlot;
  state: StateToken;
}

export interface TrunkSegment extends ElementBase {
  kind: "trunkSegment";
  level: CefrLevel;
  from: Pt; // x === 0, base
  to: Pt; // x === 0, tip
  thickStart: number;
  thickEnd: number;
}

export interface LevelNode extends ElementBase {
  kind: "levelNode";
  level: CefrLevel;
  pos: Pt;
  r: number;
}

export interface MilestoneNode extends ElementBase {
  kind: "milestone";
  level: CefrLevel;
  pos: Pt;
  r: number;
  rawState: MilestoneState;
  effectiveState: MilestoneState;
  gateSatisfied: boolean;
  isCurrentGate: boolean;
  title: string;
}

export interface SkillBranch extends ElementBase {
  kind: "skillBranch";
  level: CefrLevel;
  skill: Skill;
  side: "left" | "right";
  from: Pt; // emergence (on trunk)
  to: Pt; // tip
  angle: number; // absolute heading, DEGREES (CCW from +x; 90 = up)
  length: number;
  thickStart: number;
  thickEnd: number;
}

export interface DormantBud extends ElementBase {
  kind: "dormantBud";
  level: CefrLevel;
  skill: Skill;
  pos: Pt;
  r: number;
}

export interface Shoot extends ElementBase {
  kind: "shoot";
  level: CefrLevel;
  skill: Skill;
  topicId: string;
  topicGroup: TopicGroup;
  unlockOrder: number;
  chosenByUser: boolean;
  completedCount: number; // drives length + leaf density
  from: Pt; // anchor on branch
  to: Pt; // tip
  angle: number; // absolute heading, DEGREES
  length: number;
  thickStart: number;
  thickEnd: number;
}

export interface Leaf extends ElementBase {
  kind: "leaf";
  level: CefrLevel;
  skill: Skill;
  topicId: string;
  shootId: string;
  nodeId: string; // === JSON node.id (stable renderer/test key)
  orderIndex: number;
  pos: Pt;
  r: number;
  title: string;
}

export interface ShootTipBud extends ElementBase {
  kind: "shootTipBud";
  shootId: string;
  pos: Pt;
  r: number;
}

export type TreeElement =
  | TrunkSegment
  | LevelNode
  | MilestoneNode
  | SkillBranch
  | DormantBud
  | Shoot
  | Leaf
  | ShootTipBud;

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface TreeMetrics {
  achievedLevels: number; // nAch
  trunkHeight: number;
  groundY: number; // always 0
  totalBranches: number;
  totalShoots: number;
  totalLeaves: number;
  completedLeaves: number;
  maturedBranches: number;
  nextLevelLocked: boolean; // current milestone effective !== 'passed'
  truncated: boolean; // any nodeCap / shoot-cap hit
  suggestedScale: number; // targetPx / max(bbox.w, bbox.h)
  center: Pt; // bbox center (camera target)
}

export interface TreeLayout {
  elements: TreeElement[];
  bbox: BBox;
  metrics: TreeMetrics;
}

// ---------- PARAMS ----------
export interface TreeParams {
  // angular fan (DEGREES, deviation from vertical)
  gmin: number;
  gmax: number;
  upwardBias: number;
  balancePullMax: number;
  shootFanHalf: number;
  shootJitterFrac: number;
  // trunk
  seedSegH: number;
  trunkSegBase: number;
  trunkBaseThick: number;
  trunkTipThick: number;
  levelNodeR: number;
  milestoneNodeR: number;
  // branches
  branchBaseLen: number;
  branchPerNode: number;
  branchMinLen: number;
  branchMaxLen: number;
  branchBaseThick: number;
  branchTipThick: number;
  // shoots
  shootTMin: number;
  shootTMax: number;
  shootBaseLen: number;
  shootPerCompleted: number;
  shootMinLen: number;
  shootMaxLen: number;
  shootThickRatio: number;
  shootTipThick: number;
  // leaves
  leafR: number;
  leafPerpOffset: number;
  budR: number;
  // layout / determinism
  nodeCap: number;
  bboxPad: number;
  targetPx: number;
}

export type ComputeTreeLayout = (
  pathData: PathInput | PathRoot,
  params?: Partial<TreeParams>,
) => TreeLayout;
