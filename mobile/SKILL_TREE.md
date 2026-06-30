# Skill Tree ("Cây học tập") — Technical Reference

> **Audience:** engineers working on the Expo `mobile/` app.
> **Scope:** the interactive learning-roadmap tree on `app/(student)/roadmap.tsx`.
> **Companion docs:** [`SKILL_TREE_SPEC.md`](./SKILL_TREE_SPEC.md) = product intent / source of truth · [`SKILL_TREE_PROGRESS.md`](./SKILL_TREE_PROGRESS.md) = phased work log + device-QA notes. **This file = the as-built architecture reference.**

---

## 1. What it is

A bottom-up **living tree** that visualises the learner's CEFR journey (A1 → B2). It is **not** a decorative reskin of a flat list — the tree **grows from a sprout with real progress**:

- **A1 (lowest level) sits on the ground**; each higher level stacks upward; the **crown** caps the top carrying the goal label (highest CEFR present).
- **Only levels the learner has reached are "grown"** (full branches/foliage). Levels not yet reached are a **faint dashed skeleton** rising toward a faint goal crown.
- Within the **current** (in-progress) level, foliage **fills in (thickens) as lessons complete**, so the tree changes week-to-week even before the next level-up.
- Each lesson is a **fruit motif** whose shape encodes status (ripe fruit = completed, flower = in-progress, bud = available, grey nub = locked).
- The canvas is **interactive**: pan / pinch / double-tap-zoom / fit, tap a node to open its sheet, filter by topic/skill, pick a companion mascot, and share an image ("Khoe cây").

---

## 2. File / module map

```
app/(student)/roadmap.tsx        Host screen: 2 tabs (tree | phase), query, filter/companion/viewport state,
                                 NodeSheet host, PathHeroCompact (progress strip)
components/
  SkillTreeView.tsx              Orchestrator: layout → geometry → <Svg> render → gestures → overlays
  skill-tree/
    layout.ts                    PURE geometry + growth logic (no React/SVG) — unit-tested
    palette.ts                   BARK, MS_PAL, GROUP_COLORS (6 groups), SKILL_DOTS, CROWN/GROUND
    glyphs.tsx                   Inline-SVG glyphs (trophy / lock / sprout / check) — NOT icon fonts
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
__tests__/skillTree*.test.ts     5 test files (invariants, not screenshot-diffs)
```

---

## 3. Data model

The backend `GET /skill-tree/me` returns raw `queryForList` rows (every column on the wire). `mapSkillNode` (`lib/skillTreeApi.ts`) maps to **`SkillNode`**:

| field | notes |
|---|---|
| `id`, `title`, `cefrLevel`, `dayNumber`, `sortOrder` | core |
| `status` | normalized `COMPLETED \| IN_PROGRESS \| AVAILABLE \| LOCKED`. **C1 fix:** backend `UNLOCKED` → `AVAILABLE`; null/unknown → `LOCKED` |
| `phase`, `industry`, `moduleTitle`, `sessionType`, `emoji` | topic-group + display |
| `coreTopics[]`, `grammarPoints[]`, `prerequisites[]` | parsed from `to_jsonb(...)::text` via `asStringArray()` (null-safe, never throws) |
| `dependenciesMet` | plumbed for future DAG gating (not yet rendered) |

Gating remains **server-driven** via `status`; the client never invents unlocks.

---

## 4. Layout & growth logic — `layout.ts` (pure, unit-tested)

`buildTreeLayout(nodes, width): TreeLayout` is the heart of the feature. No React, no SVG — only numbers, so every invariant is unit-tested without a device.

### 4.1 Tiers (one per CEFR level)

Nodes are grouped by `cefrLevel`, sorted `A0→C2`, chunked into **branch rows** of `BRANCH_SIZE = 3`. Each tier carries:

| field | meaning |
|---|---|
| `level`, `state` | CEFR letter + `MilestoneState` (`passed` / `in_progress` / `locked`) |
| `milestoneY`, `branchRows[]` | geometry (branch cluster centres) |
| **`grown`** | `state !== 'locked'` — a **reached** level (full branches) vs a **future skeleton** (`branchRows: []`) |
| **`fillRatio`** | `completed / total` for the level (0..1) |
| **`foliageScale`** | foliage opacity coefficient (see 4.3) |

`milestoneState`: all-completed → `passed`; any `IN_PROGRESS`/`AVAILABLE`/`COMPLETED` → `in_progress`; otherwise `locked`.

### 4.2 The growth model (spec §2 "mọc từ mầm")

- **Grown tiers** (reached) get their full measured height `MS_BAND + branchCount * ROW` (running-sum, never `i*gap` — H1).
- **Skeleton tiers** (locked future) collapse to a compact `SKELETON_BAND` so the faint future + crown sit just above the living tree.
- Bottom-up placement: lowest level on the ground, later levels stack up.

`TreeLayout` returns:

