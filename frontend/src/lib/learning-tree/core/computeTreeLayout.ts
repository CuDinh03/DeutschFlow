// ============================================================================
// computeTreeLayout.ts — DeutschFlow deterministic learning-tree layout (v1.0)
//
// PURE function: same (pathData, params) ⇒ byte-identical TreeLayout.
// No RNG, no clock, no globals, no input mutation. Returns positioned
// primitives only. Coordinate space is y-UP, origin at the root collar; a
// y-down renderer flips with `screenY = bbox.maxY - y`. Angles are DEGREES.
//
// See ./types.ts for the contract and ./params.ts for the (shared) tuning.
// ============================================================================

import {
  CANON_SKILLS,
  DEFAULT_PARAMS,
  LEAF_SIZE_MULT,
  MS_FRAC,
  SIDE,
  SIDE_INDEX,
} from "./params";
import { hashUnit } from "./hash";
import type {
  BBox,
  BranchInput,
  BranchStatus,
  CefrLevel,
  MilestoneState,
  NodeState,
  PathInput,
  PathLevel,
  PathRoot,
  Pt,
  Skill,
  TopicGroup,
  TreeElement,
  TreeLayout,
  TreeMetrics,
  TreeParams,
} from "./types";

// ── tiny pure helpers ─────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The ONLY place trig is used (keeps cross-engine drift in one spot). */
function endpoint(base: Pt, angleDeg: number, len: number): Pt {
  return {
    x: base.x + len * Math.cos(angleDeg * DEG),
    y: base.y + len * Math.sin(angleDeg * DEG),
  };
}
function perpDir(angleDeg: number): Pt {
  return { x: Math.cos((angleDeg + 90) * DEG), y: Math.sin((angleDeg + 90) * DEG) };
}
const q = (p: Pt): Pt => ({ x: round6(p.x), y: round6(p.y) });

// ── enum normalization (never throw on bad input) ─────────────────────────────
const LEVEL_STATUS = new Set(["completed", "current", "locked"]);
const MS_STATES = new Set(["locked", "ready", "in_progress", "passed"]);
const BRANCH_STATUS = new Set(["locked", "growing", "matured"]);
const TOPIC_GROUPS = new Set(["daily", "work", "travel", "medical", "culture", "exam"]);
const NODE_STATES = new Set(["locked", "available", "in_progress", "completed"]);
const SKILLS = new Set(CANON_SKILLS as readonly string[]);

/**
 * Deep-copy + coerce unknown enums to safe defaults. Input is never mutated;
 * unknown skills are dropped, everything else degrades deterministically.
 */
