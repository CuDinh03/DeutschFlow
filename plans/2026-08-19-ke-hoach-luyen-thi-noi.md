# Kế hoạch: Mảng "Luyện thi Nói" (Prüfungstraining Sprechen)

- **Ngày:** 2026-08-19 · **Trạng thái:** KẾ HOẠCH — chưa code
- **Phạm vi:** phân tích phần thi nói A1–C2 (Goethe/telc/ÖSD/DTZ/TestDaF/DSH) → thiết kế tính năng luyện thi nói với AI
- **Nguồn phân tích:** Durchführungsbestimmungen Goethe (Stand 01.09.2025), Modellsätze chính thức, Übungstests telc, Handbuch DTZ (BAMF/g.a.s.t.), Modellsätze ÖSD, testdaf.de — danh sách link ở Phụ lục.

## 0. Quyết định đã chốt với owner (19/08/2026)

| Câu hỏi | Quyết định |
|---|---|
| Hệ chứng chỉ | **Goethe + telc ngay từ đầu** (ÖSD/DTZ/TestDaF: đợt sau) |
| Cấp độ MVP | **A1–B2** (phân tích đủ A1–C2; C1/C2 build sau) |
| Vị trí trong app | **Khu "Luyện thi" trong tab Speaking** — `/v2/student/speaking/exam` |
| Chấm điểm | **Hai chế độ**: Drill (phản hồi nhanh từng lượt) + Mock (rubric + thang điểm chuẩn kỳ thi) |
| Hệ tiêu chí chấm (bổ sung 19/08) | **Hai bộ tiêu chí chính thức tách bạch**: chấm theo **Goethe** (Erfüllung · Kohärenz/Interaktion · Wortschatz · Strukturen · Aussprache, thang A–E) hoặc theo **telc** (Ausdrucksfähigkeit · Aufgabenbewältigung · Formale Richtigkeit · Aussprache/Intonation, thang A–D) — chọn theo blueprint, KHÔNG trộn thành rubric chung |
| Luyện nói đôi (tách riêng 19/08) | **Tính năng RIÊNG dành cho B2B** (trung tâm/lớp), chỉ dùng chung khu Speaking trên UI; module, bảng, API, quyền (gói org + ghế + lớp), token kênh trung tâm và lộ trình tách khỏi mảng này. Mảng luyện thi chỉ cung cấp 3 contract public (blueprint · chấm một người · lời Prüfer). Doc riêng: `plans/2026-08-19-luyen-noi-doi-b2b.md` |
| Nền tảng đợt đầu | Web /v2 trước, mobile đợt sau (theo pattern các tính năng gần đây) |

---

## 1. Phân tích phần thi nói A1–C2

### 1.1 Goethe-Institut (mục tiêu chính MVP: A1–B2)

| Cấp | Định dạng | Vorbereitung | Các Teil (tên chính thức) | Điểm & ngưỡng |
|---|---|---|---|---|
| **A1** (Start Deutsch 1) | Nhóm ≤4 TS, 2 giám khảo, 15′ | **0′** | **T1 „Sich vorstellen"** — 7 Stichwörter (*Name? Alter? Land? Wohnort? Sprachen? Beruf? Hobby?*) + **buchstabieren** + **Nummer nennen** · **T2 „Um Informationen bitten und Informationen geben"** — Themenkarten (Thema + 1 từ khóa), 2 vòng hỏi–đáp · **T3 „Bitten formulieren und darauf reagieren"** — Bildkarten (thẻ hình đồ vật) | Thô 3+6+6=15, chấm **volle/halbe/0** ×1,66 → 25/100 toàn kỳ; đỗ tổng ≥60, không ngưỡng nói riêng |
| **A2** | Paar 15′ (Einzel 10′) | **0′** | **T1 „Fragen zur Person"** — mỗi TS 4 Aufgabenkarten từ khóa, hỏi & đáp chéo · **T2 „Von sich erzählen"** — 1 thẻ câu hỏi dẫn + gợi ý (vd *Was machen Sie mit Ihrem Geld? — Sparen? Reisen?…*), độc thoại ngắn + câu hỏi thêm của giám khảo · **T3 „Gemeinsam etwas planen"** — tình huống chung, **mỗi TS một trang lịch tuần khác nhau**, thương lượng chốt lịch | 25 điểm, thang A–E, 3 nhóm tiêu chí (Aufgabenerfüllung · Sprache · Aussprache). ⚠️ **Ngưỡng nói riêng: ≥15/25 VÀ ≥45/75 viết** — thiếu một bên là trượt |
| **B1** (modular, đề chung với ÖSD) | Paar ~15′ (T1 2–3′ · T2 3–4′/TS · T3 1–2′/TS) | **15′** (ghi chú gạch đầu dòng được mang vào) | **T1 „Gemeinsam etwas planen"** — tình huống + danh sách gợi ý, đề xuất–phản hồi–**cùng quyết định** · **T2 „Ein Thema präsentieren"** — chọn 1/2 chủ đề, trình bày theo **5 „Folien"** in sẵn (① giới thiệu đề + cấu trúc ② trải nghiệm cá nhân ③ tình hình ở quê hương + ví dụ ④ Vor-/Nachteile + Meinung ⑤ kết + cảm ơn) · **T3 „Über ein Thema sprechen"** — trả lời câu hỏi về bài mình; với bài của bạn: **eine Rückmeldung geben + eine Frage stellen** | 100 điểm, đỗ ≥60. Phân bổ: T1 = 28 (Erfüllung 8 · Interaktion 4 · Wortschatz 8 · Strukturen 8) · T2 = 40 (12/4 Kohärenz/12/12) · T3 = 16 · **Aussprache 16 chấm chung** |
| **B2** (modular 2019) | Paar ~15′ | **15′** (Konzeptpapier) | **T1 „Vortrag halten"** (~4′/TS) — kịch bản Seminar, **2 chủ đề chọn 1**, cấu trúc Einleitung–Hauptteil–Schluss + 3 gạch nội dung (*mehrere Alternativen beschreiben / Vor- und Nachteile bewerten / eine Möglichkeit genauer beschreiben*); sau bài: bạn thi **bắt buộc đặt câu hỏi** + giám khảo hỏi · **T2 „Diskussion führen"** (~5′) — kịch bản Debattierclub, câu hỏi gây tranh cãi, *Standpunkt austauschen – reagieren – zusammenfassen: dafür oder dagegen* | 100 điểm, đỗ ≥60; thang A–E (16/12/8/4/0 · 8/6/4/2/0 · 4/3/2/1/0); T1=44 / T2=56, Aussprache 16 chấm chung; Erfüllung=E → cả Teil 0 điểm |
| **C1** (modular, từ 01.01.2024) | Paar ~20′ | **20′** | **T1 „Vortrag halten"** (~5′ + 2′ hỏi đáp/TS) — chọn 1/2 chủ đề xã hội, **4 điểm nội dung bắt buộc**, bạn thi bắt buộc hỏi · **T2 „Diskussion führen"** (~5′) — chủ đề chung + Inputtext ngắn + 4 Stichpunkte, TS **tự mở đầu**, cần Einigung/Zusammenfassung | 100 điểm, đỗ ≥60; tiêu chí Erfüllung · Kohärenz/Interaktion · Wortschatz · Strukturen · Aussprache (chung) |
| **C2** (GDS) | **Einzel** ~15′ | **15′** | **T1 „Produktion"** — Vortrag ~5′ + 2–3′ hỏi: chọn 1/2 chủ đề, định hướng bằng **3 Zitate** trái chiều · **T2 „Interaktion"** — chọn chủ đề + **chọn Pro/Contra**; TS mở đầu; **giám khảo 2 giữ lập trường ngược lại**, phải thuyết phục | Mỗi Teil 5 tiêu chí ×4đ → 40 thô ×2,5 = 100; đỗ ≥60 |

