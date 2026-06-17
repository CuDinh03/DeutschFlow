import { describe, it, expect } from "vitest";
import { computeTreeLayout } from "../computeTreeLayout";
import { DEFAULT_PARAMS } from "../params";
import { hash32, hashUnit } from "../hash";
import sampleJson from "../fixtures/deutschflow_learning_tree_sample.json";
import type {
  Leaf,
  MilestoneNode,
  PathInput,
  PathLevel,
  PathRoot,
  Shoot,
  SkillBranch,
  TreeElement,
  TrunkSegment,
} from "../types";

// The fixture is the canonical source-of-truth (B1 "current" scene).
const sample = sampleJson as unknown as PathRoot;
const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const layout = computeTreeLayout(sample);
const ofKind = <K extends TreeElement["kind"]>(k: K) =>
  layout.elements.filter((e): e is Extract<TreeElement, { kind: K }> => e.kind === k);

const leafById = (nodeId: string): Leaf | undefined =>
  ofKind("leaf").find((l) => l.nodeId === nodeId);
const shootByTopic = (level: string, skill: string, topicId: string): Shoot | undefined =>
  ofKind("shoot").find((s) => s.level === level && s.skill === skill && s.topicId === topicId);
const branchOf = (level: string, skill: string): SkillBranch | undefined =>
  ofKind("skillBranch").find((b) => b.level === level && b.skill === skill);

