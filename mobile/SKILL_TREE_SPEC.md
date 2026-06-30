# Spec: Xây lại màn "Cây học tập" (Skill Tree) — React Native theo Claude Design

> **Cho session mới.** Draft bởi workflow multi-agent + **adversarial-verified** (mọi claim đã đối chiếu code/backend; các lỗi critical đã vá vào spec này).
> **File đích:** `mobile/components/SkillTreeView.tsx` (→ tách thành `components/skill-tree/*`) + `mobile/app/(student)/roadmap.tsx` + `mobile/lib/skillTreeApi.ts`.
> **Nguồn thị giác (source of truth):** `mobile/design/v2/native/na-tree.jsx` (419 dòng) + `na-roadmap.jsx`, **3 thiết kế Claude Design** (`tree/Cây học tập.html` = cách cây trưởng thành; `cay-hoc-tap-concept.svg` = vòng đời + companion; `cay-label-concept.svg` = limb=chủ đề, lá=kỹ năng).
> **Endpoint:** `GET /skill-tree/me` → `skillTreeApi.getMySkillTree()`. **Hệ thiết kế:** v2 "Galerie" light-only warm-paper + Newsreader/Instrument Sans + sharp 4px.
> **Trạng thái native hiện tại:** `SkillTreeView.tsx` v2 (commit `da5fdce1`) là reskin botanical của list CEFR phẳng — **đúng bề mặt, sai mô hình + mọc NGƯỢC**. Spec này thay thế.

---

## §0. PRE-FLIGHT — 4 lỗi CHẶN phải vá trước (adversarial review)

Một session làm theo draft gốc sẽ build cây mà node mở-khoá không bao giờ khớp data, node thứ 5+ biến mất, và với chặn vào dependency chưa cài. Vá trước khi làm bất cứ pha nào:

**C1 (CRITICAL · cũng là bug code HIỆN TẠI). Backend gửi `UNLOCKED`, không phải `AVAILABLE`.**
`SkillTreeService.java` serialize `COALESCE(p.status,'LOCKED')`, vòng đời thật = `LOCKED → UNLOCKED → IN_PROGRESS → COMPLETED`. **Không hề có `AVAILABLE`** ở backend. Nhưng `na-tree.jsx`, `skillTreeApi.ts` (`NodeStatus`), `roadmap.tsx:120`, `SkillTreeView.tsx` đều so với `'AVAILABLE'`. → Hệ quả với data thật: **mọi node unlocked-chưa-học render xám + không bấm được** (node recommended, companion, CTA "chạm vào lá đang sáng" đều chết).
→ **Fix (Pha 1 item 0):** chuẩn hoá trong `mapSkillNode`: map `UNLOCKED → 'available'`. **✅ ĐÃ VÁ** (commit `571e5fc3`): thêm `normalizeStatus()` tại boundary `mapSkillNode` (`UNLOCKED→AVAILABLE`, defensive `→LOCKED`) → mọi consumer `'AVAILABLE'` (roadmap/learn/SkillTreeView) chạy đúng; + test `__tests__/skillTreeApi.test.ts`. Session mới KHÔNG cần làm lại item này.

**C2 (CRITICAL). `nodeCap=10`/branch là ảo — `na-tree.jsx` chỉ có 4 slot, node 5+ chồng tại gốc.**
`na-tree.jsx:328`: `off=[[0,-6],[-30,18],[30,16],[0,40]][ni]||[0,0]` — chỉ 4 vị trí; node ≥5 sập về `[0,0]` (chồng lên nhau). Seed `TREE` không bao giờ >4 node/branch nên design không lộ. Data thật: 1 cấp CEFR có hàng chục ngày/node → **vỡ ở node thứ 5**, không phải 40.
→ **Fix:** `nodeOffsets.ts` là **hàm sinh N vị trí không chồng** (fan/phyllotaxis quanh tâm tán). Chốt `nodeCap` khớp hình học HOẶC quy tắc tách shoot/phân trang.

**C3 (CRITICAL). Companion persist gọi `@react-native-async-storage/async-storage` — CHƯA cài.**
`package.json` chỉ có `react-native-gesture-handler`, `react-native-reanimated`, `react-native-svg`. Design dùng web `localStorage` (không tồn tại trong RN).
→ **Fix:** dùng **`expo-secure-store`** (đã có trong app) cho key `lt_companion`, HOẶC cài `@react-native-async-storage/async-storage` + **lưu ý EAS rebuild native** (nhạy cảm với project này). Ưu tiên store JS-only đã có.