Ghi chú digital: từ 09/2025 các modul viết có thể thi trên máy tại trung tâm, **modul Sprechen vẫn thi trực tiếp với 2 giám khảo** — không ảnh hưởng thiết kế.

### 1.2 telc (mục tiêu chính MVP: A1–B2)

| Cấp | Định dạng | Vorbereitung | Các Teil | Điểm & ngưỡng |
|---|---|---|---|---|
| **A1** | Nhóm ≤4, ~15′ | 0′ | Cùng gốc đề Goethe A1: **T1 „Sich vorstellen"** (+ buchstabieren + Zahlen) · **T2 „Um Informationen bitten und geben"** (Themenkarten) · **T3 „Bitten formulieren und darauf reagieren"** (Bildkarten) | Thô 15; tổng kỳ thi 60 điểm, đỗ ≥36 (60%), không ngưỡng nói riêng |
| **A2** (Start Deutsch 2) | Paar/Einzel ~15′ | 0′ | **T1 „Sich vorstellen"** (từ khóa) · **T2 „Ein Alltagsgespräch führen"** — 1 chủ đề (vd Tagesablauf) + thẻ từ để hỏi (*Wie oft? Wann? Wohin? Was? Wo? Wie lange?*) · **T3 „Etwas aushandeln"** — lịch A≠B, tìm **Termin chung** | ×1,66 quy thang 100; đỗ 60% (không thấy ngưỡng nói riêng) |
| **B1** (Zertifikat Deutsch) | Paar ≤15′ | **20′** | **T1 „Kontaktaufnahme"** (3–4′) — làm quen theo chủ đề gợi ý + 1 câu hỏi ngoài đề · **T2 „Gespräch über ein Thema"** (5–6′) — **Vorlagen A/B khác nhau** (text ngắn + **biểu đồ/thống kê**): thuật lại cho bạn nghe rồi trao đổi quan điểm · **T3 „Gemeinsam eine Aufgabe lösen"** — lập kế hoạch chung | Tiêu chí A–D: Ausdrucksfähigkeit · Aufgabenbewältigung · Formale Richtigkeit · Aussprache/Intonation. T1=15, T2=30, T3=30 → 75 (25% của 300). ⚠️ **Đỗ kép: ≥45/75 nói VÀ ≥135/225 viết** (được thi lại riêng phần trượt) |
| **B2** | 2 TS ≤15′ | **20′** (lúc chuẩn bị **được dùng từ điển**) | Vorspann Kontaktaufnahme 30–60″ không chấm · **T1 „Präsentation"** (~2,5′/TS) — **chọn 1/5 chủ đề**, core ~90″ + Rückfragen của bạn · **T2 „Diskussion"** (~2,5′/TS) — từ text ngắn gây tranh cãi · **T3 „Problemlösung"** (~2,5′/TS) — cùng lập kế hoạch | Mỗi Teil 25 (7/7/7/4) → 75; có mức A* vượt cấp; đỗ kép 60%/60% |
| **C1 / C1 Hochschule** | Paar ~16′ | **20′** | **T1A „Präsentation"** 3′ (2 chọn 1) · **T1B „Zusammenfassung und Anschlussfragen"** — bạn thi **tóm tắt bài mình** + hỏi · **T2 „Diskussion"** 6′ từ một **Zitat/These** | Aufgabengerechtheit chấm riêng từng phần (16) + Flüssigkeit/Repertoire/Grammatik/Aussprache chấm chung (32) = 48; đỗ kép 60% |
| **DTZ** (A2–B1, từ 2023 do g.a.s.t.) | Paar ~16′ nói | 0′ | **T1 „Über sich sprechen"** + Nachfragen · **T2 „Über Erfahrungen sprechen"** — mỗi TS một **ảnh** khác nhau: **Bild beschreiben** + kể trải nghiệm · **T3 „Gemeinsam etwas planen"** | Aufgabenbewältigung chấm theo từng tiểu mục + 4 tiêu chí toàn cục; kết quả theo bậc; **B1 toàn phần đòi Sprechen=B1 + ≥1 phần khác B1** |
| Biến thể nghề | telc B1·B2 Pflege (~16′+20′ prep): **Rollenspiele** Anamnese/Angehörigengespräch + **Übergabegespräch**; DTB B2 (BAMF): 3 Teile chất liệu công việc | | | (đợt sau) |

### 1.3 Các hệ khác (tham chiếu cho đợt mở rộng)

- **ÖSD**: đặc sản **role-play điện thoại** (ZC1 A1 *Sich am Telefon entschuldigen und etwas aushandeln*; ZC2 A1 xử lý vấn đề ở vai chuyên môn), **Bild beschreiben und interpretieren** (ZB2 A2), Kurzreferat có Grafik/bài báo (ZC1 A3). ZB1 dùng chung đề với Goethe B1. Từ 2024 có bản digital song song.
- **TestDaF**: phần nói **thi với máy tính/headset** — 7 Aufgaben ~35′ (*Rat geben, Grafik beschreiben, Stellung nehmen, Thema präsentieren…*), chấm tập trung theo TDN 3–5. Đây là "bằng chứng khả thi" tốt nhất cho mô hình app: một kỳ thi thật đã chạy đúng UX "nói với máy có đồng hồ".
- **DSH**: mỗi trường tự triển khai theo Rahmenordnung; mô hình phổ biến 20′ prep (text/Grafik) + Kurzvortrag ~5′ + Gespräch.
- Không có bằng chứng chính thức nào (tính đến 19.08.2026) về việc đổi format đề B1/C2 trong 2026–2027.

### 1.4 Insight thiết kế: 10 nguyên mẫu dạng bài (Task-Archetypen)