describe("determinism & purity", () => {
  it("is byte-identical across two calls on the same input", () => {
    const a = computeTreeLayout(sample);
    const b = computeTreeLayout(sample);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("never mutates the input", () => {
    const before = deepClone(sample);
    computeTreeLayout(sample);
    expect(sample).toEqual(before);
  });

  it("rounds every numeric output field to 6 decimals", () => {
    const is6 = (v: number) => v === Math.round(v * 1e6) / 1e6;
    for (const el of layout.elements) {
      for (const val of Object.values(el)) {
        if (typeof val === "number") expect(is6(val)).toBe(true);
        else if (val && typeof val === "object" && "x" in val && "y" in val) {
          expect(is6((val as { x: number }).x)).toBe(true);
          expect(is6((val as { y: number }).y)).toBe(true);
        }
      }
    }
    for (const v of [layout.bbox.minX, layout.bbox.maxY, layout.metrics.trunkHeight, layout.metrics.suggestedScale]) {
      expect(is6(v)).toBe(true);
    }
  });
});

describe("hash", () => {
  it("is a pure uint32 and idempotent", () => {
    const h = hash32("nursing_care");
    expect(h).toBe(hash32("nursing_care"));
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    expect(hashUnit("nursing_care")).toBeGreaterThanOrEqual(0);
    expect(hashUnit("nursing_care")).toBeLessThan(1);
  });

  it("does not throw on empty string and stays finite", () => {
    expect(Number.isFinite(hashUnit(""))).toBe(true);
  });

  it("same topicId in the same fan context ⇒ same relative deflection (cùng chủ đề ⇒ cùng hướng)", () => {
    // 'health_basic' is the ONLY shoot on both A2 hoeren and A2 sprechen
    // (same m=1, same rank-0), so identical topicId ⇒ identical hash jitter ⇒
    // identical |shootAngle - branchAngle|. (A different topic *mix* changes
    // m/ranks and thus the slot width — that is the intended divergence.)
    const hoer = shootByTopic("A2", "hoeren", "health_basic")!;
    const sprech = shootByTopic("A2", "sprechen", "health_basic")!;
    const devH = Math.abs(hoer.angle - branchOf("A2", "hoeren")!.angle);
    const devS = Math.abs(sprech.angle - branchOf("A2", "sprechen")!.angle);
    expect(devH).toBeCloseTo(devS, 6);
    // and the hash itself is identical wherever the topic appears
    expect(hashUnit("nursing_care")).toBe(hashUnit("nursing_care"));
  });
});

describe("trunk (= achieved levels)", () => {
  it("has 4 achieved levels and trunkHeight 270.6 (60 + 90 + 90 + 90*0.34)", () => {
    expect(layout.metrics.achievedLevels).toBe(4);
    expect(layout.metrics.trunkHeight).toBeCloseTo(270.6, 6);
  });

  it("tapers: every segment thickStart > thickEnd, base === trunkBaseThick", () => {
    const segs = ofKind("trunkSegment");
    expect(segs.length).toBe(4);
    for (const s of segs) expect(s.thickStart).toBeGreaterThan(s.thickEnd);
    const a0 = segs.find((s) => s.level === "A0")!;
    expect(a0.from.y).toBe(0);
    expect(a0.thickStart).toBeCloseTo(DEFAULT_PARAMS.trunkBaseThick, 6);
  });

  it("excludes locked future levels (B2/C1/C2) entirely", () => {
    for (const el of layout.elements) {
      expect(["B2", "C1", "C2"]).not.toContain((el as { level?: string }).level);
    }
  });
});

describe("rule: A0 = seed (no branches), branches from A1", () => {
  it("A0 emits only trunk + level + milestone", () => {
    const a0 = layout.elements.filter((e) => (e as { level?: string }).level === "A0");
    expect(a0.map((e) => e.kind).sort()).toEqual(["levelNode", "milestone", "trunkSegment"]);
  });

  it("SkillBranch/DormantBud exist only for A1, A2, B1", () => {
    const levels = new Set(
      [...ofKind("skillBranch"), ...ofKind("dormantBud")].map((e) => e.level),
    );
    expect(Array.from(levels).sort()).toEqual(["A1", "A2", "B1"]);
  });
});

describe("branches", () => {
  it("emit in canonical order regardless of input order", () => {
    const shuffled = deepClone(sample);
    const b1 = shuffled.path.find((p: PathLevel) => p.level === "B1")!;
    b1.branches.reverse(); // schreiben, lesen, sprechen, hoeren
    const out = computeTreeLayout(shuffled);
    const b1Order = out.elements
      .filter((e) => (e as { level?: string }).level === "B1" && (e.kind === "skillBranch" || e.kind === "dormantBud"))
      .map((e) => (e as SkillBranch).skill);
    expect(b1Order).toEqual(["hoeren", "sprechen", "lesen", "schreiben"]);
  });

  it("side map: hoeren/lesen left (angle>90), sprechen/schreiben right (angle<90)", () => {
    for (const b of ofKind("skillBranch")) {
      if (b.skill === "hoeren" || b.skill === "lesen") {
        expect(b.side).toBe("left");
        expect(b.angle).toBeGreaterThan(90);
      } else {
        expect(b.side).toBe("right");
        expect(b.angle).toBeLessThan(90);
      }
      expect(b.angle).toBeGreaterThan(38);
      expect(b.angle).toBeLessThan(142);
    }
  });

  it("locked branch ⇒ DormantBud (B1 schreiben), no branch/shoot/leaf", () => {
    expect(branchOf("B1", "schreiben")).toBeUndefined();
    const bud = ofKind("dormantBud").find((b) => b.level === "B1" && b.skill === "schreiben");
    expect(bud).toBeDefined();
    expect(bud!.r).toBe(DEFAULT_PARAMS.budR);
    expect(shootByTopic("B1", "schreiben", "")).toBeUndefined();
  });

  it("length from maturity+fill: B1 hoeren=80.5 (growing,5), A1 hoeren=97 (matured,3)", () => {
    expect(branchOf("B1", "hoeren")!.length).toBeCloseTo(80.5, 6);
    expect(branchOf("A1", "hoeren")!.length).toBeCloseTo(97, 6);
  });
});

describe("shoots", () => {
  it("position from unlockOrder: lower order anchors nearer the base", () => {
    const nc = shootByTopic("B1", "hoeren", "nursing_care")!; // unlockOrder 1
    const dl = shootByTopic("B1", "hoeren", "daily_life")!; // unlockOrder 2
    const base = { x: 0, y: layout.metrics.trunkHeight };
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x - base.x, p.y - base.y);
    expect(dist(nc.from)).toBeLessThan(dist(dl.from));
  });

  it("length counts ONLY completed nodes", () => {
    expect(shootByTopic("B1", "hoeren", "nursing_care")!.length).toBeCloseTo(45, 6); // 1 completed → 34+11
    expect(shootByTopic("A1", "hoeren", "greetings")!.length).toBeCloseTo(56, 6); // 2 completed → 34+22
    expect(shootByTopic("B1", "lesen", "health_docs")!.length).toBeCloseTo(34, 6); // 0 completed → base
  });

  it("guarantees a positive min angular gap (no overlap) for a dense branch", () => {
    const dense: PathInput = [
      {
        level: "B1",
        status: "current",
        milestone: { id: "m", state: "locked" },
        branches: [
          {
            skill: "hoeren",
            status: "growing",
            shoots: Array.from({ length: 10 }, (_, i) => ({
              topicId: `t${i}`,
              topicGroup: "daily",
              unlockOrder: i + 1,
              nodes: [{ id: `n${i}`, state: "completed" }],
            })),
          },
        ],
      },
    ];
    const out = computeTreeLayout(dense);
    const angles = out.elements
      .filter((e): e is Shoot => e.kind === "shoot")
      .map((s) => s.angle)
      .sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeGreaterThan(0);
    }
  });

  it("a single shoot anchors mid-branch (no /0)", () => {
    const single: PathInput = [
      {
        level: "B1",
        status: "current",
        milestone: { id: "m", state: "locked" },
        branches: [
          { skill: "hoeren", status: "growing", shoots: [{ topicId: "x", topicGroup: "daily", unlockOrder: 1, nodes: [{ id: "n", state: "completed" }] }] },
        ],
      },
    ];
    const out = computeTreeLayout(single);
    const sh = out.elements.find((e): e is Shoot => e.kind === "shoot")!;
    expect(Number.isFinite(sh.angle)).toBe(true);
    expect(Number.isFinite(sh.from.x)).toBe(true);
  });
});