**C4 (CRITICAL). Pan/zoom port sai primitive — design dùng web PointerEvents + `setPointerCapture` + `getBoundingClientRect` (không có trong RN).**
→ **Fix:** dùng `react-native-gesture-handler` `Gesture.Pan()/Pinch()/Tap()` qua `GestureDetector`; shared-value `{s,tx,ty}`; **`Animated.G` = `Animated.createAnimatedComponent(G)` + `useAnimatedProps` cho `transform`** (re-render SVG 24-tầng mỗi setState sẽ giật). Bọc màn bằng **`<GestureHandlerRootView>`**. `fitView` đo viewport bằng `onLayout`/`useWindowDimensions` (host đã có `useWindowDimensions` ở `roadmap.tsx:28`), KHÔNG `clientWidth`.

---

## §1. Mục tiêu & tầm nhìn

Biến lộ trình từ **list CEFR phẳng "trang trí cây"** thành **một cái cây lớn lên theo tiến độ học**. Vòng đời học = vòng đời cây:
- Học viên mới → **mầm** vừa nhú khỏi đất.
- Đang B1 → cây thân chắc, 2-3 tầng nhánh rậm, **ngọn đang vươn**.
- Hoàn thành C1+ → **cây cổ thụ** nhiều tầng, tán rộng, đầy quả chín.

---

## §2. Mô hình "cây trưởng thành"

### 2.1. Hướng mọc — DƯỚI→LÊN (đảo so với native hiện tại)

```
        🌳 C1/C2  ← cổ thụ (tầng cao nhất)
       /|\
      🌲 B2        ← mục tiêu (crown gắn nhãn goal "B2")
     /|\
    🌿 B1          ← HIỆN TẠI (ngọn đang vươn, milestone trắng)
   /|\
  🌱 A2            ← passed (milestone vàng)
 /|\
🌰 A1              ← passed (gần rễ)
═══════ groundY ═══════  ← mặt đất + mầm/rễ (icon "eco")
```

- **Mỗi cấp CEFR = 1 tầng nhánh** thêm lên thân; tầng thấp = cấp thấp = gần đất. **Ngọn = cấp hiện tại**. Crown gắn nhãn `goal`. Mầm/rễ ở đáy = điểm bắt đầu.
- **3 giai đoạn trưởng thành** (từ `tree/Cây học tập.html`): **A0·Mầm** (thân trần + chồi 2 lá, "Hoàn thành bài đầu → cây nảy mầm") → **B1·Hiện tại** (cây vừa) → **C1+·Cây lớn** (cao, tán dày). Mỗi cấp qua đẩy ngọn lên cao.

### 2.2. Milestone đĩa trên thân (`MS_PAL`)

| State | Đĩa | Glyph | Tính được ở Pha 1? |
|---|---|---|---|
| `passed` | **Vàng** `#FFCD00` + glow | trophy | ✅ (mọi node của cấp = COMPLETED) |
| `in_progress` | **Trắng** `#FBFAF7` viền đen 3.5px | level text | ✅ (cấp hiện tại) |
| `locked` | Xám `#EFEAE0` **viền đứt** `5 5` | lock | ✅ |
| `ready` | Vàng nhạt `#FFE27A` + glow | level text | ❌ **HOÃN** — "đủ 4 nhánh matured" cần cấu trúc skill/branch (Pha 3) |

> **H4 fix:** Pha 1 chỉ ship **3 state tính-được** (`passed/in_progress/locked`). `ready` để Pha sau khi branch-maturity tính được. Sửa cả task lẫn checkbox nghiệm thu cho khớp.

### 2.3. Hình học layout (Pha 1 — bottom-up)

- `groundY≈1600`, tier `y` = **tổng dồn chiều cao đo được của từng tầng** (KHÔNG `i*tierGap` cố định — H1: số nhánh/tầng thay đổi, foliage tràn sang tầng trên nếu fix 300px). Mỗi tầng cao = f(số nhánh, số node).
- Trunk ribbon **gốc rộng `baseW≈46` → ngọn thuôn `topW≈11`** + sway sin, fill `url(#naTrunk)`, stroke `BARK.dark` 1.5px.
- **Canvas height = f(số tầng)**, KHÔNG hằng 1690 (H1: cây 7 cấp crown lọt trên `y=0` bị clip). `h = max(groundY+90, contentTop)` + safety cho crown.

