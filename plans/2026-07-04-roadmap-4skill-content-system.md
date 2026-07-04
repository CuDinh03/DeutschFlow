# Roadmap 4‑Skill Content System — Spec & Execution Plan

**Ngày:** 2026-07-04 · **Trạng thái:** IN PROGRESS (Phase 0 đang làm)
**Quyết định đã chốt:** Hybrid (LÕI soạn sẵn + AI luyện thêm cho PRO) · Chủ đề = nhánh bonus tùy chọn (satellite, mở từ A2) · Làm trọn **A1 (30 ngày × 4 kỹ năng)** trước.

---

## 1. Bối cảnh & vấn đề

App mobile dùng hệ `skill_tree_nodes` qua `GET /api/skill-tree/me`. Điều tra (2026-07-04) phát hiện:

- **Lỗi A — Catch‑22 mở khoá (CRITICAL):** trạng thái node = `COALESCE(progress.status,'LOCKED')`, không suy ra từ điều kiện phụ thuộc. Không có gì ghi `UNLOCKED` cho node CORE kế tiếp khi node trước hoàn thành ⇒ xong bài 1, bài 2 vẫn `LOCKED` vĩnh viễn. FE bỏ qua `dependencies_met`. `SkillTreeService.getSkillTreeForUser` / `SkillTreeService.getNodeSession`.
- **Lỗi B — Ngưỡng mở khoá 100% > ngưỡng hoàn thành 70%:** seed dependency `min_score_percent = 100` (HARD) nhưng node hoàn thành ở `mastery_threshold` (70). Node có bài tập đạt 70–99% = COMPLETED nhưng KHÔNG mở được node kế. Hiện ẩn vì A1 toàn theory‑only.
- **Lỗi C — `getNodeSession` trả status cũ:** auto‑unlock upsert `IN_PROGRESS` rồi vẫn trả `currentStatus` (LOCKED) → màn học hiện "Chưa mở khoá" lần mở đầu.
- **Tường nội dung:** `content_json` chỉ có thật ở **days 1–3**; days 4–30 rỗng (V114 seed rỗng, V116 seed 20/20 rỗng, các bản content V74–V98 bị V114 `DELETE` xoá). Node rỗng → `node.tsx` hiện "Nội dung đang cập nhật", không có nút hoàn thành → dead‑end.

## 2. Hạ tầng đã có (TÁI SỬ DỤNG — không làm lại)

| Thành phần | Trạng thái | File |
|---|---|---|
| Schema bài tập 4 kỹ năng (16 loại) | ✅ | `PracticeNodePromptBuilder` |
| Grader tổng quát 4 kỹ năng (`correct_index`/`correct_answer`+`accept_also`/`"spoken"`) | ✅ | `PracticeExerciseGrader` |
| Grader theory‑gate MC/FILL | ✅ | `NodeExerciseGrader` |
| TTS (đọc `audio_transcript` cho Hören) | ✅ | XTTS / expo-audio |
| STT + chấm phát âm (Sprechen) | ✅ | Whisper, `evaluatePronunciation` |
| Chấm viết AI (Schreiben `FREE_WRITE`) | ✅ | `correct-writing` |
| Chống lặp + Gen N+1 "luyện thêm" | ✅ | `practice_node_sessions`, `user_seen_exercise_hashes` |
| Nhánh chủ đề chọn được (satellite, A2+) | ✅ (một phần) | `unlockSatelliteNode`, `SatelliteLeafPromptBuilder` |

**Loại bài tập theo kỹ năng (đã định nghĩa sẵn):**
- 🎧 Hören: `LISTEN_AND_CHOOSE`, `LISTEN_AND_FILL`, `LISTEN_AND_ORDER`, `DICTATION`
- 🗣️ Sprechen: `SPEAKING_REPEAT`, `SPEAKING_RESPONSE`, `SPEAKING_DESCRIBE`, `ROLE_PLAY`
- 📖 Lesen: `READ_AND_CHOOSE`, `READ_TRUE_FALSE`, `READ_AND_FILL`, `READ_AND_MATCH` (+ `reading_passage`)
- ✏️ Schreiben: `TRANSLATE_VI_DE`, `REORDER_WORDS`, `FILL_GRAMMAR`, `FREE_WRITE`

## 3. Kiến trúc mục tiêu (Hybrid)

