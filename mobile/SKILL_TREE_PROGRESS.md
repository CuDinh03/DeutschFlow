# Báo cáo công việc & Kế hoạch — Xây lại "Cây học tập" (Skill Tree)

> **Phạm vi:** Toàn bộ việc làm lại màn Skill Tree trên app Expo `mobile/` theo `SKILL_TREE_SPEC.md`.
> **Nhánh:** `chore/ios-deploy-sdk54` (các commit skill-tree xếp chồng trên nhánh này, độc lập với việc deploy iOS).
> **Trạng thái:** ✅ Toàn bộ phần *làm được* của spec đã xong (Pha 1–4 + share). Phần còn lại bị chặn bởi quyết định product / cần backend.
> **Kiểm thử:** `tsc` 0 lỗi · `jest` **59/59 pass** · **CHƯA verify trên thiết bị** (cần Metro/EAS).

---

## 1. Tổng quan

Biến màn lộ trình từ **danh sách CEFR phẳng "trang trí hình cây"** thành **một cái cây thật mọc từ dưới lên theo tiến độ học** — tương tác được (kéo/zoom), có vòng đời bài học (nụ → hoa → quả), bạn đồng hành, lọc theo chủ đề/kỹ năng, và chia sẻ ảnh "khoe cây".

**7 commit** trong phiên (mỗi commit đều qua review đối kháng — adversarial — trước khi commit):

| # | Commit | Nội dung |
|---|--------|----------|
| 0 | `571e5fc3` / `f7bbce40` | **Pha 0 (C1)** — chuẩn hoá status backend `UNLOCKED → AVAILABLE` (đã làm phiên trước) |
| 1 | `668b0eff` | **Pha 1** — cây bottom-up: thân thuôn, mầm/rễ + tán (crown), milestone 3 trạng thái |
| 2 | `15a36472` | **Pha 2** — gestures (pan/pinch/zoom), 4 motif vòng đời, companion, bottom-sheet |
| 3 | `9714f76f` | **Pha 3** — nới DTO theo wire thật, foliage/chip màu theo topic-group thật |
| 4 | `226ec41b` | **Pha 4** — FilterBar + Legend (lọc dim) + phase-tab stage stepper |
| 5 | `9af70f41` | **"Khoe cây"** — share ảnh cây (KHÔNG cần thư viện mới) |
| 6 | `7d51bad3` | **dọn dẹp** — bỏ đường code chết `FOLIAGE` |

---

## 2. Quy trình làm việc

Mỗi pha lớn theo chu trình: **nghiên cứu (multi-agent) → thiết kế blueprint → implement (1 người ghi file) → review đối kháng (workflow: tìm lỗi → xác minh từng lỗi) → vá → tsc + jest → commit**.

- **Nghiên cứu Pha 2** chạy 4 agent song song đọc code repo để rút ra **mẫu đã chứng minh** trong dự án (gesture ở `srs.tsx`, animated SVG ở `SplashAnimated.tsx`/`ProgressRing.tsx`, secure-store ở `ThemeProvider.tsx`) → tránh đoán API.
- **Review đối kháng**: mỗi reviewer nêu finding theo từng "chiều" (gesture/reanimated, svg, integration, a11y…), rồi **một agent khác xác minh lại từng finding** (mặc định coi là false-positive trừ khi đối chiếu code chứng minh được). Tổng cộng các vòng review chỉ giữ lại **7 lỗi thật** trong toàn bộ phiên — tất cả đã vá trước khi commit.

---

## 3. Chi tiết từng pha