---

## §3. Hệ thị giác

### 3.1. Hằng số/palette (copy nguyên từ `na-tree.jsx`)

```ts
const SKILLS = [
  { k:'hoeren',    label:'Nghe', color:'#4F86E0', ic:'hearing' },
  { k:'lesen',     label:'Đọc',  color:'#5E9150', ic:'menu_book' },
  { k:'sprechen',  label:'Nói',  color:'#E8853A', ic:'record_voice_over' },
  { k:'schreiben', label:'Viết', color:'#8257D8', ic:'edit' },
]
const GROUP_COLORS = {
  daily:  { name:'Đời sống',  leaf:'#6FA85B', dark:'#4E7E3C', soft:'#B2D6A1', ic:'cottage' },
  work:   { name:'Công việc', leaf:'#5B86C9', dark:'#39599C', soft:'#AEC6E8', ic:'work' },
  travel: { name:'Du lịch',   leaf:'#C9963E', dark:'#9C6F23', soft:'#E8C788', ic:'flight' },
  medical:{ name:'Y tế',      leaf:'#3FA59B', dark:'#287A71', soft:'#98CFC8', ic:'health_and_safety' },
  culture:{ name:'Văn hóa',   leaf:'#9B7BC4', dark:'#74559E', soft:'#CBB7E4', ic:'theater_comedy' },
  exam:   { name:'Luyện thi', leaf:'#D4A53A', dark:'#A77E1C', soft:'#EED391', ic:'quiz' },
}
const BARK  = { dark:'#352B21', mid:'#564636', light:'#6E5A45' }
const MS_PAL = {
  passed:      { fill:'#FFCD00', stroke:'#B8911C', glow:'#FFCD00', dashed:false },
  ready:       { fill:'#FFE27A', stroke:'#C79A1E', glow:'#FFE27A', dashed:false },
  in_progress: { fill:'#FBFAF7', stroke:'#161513', glow:null,      dashed:false },
  locked:      { fill:'#EFEAE0', stroke:'#C9C2B6', glow:null,      dashed:true  },
}
// Gradients: naRipe (quả chín) #F6B85A→#EE8C2E→#D86E1C; naBud (nụ) #B6D49E→#7FA86A; naTrunk dọc BARK.dark→BARK.light
```

> **M2 (icon font):** `na-tree.jsx` dùng `fontFamily="Material Symbols Outlined"` render TÊN glyph làm text — **RN không có font này** → sẽ in literal "workspace_premium". **Bắt buộc** thay MỌI `SIcon` (trophy/lock/check/eco + icon skill/group) bằng `@expo/vector-icons` (Material Symbols/MaterialIcons) hoặc inline SVG `<Path>`. Quyết định cross-cutting, đừng copy `SIcon` nguyên.

### 3.2. Cấu trúc 4 lớp

1. **Thân** (ribbon thuôn bottom-up + sway).
2. **Limb = CHỦ ĐỀ** — chip nhãn chủ đề (hiện 1 lần khi `!locked`) + tán lá tô theo `topicGroup`.
3. **Lá/node = BÀI HỌC theo KỸ NĂNG** — badge kỹ năng (icon+màu) ở góc dưới-trái node.
4. **Motif theo STATE** (vòng đời):

| State | Motif | Geometry (port react-native-svg) |
|---|---|---|
| `locked` | Nụ khép mờ | `circle r11 fill #AEBCA4 stroke #94A589`, opacity 0.4 |
| `available` | **Nụ + glow = ĐIỂM BẤM** | `circle r12.5 fill url(#naBud) stroke #6F9460` + lá mầm + halo glow → **tappable** |
| `in_progress` | Hoa nở | 5 cánh `ellipse rx6.5 ry9 fill #F7DCE6 stroke #E8A9C0` góc [0,72,144,216,288] + nhụy `circle r7 #FFCD00` |
| `completed` | Quả cam + ✓ | `circle r15 fill url(#naRipe) stroke #C2611A` + lá + highlight + badge `circle r8 #1E9E61` + check |

Skill badge (mọi state): `g translate(-12,13)` → `circle r8.5 fill SKILL.color stroke #fff` + icon.