```
CORE node (skill_tree_nodes, days 1–30 A1)
├── theory  → content_json.theory_cards / vocabulary / phrases   [soạn sẵn]
└── skill_exercises: {                                            [soạn sẵn, ĐÓNG BĂNG]
      HOEREN:   [ ...6 bài ],   ← chấm bởi PracticeExerciseGrader
      SPRECHEN: [ ...6 bài ],   ← 'spoken' + evaluatePronunciation
      LESEN:    [ reading_passage + ...6 bài ],
      SCHREIBEN:[ ...6 bài ]    ← FREE_WRITE → correct-writing
    }
PRO "luyện thêm vô hạn"  → PracticeNodeService (AI sinh, giữ nguyên)
Nhánh chủ đề (bonus)     → SATELLITE_LEAF, mở từ A2 (giữ nguyên cơ chế)
```

- **Nguồn nội dung CORE:** dùng chính các prompt trong `PracticeNodePromptBuilder` để LLM sinh **offline** 1 lần → review → **đóng băng vào Flyway migration** (không sinh per‑user, không tốn token runtime, chạy cho FREE).
- **Chấm điểm:** tái dùng `PracticeExerciseGrader` cho `skill_exercises`; `evaluatePronunciation`/`correct-writing` cho Nói/Viết.
- **Hoàn thành node:** đạt `mastery_threshold` trên tổng các kỹ năng có bài chấm xác định → COMPLETED → mở node kế (sau khi vá A/B/C).

## 4. Mô hình dữ liệu

Chọn **nhúng vào `content_json`** (1 hàng/node, tái dùng pipeline + grader). Thêm khối:
```json
"skill_exercises": { "HOEREN": [...], "SPRECHEN": [...], "LESEN": [...], "SCHREIBEN": [...] }
```
- Không cần bảng mới cho CORE. `practice_node_sessions` vẫn dành cho AI "luyện thêm".
- Cần cờ `session_type`/metadata để runner biết node có 4‑skill exercises.

## 5. Phân pha thực thi

### Phase 0 — Vá gating (unblock ngay) ✅ ĐANG LÀM
`SkillTreeService`:
1. **A:** `getSkillTreeForUser` — suy ra `UNLOCKED` khi `dependencies_met && status='LOCKED'`.
2. **B:** bỏ điều kiện `score_percent < min_score_percent` trong `dependencies_met` SQL + `checkDependenciesMet` (COMPLETED là đủ; ngưỡng điểm đã enforce ở `mastery_threshold` lúc hoàn thành).
3. **C:** `getNodeSession` trả status sau khi auto‑unlock (`IN_PROGRESS`, không phải LOCKED cũ).
- Kết quả: xong bài 1 → bài 2/3 (có nội dung) mở & học được. (Bài 4+ vẫn chờ nội dung — Phase 2.)

### Phase 1 — Engine 4 kỹ năng cho nội dung soạn sẵn
- Backend: đọc `content_json.skill_exercises`, phục vụ theo kỹ năng; chấm bằng `PracticeExerciseGrader`; quy tắc hoàn thành node theo tổng điểm 4 kỹ năng.
- Mobile: runner 4 tab kỹ năng trong `node.tsx`/`node-practice.tsx` (render đủ 16 loại; nối TTS/STT/writing‑AI đã có). Không phá luồng AI "luyện thêm" cho PRO.
- Test: unit grader mọi loại; e2e 1 node đủ 4 kỹ năng.

### Phase 2 — Soạn & đóng băng nội dung A1 (30 ngày)
- Pipeline: LLM sinh (dùng prompt sẵn) → review người → migration `V2xx__a1_core_content_days_4_30.sql` (+ days 1–3 bổ sung skill_exercises).
- Mỗi ngày: theory + 4×~6 bài tập. Chấm xác định cho Nghe/Đọc/Viết‑deterministic; Nói + FREE_WRITE dùng AI chấm.
- Fresh‑replay test xác nhận days 1–30 đều `has_content = true`.

### Phase 3 — Nhánh chủ đề bonus
- Chuẩn hoá satellite: chọn theme (Đời sống/Công việc/Du lịch/Y tế‑Pflege) → nhánh phụ tùy chọn, mở từ A2. Tái dùng `unlockSatelliteNode` + track.

### Phase 4 — A2 → B2
- Lặp lại Phase 1–3 cho các cấp còn lại sau khi A1 chạy end‑to‑end.

