# Skill Tree ("Cây học tập") — Technical Reference

> **Audience:** engineers working on the Expo `mobile/` app.
> **Scope:** the interactive learning-roadmap tree on `app/(student)/roadmap.tsx`.
> **Companion docs:** [`SKILL_TREE_SPEC.md`](./SKILL_TREE_SPEC.md) = product intent / source of truth · [`SKILL_TREE_PROGRESS.md`](./SKILL_TREE_PROGRESS.md) = phased work log + device-QA notes. **This file = the as-built architecture reference, current as of the design-match (mầm sprout + gold discs + stage tabs).**

---

## 1. What it is

A bottom-up **living tree** that visualises the learner's CEFR journey (A1 → B2/goal). It is **not** a decorative reskin of a flat list — the tree **grows from a sprout with real progress**:

- **A new learner is a "mầm"**: a short bare tapered trunk with a **2-leaf sprout at its tip** and roots in the ground mound. No branches yet.
- **As levels are reached the trunk grows up**, sprouting a tier of branches per level. The lowest level sits on the ground; higher levels stack upward; the **growing tip carries the sprout**, and the **goal/crown floats faintly above** until reached.
- **Levels not yet reached** are a **faint dashed skeleton** (milestone dots) rising toward the faint goal.
- Within the **current** (in-progress) level, foliage **thickens as lessons complete**, so the tree changes week-to-week even before the next level-up.
- Each lesson is a **fruit motif** whose shape encodes status (ripe fruit = completed, flower = in-progress, bud = available, grey nub = locked).
- **Maturity preview** ("Mầm / Hiện tại / Cây lớn" tabs) lets the learner see the tree as a sprout, at real progress, or fully grown — a render-only projection.
- The canvas is **interactive**: pan / pinch / double-tap-zoom / fit, tap a node to open its sheet, filter by topic/skill, pick a companion mascot, and share an image ("Khoe cây").

---

## 2. File / module map

```
app/(student)/roadmap.tsx        Host: tree|phase tabs, query, filter/companion/viewport/previewStage
                                 state, NodeSheet host, StageTabs + PathHeroCompact (progress strip)
components/
  SkillTreeView.tsx              Orchestrator: layout → geometry → <Svg> render → gestures → overlays
  skill-tree/
    layout.ts                    PURE geometry + growth + preview logic (no React/SVG) — unit-tested
    palette.ts                   BARK, MS_PAL (gold/white/parchment discs), GROUP_COLORS (6), SKILL_DOTS, GROUND
    glyphs.tsx                   Inline-SVG glyphs (lock / sprout 2-leaf / check) — NOT icon fonts
    nodeOffsets.ts               Fan N nodes within a cluster without overlap — unit-tested
    topicGroup.ts                topicGroupOf / topicLabelOf (phase|industry → group) — unit-tested
    stages.ts                    deriveStages (4 maturity stages from real progress) — unit-tested
    PhaseStepper.tsx             "Giai đoạn" tab header
    motifs/NodeMotif.tsx         4 lifecycle motifs + BloomHalo + RecRing + CompanionEmoji + SkillBadge
    sheets/NodeSheet.tsx         Tap-in-place bottom sheet → real lesson route
    controls/
      useTreeGestures.ts         Shared values {s,tx,ty} + Pan/Pinch/Tap + fitView(onDone) + zoom; animatedStyle
      zoomMath.ts                Pure clamp/fit/focal/toCanvas/toggle — unit-tested
      TreeControls.tsx           ZoomButtons, FitButton, ShareButton
      FilterBar.tsx              Topic + skill filter (doubles as legend)
      CompanionChips.tsx         Companion picker
lib/
  skillTreeApi.ts                DTO + mapSkillNode (full wire shape, null-safe json-text parse)
  treeCompanion.ts               useCompanion (expo-secure-store) + COMPANIONS
  shareTree.ts                   capture PNG → cache file → RN Share
__tests__/skillTreeLayout.test.ts  + skillTree{Pha2,Topic,Stages,Api}.test.ts — invariants, not screenshot-diffs
```

---