> **Ghi chú ẩn dụ (Q3):** brief product nói "đang học=quả xanh, master=quả cam"; `na-tree.jsx` render "in_progress=hoa nở, completed=quả cam". **Theo `na-tree.jsx`** (source thị giác) trừ khi product chốt khác.

### 3.3. Companion (con trỏ "nên học kế tiếp")

5 lựa chọn `owl🦉/bird🐦/butterfly🦋/squirrel🐿️/none`, persist (**C3: dùng expo-secure-store**, key `lt_companion`, mặc định `owl`). Đậu trên **node recommended** = con trỏ; **leo dần** khi tiến bộ (bóng mờ ở vị trí cũ = cảm giác hành trình). Vòng vàng đứt nét xoay quanh node rec.

> **H2 fix:** `recId` chỉ dùng **pass-2** ("node available đầu tiên") — `chosenByUser` là field **design-only**, KHÔNG có trên wire; bỏ khỏi contract.

---

## §4. Mô hình dữ liệu & KHOẢNG CÁCH API

### 4.1. Vấn đề gốc
Backend `/skill-tree/me` **đã trả gần đủ field trên wire** (`core_topics`, `sort_order`, `session_type`, `tags`, `prerequisites_json`, `unlock_metadata`, `dependencies_met`, `emoji`, `phase`...); nhưng `skillTreeApi.ts` **thu hẹp `RawSkillNode` xuống 6 field** rồi drop phần còn lại tại ranh giới TS (JSON đến nhưng không đọc). Các field json-text (`core_topics`...) đến dưới dạng **chuỗi JSON** (SQL `to_jsonb(...)::text`) → phải `JSON.parse` như `mapSkillNode` đã làm cho `tags`.

### 4.2. Bảng field thật ↔ mobile

| Tính năng | Field backend | Trên wire? | Trong mobile DTO? | Hành động |
|---|---|---|---|---|
| Spine + milestone | `cefr_level, day_number, sort_order, user_status` | ✅ (pre-sorted) | ⚠️ thiếu `sort_order` | **Client**: thêm `sort_order` |
| Limb = chủ đề | `core_topics, phase, industry, module_title_vi` | ✅ | ❌ | **Client**: nới DTO + `JSON.parse` |
| Node motif | `user_status` (**`UNLOCKED`** không phải AVAILABLE — C1) | ✅ | ✅ (`status`) | **Chuẩn hoá UNLOCKED→available** |
| **Lá = KỸ NĂNG** | per-node skill | ❌ — `session_type` ≈ luôn `LESSON`; 4 kỹ năng ở `practice_node_sessions.skill_type`, sinh **sau khi completed**, không endpoint | ❌ | **CẦN API** (hoặc cosmetic 4-lá) |
| DAG unlock | `prerequisites_json` (chứa **`node_code`** vd `["A1-001"]`), `unlock_metadata.next`, `dependencies_met` | ⚠️ edge list `node→depends_on` KHÔNG trả; nhưng prereq + meta + gate CÓ | ❌ | **Client** nếu chấp nhận prereq làm edge |
| Edge chính danh | `skill_tree_node_dependencies` (`dependency_type, min_score`) | ❌ | ❌ | **CẦN API** (chỉ khi cần) |

> **H3 fix:** `prerequisites_json` chứa **`node_code`** (nullable, V181), còn row keyed bằng **`id`** → Pha 3 phải dựng **index `node_code→id`** + xử lý `node_code` null. HOẶC hạ scope: chỉ dùng `dependencies_met` (boolean, 1 field) để gate unlock, **hoãn fork/merge geometry**.

### 4.3. Shape DTO đề xuất (Pha 3 — phần lớn client-only)
Nới `RawSkillNode`/`SkillNode`/`mapSkillNode` thêm: `sortOrder, coreTopics[], grammarPoints[], phase, moduleTitle, prerequisites[] (node_code), unlockNext[], dependenciesMet, emoji`. (Chi tiết trong draft — workflow output.)

### 4.4. Skill-leaves chính danh (CHỈ nếu không cosmetic) — cần 1 trong:
- (a) `GET /skill-tree/node/{id}/practice` → list `practice_node_sessions` (`skill_type`, status); hoặc
- (b) thêm `skills[]` vào row `/skill-tree/me`.