Toàn bộ ~23 Teil của Goethe+telc A1–C1 (và các hệ khác) quy về **10 nguyên mẫu**. Đây là đơn vị xây dựng của engine — mỗi archetype là một máy trạng thái hội thoại + họ prompt + ánh xạ rubric; **đề thi cụ thể chỉ là dữ liệu (blueprint + task bank)**, không phải code riêng:

| # | Mã archetype | Nhiệm vụ | Xuất hiện | Tương tác |
|---|---|---|---|---|
| 1 | `SELF_INTRO` | Sich vorstellen (+ buchstabieren/Zahlen ở A1) | Goethe/telc A1 T1 · telc A2 T1 · DTZ T1 (từ B1↑ chỉ là warm-up không chấm) | TS ↔ Prüfer |
| 2 | `CARD_QA` | Hỏi–đáp theo thẻ (Themen-/Aufgabenkarten) | Goethe/telc A1 T2 · Goethe A2 T1 · telc A2 T2 | TS ↔ Partner |
| 3 | `REQUEST_RESPOND` | Bitten formulieren und darauf reagieren (Bildkarten) | Goethe/telc A1 T3 (chỉ A1) | TS ↔ Partner |
| 4 | `ABOUT_ME` | Von sich erzählen (độc thoại ngắn có gợi ý) | Goethe A2 T2 · DTZ T2 phần kể | Mono + hỏi thêm |
| 5 | `PLAN_NEGOTIATE` | Gemeinsam etwas planen / Termin aushandeln | Goethe A2 T3 · telc A2 T3 · **Goethe B1 T1** · telc B1 T3 · telc B2 T3 · DTZ T3 | TS ↔ Partner (nguyên mẫu bền nhất A2→B2) |
| 6 | `TOPIC_EXCHANGE` | Kontaktaufnahme / Gespräch über ein Thema (± Grafik) | telc B1 T1 + T2 | TS ↔ Partner |
| 7 | `PRESENT` | Präsentation/Vortrag có cấu trúc | Goethe B1 T2 (**5 Folien**) · Goethe B2 T1 · telc B2 T1 (90″) · telc C1 T1A · Goethe C1 T1 · Goethe C2 T1 | Mono + Q&A |
| 8 | `FEEDBACK_FOLLOWUP` | Rückmeldung geben / Zusammenfassung + Fragen sau bài của bạn | Goethe B1 T3 (16 điểm riêng!) · Goethe B2/C1 T1 (câu hỏi bắt buộc) · telc C1 T1B | TS ↔ Partner-AI trình bày |
| 9 | `DISCUSS` | Diskussion Pro–Contra | Goethe B2 T2 · C1 T2 · **C2 T2 (đấu với giám khảo)** · telc B2 T2 · telc C1 T2 | TS ↔ Partner/Prüfer |
| 10 | `PICTURE` | Bild beschreiben (+ interpretieren) | DTZ T2 · ÖSD ZA1/ZB2 | Mono + hỏi | 

MVP A1–B2 cần archetype **1–9** (bỏ 10 — chỉ dùng khi thêm DTZ/ÖSD).

**Trục leo thang độ khó A1→C2** (dùng để hiệu chỉnh prompt + kỳ vọng):
1. Vorbereitungszeit: 0′ → 15′ → 20′ (phản xạ tức thời → diễn ngôn hoạch định)
2. Chất liệu: thẻ hình/từ khóa → tờ gợi ý + Folien + Grafik → chủ đề trừu tượng + Inputtext → Zitate
3. Độc thoại: vài câu → 1–1,5′ → 3–4′ → 5′+ có chất vấn
4. Tương tác: hỏi–đáp nghi thức → thương lượng đời sống → tranh luận ngang hàng → tranh luận với giám khảo giữ lập trường ngược (C2)
5. Sprechen luôn ≈ 25% kỳ thi hoặc là modul đỗ/trượt riêng; một số đề có **ngưỡng nói riêng** (Goethe A2: 15/25 · telc B1–C1: 60% nói · DTZ: bậc nói quyết định)

---

## 2. Thiết kế tính năng

### 2.1 UX — khu "Luyện thi" trong tab Speaking

Lối vào: tab Speaking thêm card **"Phòng luyện thi nói" (Prüfungstraining)** bên cạnh hội thoại tự do. Route mới `/v2/student/speaking/exam`.

**Màn chọn:** hệ (Goethe/telc) × cấp (A1–B2) × chế độ — mặc định gợi ý từ `profile.currentLevel` + `examType` (đã có trong RoadmapSetup) và kết quả placement test nói hiện có (`user_placement_tests`).

**Ba chế độ:**
1. **Luyện từng phần (Drill)** — chọn một Teil bất kỳ, luyện lặp với đề ngẫu nhiên từ ngân hàng; feedback ngay sau mỗi lượt: điểm 0–10, sửa lỗi (CorrectionCard hiện có), gợi ý Redemittel theo dạng bài. Cho phép rút gọn/bỏ Vorbereitungszeit.
2. **Thi thử trọn gói (Mock)** — đúng trình tự các Teil, đúng timing + Vorbereitungszeit (đếm ngược server-side); AI đóng **hai vai bằng hai giọng TTS khác nhau**: *Prüfer* (điều phối, đặt câu hỏi, chuyển phần) và *Partner ảo* (trong các Teil Paarprüfung: planen, Diskussion, đặt câu hỏi sau Vortrag) — đây là chế độ **luyện cá nhân** nên AI buộc phải thế vai partner; ở tính năng B2B luyện nói đôi, AI **chỉ** là Prüfer. **Không ngắt sửa lỗi giữa chừng.** Kết thúc trả **Ergebnisbogen** mô phỏng phiếu chấm: điểm từng tiêu chí đúng rubric (mục 2.4), tổng, đạt/trượt theo ngưỡng thật (kể cả ngưỡng nói riêng A2/telc B1), transcript + bản sửa, đề xuất Teil cần luyện.
3. **Ôn yếu điểm** — đổ lỗi phát hiện được vào kho `UserGrammarError`/`ErrorReviewTask` (SRS lỗi đã có); màn này lọc lỗi theo dạng bài + gói Redemittel.

**Màn hình phòng thi:**
- *Prep screen*: đề + stimulus, notepad (ghi chú lưu vào session, hiện lại trong lúc thi — đúng luật "được dùng ghi chú"), đồng hồ đếm ngược, nút "Vào thi sớm".
- *Live screen*: stepper Teil, avatar Prüfer/Partner (đang nói → TTS), thẻ stimulus (Themenkarte/Bildkarte/lịch tuần/5 Folien/Grafik), push-to-talk (mic pipeline hiện có), transcript cuộn.
- *Result screen*: Ergebnisbogen + so sánh các lần thi trước (biểu đồ tiến bộ theo tiêu chí).

### 2.2 Ngân hàng đề & pháp lý