function normalizePath(rawPath: unknown): PathLevel[] {
  if (!Array.isArray(rawPath)) return [];
  const out: PathLevel[] = [];
  for (const rawLevel of rawPath) {
    const lvl = (rawLevel ?? {}) as Record<string, unknown>;
    const level = lvl.level as CefrLevel;
    const status = LEVEL_STATUS.has(lvl.status as string)
      ? (lvl.status as PathLevel["status"])
      : "locked";

    const rawMs = (lvl.milestone ?? {}) as Record<string, unknown>;
    const milestone = {
      id: typeof rawMs.id === "string" ? rawMs.id : `ms_${String(level)}`,
      title: typeof rawMs.title === "string" ? rawMs.title : undefined,
      state: (MS_STATES.has(rawMs.state as string) ? rawMs.state : "locked") as MilestoneState,
      passedAt: typeof rawMs.passedAt === "string" ? rawMs.passedAt : undefined,
      unlocksWhen: typeof rawMs.unlocksWhen === "string" ? rawMs.unlocksWhen : undefined,
    };

    const branchesRaw = Array.isArray(lvl.branches) ? lvl.branches : [];
    const branches: BranchInput[] = [];
    branchesRaw.forEach((rawBranch, bIdx) => {
      const b = (rawBranch ?? {}) as Record<string, unknown>;
      if (!SKILLS.has(b.skill as string)) return; // drop unknown skill
      const skill = b.skill as Skill;
      const bStatus = (BRANCH_STATUS.has(b.status as string) ? b.status : "locked") as BranchStatus;
      const shootsRaw = Array.isArray(b.shoots) ? b.shoots : [];
      const shoots = shootsRaw.map((rawShoot, sIdx) => {
        const sh = (rawShoot ?? {}) as Record<string, unknown>;
        const topicId = typeof sh.topicId === "string" ? sh.topicId : `${level}_${skill}_${bIdx}_${sIdx}`;
        const topicGroup = (TOPIC_GROUPS.has(sh.topicGroup as string)
          ? sh.topicGroup
          : "daily") as TopicGroup;
        const uo = Number(sh.unlockOrder);
        const nodesRaw = Array.isArray(sh.nodes) ? sh.nodes : [];
        const nodes = nodesRaw.map((rawNode, nIdx) => {
          const n = (rawNode ?? {}) as Record<string, unknown>;
          return {
            id: typeof n.id === "string" && n.id.length > 0 ? n.id : `${topicId}_${nIdx}`,
            title: typeof n.title === "string" ? n.title : undefined,
            state: (NODE_STATES.has(n.state as string) ? n.state : "locked") as NodeState,
          };
        });
        return {
          topicId,
          topicLabel: typeof sh.topicLabel === "string" ? sh.topicLabel : undefined,
          topicGroup,
          unlockOrder: Number.isFinite(uo) ? uo : 9999,
          chosenByUser: Boolean(sh.chosenByUser),
          nodes,
        };
      });
      branches.push({ skill, label: typeof b.label === "string" ? b.label : undefined, status: bStatus, shoots });
    });

    out.push({ level, status, note: typeof lvl.note === "string" ? lvl.note : undefined, milestone, branches });
  }
  return out;
}

// ── milestone derivation ──────────────────────────────────────────────────────
interface MsInfo {
  raw: MilestoneState;
  eff: MilestoneState;
  gateSatisfied: boolean;
}
function deriveMs(level: PathLevel): MsInfo {
  const raw = level.milestone.state;
  const gateSatisfied =
    level.branches.length === 4 && level.branches.every((b) => b.status === "matured");
  let eff: MilestoneState;
  if (raw === "passed") eff = "passed";
  else if (raw === "in_progress") eff = "in_progress";
  else if (gateSatisfied) eff = "ready";
  else eff = "locked";
  return { raw, eff, gateSatisfied };
}

function countSkillsOnSide(present: Set<Skill>, side: "left" | "right"): number {
  let k = 0;
  for (const s of CANON_SKILLS) if (present.has(s) && SIDE[s] === side) k++;
  return k;
}