## 3. Data model

`GET /skill-tree/me` returns raw `queryForList` rows (every column on the wire). `mapSkillNode` (`lib/skillTreeApi.ts`) maps to **`SkillNode`**:

| field | notes |
|---|---|
| `id`, `title`, `cefrLevel`, `dayNumber`, `sortOrder` | core |
| `status` | normalized `COMPLETED \| IN_PROGRESS \| AVAILABLE \| LOCKED`. **C1 fix:** backend `UNLOCKED` → `AVAILABLE`; null/unknown → `LOCKED` |
| `phase`, `industry`, `moduleTitle`, `sessionType`, `emoji` | topic-group + display |
| `coreTopics[]`, `grammarPoints[]`, `prerequisites[]` | parsed from `to_jsonb(...)::text` via `asStringArray()` (null-safe, never throws) |
| `dependenciesMet` | plumbed for future DAG gating (not yet rendered) |

Gating stays **server-driven** via `status`; the client never invents unlocks.

---

## 4. Layout & growth logic — `layout.ts` (pure, unit-tested)

`buildTreeLayout(nodes, width, preview = 'current'): TreeLayout` is the heart of the feature. No React, no SVG — only numbers, so every invariant is unit-tested without a device.

### 4.1 Tiers (one per CEFR level)

Nodes are grouped by `cefrLevel`, sorted `A0→C2`, chunked into **branch rows** of `BRANCH_SIZE = 3`. Each tier carries:

| field | meaning |
|---|---|
| `level`, `state` | CEFR letter + `MilestoneState` (`passed` / `in_progress` / `locked`) |
| `milestoneY`, `branchRows[]` | geometry (branch cluster centres); skeleton tiers have `branchRows: []` |
| **`grown`** | `state !== 'locked'` — a **reached** level (full branches) vs a **future skeleton** |
| **`fillRatio`** | `completed / total` for the level (0..1) |
| **`foliageScale`** | foliage opacity coefficient (see §4.3) |

`milestoneState`: all-completed → `passed`; any `IN_PROGRESS`/`AVAILABLE`/`COMPLETED` → `in_progress`; else `locked`.

### 4.2 The growth model (spec §2 "mọc từ mầm")

- **Grown tiers** (reached) get full height `MS_BAND + branchCount * ROW` (running-sum, never `i*gap` — H1).
- **Skeleton tiers** (locked future) collapse to a compact `SKELETON_BAND` so the faint future sits just above the living tree.
- Bottom-up placement: lowest level on the ground, later levels stack up.

`TreeLayout` returns:

| field | meaning |
|---|---|
| `groundY` | ground line (mound + roots sit here) |
| **`grownTopY`** | top edge of the highest **grown** tier — where the living trunk ends and the faint future trunk begins |
| `topY` | top of **everything** incl. skeleton — the goal/crown anchor |
| `goalLabel` | highest CEFR present (the goal) |
| **`goalReached`** | highest level is `passed` → crown solid + no tip sprout; else crown faint + sprout shown |
| **`hasGrown`** | any tier grown. **Cold-start (mầm):** every level locked (new user / null `user_status` → all `LOCKED`) → `hasGrown=false`, `grownTopY===groundY`. The renderer then draws a **short bare trunk stub** (`MIN_TRUNK_STUB`, in SkillTreeView) with the sprout at its tip — NOT a degenerate `trunkPath(groundY,groundY)`, and NOT a missing trunk. |

### 4.3 `foliageScale` (current-level "fill in")

```
passed        → 1                                            (lush)
in_progress   → CURRENT_FOLIAGE_FLOOR + (1-floor)*fillRatio   (floor 0.25 → 1.0 by completion)
locked/future → 0                                            (no foliage drawn)
```

`CURRENT_FOLIAGE_FLOOR = 0.25` is the tunable 0%-sprout faintness; the renderer applies it as the branch-cluster opacity, so the current level visibly thickens as its lessons complete.

### 4.4 Maturity preview — the `preview` param

`preview: PreviewStage` (`'mam' | 'current' | 'big'`) is a **render-only override** of level classification — it never touches lesson data or gating:

- **`mam`** → every level forced `locked` (grown=false) → a bare sprout (what a brand-new tree looks like).
- **`current`** (default) → the learner's actual progress.
- **`big`** → every level forced `passed` (grown, foliageScale 1, `goalReached=true`) → the full grown tree with gold discs (the goal preview).

Driven by the `StageTabs` segmented control in `roadmap.tsx`.

### 4.5 Other pure helpers

- `recommendedNodeId(nodes)` — first `AVAILABLE` node in CEFR-then-day order (mascot perch / "next" hint). `null` when nothing is unlocked-not-started.
- `trunkPath(cx, groundY, topY)` — tapered bark ribbon, wide base → thin top, sway fading toward the top. Called with `trunkTopY` (= `grownTopY`, or `groundY - MIN_TRUNK_STUB` at cold-start) so the living trunk is only as tall as the reached levels.

---

## 5. Rendering pipeline — `SkillTreeView.tsx`

One `<Svg>` sized to the **full canvas** (`CANVAS_W=380 × layout.height`), wrapped in a pan/zoomed `<Animated.View>`, inside a viewport-sized clip `<View>`:

```
<GestureDetector gesture>
  <View collapsable={false} w=viewport h=viewport overflow:hidden>   ← clip + RNGH ref anchor
    <Animated.View [{w:CANVAS_W, h:layout.height, transformOrigin:'0 0'}, animatedStyle]>  ← pan/zoom
      <Svg ref={svgRef} w=CANVAS_W h=layout.height>                  ← full-canvas (no clip before scale)
        <Defs> naRipe / naBud / naTrunk gradients
        <G>  ← static; transform lives on the Animated.View above
          ground mound + roots
          · faint dashed future trunk (trunkTopY → topY, when skeleton exists)
          · living trunk  (groundY → trunkTopY, always; short stub at cold-start)
          · crown/goal    (faint opacity 0.34 unless goalReached)
          · branch foliage + topic chip  (opacity = tier.foliageScale × filter-dim)
          · lesson motifs (RecRing / BloomHalo / NodeMotif / SkillBadge / CompanionEmoji)
          · milestones    (Milestone for grown, SkeletonMilestone for future)
          · sprout        (2-leaf, at trunkTopY, shown until goalReached)
```

`trunkTopY = layout.hasGrown ? layout.grownTopY : layout.groundY - MIN_TRUNK_STUB` — guarantees a real trunk at the mầm stage.

Overlays **outside** the `<Svg>` (RN, not SVG): share/zoom/fit cluster, companion picker. `StageTabs` (in-flow, below FilterBar) and `PathHeroCompact` (`pointerEvents="box-none"` overlay) live in `roadmap.tsx`.

**⚠️ Critical Fabric rule:** the pan/zoom transform **must** live on the wrapping `<Animated.View>` (`useAnimatedStyle`), **never** on an svg `<G>` via `useAnimatedProps`. On the **New Architecture (Fabric)**, `react-native-svg` does not update an animated `<G>` transform — pan/pinch/zoom silently do nothing and tap coords desync. See §6.

---

## 6. Gestures & zoom — `useTreeGestures.ts` + `zoomMath.ts`

- **Composition:** `Gesture.Simultaneous(Gesture.Race(pan, pinch), Gesture.Exclusive(doubleTap, singleTap))`.
  - Pan ignores < `PAN_SLOP` (5px); pinch clamps scale `[0.32, 1.5]` with focal compensation; double-tap toggles `0.46 ↔ 1.1`; single-tap is inverse-transformed to canvas coords and hit-tested.
- **Transform model (pure, `zoomMath.ts`):** a canvas point `(x,y)` maps to viewport px `(tx + s*x, ty + s*y)` — i.e. `translate(tx,ty) scale(s)` about origin `(0,0)`. `transformOrigin: '0 0'` on the `<Animated.View>` keeps this exact. `clampScale`/`focalZoom`/`toggleScale`/`fitTransform`/`toCanvas` are unit-tested.
- **Tap, NOT `<G onPress>`:** under a `GestureDetector` per-node press is swallowed; single-tap → `runOnJS(onTapCanvas)` → nearest node within `TAP_R=26` canvas px (filter-aware: dimmed nodes are skipped).
- **`fitView(onDone)`** animates to the fit transform and fires `onDone` on the JS thread when the spring settles — used by share to capture only after the tree has framed (no `setTimeout` race).