- **KHÔNG sao chép đề thật** Goethe/telc (nội dung đề có bản quyền). Chỉ mô phỏng **định dạng** (không bảo hộ bản quyền): tự sinh chủ đề/thẻ/tình huống "theo format" bằng LLM tier CONTENT + admin duyệt (pipeline như concept batch của Galerie và Gen-1 của PracticeNodeService). Không dùng logo/tên gây nhầm liên kết chính thức; disclaimer: *"Mô phỏng theo định dạng đề thi công khai; không liên kết với Goethe-Institut/telc; điểm chỉ mang tính tham khảo."*
- Chủ đề bám danh mục chủ đề chính thức của từng cấp (A1: Essen, Einkaufen, Wohnen, Familie, Arbeit, Freizeit…; B1/B2: chủ đề xã hội phù hợp giáo trình).
- Khối lượng MVP đề xuất: mỗi hệ × cấp × Teil **5 biến thể lúc ra mắt, mục tiêu 10** (riêng thẻ A1 T2: ≥50 thẻ — chuyển ~35 thẻ hardcode trong `SprechenTeil2Service` vào DB làm vốn ban đầu). Assets hình cho A1 T3 (Bildkarten): SVG line-art theo pipeline Galerie (vẽ-in-session, 0đ) hoặc icon curated.
- Cấu trúc dữ liệu: **exam blueprint** (điều phối) tách khỏi **task** (nội dung) — thêm hệ/cấp mới = thêm dữ liệu, không thêm code.

### 2.3 Kiến trúc backend (đề xuất)

Package mới `com.deutschflow.examspeaking` (tách khỏi `speaking` hiện có, theo pattern module `interview`):

**Bảng mới (Flyway — kiểm số hiệu V ngay trước merge, bẫy đã biết):**
- `speaking_exam_blueprints` — provider (GOETHE|TELC), level, version, `parts_json` (mảng Teil: archetype, timing giây, prep giây, vai AI, stimulus type), `rubric_json` (tiêu chí + thang + trọng số + ngưỡng)
- `speaking_exam_tasks` — provider, level, teil_no, archetype, `stimulus_json` (thẻ/chủ đề/Folien/lịch/Grafik data), asset refs, status (DRAFT/APPROVED), source (GENERATED/CURATED)
- `speaking_exam_sessions` — user, blueprint, mode (DRILL|MOCK), state (PREP/IN_PART/BETWEEN/DONE/GRADING/RESULTS/ABORTED), current_part, `notes_text` (Konzeptpapier), timestamps server-side (prep_started_at, part_started_at…)
- `speaking_exam_turns` — session, part, role (CANDIDATE/PRUEFER/PARTNER), transcript, audio ref, `turn_eval_json` (drill)
- `speaking_exam_results` — session, `criteria_json` (điểm từng tiêu chí từng Teil), total, passed, band, full corrections

**Orchestrator** `ExamSessionOrchestrator` — máy trạng thái theo blueprint (mô phỏng `InterviewOrchestrator`/`PhaseProgressionPolicy` đã có): directive từng lượt cho LLM (vai gì, nói gì tiếp, khi nào chuyển Teil), guard chống lệch vai/lệch level kiểu `InterviewSpeechSanitizer` + `LevelCalibrator`.

**Endpoints (đề xuất):**
```text
GET  /api/speaking/exam/blueprints?provider=&level=
POST /api/speaking/exam/sessions            {provider, level, mode, teil?}   ← drill chọn 1 Teil
GET  /api/speaking/exam/sessions/{id}       ← state + directive + stimulus hiện tại
POST /api/speaking/exam/sessions/{id}/turns multipart{audio} | {transcript} ← MOCK: bắt buộc audio, server STT verbose (prompt rỗng) và phát hành transcript; DRILL: cho phép transcript FE đã STT qua /api/ai-speaking/transcribe
POST /api/speaking/exam/sessions/{id}/advance   ← kết thúc prep / sang Teil kế
POST /api/speaking/exam/sessions/{id}/finish    ← chốt, enqueue chấm mock
GET  /api/speaking/exam/results?limit=          ← lịch sử
```

**Tái dùng tối đa (đã xác minh trong repo):**
| Cần | Đã có |
|---|---|
| STT | `POST /api/ai-speaking/transcribe` (GroqWhisperClient) + `useSpeakingRecorderMic` |
| TTS 2 giọng | `EdgeTtsService` làm chính (2 giọng Prüfer/Partner; ổn định, rẻ) — `SpeakingTtsPipeline` + XTTS persona là nâng cấp khi XTTS hết phụ thuộc ngrok |
| LLM | `AiChatClientFactory` (Fireworks) + admin ai-config; reasoning_effort low cho turn, cao cho eval |
| Quota | `QuotaService.assertAllowed` + `OrgPoolGuard` + `AiRateLimiterService` (bucket EVAL) — theo đúng mẫu `AiSpeakingMockExamController.requireEvalBudget` |
| Rubric chỉnh được | pattern `InterviewRubricTemplate` + admin controller |
| Chấm async | `ai/queue` (AiJob + AiJobSseRegistry) — eval mock chạy nền, FE nhận SSE, không treo UI |
| Kho lỗi/SRS | `UserGrammarError` → `ErrorReviewTask` + ReviewScheduler |
| Tín hiệu phát âm | `GroqWhisperClient.transcribeVerbose` (logprob, word timestamps) cho Flüssigkeit/intelligibility; `PronunciationScorerService` **chỉ** cho micro-task đọc-theo (cần expectedText); Gemini-audio cần mở rộng `GeminiApiClient` |
| Placement gợi ý cấp | `user_placement_tests` (đã có từ onboarding) |

### 2.4 Kiến trúc chấm điểm (bản siết chặt 19/08 — thay bản cũ sau phản biện)

**Khung: hai kiểu chấm, tách bạch theo hệ chứng chỉ.** Mỗi phiên chấm theo đúng hệ người học chọn:

| | **Kiểu 1 — theo tiêu chí Goethe** | **Kiểu 2 — theo tiêu chí telc** |
|---|---|---|
| Tiêu chí | Erfüllung der Aufgabenstellung · Kohärenz (độc thoại) / Interaktion (hội thoại) · Wortschatz · Strukturen · Aussprache (riêng A1: volle/halbe/0 theo nhiệm vụ) | A1/A2: volle/halbe/0 theo nhiệm vụ · B1/B2: Ausdrucksfähigkeit · Aufgabenbewältigung · Formale Richtigkeit · Aussprache und Intonation · C1 (sau): + Aufgabengerechtheit, Flüssigkeit, Repertoire |
| Thang | **A–E** (5 bậc) | **A–D** (4 bậc; B2 thêm cờ A* vượt cấp) |
| Phiếu kết quả | Mô phỏng Bewertungsbogen Goethe (điểm per-Teil + Aussprache chấm chung) | Mô phỏng phiếu telc (per-Teil; tiêu chí ngôn ngữ chấm chung theo cấp) |
| Ngưỡng đặc thù | A2: **≥15/25 phần nói riêng**; module đỗ ≥60 | B1: **≥45/75 phần nói** (đỗ kép với viết); nói = 25% của 300 |