### 4.5. Topic→6 group (M4)
`core_topics` là enum (`ALPHABET, UMLAUTE`) + `industry` null với **phần lớn core node** → group-color chỉ có nghĩa cho `SATELLITE_LEAF`/industry node. **Map chính (primary) = `phase`→group** (`PHONETIK/GRUNDLAGEN→daily`...), `industry`→group cho satellite; định nghĩa **default group** rõ. Bảng map cần product chốt (§8 Q2).

---

## §5. Kiến trúc component

```
components/skill-tree/
  SkillTreeView.tsx        // root: state view{s,tx,ty}, sel, comp, filters; orchestrate
  TreeCanvas.tsx           // <Svg><Defs/> + outer Animated.G translate(tx,ty) scale(s)
  TreeBody.tsx             // trunk + ground + crown + loop tiers(branches/milestones)
  geometry/{ layout.ts (tier y = running-sum, bottom-up), trunkGeom.ts (tapered+sway),
            branchGeom.ts (4 anchor + Bézier), nodeOffsets.ts (N-node fan — C2) }
  motifs/{ NodeMotif, SkillBadge, Milestone (4 state), Crown, Ground, BranchFoliage, TopicChip }
  controls/{ useTreeGestures.ts (GestureDetector Pan+Pinch+Tap → shared values — C4),
            ZoomButtons, FitButton ("Toàn cảnh", fitView via useWindowDimensions) }
  chrome/{ TreeHeader (title+RmTabs+level-chips+user·goal), FilterBar (topic+skill+companion),
          Legend (6 group + 4 skill), LevelUpBanner }
  sheets/{ NodeSheet (bottom-sheet), NodeLessonPanel (→ getNodeSession/submitNode THẬT — H5) }
  states/{ SeedState (mầm "Gieo mầm"), LoadingState, ErrorState }
lib/{ skillTreeApi.ts (nới DTO + chuẩn hoá UNLOCKED), skillTreeModel.ts (flat → TREE adapter) }
app/(student)/roadmap.tsx  // tab host: tree | phase
```

- `skillTreeModel.ts` = **adapter** flat `SkillNode[]` → `TREE{path[].branches[].shoots[].nodes[]}` (gom cefr→tier; cosmetic 4-branch nếu chưa có skill thật; suy `topicGroup`).
- **1 SVG, transform ở outer `Animated.G`** (pan/zoom). HUD/header/chip/sheet là **RN overlay NGOÀI svg**.
- Bọc root `<GestureHandlerRootView>`.

---

## §6. Kế hoạch theo PHA

### Pha 1 — Sửa hướng bottom-up + status-fix + milestone 3-state (data 6 field hiện có) — ✅ XONG
> **✅ HOÀN THÀNH.** Tách module `components/skill-tree/{layout.ts,palette.ts,glyphs.tsx}` + rewrite `SkillTreeView.tsx`. tsc xanh; +6 test invariant `__tests__/skillTreeLayout.test.ts` (31/31 jest pass). Chưa device-verify (cần Metro/EAS — Pha 2 gắn gestures sẽ QA chung).
0. **C1: chuẩn hoá `UNLOCKED→available`** trong `mapSkillNode` + sửa `NodeStatus` + mọi `'AVAILABLE'` (`roadmap.tsx`, `SkillTreeView.tsx`). ← cũng vá bug hiện tại. **✅** (commit `571e5fc3`).
1. ✅ `buildTreeLayout()` bottom-up: A1 ở đáy, cấp cao lên trên; tier y = **running-sum** `f(branchCount)` (H1) — test parity.
2. ✅ Trunk ribbon gốc-rộng(46)→ngọn-thuôn(14) + sway fade-out + gradient `naTrunk` (`LinearGradient`).
3. ✅ `Ground` (mound + sprout glyph inline-SVG thay `eco`) + `Crown` (5-blob canopy + goal label = cấp CEFR cao nhất).
4. ✅ `Milestone` **3 state tính được** (`passed`=trophy/gold · `in_progress`=trắng/level-text · `locked`=dashed/lock) đúng `MS_PAL` — `ready` HOÃN (H4). Glyph = inline `<Path>` (M2, KHÔNG Material Symbols font).
5. ✅ Canvas height = `TOP_PAD + Σ tierHeight + BOTTOM_PAD` (H1).
   **Data:** không cần field mới.