describe("leaves", () => {
  it("one leaf per node in data order + a tip bud", () => {
    const ncLeaves = ofKind("leaf").filter((l) => l.shootId === "shoot-B1-hoeren-nursing_care");
    expect(ncLeaves.map((l) => l.nodeId)).toEqual(["b1_h_nc_1", "b1_h_nc_2", "b1_h_nc_3", "b1_h_nc_4"]);
    expect(ofKind("shootTipBud").some((b) => b.shootId === "shoot-B1-hoeren-nursing_care")).toBe(true);
  });

  it("leaf id mirrors node id; state token mirrors node state", () => {
    expect(leafById("b1_h_nc_2")!.id).toBe("leaf-b1_h_nc_2");
    expect(leafById("b1_h_nc_2")!.state).toBe("leaf:in_progress");
  });

  it("size by state: completed r=7, locked r=4.9", () => {
    expect(leafById("b1_h_nc_1")!.r).toBeCloseTo(7, 6);
    expect(leafById("b1_h_nc_4")!.r).toBeCloseTo(4.9, 6);
  });
});

describe("milestone gate (separate condition)", () => {
  it("B1 derives 'locked' (schreiben not matured); A1/A2 'passed'", () => {
    const ms = (lvl: string) => ofKind("milestone").find((m) => m.level === lvl)! as MilestoneNode;
    expect(ms("B1").effectiveState).toBe("locked");
    expect(ms("B1").gateSatisfied).toBe(false);
    expect(ms("A1").effectiveState).toBe("passed");
    expect(ms("A2").effectiveState).toBe("passed");
  });

  it("derives 'ready' when 4 branches matured but raw still 'locked'", () => {
    const ready: PathInput = [
      {
        level: "A1",
        status: "current",
        milestone: { id: "m", state: "locked" },
        branches: (["hoeren", "sprechen", "lesen", "schreiben"] as const).map((skill) => ({
          skill,
          status: "matured" as const,
          shoots: [{ topicId: `t_${skill}`, topicGroup: "daily" as const, unlockOrder: 1, nodes: [{ id: `n_${skill}`, state: "completed" as const }] }],
        })),
      },
    ];
    const m = computeTreeLayout(ready).elements.find((e): e is MilestoneNode => e.kind === "milestone")!;
    expect(m.effectiveState).toBe("ready");
    expect(m.gateSatisfied).toBe(true);
  });

  it("gates trunk growth: flipping B1 milestone to 'passed' grows the trunk", () => {
    const passed = deepClone(sample);
    passed.path.find((p: PathLevel) => p.level === "B1")!.milestone.state = "passed";
    const grown = computeTreeLayout(passed);
    expect(grown.metrics.trunkHeight).toBeGreaterThan(layout.metrics.trunkHeight);
    expect(grown.metrics.trunkHeight).toBeCloseTo(330, 6); // 60+90+90+90
  });
});