Hai kiểu **dùng chung tầng tín hiệu** (đo đạc bên dưới) nhưng **khác tầng quy điểm**: mapping điểm, descriptor nguyên văn tiếng Đức của hệ trong prompt chấm, và phiếu kết quả. `rubric_json` của blueprint chứa trọn bộ tiêu chí + thang + bảng điểm + ngưỡng + luật đặc thù của hệ đó. *Tùy chọn đợt sau: "một bài nói — hai phiếu điểm" (chấm chéo cả Goethe lẫn telc từ cùng bộ tín hiệu; chỉ tốn thêm tầng quy điểm).*

**4 nguyên tắc bất di bất dịch:**
1. **Đúng tín hiệu cho đúng tiêu chí** — không bắt LLM "nghe" phát âm từ text.
2. **LLM trích bằng chứng, CODE quyết điểm** — bảng điểm, trọng số, luật (Erfüllung=E → Teil=0, ngưỡng nói riêng, làm tròn) nằm trong `rubric_json` + code tổng hợp, không nằm trong cảm tính model.
3. **Không fake độ chính xác** — tổng điểm trả dạng **khoảng + tâm** (từ độ lệch 2 pass + confidence tín hiệu); mỗi tiêu chí có nhãn tin cậy.
4. **Chấm điểm là artifact có kiểm thử** — golden set + regression harness; đổi prompt/model phải đạt lại ngưỡng đồng thuận mới được merge.

**Tầng tín hiệu (dùng chung 2 hệ):**