### Pha 1 — Cây mọc từ dưới lên (`668b0eff`)
- **Mô hình bottom-up**: A1 ở **đáy** (trên mặt đất + mầm/rễ), cấp cao xếp **lên trên** thân, **crown (tán)** gắn nhãn mục tiêu (cấp CEFR cao nhất) ở ngọn.
- **Thân (trunk)**: ribbon gốc-rộng (46) → ngọn-thuôn (14) + sway (lượn) tắt dần ở ngọn, fill gradient `naTrunk`.
- **Milestone 3 trạng thái tính được** (`MS_PAL`): `passed` (vàng + cúp), `in_progress` (trắng + chữ cấp), `locked` (xám + viền đứt + ổ khoá). Trạng thái `ready` **hoãn** (cần branch-maturity — H4).
- **Chiều cao chạy dồn (running-sum)**: chiều cao mỗi tầng = `f(số nhánh)`, canvas height = `f(số tầng)` → tầng nhiều bài thì cao thêm, không tràn (H1).
- **Glyph vẽ bằng inline `<Path>`** (cúp/khoá/mầm/check) — KHÔNG dùng font "Material Symbols" (RN không có → sẽ in literal text — lỗi M2).

### Pha 2 — Tương tác + vòng đời + companion (`15a36472`)
- **Gestures** (`useTreeGestures.ts`): `GestureDetector` ghép `Gesture.Simultaneous(Race(pan, pinch), Exclusive(doubleTap, singleTap))`.
  - Pan bỏ qua < 5px; Pinch kẹp scale `[0.32, 1.5]` + bù tiêu điểm (focal); double-tap toggle `0.46 ↔ 1.1`; "Toàn cảnh" fit cả cây.
  - Transform đặt trên `<Animated.G>` qua `useAnimatedProps` dạng **chuỗi** `translate(tx ty) scale(s)` → SVG **không re-render mỗi frame** (C4).
- **Tap bằng hit-test, KHÔNG dùng `<G onPress>`**: dưới `GestureDetector`, `onPress` từng node không đáng tin → tap đơn được nghịch-biến-đổi về toạ độ canvas rồi dò node gần nhất (`zoomMath.toCanvas`).
- **4 motif vòng đời** (`NodeMotif.tsx`): quả chín + ✓ (completed) / hoa 5 cánh (in_progress) / nụ (available) / nút xám (locked). Port web → react-native-svg bằng `rotation`/`originX`/`originY` (không dùng `rotate(a x y)` của web). Bloom nhấp nháy + vòng "gợi ý" xoay — **tắt theo `useReducedMotion()`**.
- **Companion** (`treeCompanion.ts`): 5 lựa chọn, lưu bằng `expo-secure-store` key `lt_companion` mặc định `owl` (C3 — KHÔNG cần async-storage). Mascot đậu trên **node gợi ý** = node `AVAILABLE` đầu tiên theo thứ tự CEFR/ngày (`recommendedNodeId`, H2).
- **NodeSheet** (`sheets/NodeSheet.tsx`): bottom-sheet (RN overlay NGOÀI `<Svg>`, animate SlideInDown). **CTA mở đúng route bài học thật `/(student)/node`** (server-graded) — KHÔNG dùng quiz stub (H5).
- **Bonus**: TabBar nổi (`ui/TabBar.tsx`) tự ẩn trên màn detail `href:null` (nó có header + nút back riêng) — vá tận gốc việc thanh tab che control đáy (ảnh hưởng toàn app).

### Pha 3 — Dữ liệu topic thật (`9714f76f`)
- **Phát hiện**: `/skill-tree/me` của backend trả **nguyên dòng raw (`queryForList`)** — mọi cột đều có trên wire (`phase`, `industry`, `module_title_vi`, `session_type`, `sort_order`, `emoji`, `core_topics`, `grammar_points`, `prerequisites_json`, `dependencies_met`…). Mobile DTO trước đó **vứt bỏ**, chỉ giữ 6 field.
- **Nới DTO** (`skillTreeApi.ts`): thêm `sortOrder, phase, industry, moduleTitle, sessionType, emoji, coreTopics[], grammarPoints[], prerequisites[] (node_code), dependenciesMet`. Helper `asStringArray()` parse cột json-text (`to_jsonb(...)::text`) an toàn null, không throw (xử lý cả mảng string lẫn mảng object `{node_code|code|id}` — H3).
- **Topic-group thật** (`topicGroup.ts`): `topicGroupOf` = industry → group (Medizin/Pflege→medical, IT/Gastro→work, Tourismus→travel), không có thì phase → daily, mặc định daily; session "exam" → exam. Foliage + chip dùng `GROUP_COLORS` thật (6 nhóm); NodeSheet thêm eyebrow nhóm.