describe("tokens & ordering", () => {
  it("colored elements use group:* slots, never hex/opacity", () => {
    const colored = [...ofKind("leaf"), ...ofKind("shoot"), ...ofKind("shootTipBud")];
    for (const el of colored) expect(el.colorSlot).toMatch(/^group:(daily|work|travel|medical|culture|exam)$/);
    expect(JSON.stringify(layout)).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("every state token is in the closed vocabulary", () => {
    const re = /^(state:(completed|current|locked|ready|in_progress|passed)|branch:(matured|growing|locked)|leaf:(locked|available|in_progress|completed))$/;
    for (const el of layout.elements) expect(el.state).toMatch(re);
  });

  it("emission order: trunks → mid → levelNodes → milestones", () => {
    const kinds = layout.elements.map((e) => e.kind);
    const firstStructural = kinds.findIndex((k) => k === "levelNode" || k === "milestone");
    expect(kinds.slice(0, 4).every((k) => k === "trunkSegment")).toBe(true);
    const tail = kinds.slice(firstStructural);
    const levelCount = ofKind("levelNode").length;
    expect(tail.slice(0, levelCount).every((k) => k === "levelNode")).toBe(true);
    expect(tail.slice(levelCount).every((k) => k === "milestone")).toBe(true);
  });
});

describe("guardrails & robustness", () => {
  it("nodeCap=10 truncates an 11-node shoot and flags metrics.truncated", () => {
    const big: PathInput = [
      {
        level: "B1",
        status: "current",
        milestone: { id: "m", state: "locked" },
        branches: [
          {
            skill: "hoeren",
            status: "growing",
            shoots: [{ topicId: "x", topicGroup: "daily", unlockOrder: 1, nodes: Array.from({ length: 11 }, (_, i) => ({ id: `n${i}`, state: "completed" as const })) }],
          },
        ],
      },
    ];
    const out = computeTreeLayout(big);
    expect(out.elements.filter((e) => e.kind === "leaf").length).toBe(10);
    expect(out.metrics.truncated).toBe(true);
  });

  it("balance pull is one-shot (idempotent) and never NaN on all-locked", () => {
    const allLocked: PathInput = [
      {
        level: "A1",
        status: "current",
        milestone: { id: "m", state: "locked" },
        branches: (["hoeren", "sprechen", "lesen", "schreiben"] as const).map((skill) => ({ skill, status: "locked" as const, shoots: [] })),
      },
    ];
    const out = computeTreeLayout(allLocked);
    for (const el of out.elements) {
      const vals = Object.values(el).filter((v) => typeof v === "number") as number[];
      for (const v of vals) expect(Number.isNaN(v)).toBe(false);
    }
  });

  it("normalizes unknown enums without throwing", () => {
    const dirty = [
      {
        level: "A1",
        status: "weird",
        milestone: { id: "m", state: "??" },
        branches: [
          { skill: "foo", status: "??", shoots: [] }, // unknown skill → dropped
          { skill: "hoeren", status: "growing", shoots: [{ topicId: "x", topicGroup: "xyz", unlockOrder: 1, nodes: [{ id: "n", state: "huh" }] }] },
        ],
      },
    ];
    // 'weird' status ⇒ locked ⇒ not achieved ⇒ empty tree, but must not throw.
    expect(() => computeTreeLayout(dirty as unknown as PathInput)).not.toThrow();
    const fixed = deepClone(dirty);
    (fixed[0] as { status: string }).status = "current";
    const out = computeTreeLayout(fixed as unknown as PathInput);
    expect(out.elements.find((e) => e.kind === "skillBranch")).toBeDefined();
    expect(ofKindIn(out.elements, "leaf")[0].colorSlot).toBe("group:daily"); // xyz → daily
  });

  it("empty / all-locked path ⇒ empty layout, zero metrics, no /0", () => {
    const empty = computeTreeLayout([]);
    expect(empty.elements).toEqual([]);
    expect(empty.metrics.achievedLevels).toBe(0);
    expect(empty.metrics.trunkHeight).toBe(0);
    expect(Number.isFinite(empty.metrics.suggestedScale)).toBe(true);
  });

  it("single A0 (completed) ⇒ seed-only, trunkHeight = seedSegH", () => {
    const seedOnly: PathInput = [
      { level: "A0", status: "completed", milestone: { id: "ms_a0", state: "passed" }, branches: [] },
    ];
    const out = computeTreeLayout(seedOnly);
    expect(out.elements.map((e) => e.kind).sort()).toEqual(["levelNode", "milestone", "trunkSegment"]);
    expect(out.metrics.trunkHeight).toBeCloseTo(DEFAULT_PARAMS.seedSegH, 6);
  });
});

describe("bbox & metrics", () => {
  it("encloses every element (incl. radii) and suggestedScale > 0", () => {
    const { bbox } = layout;
    for (const el of layout.elements) {
      if (el.kind === "trunkSegment" || el.kind === "skillBranch" || el.kind === "shoot") {
        for (const p of [el.from, el.to]) {
          expect(p.x).toBeGreaterThanOrEqual(bbox.minX);
          expect(p.x).toBeLessThanOrEqual(bbox.maxX);
          expect(p.y).toBeGreaterThanOrEqual(bbox.minY);
          expect(p.y).toBeLessThanOrEqual(bbox.maxY);
        }
      } else {
        expect(el.pos.x - el.r).toBeGreaterThanOrEqual(bbox.minX);
        expect(el.pos.x + el.r).toBeLessThanOrEqual(bbox.maxX);
      }
    }
    expect(layout.metrics.suggestedScale).toBeGreaterThan(0);
    expect(layout.metrics.center.x).toBeCloseTo((bbox.minX + bbox.maxX) / 2, 6);
  });

  it("reports tree composition", () => {
    expect(layout.metrics.totalLeaves).toBe(ofKind("leaf").length);
    expect(layout.metrics.completedLeaves).toBe(ofKind("leaf").filter((l) => l.state === "leaf:completed").length);
    expect(layout.metrics.nextLevelLocked).toBe(true);
  });
});

describe("snapshot", () => {
  it("matches the committed canonical B1 layout", () => {
    expect(layout).toMatchSnapshot();
  });
});

// local helper (kept after use to keep the suite readable)
function ofKindIn<K extends TreeElement["kind"]>(
  els: TreeElement[],
  k: K,
): Extract<TreeElement, { kind: K }>[] {
  return els.filter((e): e is Extract<TreeElement, { kind: K }> => e.kind === k);
}