> Why the Animated.View, not Animated.G: device-QA found pan/pinch/zoom/tap **all dead** on Fabric because `react-native-svg`'s animated `<G transform>` never repainted. Moving the transform to the RN `<Animated.View>` (and sizing the Svg to the full canvas inside a clip) fixed it; verified live (zoom + pan + tap→sheet).

---

## 7. Controls

| control | file | behaviour |
|---|---|---|
| **Milestone disc** | `Milestone` in `SkillTreeView.tsx` (palette `MS_PAL`) | `passed` = **gold disc + CEFR letter + small green ✓ badge** (corner); `in_progress` = white disc + letter; `locked` = parchment dashed disc + lock glyph. Future/skeleton levels use `SkeletonMilestone` (faint dashed circle + letter). |
| **Stage tabs** | `StageTabs` in `roadmap.tsx` → `buildTreeLayout(preview)` | Maturity-PREVIEW segmented control (Mầm / Hiện tại / Cây lớn). Render-only override (§4.4) — never changes data/gating. |
| **Filter** | `controls/FilterBar.tsx` | 6 topic-group chips + 4 skill chips (doubles as legend). Selecting **dims** non-matching branches (topic) / nodes (skill = `dayNumber % 4`) to opacity 0.16 and excludes them from hit-test. Must sit **in document flow** (a ScrollView over the GestureDetector swallows pan). |
| **Companion** | `CompanionChips.tsx` + `lib/treeCompanion.ts` | 5 mascots; choice persists via `expo-secure-store` (key `lt_companion`, default `owl`). The mascot perches on the recommended node. |
| **NodeSheet** | `sheets/NodeSheet.tsx` | Tap-in-place bottom sheet (RN overlay outside `<Svg>`). Topic-group eyebrow, title, status; CTA opens the **real lesson route** `/(student)/node` (server-graded), not a quiz stub. |
| **Share** | `lib/shareTree.ts` + ShareButton | `fitView(onDone)` → `Svg.toDataURL()` (PNG) → `expo-file-system/legacy` cache → RN `Share`. **No new native dep / no rebuild.** Full-canvas Svg → captures the entire tree. iOS attaches the image; Android carries the caption only (RN Share limit). |
| **Phase tab** | `PhaseStepper.tsx` + `stages.ts` | 4 maturity stages from real progress + "next action" deep links. The per-node `SectionList` under it is the **a11y fallback** for the gesture canvas. |

---

## 8. Progress strip — `roadmap.tsx` `PathHeroCompact`

A **slim editorial strip** pinned as an overlay on the tree tab (warm-paper v2 "Galerie"):

```
[▢ yellow]  [0% — serif Newsreader]  [──── thin track (h6, fill accent) ────]  [0/55 CHẶNG]
```

`surface` background, hairline `borderStrong`, sharp `radius.sm` (4px), subtle shadow. Single compact row (~⅓ shorter than the old heavy ink card) — sits lighter over the canopy.

---

## 9. Theming (v2 "Galerie")

Warm-paper, **light-only**. Tokens from `lib/theme`: `bg #FBFAF7` · `surface #FFF` · `surfaceSunken #F6F3EC` · borders `#E7E3DA`/`#D8D2C6` · ink `#161513` · muted `#76716A` · faint `#C9C4BC` · accent yellow (+ AA gold `#C79A00`) · `success #1E9E61`. Milestone gold disc = `#FFCD00`. Numbers use **Newsreader serif**; UI uses **Instrument Sans**; corners are **sharp ~4px**; the **yellow square** is the brand motif.

---

## 10. Testing

`tsc --noEmit` clean · **`jest` 72/72**. Tests are **invariants** (web↔RN render differs, so no screenshot-diffs):