### Pha 4 — Lọc + Legend + Phase stepper (`226ec41b`)
- **FilterBar** (`controls/FilterBar.tsx`): 6 chip topic-group + 4 chip kỹ năng, **có màu nên kiêm luôn Legend** (§7 "6+4"). Chọn → **dim** nhánh không khớp (topic) / node không khớp (kỹ năng = `dayNumber % 4`); nút "Tất cả" xoá lọc. **Hit-test cũng theo lọc** (node bị mờ thì không tap được; node nhìn thấy gần đó vẫn thắng tap).
- **Phase tab** = `PhaseStepper.tsx` — 4 giai đoạn (Nền tảng → Sản sinh → Lưu loát → Tốt nghiệp), trạng thái suy từ **tiến độ thật** (`stages.ts` `deriveStages`) + snapshot tiến độ + "việc nên làm tiếp" (deep-link node/srs/speaking). Là **ListHeaderComponent**, **GIỮ danh sách node per-level bên dưới** làm **a11y fallback** cho cây gesture (không thay hẳn SectionList).

### "Khoe cây" — share (`9af70f41`)
- **KHÔNG cần thư viện mới / KHÔNG rebuild**: `react-native-svg` `Svg.toDataURL()` → PNG base64 → `expo-file-system/legacy` `writeAsStringAsync` (cache) → RN `Share.share` (đã dùng sẵn trong app).
- Auto-fit rồi capture **đúng lúc animation fit xong** qua `fitView(onDone)` (callback hoàn tất của `withTiming`) — bỏ `setTimeout` (hết race UI/JS thread).
- **iOS đính kèm ảnh; Android chỉ share caption** (giới hạn của RN Share — muốn đính ảnh trên Android cần `expo-sharing` + rebuild).

### Dọn dẹp (`7d51bad3`)
- Pha 3/4 khiến đường tô màu cũ `FOLIAGE` thành **code chết** (foliage giờ lấy từ topic-group thật) → bỏ field `BranchRow.foliage`, tham số `foliagePalette`, hằng `FOLIAGE`.

---

## 4. Kiến trúc & cấu trúc file

```
mobile/
├── components/
│   ├── SkillTreeView.tsx            # orchestrator: layout → gestures → motif → controls
│   └── skill-tree/
│       ├── layout.ts                # hình học thuần (buildTreeLayout bottom-up, trunkPath, recommendedNodeId) — unit-test
│       ├── palette.ts               # màu: BARK, MS_PAL, GROUP_COLORS (6 nhóm), SKILL_DOTS, CROWN/GROUND
│       ├── glyphs.tsx               # glyph inline SVG (cúp/khoá/mầm/check)
│       ├── nodeOffsets.ts           # fan N node không chồng (C2) — unit-test
│       ├── topicGroup.ts            # topicGroupOf / topicLabelOf (phase/industry→group) — unit-test
│       ├── stages.ts                # deriveStages (4 giai đoạn từ tiến độ thật) — unit-test
│       ├── PhaseStepper.tsx         # header tab "Giai đoạn"
│       ├── controls/
│       │   ├── useTreeGestures.ts   # shared values {s,tx,ty} + Pan/Pinch/Tap + fitView(onDone) + zoom
│       │   ├── zoomMath.ts          # toán pan/zoom thuần (clamp/fit/focal/toCanvas/toggle) — unit-test
│       │   ├── TreeControls.tsx     # ZoomButtons, FitButton, ShareButton
│       │   ├── FilterBar.tsx        # lọc topic + skill (kiêm legend)
│       │   └── CompanionChips.tsx   # chọn bạn đồng hành
│       ├── motifs/NodeMotif.tsx     # 4 motif + BloomHalo + RecRing + CompanionEmoji + SkillBadge
│       └── sheets/NodeSheet.tsx     # bottom-sheet tap-tại-chỗ → route bài học thật
├── lib/
│   ├── skillTreeApi.ts              # DTO + mapSkillNode (nới full wire shape, parse json-text null-safe)
│   ├── treeCompanion.ts            # useCompanion (expo-secure-store) + COMPANIONS
│   └── shareTree.ts                 # capture PNG → file → Share
├── app/(student)/roadmap.tsx        # host: 2 tab (tree | phase), state filter/companion/viewport/sheet
└── __tests__/skillTree*.test.ts     # 5 file test
```