### Pha 2 — Lifecycle motifs đúng + companion + gestures — ✅ XONG
> **✅ HOÀN THÀNH.** Design + research multi-agent → impl single-writer → adversarial review (8 agent: 4 reviewer + verify từng finding) chỉ 1 issue thật (TabBar nổi che control đáy → fix root-cause). tsc 0; +13 test invariant (`__tests__/skillTreePha2.test.ts`: nodeOffsets/zoomMath/recId); jest 42/42. Chưa device-verify (cần Metro/EAS).
1. ✅ `NodeMotif` 4 motif (quả+✓ / hoa 5 cánh / nụ / nub xám) — port react-native-svg dùng `rotation`/`originX/Y` (KHÔNG web `rotate(a x y)`); + `nodeOffsets(N)` fan không chồng cho N≥5 (C2, test); skill badge = dot cosmetic `dayNumber%4` (M2, no Material font).
2. ✅ **C4:** `useTreeGestures` = `GestureDetector` Pan(minDistance 5)/Pinch(clamp `[0.32,1.5]` + focal)/Tap(double 0.46↔1.1, single→hit-test) qua `Gesture.Simultaneous(Race(pan,pinch), Exclusive(double,single))`; transform = `useAnimatedProps` STRING `translate(tx ty) scale(s)` trên `Animated.G` (mirror `SplashAnimated.tsx`/`ProgressRing.tsx`); ZoomButtons+FitButton ("Toàn cảnh"); `useReducedMotion()` tắt spin/bloom (functional pan/zoom giữ). **Lưu ý:** `<G onPress>` KHÔNG đáng tin dưới GestureDetector → tap route qua single-Tap + inverse-transform hit-test (`zoomMath.toCanvas`).
3. ✅ Companion 5 lựa chọn persist `expo-secure-store` key `lt_companion` default owl (C3, `lib/treeCompanion.ts`) + `recommendedNodeId` = node AVAILABLE đầu theo CEFR/day (H2, test) + vòng vàng dashed xoay + emoji đậu rec-node.
4. ✅ `NodeSheet` tap-tại-chỗ (RN overlay ngoài Svg, SlideInDown) — **H5:** CTA `router.push('/(student)/node')` THẬT (server-graded), KHÔNG stub quiz. State ở host (`roadmap.tsx`); fruit tap → `onSelectNode`. Locked node mở sheet (giải thích) với CTA disabled.
   **Bonus:** TabBar nổi tự ẩn trên màn detail `href:null` (`components/ui/TabBar.tsx`) — fix root-cause control đáy bị che (toàn app). Host: ScrollView→canvas đo `onLayout` (guard chống loop `Maximum update depth`), refresh dời lên `AppHeader.right`, PathHero compact overlay; tab "Giai đoạn" SectionList = a11y fallback (canvas gesture mất per-node a11y).
   **Data:** 6 field; skill/topic cosmetic tạm.

### Pha 3 — Mở DTO → limb-topic + leaf-skill + DAG thật
1. Nới DTO (§4.3, phần lớn client-only) + `JSON.parse` json-text (null-safe).
2. `topicGroup`/`topicLabel` thật (phase/industry→group, M4) → foliage + chip đúng màu.
3. DAG: index `node_code→id` (H3) + `dependencies_met` gate; hoặc chỉ gate boolean, hoãn fork/merge.
4. **CẦN BACKEND** cho skill thật: endpoint/field practice (§4.4); chưa có → giữ cosmetic 4-lá.

### Pha 4 — Filter, growth-stage preview, "Khoe cây", phase-tab
1. `FilterBar` (topic+skill dim) + `Legend` + `LevelUpBanner`/`doRitual` (khi `ready`).
2. Growth-stage preview (cây ở cấp tương lai, skeleton mờ).
3. "Khoe cây" share (SVG→PNG snapshot + caption).
4. Phase-tab = stage-stepper `na-roadmap.jsx` (Nền tảng→Sản sinh→Lưu loát→Tốt nghiệp) thay flat SectionList.

---

## §7. Tiêu chí nghiệm thu (invariant, testable — M1)