| field | meaning |
|---|---|
| `groundY` | ground line (sprout sits here) |
| **`grownTopY`** | top edge of the **solid/living** trunk (top of the highest grown tier) |
| `topY` | top of **everything** incl. skeleton — the crown anchor |
| `goalLabel` | highest CEFR present (the goal, on the crown) |
| **`goalReached`** | highest level is `passed` → crown renders solid, else faint |
| **`hasGrown`** | any tier grown. **Cold-start guard:** when every level is locked (new user / null `user_status` → all `LOCKED`), `hasGrown=false` and `grownTopY===groundY`; the renderer then **suppresses the solid trunk** so only the sprout + faint skeleton show — preventing a degenerate inverted `trunkPath(groundY, groundY)` ribbon. |

### 4.3 `foliageScale` (current-level "fill in")

```
passed        → 1                                          (lush)
in_progress   → CURRENT_FOLIAGE_FLOOR + (1-floor)*fillRatio   (floor 0.25 → 1.0 by completion)
locked/future → 0                                          (no foliage drawn)
```

`CURRENT_FOLIAGE_FLOOR = 0.25` is the tunable 0%-sprout faintness. The renderer applies this as the branch-cluster opacity, so a level visibly thickens as its lessons complete.

### 4.4 Other pure helpers

- `recommendedNodeId(nodes)` — first `AVAILABLE` node in CEFR-then-day order (the mascot perch / "next" hint). `null` when nothing is unlocked-not-started.
- `trunkPath(cx, groundY, topY)` — tapered bark ribbon, wide base → thin top, sway fading toward the top. Called with `grownTopY` so the living trunk is only as tall as the reached levels.

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
          ground mound · faint dashed future trunk (grownTopY→topY) · living trunk (gated on hasGrown)
          · crown (faint unless goalReached) · branch foliage (opacity = foliageScale × filter-dim)
          · lesson motifs (RecRing/BloomHalo/NodeMotif/SkillBadge/CompanionEmoji)
          · milestones (Milestone for grown, SkeletonMilestone for future) · sprout
```

Overlays **outside** the `<Svg>` (RN, not SVG): share/zoom/fit cluster, companion picker. `PathHeroCompact` is hosted by `roadmap.tsx` as a `pointerEvents="box-none"` overlay.

**⚠️ Critical Fabric rule:** the pan/zoom transform **must** live on the wrapping `<Animated.View>` (`useAnimatedStyle`), **never** on an svg `<G>` via `useAnimatedProps`. On the **New Architecture (Fabric)**, `react-native-svg` does not update an animated `<G>` transform — pan/pinch/zoom silently do nothing and tap coords desync. See §6.

---

## 6. Gestures & zoom — `useTreeGestures.ts` + `zoomMath.ts`

- **Composition:** `Gesture.Simultaneous(Gesture.Race(pan, pinch), Gesture.Exclusive(doubleTap, singleTap))`.
  - Pan ignores < `PAN_SLOP` (5px); pinch clamps scale `[0.32, 1.5]` with focal compensation; double-tap toggles `0.46 ↔ 1.1`; single-tap is inverse-transformed to canvas coords and hit-tested.
- **Transform model (pure, `zoomMath.ts`):** a canvas point `(x,y)` maps to viewport px `(tx + s*x, ty + s*y)` — i.e. `translate(tx,ty) scale(s)` about origin `(0,0)`. `transformOrigin: '0 0'` on the `<Animated.View>` keeps this exact.
  - `clampScale`, `focalZoom`, `toggleScale`, `fitTransform`, `toCanvas` are all unit-tested.
- **Tap, NOT `<G onPress>`:** under a `GestureDetector`, per-node press is swallowed; single-tap → `runOnJS(onTapCanvas)` → nearest node within `TAP_R=26` canvas px (filter-aware: dimmed nodes are skipped so the filter gates interaction).
- **`fitView(onDone)`** animates to the fit transform and fires `onDone` on the JS thread when the spring settles — used by share to capture only after the tree has framed (no `setTimeout` race).

> Why the Animated.View, not Animated.G: a session device-QA found pan/pinch/zoom/tap **all dead** on Fabric because `react-native-svg`'s animated `<G transform>` never repainted. Moving the transform to the RN `<Animated.View>` (and sizing the Svg to the full canvas inside a clip) fixed it; verified live (zoom + pan + tap→sheet).

---

## 7. Controls

| control | file | behaviour |
|---|---|---|
| **Filter** | `controls/FilterBar.tsx` | 6 topic-group chips + 4 skill chips (doubles as legend). Selecting **dims** non-matching branches (topic) / nodes (skill = `dayNumber % 4`) to opacity 0.16 and excludes them from hit-test. Must sit **in document flow** (a ScrollView over the GestureDetector swallows pan). |
| **Companion** | `CompanionChips.tsx` + `lib/treeCompanion.ts` | 5 mascots; choice persists via `expo-secure-store` (key `lt_companion`, default `owl`). The chosen mascot perches on the recommended node (`recommendedNodeId`). |
| **NodeSheet** | `sheets/NodeSheet.tsx` | Tap-in-place bottom sheet (RN overlay outside `<Svg>`). Shows topic-group eyebrow, title, status; CTA opens the **real lesson route** `/(student)/node` (server-graded), not a quiz stub. |
| **Share** | `lib/shareTree.ts` + ShareButton | `fitView(onDone)` → `Svg.toDataURL()` (PNG base64) → `expo-file-system/legacy` cache → RN `Share`. **No new native dep / no rebuild.** With the full-canvas Svg, `toDataURL` captures the entire tree. iOS attaches the image; Android carries the caption only (RN Share limit). |
| **Phase tab** | `PhaseStepper.tsx` + `stages.ts` | 4 maturity stages from real progress + "next action" deep links. The per-node `SectionList` under it is kept as the **a11y fallback** for the gesture canvas. |

---

## 8. Progress strip — `roadmap.tsx` `PathHeroCompact`

A **slim editorial strip** pinned as an overlay on the tree tab (warm-paper v2 "Galerie"):

```
[▢ yellow]  [0% — serif Newsreader]  [──── thin track (h6, fill accent) ────]  [0/55 CHẶNG]
```

- `surface` background, hairline `borderStrong`, sharp `radius.sm` (4px), subtle shadow.
- Single compact row (~⅓ shorter than the previous heavy ink-black card) — sits lighter over the canopy and no longer buries the crown.

---

## 9. Theming (v2 "Galerie")

Warm-paper, **light-only**. Tokens from `lib/theme`: `bg #FBFAF7` · `surface #FFF` · `surfaceSunken #F6F3EC` · borders `#E7E3DA`/`#D8D2C6` · ink `#161513` · muted `#76716A` · faint `#C9C4BC` · accent yellow (+ AA gold `#C79A00`) · `success #1E9E61` · `inkSurface #161513`. Numbers use the **Newsreader serif**; UI uses **Instrument Sans**; corners are **sharp ~4px**; the **yellow square** is the brand motif.