**Nguyên tắc render**: 1 `<Svg>` cỡ viewport, nội dung cây nằm trong `<Animated.G>` (pan/zoom UI-thread). Mọi chrome (PathHero, FilterBar, controls, companion, sheet) là **RN overlay NGOÀI svg**. **FilterBar phải đặt in-flow trên canvas** (không overlay) vì `ScrollView` phủ lên `GestureDetector` sẽ nuốt thao tác pan.

---

## 5. Quyết định kỹ thuật then chốt (và lý do)

| Quyết định | Lý do |
|---|---|
| `<Animated.G>` + `useAnimatedProps` chuỗi `translate() scale()` | Pan/zoom chạy UI-thread, SVG không re-render → mượt (C4). Đã chứng minh trong repo (`SplashAnimated.tsx`). |
| Tap qua hit-test, không `<G onPress>` | Dưới `GestureDetector`, press từng node SVG không đáng tin (bị detector nuốt). |
| `rotation`/`originX/Y` cho motif | Port web `rotate(a x y)` không sang RN; props này xoay quanh tâm rõ ràng, bền version. |
| `expo-secure-store` cho companion | Web dùng `localStorage` (không có ở RN); `async-storage` chưa cài; secure-store đã có sẵn (C3). |
| Share bằng `toDataURL` + RN `Share` | Không thêm dep native → không EAS rebuild (dự án nhạy cảm rebuild). |
| Bọc `<Svg>` trong `<View collapsable>` | Để ref `svgRef` (gọi `toDataURL`) bền vững dưới `GestureDetector` bất chấp nội bộ RNGH/RNSVG. |
| Ẩn TabBar nổi ở màn `href:null` | Màn detail có header + back riêng; thanh tab che control đáy. |
| Giữ list node ở tab "Giai đoạn" | Là **a11y fallback** cho cây gesture (cây mất a11y per-node). |

---

## 6. Kiểm thử

- **`tsc --noEmit`**: 0 lỗi.
- **`jest`**: **59/59 pass**, 39 test mới là **invariant** (theo §7 spec — test bất biến, không screenshot-diff vì web↔RN render khác):
  - `skillTreeLayout.test.ts` — bottom-up, running-sum, milestone state, goal label.
  - `skillTreePha2.test.ts` — nodeOffsets (fan không chồng N≥5), zoomMath (clamp/fit/focal), recommendedNodeId.
  - `skillTreeTopic.test.ts` — topicGroupOf/topicLabelOf + parse DTO json-text (edge: object prereq, JSON hỏng).
  - `skillTreeStages.test.ts` — deriveStages 4 giai đoạn.
  - `skillTreeApi.test.ts` — chuẩn hoá status (C1) + parse tags.
- **CHƯA chạy trên thiết bị** (môi trường không có Metro/EAS). Spec cố tình lấy invariant làm cổng nghiệm thu thay vì screenshot.

---

## 7. Lỗi đã phát hiện & vá qua review đối kháng

| Pha | Lỗi (đã vá trước commit) |
|---|---|
| 2 | TabBar nổi che control đáy → ẩn TabBar ở màn `href:null`. |
| 4 | FilterBar (ScrollView) phủ canvas nuốt pan → dời ra in-flow. |
| 4 | Node bị lọc-mờ vẫn tap được → hit-test bỏ qua node dimmed. |
| share | `toDataURL` trả `undefined` khi lỗi → guard `base64`. |
| share | Ref `<Svg>` dưới `GestureDetector` không chắc chắn → bọc `<View collapsable>`. |
| share | `setTimeout` 340ms đua thread → dùng callback hoàn tất `fitView(onDone)`. |