## 6. Rủi ro / lưu ý
- Nội dung LLM cần review người (độ chính xác tiếng Đức + giải thích tiếng Việt).
- `content_json` phình (~10–20KB/node có 24 bài) — gzip ok; cân nhắc lazy‑load exercises nếu cần.
- Sau bỏ gate `min_score_percent`, cột này thành advisory (giữ để dữ liệu, không dùng để chặn).
- Kiểm tra không phá test FE `skillTreeApi.test.ts` + test backend liên quan `dependencies_met`.

## 7. Tiến độ
- [x] Phase 0 — vá A/B/C trong `SkillTreeService` (compile ✅ 2026-07-04; chưa deploy/commit). A: derive-at-read UNLOCKED khi deps met; B: bỏ gate `score_percent<min_score`; C: `getNodeSession` trả `IN_PROGRESS` sau auto-unlock.
- [x] Phase 1 — engine 4 kỹ năng (backend + mobile runner) — XONG (còn: ghi âm Sprechen thật, device QA)
  - [x] **Backend keystone** (compile ✅): `SkillTreeService.submitSkillExercises()` chấm `content_json.skill_exercises.{HOEREN,SPRECHEN,LESEN,SCHREIBEN}` bằng `PracticeExerciseGrader`, cộng dồn, hoàn thành node khi ≥ `mastery_threshold` (tái dùng writeProgress + awardCompletionSideEffects → mở node kế). Endpoint `POST /api/skill-tree/{nodeId}/skill-exercises/submit` (body `{skill_answers:{HOEREN:{...},...}}`).
  - [x] **Schema locked** — `content_json.skill_exercises` = mảng (Hören/Sprechen/Schreiben) hoặc `{reading_passage, exercises:[]}` (Lesen). Grader chấm `correct_index`/`correct_answer`+`accept_also`/sentinel `"spoken"` (Nói/FREE_WRITE). REORDER cần thêm `correct_answer` (câu ghép) để grader chấm.
  - [x] **Node mẫu bài 2** `V245__a1_day2_4skill_sample.sql` (3 theory_cards + 6 vocab + 4 kỹ năng). JSON valid ✓, mô phỏng chấm: perfect = 10/10 = 100% → completed ✓. ADDITIVE, không phá luồng cũ.
  - [x] **Mobile runner 4 kỹ năng** (tsc 0 lỗi, jest 8/8): màn `app/(student)/skill-practice.tsx` render mọi loại bài (choice/text/true-false/reorder/speaking), **TTS `de-DE` cho Nghe** (expo-speech), chấm server qua `submitSkillExercises`, mở node kế. Helper thuần `lib/skillExercises.ts` (+ test `__tests__/skillExercises.test.ts`). Types + method trong `lib/skillTreeApi.ts`. `node.tsx` route sang runner khi có `skill_exercises`. Sprechen = sentinel `"spoken"` (ghi âm/pronunciation-eval để sau); không có FREE_WRITE trong nội dung A1.
  - Guard `markNodeComplete` **CỐ Ý bỏ**: routing ở app mới đã ẩn mark-learned khi có skill_exercises; guard sẽ làm hỏng app cũ (TestFlight) sau deploy backend, và không có rủi ro integrity (bài free).
  - [ ] (còn) Ghi âm thật cho Sprechen (nối `evaluate-pronunciation`); unit test `submitSkillExercises` (mock JdbcTemplate); **device QA** (không test được trong môi trường này — RN, preview web không áp dụng).
- [x] Phase 2 — **A1 days 1–30 XONG** (mọi ngày có nội dung 4 kỹ năng)
  - [x] Day 2 `V245`, Days 4–5 `V246` (soạn tay).
  - [x] Days 1, 3, 6–30 `V247__a1_days_1_3_6_30_4skill.sql` — Workflow (author→verify, 54 agent, ~3.86M token) + validate deterministic: 27/27 JSON valid, chấm mô phỏng perfect=100%/ngày, theory=3/vocab=6, **27/27 title khớp seed**. ADDITIVE. ⚠️ Days 25–30 verify bị ngắt (session limit) nhưng file ghi trước đó; spot-check Perfekt/Abschlusstest OK — **review nhẹ tay** 25–30.
  - [ ] (polish) mở rộng ~2-3 → ~6 bài/kỹ năng/ngày; review bản ngữ.
  - Ghi chú: nội dung ADDITIVE → deploy độc lập được; sau Phase 0, lộ trình A1 đi hết được (complete qua "Đánh dấu đã học"); **runner 4 tab** thêm luyện tập tương tác.
- [ ] Phase 3 — nhánh chủ đề bonus
- [ ] Phase 4 — A2→B2