---

## 10. Testing

`tsc --noEmit` clean · **`jest` 69/69**. Tests are **invariants** (web↔RN render differs, so no screenshot-diffs):

- `skillTreeLayout.test.ts` — bottom-up order, running-sum heights, milestone state, goal label, **growth model** (grown vs skeleton, `fillRatio`, `foliageScale` floor→1 exact, `grownTopY`/`topY`/`goalReached`, **cold-start all-locked** `hasGrown=false`, compact skeleton).
- `skillTreePha2.test.ts` — nodeOffsets fan, zoomMath, recommendedNodeId.
- `skillTreeTopic.test.ts`, `skillTreeStages.test.ts`, `skillTreeApi.test.ts` — topic groups, stages, DTO parse + status normalization.

---

## 11. Device-QA verification (iOS Simulator, 2026-06-30)

Verified on iPhone 16 Pro (dev build, **0 signing** on simulator), driven via deep link `deutschflow://roadmap`:

| area | result |
|---|---|
| Build + render (bottom-up tree, crown, milestones, sprout) | ✅ |
| Emoji (mascot 🦉 + companion chips) — **iOS** | ✅ (Android still untested) |
| Custom serif/UI fonts in SVG text | ✅ |
| Growth model (current level faint→fills, future skeleton, faint crown) | ✅ |
| Pan / double-tap / zoom buttons / fit | ✅ (Fabric fix) |
| Tap node → correct NodeSheet | ✅ |
| Filter chip select + dim | ✅ |
| Companion switch | ✅ |
| Share `toDataURL` → valid full-canvas PNG | ✅ |
| Adversarial review (multi-agent workflows) | caught + fixed the Fabric transform bug + cold-start trunk bug |

---

## 12. Known limitations / follow-ups

- **Android QA** outstanding — emoji in SVG `<Text>` and in `toDataURL` are the main risks (iOS is clean).
- **Pinch / double-tap on a real finger** — synthetic input can't drive RNGH; the transform pipeline is proven via zoom buttons + pan + tap, but real multitouch wants a hardware pass.
- **Share image is full-canvas** (very tall, e.g. 1140×9726) — consider capping height or a dedicated capture Svg.
- **Gated (need backend/product):** per-node skill leaves (§4.4 practice endpoint), `ready` milestone + LevelUpBanner (branch-maturity signal), topic→group taxonomy table (§8 Q2), DAG fork/merge geometry (`prerequisites`/`dependenciesMet` already plumbed).
- **Data note:** the QA account had 0/55 completed, so the `completed` fruit motif + `passed` (trophy) milestone were not exercised on-device.
- **`RecRing` spin on Fabric:** the recommended-node ring animates `transform: rotate()` on an `<AnimatedG>` (`motifs/NodeMotif.tsx`) — the same animated-`<G>`-transform class that Fabric does not update, so the spin may be static. It degrades gracefully (a rotating vs static **dashed circle** is visually near-identical, and the reduced-motion fallback is already a static dashed ring), so it is left as-is. `BloomHalo` (opacity) and the static `rotation`/`originX` motifs are unaffected. Revisit only if the spin is wanted.