> Hàng chục finding khác bị **xác minh là false-positive** và loại bỏ — nhờ bước verify từng finding.

---

## 8. Kế hoạch tiếp theo (phần CÒN LẠI — đều bị chặn)

Toàn bộ phần *làm được* của spec đã xong. Phần còn lại cần **quyết định product** hoặc **việc backend**, không thể tự làm một mình nếu không muốn đoán mò hoặc làm UI suy đoán:

### A. Cần quyết định product
1. **Bảng map topic → 6 nhóm (§8 Q2)** — hiện đang dùng **default M4** (industry/phase→group). Cần product chốt bảng chính thức: industry nào → nhóm nào? nhóm mặc định cho core node? → *Khi có bảng, tôi wire ngay (chỉ sửa `topicGroup.ts`).*
2. **Re-group node thành "limb theo chủ đề"** — hiện vẫn chunk 3 node/nhánh, tô màu theo lead node. Mô hình "mỗi limb = 1 chủ đề" cần chốt cách gom (theo `phase`? `core_topics`? `industry`?). Đây là quyết định cấu trúc/UX.
3. **Ẩn dụ motif (§8 Q3)**, **companion bật mặc định? (§8 Q4)**, **scope "Khoe cây" (§8 Q5)** — các câu hỏi nhỏ còn mở.

### B. Cần việc backend
4. **Lá = kỹ năng thật per-node (§4.4)** — hiện skill-dot chỉ **cosmetic** (`dayNumber % 4`). Cần 1 trong:
   - (a) endpoint `GET /skill-tree/node/{id}/practice` trả `practice_node_sessions` (skill_type, status); hoặc
   - (b) thêm `skills[]` vào dòng `/skill-tree/me`.
   → *Khi backend có, mobile chỉ cần đọc field và thay skill-dot bằng skill thật.*
5. **Trạng thái milestone `ready` + LevelUpBanner/ritual (H4)** — cần tín hiệu "đủ điều kiện lên cấp" / branch-maturity (hiện không tính được không tuỳ tiện). Có thể dựa `dependencies_met` (đã plumb sẵn vào DTO) nếu product định nghĩa rõ ngưỡng.

### C. Để sau / giá trị thấp
6. **DAG fork/merge geometry (H3)** — vẽ nhánh tách/gộp theo prerequisite. `prerequisites`/`dependenciesMet` đã có trong DTO; cần dựng index `node_code → id`. Gating hiện vẫn theo `user_status` backend (đã đúng).
7. **Growth-stage preview** — cây ở cấp tương lai (skeleton mờ). Suy đoán, giá trị thấp.

### D. Vận hành (BẮT BUỘC trước khi ship)
8. **QA trên thiết bị** — chạy EAS preview build và kiểm thực tế: pan/pinch/double-tap/fit, 4 motif + bloom/spin (và reduced-motion tắt), companion persist qua restart, tap → sheet (không nhảy route), filter dim, share (iOS đính ảnh / Android caption). Gói vào lần EAS build tới của nhánh.

---

## 9. Lưu ý nhanh cho phiên sau

- **Spec nguồn**: `mobile/SKILL_TREE_SPEC.md` (đã đồng bộ marker ✅ từng pha).
- **Nhánh**: `chore/ios-deploy-sdk54` — 7 commit skill-tree xếp chồng, **chưa merge**.
- **Gotcha nhớ kỹ**: transform phải là **chuỗi** trên `Animated.G`; tap qua hit-test (không `<G onPress>`); FilterBar **in-flow** không overlay; `<Svg>` bọc `<View collapsable>` cho ref.
- **Build local**: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` + `ENABLE_USER_SCRIPT_SANDBOXING=NO` trước build (EAS không bị) — theo handoff deploy.