**Pha 1:** A1 ở đáy/B2 ở ngọn; thân gốc-rộng→thuôn; có ground+mầm+crown(goal); milestone **3 state** đúng `MS_PAL`; **một node `UNLOCKED` render motif nụ + fire `onTap`** (test C1); render từ `/skill-tree/me` không lỗi; **structural parity** với `na-tree.jsx` (thứ tự tầng/motif-per-state/palette hex) — KHÔNG screenshot-diff (web vs RN khác render).
**Pha 2:** 4 motif đúng; sau `fitView`: bbox nội dung ⊆ viewport; pinch `s∈[0.32,1.5]`; pan bỏ qua `<5px`; double-tap toggle `0.46↔1.1`; companion persist qua restart, đậu đúng rec node; tap → bottom-sheet (không nhảy route); reduced-motion tắt spin/bloom.
**Pha 3:** DTO nới + `JSON.parse` null-safe không crash; `topicGroup` đúng (Y tế=teal...); chip chủ đề `topicLabel` thật; node prereq chưa đạt → locked đúng; (nếu có API) badge skill từ `skill_type`.
**Pha 4:** filter dim đúng + "Tất cả" clear; legend đúng 6+4; `ready`→banner+flash; "Khoe cây" export đúng; phase-tab = stepper.

---

## §8. Câu hỏi mở / quyết định product

1. **Skill mapping:** kỹ năng per-node KHÔNG có (`session_type`≈LESSON; skill ở `practice_node_sessions` sau completed). (a) mở endpoint/field practice thật, hay (b) 4-lá cosmetic cố định (thị giác khớp nhưng skill không phản ánh tiến độ)?
2. **`core_topics`/`industry`→6 group:** bảng map chính thức? industry (IT/Medizin/Pflege/...) → group nào? default group cho core node (industry null)?
3. **Ẩn dụ motif:** theo `na-tree.jsx` (hoa/quả) hay brief (quả xanh→cam)?
4. **Companion mặc định bật?** B2B có toggle tắt (tránh trẻ-con-hoá)?
5. **"Khoe cây" scope:** PNG cá nhân? leaderboard? B2B ẩn share (privacy)?
6. **NodeSheet vs route:** bỏ hẳn `node.tsx`/`node-practice.tsx` hay deep-link fallback? (Lưu ý H5: `node.tsx`+`node-practice.tsx` là learning-loop server-graded THẬT — đừng bỏ.)
7. **DAG nguồn:** `prerequisites_json` denormalized (trên wire) hay edge chính danh `skill_tree_node_dependencies` (cần serialize mới)?
8. **`nodeCap`/branch:** cấp >40 node thì tách shoot/phân trang thế nào (C2)?

---

## Phụ lục A — Adversarial critique (nguyên văn, để truy vết)

> Đã tích hợp vào spec trên; giữ đây để session mới đối chiếu. Files verified: `na-tree.jsx`, `na-roadmap.jsx`, `SkillTreeView.tsx`, `skillTreeApi.ts`, `roadmap.tsx`, `package.json`, `SkillTreeService.java`.

- **C1** status `UNLOCKED` vs `AVAILABLE` (tappable bud không khớp data) — Pha 1 item 0.
- **C2** `nodeCap=10` ảo, renderer chỉ 4 slot, vỡ ở node 5.
- **C3** `async-storage` chưa cài (design dùng web localStorage).
- **C4** gesture port sai (web PointerEvents) → GestureDetector+Reanimated+Animated.G.
- **H1** tier height phải = running-sum (không `i*tierGap`); canvas h = f(tầng).
- **H2** `recId` pass-2 only; `chosenByUser` design-only.
- **H3** DAG: `prerequisites_json` chứa `node_code` (nullable) ≠ `id` → cần join code→id; hoặc chỉ gate `dependencies_met`.
- **H4** Pha 1 ship 3 milestone state; `ready` hoãn.
- **H5** `NodeLessonPanel` wire `getNodeSession`/`submitNode` thật, đừng regress về stub quiz.
- **M1** nghiệm thu = invariant (zoom clamp/fitView bbox/pan threshold), không "mượt/đúng".
- **M2** Material Symbols font không có trong RN → `@expo/vector-icons`/inline SVG.
- **M3** `mix()` hardcode hex offset [1,3,5] (chỉ 6-digit).
- **M4** topic-group: phase→group primary cho core node; default group rõ.

**Đúng & giữ:** tách data-model (§4) chính xác; skill-leaves là yêu-cầu-API duy nhất; mô hình bottom-up + công thức layout copy đúng nguồn; phủ đủ design (companion/motif/growth-stage/limb/leaf/milestone/controls/legend/filter/ritual/phase-stepper).