| Tín hiệu | Đo thế nào | Nuôi tiêu chí | Tin cậy |
|---|---|---|---|
| Checklist nội dung | LLM đánh dấu từng content-point của task (erfüllt/teilweise/nicht) + **quote nguyên văn**; code quy điểm | Goethe Erfüllung · telc Aufgabenbewältigung (vế nhiệm vụ) | Cao |
| Diễn ngôn & tương tác | Code đếm connector (dann/weil/deshalb/obwohl…) + đo latency phản hồi lượt; LLM band theo descriptor | Goethe Kohärenz/Interaktion · telc Ausdrucksfähigkeit (vế diễn ngôn) | Cao |
| Phổ từ vựng | Code profile lemma theo **wordlist Goethe có sẵn trong repo** (`backend/src/main/resources/wordlists/goethe_official_wordlist.tsv`, tài sản #352/#356) + type-token ratio; LLM đánh giá độ phù hợp chủ đề | Goethe Wortschatz (Spektrum) · telc Ausdrucksfähigkeit | Cao |
| Độ đúng ngôn ngữ | **Pass trích lỗi riêng**: LLM liệt kê lỗi nguyên văn + sửa + phân loại theo mã `ErrorCatalog.ORDERED_CODES` sẵn có; code map **mật độ lỗi/100 từ → band** theo bảng ngưỡng hiệu chuẩn từng cấp | Goethe Strukturen + Wortschatz (Beherrschung) · telc Formale Richtigkeit | Trung bình (bias STT — xem "chống thổi phồng") |
| Flüssigkeit (đo được) | Code từ `GroqWhisperClient.transcribeVerbose` (word timestamps + duration + logprob): tốc độ từ/phút, articulation rate, tỉ lệ & độ dài khoảng lặng, mean length of run, số lần lặp/false-start | Goethe B2 Kohärenz/Flüssigkeit · telc Aufgabenbewältigung (Flüssigkeit) / C1 Flüssigkeit | Cao (khách quan, tái lập được) |
| Phát âm | **3 tầng**: (1) intelligibility proxy từ avg_logprob per segment; (2) **Gemini-audio** chấm holistic clip độc thoại dài nhất 60–90s theo descriptor (Satzmelodie, Wortakzent, einzelne Laute) — cần mở rộng `GeminiApiClient` nhận audio (hiện chỉ nhận PDF/Word); (3) nâng cấp sau: **Azure Pronunciation Assessment de-DE** (chấm được lời nói tự do) nếu golden set cho thấy tầng 2 chưa đủ | Goethe Aussprache · telc Aussprache/Intonation | Trung bình → cao dần; **luôn dán nhãn tin cậy** |
| Đọc-theo (tùy chọn) | Micro-task 30s đọc to sau mock (ghi rõ là phần bổ sung của app, không có trong đề thật) → `PronunciationScorerService` chấm đúng sở trường (so với văn bản chuẩn) | Bổ trợ Aussprache | Cao trong phạm vi hẹp |

**Pipeline chấm mock (chạy nền qua AiJob, SSE báo tiến độ):**
```text
Audio từng lượt (mode mock: client gửi AUDIO — server STT verbose, prompt RỖNG, server phát hành transcript)
 → [0] Metric extractor (code thuần, 0 token): fluency, lexical profile, connectors, bản đồ logprob
 → [1] Mỗi Teil: checklist Erfüllung (LLM trích + quote)
 → [2] Mỗi Teil: trích lỗi nguyên văn + sửa + mã ErrorCatalog
 → [3] Band từng tiêu chí: LLM với descriptor NGUYÊN VĂN của hệ (Goethe hoặc telc) + few-shot neo band + metrics đính kèm; bắt buộc dẫn chứng
 → [4] Aussprache: logprob + Gemini-audio clip
 → [5] Code tổng hợp theo rubric_json: tiêu chí → Teil → tổng; áp luật E→0, ngưỡng riêng, làm tròn
 → [6] Bước [1]–[4] chạy 2 LƯỢT ĐỘC LẬP ("2 giám khảo": khác model hoặc seed/temperature) → trung bình như thi thật;
       tiêu chí nào lệch >1 band → pass 3 làm trọng tài trên bằng chứng của 2 pass
 → Ergebnisbogen: điểm + khoảng tin cậy + bằng chứng + đạt/trượt theo ngưỡng hệ
```

**Chống thổi phồng điểm ("điểm thực" = không nịnh người học):**
- Whisper có thiên hướng **chuẩn hóa lỗi của người học** → mode thi giữ STT prompt rỗng; đoạn logprob thấp bị loại khỏi đếm lỗi và hiển thị "nghe không rõ"; bảng ngưỡng lỗi hiệu chuẩn trên **cùng pipeline STT** (bias được nuốt vào calibration); UI cho xem "AI nghe được gì" để người học đối chiếu.
- Persona "giám khảo nghiêm": phân vân giữa 2 band → chọn band thấp (bù thiên hướng hào phóng của LLM; tinh chỉnh bằng golden set).
- Band độ-đúng quyết bởi **số lỗi đếm được** theo bảng ngưỡng, không bởi ấn tượng của model.
- Mock **không nhận transcript từ client** (chặn dán văn bản); drill giữ luồng nhẹ như hiện tại.

**Hiệu chuẩn — điều kiện ra mắt, không phải nice-to-have:**
- Golden set **≥20 phiên/cấp** (đợt alpha nội bộ; owner + giáo viên chấm tay đúng phiếu của hệ tương ứng), lưu làm fixture.
- Ngưỡng được ship: đồng thuận đạt/trượt **≥85%**; đúng band **≥60%**, lệch ≤1 band **≥90%** (ngang mức đồng thuận giữa 2 giám khảo người).
- Regression harness: golden set (transcript đã lưu → chạy lại rẻ) tự động chạy khi đổi prompt/model; fail = không merge.
- Drift: admin xem phân bố điểm theo tuần/cấp/Teil, cảnh báo khi trung bình lệch.

**Encode bảng điểm trong `rubric_json` (code quyết):**
- Goethe A1: volle/halbe/0 từng nhiệm vụ → 15 thô ×1,66 → /25 · Goethe A2: A–E ba nhóm → /25 + **luật ngưỡng 15/25** · Goethe B1: T1 8/4/8/8 · T2 12/4/12/12 · T3 16 · Aussprache 16 → /100 · Goethe B2: thang A–E (16/12/8/4/0 · 8/6/4/2/0 · 4/3/2/1/0), T1 44 + T2 56 → /100
- telc A1: /15 thô (bối cảnh tổng kỳ 60) · telc A2: ×1,66 → /100 · telc B1: A–D, T1 15 (4/4/4/3) + T2 30 (8/8/8/6) + T3 30 (8/8/8/6) → /75 + **luật 45/75** · telc B2: 3 Teil × 25 (7/7/7/4) → /75; **A\* quy điểm = A** (cờ chất lượng, không cộng thêm)
- Chỗ tài liệu công khai không in bảng chi tiết (vd Goethe C1 sau này): dùng thang đã công bố + chuẩn hóa về 100, ghi chú "xấp xỉ theo thang công bố" trong doc/tooltip.
- Bẫy đã biết: LLM hay bọc vỏ `{type,content}` quanh JSON — normalize ở tầng parse (bài học #370/#371).

**Trình bày kết quả (trung thực):** Ergebnisbogen theo đúng phiếu của hệ; mỗi tiêu chí: band + điểm + 1–2 quote bằng chứng + nhãn tin cậy (cao/trung bình/ước lượng); tổng dạng khoảng *"68–76, tâm 72"*; câu khung cố định: *"Điểm mô phỏng — sai số điển hình ±1 band so với giám khảo người; không phải chứng nhận."*

**Drill (giữ nhẹ, nhất quán):** 1 call: score 0–10 + tối đa 3 lỗi ưu tiên (mã ErrorCatalog → đổ SRS) + Redemittel; feedback nhắc tên tiêu chí của hệ đang luyện nhưng **không in điểm/band chính thức** — con số "chính thức" chỉ xuất hiện ở mock đã hiệu chuẩn.

**Điều kiện hạ tầng cần chốt trước Đợt 1:** `GEMINI_API_KEY` trên prod cho tầng Gemini-audio (không có → Aussprache hiển thị "chưa chấm được", không bịa số); owner xoay key Groq (nợ FW.4) + chốt tier Whisper; quyết định Azure PA chỉ sau khi golden set đo chất lượng tầng Gemini.

### 2.5 Frontend (web /v2)

- Routes: `/v2/student/speaking/exam` (catalog) · `/v2/student/speaking/exam/session/[id]` (prep → live → result).
- Components mới: `ExamTimer` (đếm ngược, đổi màu 20% cuối), `TeilStepper`, `StimulusCard` (variant: Themenkarte / Bildkarte / Wochenkalender / FolienDeck / MiniGrafik SVG), `ExamNotepad`, `Ergebnisbogen`.
- Tái dùng: `useSpeakingRecorderMic`, `VoiceVisualizer`, `CorrectionCard`, `SessionSummary`, quota hook `useAiSpeakingQuota`.
- i18n: namespace mới trong `messages/v2/student.{vi,en,de}.json` — **đủ 3 locale ngay từ đầu** (bẫy parity checker mù khi thiếu cả 3).
- E2E Playwright: luồng drill A1 T2 + mock A1 rút gọn; **không `waitForTimeout`** — chờ `role="status"`/deterministic (bẫy đã biết); JWT mint lúc chạy như bộ e2e hiện có.

### 2.6 Quota, chi phí & gói

- Ước tính token/phiên (Fireworks): drill 1 lượt ≈ 1,5–3k; mock A1 ≈ 20–30k; mock B1/B2 ≈ **50–80k** (hội thoại + chấm 2 pass nhiều call + audio-eval). Charge theo estimate từng phần (mẫu `MOCK_EVAL_ESTIMATED_TOKENS`), refund phần không dùng theo cơ chế OrgReservation hiện có; cân nhắc đóng gói giá theo "lượt thi thử" cho dễ hiểu với người dùng.
- Gợi ý gói: FREE = drill giới hạn/ngày (FreeTierGuard) + 1 mock/tuần; PRO/org = theo quota 2 kênh token hiện hành. Mock đầy đủ là điểm bán tự nhiên cho PRO.
- TTS: ưu tiên EdgeTts cho câu ngắn của Prüfer để giảm tải XTTS (ngrok ephemeral là điểm yếu vận hành đã biết).

### 2.7 Admin & vận hành

- Admin CRUD ngân hàng đề + duyệt đề generate (theo mẫu InterviewAdminController / weekly-speaking admin): hàng đợi DRAFT → APPROVED, preview stimulus, thống kê lượt dùng & điểm trung bình từng task (phát hiện đề quá khó/dễ).
- Model routing qua `/api/admin/ai-config` hiện có; log usage vào AiUsageLedger.

### 2.8 Chỉ số thành công (đo sau khi ship)

1. Tỉ lệ hoàn thành mock (bắt đầu → nhận Ergebnisbogen) ≥ 70%
2. Người dùng quay lại drill ≥ 2 phiên/tuần
3. Điểm trung bình từng tiêu chí tăng theo thời gian (proxy hiệu quả học)
4. Chuyển đổi FREE→PRO từ paywall mock
5. Chi phí token/phiên nằm trong ước tính ±30%

### 2.9 Ranh giới với tính năng B2B "Luyện nói đôi" (tách riêng 19/08)

Luyện nói đôi (học viên cùng lớp luyện với nhau, AI làm Prüfer và chấm cả hai) là **tính năng riêng dành cho B2B**, chỉ dùng chung khu Speaking trên UI; module, bảng, API, quyền và lộ trình tách khỏi mảng này — xem `plans/2026-08-19-luyen-noi-doi-b2b.md`. Mảng luyện thi chỉ cần **giữ 3 contract public & ổn định** để tính năng đó cắm vào: `ExamBlueprintCatalog` (đọc định nghĩa Teil), `ExamGradingService.grade(participantBundle, rubricRef)` (chấm **một** người theo kiểu Goethe/telc, nhận ngữ cảnh partner), `PrueferScriptService` (lời dẫn + TTS giám khảo). Thiết kế các service này từ Đợt 0 với interface rõ, không để logic chấm dính vào controller.

---

## 3. Lộ trình triển khai theo đợt

| Đợt | Nội dung | Ghi chú |
|---|---|---|
| **Đợt 0 — Nền móng backend** | Migration 5 bảng + blueprint schema + `ExamSessionOrchestrator` + endpoints + charge quota + **metric extractor** (fluency/lexical từ transcribeVerbose + wordlist) + encode đủ `rubric_json` **cả 2 hệ** A1–B2 + seed **Goethe A1 đủ 3 Teile** (chuyển 35 thẻ hardcode vào DB, thêm Bildkarten T3) + **công bố 3 interface public** cho tính năng B2B nói đôi (`ExamBlueprintCatalog`, `ExamGradingService.grade` một người có ngữ cảnh partner, `PrueferScriptService`) — A1 T2/T3 đã là bài đôi | Xong khi: IT xanh, unit test mapping bảng điểm 2 hệ xanh, curl trọn phiên drill + mock A1 text-only; 3 interface có stub để B2B xây song song |
| **Đợt 1 — Phòng thi web A1** | UI catalog + prep/live/result; drill + mock cho **Goethe A1 + telc A1** (≈90% chung format); Ergebnisbogen theo phiếu từng hệ; i18n 3 locale; e2e; đo latency SLO | Ship user-facing đầu tiên. **Gate ra mắt public: golden set A1 ≥20 phiên chấm tay đạt ngưỡng đồng thuận (đạt/trượt ≥85%, ±1 band ≥90%)** |
| **Đợt 2 — A2** | Archetype `ABOUT_ME` + `PLAN_NEGOTIATE` (lịch tuần A≠B) + telc A2 `CARD_QA` biến thể; **ngưỡng nói riêng Goethe A2**; ngân hàng đề A2 | |
| **Đợt 3 — B1** | `PRESENT` (5 Folien UI) + `FEEDBACK_FOLLOWUP` + `TOPIC_EXCHANGE` (Grafik SVG); Vorbereitungszeit 15–20′ + notepad; Goethe B1 + telc B1 (ZD); rubric 100/75 điểm đầy đủ | Đợt nặng nhất — B1 là thị trường chính (Ausbildung) |
| **Đợt 4 — B2** | Goethe B2 (Vortrag 2-chọn-1 + Diskussion) + telc B2 (Präsentation 90″ + Diskussion + Problemlösung); partner-AI chất vấn sau Vortrag | |
| **Đợt 5 — Ôn yếu điểm + mobile** | Màn ôn yếu điểm (SRS lỗi + Redemittel packs); parity mobile Expo — dùng chung bộ primitive đa nền tảng định nghĩa ở doc B2B §11 (typed client từ OpenAPI, snapshot + event `seq/since`, capabilities handshake, `expo-keep-awake`, audio unlock/audio session) để phòng thi cá nhân trên web và app hành xử giống nhau; admin dashboard đề | |
| **Đợt 6 — Hậu MVP** | C1 (Goethe 2024 + telc C1/HS), C2 GDS (đấu với giám khảo), DTZ (`PICTURE`), biến thể Pflege/DTB, ÖSD/telefonat, chế độ "TestDaF-style" | Theo nhu cầu thực tế |

### Trạng thái thi công — Đợt 0 (22/08/2026)

**✅ Đợt 0 thi công xong trên nhánh `feat/exam-speaking-d0` (worktree `DeutschFlow-examspeaking`, base `7a02a2e3`) — chờ PR/merge.** Đã có:

- Migration `V277__exam_speaking_foundation.sql`: 5 bảng (`speaking_exam_blueprints/tasks/sessions/turns/results`) + seed **8 blueprint** (Goethe & telc A1–B2; rubric 2 hệ tách bạch, chỗ nội suy ghi `approximation`) + **ngân hàng đề A1** (6 thẻ T1, 50 Themenkarte T2 — chuyển từ hardcode `SprechenTeil2Service`, 24 Bildkarte T3 dạng `iconKey`). 🪤 Dollar-quote `$j${` bị Flyway hiểu là placeholder → phải có khoảng trắng; cột INT (Hibernate validate không nhận SMALLINT).
- Module `com.deutschflow.examspeaking` (~40 file): **3 contract public** cho B2B (`api/ExamBlueprintCatalog`, `api/ExamGradingService.grade(userId, ParticipantBundle, RubricRef)`, `api/PrueferScriptService`) + model bất biến (`ExamBlueprint`, `RubricDefinition`, `ParticipantBundle`, `Ergebnisbogen`, `Utterance`).
- **Chấm điểm 2.4**: `metrics/` (Flüssigkeit từ word-timestamps, profile theo `wordlists/goethe_official_wordlist.tsv`, connector/subordinator), `scoring/` (`RubricScorer` — code quyết điểm, ×1,66 half-up, E→Teil 0, ngưỡng nói riêng, tiêu chí không tín hiệu loại khỏi tử+mẫu; `ScoreAggregator` 2 pass + trọng tài; `ErrorDensityBandMapper`, `FluencyBandMapper`, `IntelligibilityBandMapper`; `DefaultExamGradingService` pipeline [0]–[6]; `LlmJson` bóc vỏ `{type,content}`).
- **Phiên**: `session/` (`ExamSessionOrchestrator` kịch bản bước theo 5 flow; `ExamSessionService` drill/mock, quota 3 lớp, STT verbose cho audio, tự chuyển Teil, finish → AiJob `EXAM_MOCK_GRADING`; `AiInterlocutorService` Prüfer/Partner tier CHAT_PAID + chấm nhanh drill tier GRADING_DAILY; `DefaultPrueferScriptService` lời dẫn theo mẫu; `ExamGradingJobHandler`). `AiJobWorker` thêm registry `AiJobHandler` (module mới không sửa switch).
- API `/api/speaking/exam/**` (`ExamSpeakingController`): blueprints · sessions (POST/GET) · turns (JSON text cho drill; multipart audio cho mock — server phiên âm) · advance · finish · notes · result · results. Tiến độ chấm: client subscribe `GET /api/jobs/{gradingJobId}/sse` (hạ tầng có sẵn).
- Cấu hình `app.examspeaking.*` (`allow-text-turns-in-mock` CHỈ dev/test; `grading-passes` mặc định 2).
- Test: 20 unit (mapping điểm 2 hệ đúng từng số: Goethe A1 ×1,66, B1 28/40/16/16, A2 ngưỡng 15/25, telc B1 bandPoints + 45/75; pipeline chấm với LLM giả; extractor; orchestrator; codec) + IT `ExamSessionFlowIntegrationTest` 4 test (seed; drill A1 T2 trọn 4 lượt; mock A1 text-only 3 Teil → job → kết quả 23/25; thiếu đề → 409). Toàn bộ backend **2083 test xanh**.

**Chưa làm trong Đợt 0 (đúng phạm vi):** UI web (Đợt 1); asset hình Bildkarte (mới có `iconKey`); đường audio mock chưa có IT với file thật (QA tay ở Đợt 1); golden set; Aussprache tầng 2 (Gemini-audio).

Mỗi đợt theo quy trình repo: worktree sạch từ `origin/main` → IT (`DEUTSCHFLOW_IT_REQUIRE_DB=true`) + e2e → PR → merge → `./deploy-backend.sh` tay (job Deploy CI đang `if:false`) → QA prod → cập nhật doc này.

## 4. Rủi ro & biện pháp

| Rủi ro | Biện pháp |
|---|---|
| Bản quyền đề thật | Chỉ mô phỏng format, tự sinh nội dung, disclaimer không liên kết; không dùng logo/tên gây nhầm |
| Aussprache không chấm được từ transcript; `PronunciationScorerService` chỉ hợp bài đọc-theo (cần expectedText) | 3 tầng: logprob proxy + Gemini-audio clip + (nâng cấp) Azure Pronunciation Assessment; nhãn tin cậy; thiếu tín hiệu thì ghi "chưa chấm được" chứ không bịa số |
| **Whisper chuẩn hóa lỗi người học → điểm thổi phồng hệ thống** | STT prompt rỗng ở mode thi; loại đoạn logprob thấp khỏi đếm lỗi; ngưỡng lỗi hiệu chuẩn trên cùng pipeline; hiển thị "AI nghe được gì"; golden set đo bias |
| Điểm không nhất quán giữa các lần chấm / LLM chấm hào phóng | 2 pass giám khảo độc lập + trọng tài khi lệch >1 band; band quyết bởi số lỗi đếm được; persona nghiêm; regression golden set |
| Mock: transcript do client gửi → dán văn bản được | Mode mock: client gửi audio, server tự STT và phát hành transcript |
| Độ trễ mỗi lượt (STT+LLM+TTS có thể 8–12s) phá cảm giác phòng thi | SLO <5s ra âm đầu tiên; stream TTS theo câu; câu đệm của Prüfer ("Mhm, verstehe…"); đo từ Đợt 1 |
| Phụ thuộc Groq Whisper trong khi key Groq từng lộ chưa xoay (FW.4) | Owner xoay key + chốt tier Whisper trước Đợt 1; cấu hình STT dự phòng (Fireworks transcription) |
| SSE phòng thi ghim connection DB (bài học OSIV 09/07) | Handler SSE ngoài transaction; fan-out qua Redis như NotificationSseBroadcaster |
| Eval mock dài → treo UI / timeout | Chạy nền qua AiJob queue + SSE; FE hiển thị "đang chấm" |
| Chi phí token phiên mock lớn | Charge theo estimate từng phần + trần FREE (FreeTierGuard); đo ledger từ Đợt 1 |
| LLM bọc vỏ `{type,content}` quanh JSON | Normalize ở parser (bài học #370/#371) |
| Partner-AI lộ vai / lệch level | Guard kiểu InterviewSpeechSanitizer + LevelCalibrator; QA prompt theo cấp |
| Latency TTS (XTTS ngrok) | EdgeTts cho câu ngắn; stream theo câu (GermanSentenceSplitter có sẵn) |
| i18n thiếu locale → checker mù | Thêm key đủ 3 locale trong cùng PR |
| Trùng số Flyway | Kiểm `V###` ngay trước merge |

## 4b. Việc còn lại từ phản biện 19/08 (ngoài phần chấm điểm — đưa vào đợt tương ứng)

- Mock mặc định **"prep rút gọn 5′"** + toggle "chuẩn thi thật 15–20′"; autosave/resume phiên bỏ dở; hoàn quota đã đặt chỗ khi ABORT.
- **Goethe B1 T3 là bài đảo vai**: partner-AI phải trình bày Präsentation TRƯỚC để người học cho Rückmeldung → dùng bài trình bày **soạn sẵn theo task** (cài vài lỗi chủ ý đúng trình độ), không sinh sống; partner nói tối đa ~2 câu/lượt ở A2–B1 (LevelCalibrator).
- Ngân hàng đề: seed **5 biến thể/Teil** lúc ra mắt (thay vì 10) + auto-QA bằng LLM checklist trước hàng đợi owner duyệt (tránh nút cổ chai như Galerie).
- Audio người học: retention 30 ngày (S3 lifecycle) + toggle "không lưu audio" + cập nhật privacy policy (gộp nợ X.4 đang KHẨN).
- TTS: MVP chốt **EdgeTTS làm chính** (XTTS qua ngrok không ổn định), XTTS là nâng cấp; xác nhận 2 giọng Prüfer/Partner phân biệt rõ.
- Diễn đạt lại lời dẫn 5 Folien bằng từ ngữ riêng (không chép nguyên văn tài liệu); feedback theo **locale người dùng** (vi/en/de) thay vì hardcode tiếng Việt; ghi chú trung thực: Goethe/telc A1 thật là thi nhóm ≤4 người — app mô phỏng 1-kèm-1.

## 5. Phụ lục — nguồn chính thức đã đối chiếu (08/2026)

- Goethe Durchführungsbestimmungen (Stand 01.09.2025) A1–C2 + Modellsätze + Handbuch C1 2024: goethe.de/pro/relaunch/prf/… (A1 `…Durchfuehrungsbestimmungen_A1_Start_Deutsch_1.pdf`, A2, B1, B2, C1, `C2_neu.pdf`); bfu.goethe.de (phiếu chấm B1/A2/B2)
- telc Übungstests A1/A2/B1(ZD)/B2 + C1 Hochschule Tipps (telc.net)
- DTZ: Übungssatz 1 + DTZ-Handbuch (gast.de, bamf.de)
- ÖSD Modellsätze ZA1–ZC2 (osd.at)
- TestDaF papierbasiert + digital (testdaf.de); DSH: dsh-fadaf.de + trang các trường
- Điểm chưa xác minh được (⚠️): phân bổ điểm chi tiết từng tiêu chí Goethe C1 trên Bewertungsbogen; chia 44/56 của Goethe B2 lấy từ Lehrerhandbuch Klett (khớp thang phiếu chấm chính thức); ngưỡng nói riêng telc A2; chi tiết Teil của telc Pflege/DTB từ nguồn thứ cấp.