- `skillTreeLayout.test.ts` — bottom-up order, running-sum heights, milestone state, goal label, **growth model** (grown vs skeleton, `fillRatio`, `foliageScale` floor→1 exact, `grownTopY`/`topY`/`goalReached`, **cold-start all-locked** `hasGrown=false`, compact skeleton), **preview override** (`big`=all passed+goalReached, `mam`=all locked, `current`=real / default).
- `skillTreePha2.test.ts` — nodeOffsets fan, zoomMath, recommendedNodeId.
- `skillTreeTopic.test.ts`, `skillTreeStages.test.ts`, `skillTreeApi.test.ts` — topic groups, stages, DTO parse + status normalization.

---

## 11. Device-QA verification (iOS Simulator)

Verified on iPhone 16 Pro (dev build, **0 signing** on simulator), driven via deep link `deutschflow://roadmap`. Because the QA account is at 0% (no passed/grown levels), the grown states were verified through the **maturity-preview tabs** (temporarily defaulting `previewStage` then `xcrun simctl io booted screenshot`, then reverting to `current` — computer-use was unavailable for live taps).

| area | result |
|---|---|
| Build + render (bottom-up tree, milestones, ground + roots) | ✅ |
| **Mầm stage** (`mam`) — short trunk + **2-leaf sprout at tip** + roots + no branches + faint skeleton to goal | ✅ (matches design A0·Mầm) |
| **Cây lớn stage** (`big`) — lush full tree + **gold disc with letter + ✓** | ✅ (matches design C1·Cây lớn) |
| **Hiện tại stage** (`current`) — growth by real progress; current level fills in | ✅ |
| Emoji (mascot 🦉 + companion chips) — **iOS** | ✅ (Android untested) |
| Custom serif/UI fonts in SVG text | ✅ |
| Pan / double-tap / zoom buttons / fit | ✅ (Fabric fix) |
| Tap node → correct NodeSheet | ✅ |
| Filter chip select + dim · companion switch | ✅ |
| Share `toDataURL` → valid full-canvas PNG | ✅ |
| Adversarial review (multi-agent workflows) | caught + fixed the Fabric transform bug + the cold-start trunk bug |

---

## 12. Known limitations / follow-ups

- **"Lên cấp" ritual button (deferred):** in the new design but not built — needs a backend level-up action + the H4 branch-maturity "ready" signal. A button with no real action is worse than none; revisit when the backend + interactive device-QA are available.
- **Per-skill branch labels (deferred):** the design labels branches by skill (Đọc/Viết/Nghe/Nói). There is no real per-node skill on the wire (§4.4), so we kept **real topic labels** rather than faking skill data.
- **Crown → dashed goal-dot (cosmetic):** the design's faint top marker is a dashed goal-dot; ours is a faint foliage crown. Minor.
- **Android QA outstanding** — emoji in SVG `<Text>` and in `toDataURL` are the main risks (iOS is clean).
- **Pinch / double-tap on a real finger** — synthetic/simulator input can't fully drive RNGH; the transform pipeline is proven via zoom buttons + pan + tap, but real multitouch wants a hardware pass.
- **Share image is full-canvas** (very tall, e.g. 1140×9726) — consider capping height or a dedicated capture Svg.
- **`RecRing` spin on Fabric:** the recommended-node ring animates `transform: rotate()` on an `<AnimatedG>` (`motifs/NodeMotif.tsx`) — the same animated-`<G>`-transform class Fabric does not update, so the spin may be static. Degrades gracefully (a rotating vs static **dashed circle** is near-identical, and the reduced-motion fallback is already a static ring), so left as-is. `BloomHalo` (opacity) and static `rotation`/`originX` motifs are unaffected.
- **Gated (need backend/product):** per-node skill leaves (§4.4 practice endpoint), `ready` milestone signal, topic→group taxonomy table, DAG fork/merge geometry (`prerequisites`/`dependenciesMet` already plumbed).
- **Data note:** the QA account had 0/55 completed; the `completed` fruit motif was only seen via the `big` preview.