// ── bounding box ──────────────────────────────────────────────────────────────
function foldBBox(elements: TreeElement[], pad: number): BBox {
  if (elements.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const acc = (x: number, y: number, m: number) => {
    if (x - m < minX) minX = x - m;
    if (y - m < minY) minY = y - m;
    if (x + m > maxX) maxX = x + m;
    if (y + m > maxY) maxY = y + m;
  };
  for (const el of elements) {
    switch (el.kind) {
      case "trunkSegment":
      case "skillBranch":
      case "shoot": {
        const m = Math.max(el.thickStart, el.thickEnd) / 2;
        acc(el.from.x, el.from.y, m);
        acc(el.to.x, el.to.y, m);
        break;
      }
      default:
        acc(el.pos.x, el.pos.y, el.r);
        break;
    }
  }
  minX = round6(minX - pad);
  minY = round6(minY - pad);
  maxX = round6(maxX + pad);
  maxY = round6(maxY + pad);
  return { minX, minY, maxX, maxY, width: round6(maxX - minX), height: round6(maxY - minY) };
}

// ── main ──────────────────────────────────────────────────────────────────────
export function computeTreeLayout(
  pathData: PathInput | PathRoot,
  params?: Partial<TreeParams>,
): TreeLayout {
  const P: TreeParams = { ...DEFAULT_PARAMS, ...(params ?? {}) };
  const rawPath = Array.isArray(pathData) ? pathData : ((pathData as PathRoot)?.path ?? []);
  const path = normalizePath(rawPath);

  const elements: TreeElement[] = [];
  let truncated = false;

  // 1. achieved levels = the trunk
  const ach = path.filter((p) => p.status === "completed" || p.status === "current");
  const nAch = ach.length;
  if (nAch === 0) {
    return {
      elements: [],
      bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
      metrics: {
        achievedLevels: 0,
        trunkHeight: 0,
        groundY: 0,
        totalBranches: 0,
        totalShoots: 0,
        totalLeaves: 0,
        completedLeaves: 0,
        maturedBranches: 0,
        nextLevelLocked: true,
        truncated: false,
        suggestedScale: round6(P.targetPx),
        center: { x: 0, y: 0 },
      },
    };
  }

  const msInfo = ach.map(deriveMs);

  // 2. trunk walk (milestone gates the CURRENT segment's height)
  let y = 0;
  const levelY: number[] = [];
  const trunkSpecs: { yStart: number; yEnd: number; level: CefrLevel; status: PathLevel["status"] }[] = [];
  for (let i = 0; i < nAch; i++) {
    const lvl = ach[i];
    const isCurrent = lvl.status === "current";
    const baseSeg = lvl.level === "A0" ? P.seedSegH : P.trunkSegBase;
    const segActual = isCurrent ? baseSeg * MS_FRAC[msInfo[i].eff] : baseSeg;
    const yStart = y;
    y += segActual;
    levelY[i] = y;
    trunkSpecs.push({ yStart, yEnd: y, level: lvl.level, status: lvl.status });
  }
  const trunkHeight = y;
  const denom = trunkHeight || 1;
  const thickAt = (yy: number): number => lerp(P.trunkBaseThick, P.trunkTipThick, yy / denom);

  // 3. trunk segments (base → tip)
  for (const spec of trunkSpecs) {
    elements.push({
      kind: "trunkSegment",
      id: `trunk-${spec.level}`,
      level: spec.level,
      from: { x: 0, y: round6(spec.yStart) },
      to: { x: 0, y: round6(spec.yEnd) },
      thickStart: round6(thickAt(spec.yStart)),
      thickEnd: round6(thickAt(spec.yEnd)),
      colorSlot: "trunk",
      state: `state:${spec.status}`,
    });
  }

  let maturedBranches = 0;
  let totalBranches = 0;
  let totalShoots = 0;
  let totalLeaves = 0;
  let completedLeaves = 0;

  // 4. branches + shoots + leaves (A0 = seed, no branches)
  for (let i = 0; i < nAch; i++) {
    const lvl = ach[i];
    if (lvl.level === "A0") continue;
    const base: Pt = { x: 0, y: levelY[i] };

    const bySkill = new Map<Skill, BranchInput>();
    for (const b of lvl.branches) bySkill.set(b.skill, b);
    const present = new Set<Skill>(bySkill.keys());

    // 4a. per-branch geometry (length needed before the balance pull)
    interface BInfo {
      skill: Skill;
      side: "left" | "right";
      dev: number;
      angle: number;
      len: number;
      status: BranchStatus;
      totalNodes: number;
      branch: BranchInput;
    }
    const branchInfos: BInfo[] = [];
    for (const skill of CANON_SKILLS) {
      const b = bySkill.get(skill);
      if (!b) continue;
      const side = SIDE[skill];
      const s = SIDE_INDEX[skill];
      const kSide = countSkillsOnSide(present, side);
      let dev = P.gmin + ((s + 0.5) / kSide) * (P.gmax - P.gmin);
      dev = dev - P.upwardBias * i; // apical narrowing
      dev = clamp(dev, P.gmin, P.gmax);
      const totalNodes = Math.min(
        b.shoots.reduce((sum, sh) => sum + Math.min(sh.nodes.length, P.nodeCap), 0),
        P.nodeCap,
      );
      const matB = b.status === "matured" ? 1 : b.status === "growing" ? 0.7 : 0;
      const len =
        matB === 0
          ? 0
          : clamp(matB * (P.branchBaseLen + P.branchPerNode * totalNodes), P.branchMinLen, P.branchMaxLen);
      branchInfos.push({ skill, side, dev, angle: 90, len, status: b.status, totalNodes, branch: b });
    }

    // 4b. gentle balance pull (one-shot, bounded ⇒ byte-stable)
    let leftMass = 0;
    let rightMass = 0;
    for (const bi of branchInfos) {
      if (bi.side === "left") leftMass += bi.len;
      else rightMass += bi.len;
    }
    const shift =
      clamp((rightMass - leftMass) / (leftMass + rightMass + 1e-9), -1, 1) * P.balancePullMax;
    for (const bi of branchInfos) {
      bi.dev = clamp(bi.dev + (bi.side === "left" ? shift : -shift), P.gmin, P.gmax);
      bi.angle = bi.side === "left" ? 90 + bi.dev : 90 - bi.dev;
    }

    // 4c. emit in canonical skill order
    for (const skill of CANON_SKILLS) {
      const bi = branchInfos.find((x) => x.skill === skill);
      if (!bi) continue;

      if (bi.len <= 0) {
        elements.push({
          kind: "dormantBud",
          id: `bud-${lvl.level}-${skill}`,
          level: lvl.level,
          skill,
          pos: q(base),
          r: P.budR,
          colorSlot: "level",
          state: "branch:locked",
        });
        continue;
      }

      totalBranches++;
      if (bi.status === "matured") maturedBranches++;
      const tip = endpoint(base, bi.angle, bi.len);
      elements.push({
        kind: "skillBranch",
        id: `branch-${lvl.level}-${skill}`,
        level: lvl.level,
        skill,
        side: bi.side,
        from: q(base),
        to: q(tip),
        angle: round6(bi.angle),
        length: round6(bi.len),
        thickStart: round6(Math.max(P.branchBaseThick * Math.min(1, bi.totalNodes / 4), 1)),
        thickEnd: round6(P.branchTipThick),
        colorSlot: "level",
        state: `branch:${bi.status}`,
      });

      // 4d. shoots — slot + bounded jitter ⇒ no overlap, single pass
      const shoots = bi.branch.shoots.map((sh, idx) => ({ sh, idx }));
      shoots.sort(
        (a, c) =>
          a.sh.unlockOrder - c.sh.unlockOrder ||
          (a.sh.topicId < c.sh.topicId ? -1 : a.sh.topicId > c.sh.topicId ? 1 : 0) ||
          a.idx - c.idx,
      );
      const m = Math.min(shoots.length, P.nodeCap);
      if (shoots.length > P.nodeCap) truncated = true;

      for (let r = 0; r < m; r++) {
        const sh = shoots[r].sh;
        const t = P.shootTMin + ((r + 0.5) / m) * (P.shootTMax - P.shootTMin);
        const anchor = endpoint(base, bi.angle, t * bi.len);
        const slotCenter = ((r + 0.5) / m) * (2 * P.shootFanHalf) - P.shootFanHalf;
        const jitter = (hashUnit(sh.topicId) - 0.5) * ((2 * P.shootFanHalf) / m) * P.shootJitterFrac;
        const shootDev = clamp(slotCenter + jitter, -P.shootFanHalf, P.shootFanHalf);
        let shootAngle = bi.side === "left" ? bi.angle + shootDev : bi.angle - shootDev;
        shootAngle = 90 + clamp(shootAngle - 90, -88, 88); // hard anti-cross cap

        const nodes = sh.nodes.slice(0, P.nodeCap);
        if (sh.nodes.length > P.nodeCap) truncated = true;
        const completedCount = Math.min(
          sh.nodes.reduce((n, nd) => n + (nd.state === "completed" ? 1 : 0), 0),
          P.nodeCap,
        );
        const shootLen = clamp(
          P.shootBaseLen + P.shootPerCompleted * completedCount,
          P.shootMinLen,
          P.shootMaxLen,
        );
        const sTip = endpoint(anchor, shootAngle, shootLen);
        const shootId = `shoot-${lvl.level}-${skill}-${sh.topicId}`;
        totalShoots++;
        elements.push({
          kind: "shoot",
          id: shootId,
          level: lvl.level,
          skill,
          topicId: sh.topicId,
          topicGroup: sh.topicGroup,
          unlockOrder: sh.unlockOrder,
          chosenByUser: Boolean(sh.chosenByUser),
          completedCount,
          from: q(anchor),
          to: q(sTip),
          angle: round6(shootAngle),
          length: round6(shootLen),
          thickStart: round6(P.branchTipThick * P.shootThickRatio),
          thickEnd: round6(P.shootTipThick),
          colorSlot: `group:${sh.topicGroup}`,
          state: "state:in_progress",
        });

        // 4e. leaves along the shoot (data/pedagogical order)
        const N = nodes.length;
        for (let j = 0; j < N; j++) {
          const node = nodes[j];
          const u = N === 1 ? 0.5 : (j + 1) / (N + 1);
          let pos = endpoint(anchor, shootAngle, u * shootLen);
          if (j > 0) {
            const pd = perpDir(shootAngle);
            const sign = j % 2 === 0 ? 1 : -1;
            pos = { x: pos.x + pd.x * sign * P.leafPerpOffset, y: pos.y + pd.y * sign * P.leafPerpOffset };
          }
          totalLeaves++;
          if (node.state === "completed") completedLeaves++;
          elements.push({
            kind: "leaf",
            id: `leaf-${node.id}`,
            level: lvl.level,
            skill,
            topicId: sh.topicId,
            shootId,
            nodeId: node.id,
            orderIndex: j,
            pos: q(pos),
            r: round6(P.leafR * LEAF_SIZE_MULT[node.state]),
            colorSlot: `group:${sh.topicGroup}`,
            state: `leaf:${node.state}`,
            title: node.title ?? "",
          });
        }

        // 4f. shoot tip bud (so even an all-locked shoot shows where it grows)
        elements.push({
          kind: "shootTipBud",
          id: `tipbud-${shootId}`,
          shootId,
          pos: q(sTip),
          r: P.budR,
          colorSlot: `group:${sh.topicGroup}`,
          state: "leaf:available",
        });
      }
    }
  }

  // 5. structural nodes last (paint atop stems)
  for (let i = 0; i < nAch; i++) {
    const lvl = ach[i];
    elements.push({
      kind: "levelNode",
      id: `level-${lvl.level}`,
      level: lvl.level,
      pos: { x: 0, y: round6(levelY[i]) },
      r: P.levelNodeR,
      colorSlot: "level",
      state: `state:${lvl.status}`,
    });
  }
  for (let i = 0; i < nAch; i++) {
    const lvl = ach[i];
    const info = msInfo[i];
    elements.push({
      kind: "milestone",
      id: lvl.milestone.id,
      level: lvl.level,
      pos: { x: 0, y: round6(levelY[i]) },
      r: P.milestoneNodeR,
      rawState: info.raw,
      effectiveState: info.eff,
      gateSatisfied: info.gateSatisfied,
      isCurrentGate: i === nAch - 1,
      title: lvl.milestone.title ?? "",
      colorSlot: "milestone",
      state: `state:${info.eff}`,
    });
  }

  // 6. bbox + metrics
  const bbox = foldBBox(elements, P.bboxPad);
  const metrics: TreeMetrics = {
    achievedLevels: nAch,
    trunkHeight: round6(trunkHeight),
    groundY: 0,
    totalBranches,
    totalShoots,
    totalLeaves,
    completedLeaves,
    maturedBranches,
    nextLevelLocked: msInfo[nAch - 1].eff !== "passed",
    truncated,
    suggestedScale: round6(P.targetPx / Math.max(bbox.width, bbox.height, 1)),
    center: { x: round6((bbox.minX + bbox.maxX) / 2), y: round6((bbox.minY + bbox.maxY) / 2) },
  };

  return { elements, bbox, metrics };
}
