# Tổng hợp & đánh giá cuối — Mảng "Luyện thi Nói" + Tính năng B2B "Luyện nói đôi"

- **Ngày:** 2026-08-19 · **Trạng thái:** hai kế hoạch đã chốt ở mức thiết kế, **chưa code**
- **Doc chi tiết:** (1) `plans/2026-08-19-ke-hoach-luyen-thi-noi.md` — mảng luyện thi nói cá nhân (engine); (2) `plans/2026-08-19-luyen-noi-doi-b2b.md` — tính năng B2B luyện nói đôi. Bản này là lớp tổng hợp + đánh giá; khi mâu thuẫn, doc chi tiết là nguồn chuẩn.

---

## 1. Bức tranh tổng thể

```text
                    KHU SPEAKING (UI chung duy nhất)
   ┌───────────────────────────────┐     ┌──────────────────────────────────────┐
   │ (1) LUYỆN THI NÓI — cá nhân    │     │ (2) LUYỆN NÓI ĐÔI — B2B (lớp/org)    │
   │ FREE/PRO/org · web → mobile    │     │ chỉ org + lớp · web + mobile từ P0   │
   │ AI = Prüfer + Partner ảo       │     │ AI = Prüfer DUY NHẤT · partner = HV  │
   │ Drill / Mock / Ôn yếu điểm     │     │ GV giao bài theo cặp · GV xem/nghe   │
   │ module examspeaking            │     │ module pairspeaking                  │
   └──────────────┬────────────────┘     └──────────────────┬───────────────────┘
                  │ cung cấp 3 contract public (read/call)    │ tiêu thụ, không share bảng
                  │  ExamBlueprintCatalog · ExamGradingService.grade(1 người) · PrueferScriptService
                  └───────────────────────────────────────────┘
   Phụ thuộc MỘT CHIỀU: (2) cần (1) xong Đợt 0 (interface) + qua gate hiệu chuẩn (kết quả thật). (1) không cần (2).
```

**Quyết định nền (đã chốt với owner 19/08):** Goethe + telc từ đầu · MVP A1–B2 (phân tích đủ A1–C2) · đặt trong tab Speaking · chấm 2 chế độ Drill/Mock **theo 2 bộ tiêu chí tách bạch** Goethe (A–E) / telc (A–D) · nói đôi là tính năng B2B riêng · AI chỉ giám khảo trong nói đôi · giáo viên giao bài theo cặp + xem · web ↔ mobile tương tác chéo từ P0.

---

## 2. Kế hoạch (1) — Luyện thi Nói: tóm tắt

| Khía cạnh | Nội dung chốt |
|---|---|
| Phân tích đề | Ma trận Sprechen A1–C2 của Goethe (Stand 09/2025), telc, DTZ, ÖSD, TestDaF, DSH đã đối chiếu nguồn chính thức; các ngưỡng "bẫy": Goethe A2 nói ≥15/25, telc B1 nói ≥45/75, Goethe B1 28/40/16+Aussprache 16, B2 44/56, A1 volle/halbe/0 ×1,66 |
| Insight engine | ~23 Teil quy về **10 archetype**; đề = data (`blueprint` + `task bank`), thêm hệ/cấp = thêm dữ liệu. MVP cần archetype 1–9 |
| UX | Card "Phòng luyện thi nói" → chọn hệ × cấp × chế độ; Drill (feedback nhanh, không in điểm chính thức) · Mock (đúng trình tự, đồng hồ server, prep rút gọn 5′ mặc định, AI hai vai hai giọng, Ergebnisbogen) · Ôn yếu điểm (SRS lỗi sẵn có) |
| Backend | Module `examspeaking`, 5 bảng, `ExamSessionOrchestrator` theo mẫu module `interview`; tái dùng STT Whisper verbose, EdgeTts, AiChatClientFactory, quota 3 lớp, AiJob queue + SSE, kho lỗi SRS |
| Chấm điểm | "LLM trích bằng chứng — CODE quyết điểm"; tầng tín hiệu chung (checklist nội dung, connector, profile wordlist Goethe trong repo, trích lỗi theo `ErrorCatalog` → mật độ/100 từ, Flüssigkeit đo từ word-timestamps, Aussprache 3 tầng có nhãn tin cậy); 2 pass "giám khảo" + trọng tài; chống thổi phồng (STT prompt rỗng, mock chỉ nhận audio, persona nghiêm); kết quả dạng khoảng + tâm; **golden set ≥20 phiên/cấp là gate ra mắt** (đạt/trượt ≥85%, ±1 band ≥90%) + regression harness |
| Pháp lý | Mô phỏng format (không bảo hộ), tự sinh nội dung + admin duyệt, không sao chép đề/logo, disclaimer không liên kết, điểm tham khảo |
| Lộ trình | Đ0 nền móng + seed Goethe A1 + **công bố 3 interface** → Đ1 phòng thi web A1 (Goethe+telc) + gate golden set → Đ2 A2 → Đ3 B1 (nặng nhất) → Đ4 B2 → Đ5 ôn yếu điểm + mobile → Đ6 C1/C2, DTZ/ÖSD/Pflege |
| Chi phí | Drill 1,5–3k token/lượt; mock A1 20–30k; mock B1/B2 50–80k (2 pass chấm); charge theo estimate từng phần; mock = điểm bán PRO |
| KPI | Hoàn thành mock ≥70%; drill ≥2 phiên/tuần; điểm tiêu chí tăng theo thời gian; chuyển đổi FREE→PRO; chi phí ±30% ước tính |

## 3. Kế hoạch (2) — Luyện nói đôi B2B: tóm tắt

| Khía cạnh | Nội dung chốt |
|---|---|
| Định vị | Công cụ lớp học: học viên cùng lớp luyện như phòng thi thật; chỉ org (feature flag + ghế `org_members` + thành viên lớp); token kênh trung tâm; KPI B2B riêng |
| Vai | **AI = Prüfer duy nhất** (đọc đề, bấm giờ, hỏi từng người, chấm). Partner luôn là người. Độc thoại chạy lần lượt A rồi B; hội thoại chung hai mic |
| Giáo viên (P0) | Giao bài về nhà theo cặp (xếp tay/tự động, hạn), bảng cặp × trạng thái, xem 2 Ergebnisbogen cạnh nhau + transcript + nghe lại audio từng người, nhắc hạn, gia hạn/đổi cặp; lớp lẻ người → bộ ba (P3) hoặc bài thứ hai — không ghép AI |
| Kiến trúc | 3 mặt phẳng: Control (REST + SSE ticket + Redis pub/sub — **không WebSocket**, `/ws` đang bị chặn) · Media (LiveKit Cloud, backend chỉ ký JWT phòng; đường lùi LiveKit OSS cùng SDK) · Recording/grading (LiveKit **track egress** từng người → S3 là đường chuẩn mọi nền tảng; web chunk chỉ là fallback) |
| Mất kết nối | Grace 60–90s → SUSPENDED nối lại trong hạn bài → INCOMPLETE chấm partial. Không AI thay vai |
| Đa nền tảng | Một API/state machine/event schema; snapshot + `seq/since` replay; capabilities handshake (426 khi app cũ); mobile SSE qua `react-native-sse` + polling; push Expo + deep link chung; LiveKit RN = native build EAS; cặp hỗn hợp web↔mobile là nghiệm thu bắt buộc |
| Lộ trình | P0 bài về nhà theo cặp (web + app, GV web) → P1 tự mời + `LOCAL` 2-người-1-máy → P2 override band/lịch/thống kê/GV nghe trực tiếp → P3 phòng 3 ghế + GV trên app |
| Chi phí | Hội thoại 0 token; 2× STT + 2× chấm (~30–50k token/phiên) + phí media & egress theo phút (chưa tra giá) |

---

## 4. Quan hệ & thứ tự thi công

```text
(1) Đ0 ──► Đ1 (gate golden set A1) ──► Đ2 (A2) ──► Đ3 (B1) ──► Đ4 (B2) ──► Đ5 ──► Đ6
     │ công bố 3 interface (stub)          ▲ kết quả "thật" cho nói đôi cấp A1/A2 cần qua gate này
     ▼                                     │
(2) P0 xây song song: lobby · giao bài · LiveKit · egress · SSE · mobile native ─► bật chấm thật ─► P1 ─► P2 ─► P3
```

- (1) không bao giờ bị (2) chặn. (2) bị (1) chặn đúng hai điểm: **interface ở Đ0** và **gate hiệu chuẩn ở Đ1** (cho cấp tương ứng).
- Đề xuất bắt đầu: **Đ0 ngay** (không chờ quyết định nào của owner ngoài xoay key Groq chạy song song); owner dùng thời gian Đ0 để (a) gom người chấm golden set, (b) chốt vendor media + consent cho P0.

---

## 5. Đánh giá cuối

### 5.1 Điểm mạnh (đã kiểm chứng trong repo/nguồn)

1. **Đúng bản chất kỳ thi**: ma trận đề lấy từ Durchführungsbestimmungen/Modellsätze chính thức; 10 archetype phủ trọn; nói đôi tái tạo đúng Paarprüfung (partner là người cùng cấp, giám khảo điều phối).
2. **Tái dùng thật, không hứa suông**: STT verbose + word-timestamps, EdgeTts, quota 3 lớp, AiJob + SSE ticket + Redis pub/sub, kho lỗi SRS, wordlist Goethe, `ErrorCatalog`, module `interview` làm mẫu orchestrator/rubric — đều đã xác minh bằng đường dẫn file.
3. **Chấm điểm có kỷ luật**: code quyết điểm, 2 pass giám khảo, golden set là gate, khoảng tin cậy — đây là điểm khác biệt so với "LLM chấm một phát" và là thứ bảo vệ uy tín sản phẩm.
4. **Ranh giới sạch**: hai module, hai bộ bảng, hai lộ trình, ba contract; thêm hệ/cấp mới là thêm dữ liệu.
5. **Đa nền tảng có cơ chế, không chỉ tuyên bố**: snapshot/replay, capabilities handshake, egress chung một đồng hồ.

### 5.2 Rủi ro còn lại (gộp cả hai, xếp hạng)

| # | Rủi ro | Mức | Biện pháp đã ghi | Còn mở |
|---|---|---|---|---|
| 1 | Whisper "sửa hộ" lỗi người học → điểm thổi phồng | 🔴 | STT prompt rỗng, loại đoạn logprob thấp, hiệu chuẩn cùng pipeline, hiển thị "AI nghe được gì" | **Độ lớn bias chỉ biết sau golden set A1** — nếu quá lớn phải cân nhắc chấm từ audio (multimodal) sớm hơn |
| 2 | Aussprache không đo được từ transcript; `PronunciationScorerService` chỉ hợp đọc-theo; `GeminiApiClient` chưa nhận audio | 🔴 | 3 tầng + nhãn tin cậy + "chưa chấm được" thay vì bịa; micro-task đọc-theo tùy chọn | Cần mở rộng Gemini client (spike) hoặc Azure PA; cần `GEMINI_API_KEY` prod |
| 3 | Golden set cần người chấm tay (owner + giáo viên) — nguồn lực con người, không phải code | 🟠 | Thu qua alpha nội bộ; phiên đôi có giáo viên nghe lại nuôi liên tục | Chưa có cam kết ai chấm, bao giờ |
| 4 | Độ trễ lượt trong mock cá nhân (STT+LLM+TTS) | 🟠 | SLO <5s, stream theo câu, câu đệm Prüfer, đo từ Đ1 | Chưa đo thực tế |
| 5 | Phụ thuộc Groq Whisper + key từng lộ chưa xoay (FW.4) | 🟠 | Xoay key + chốt tier trước Đ1; STT dự phòng | Owner chưa xoay |
| 6 | Vendor media (LiveKit) — giá, vùng, egress/phút chưa tra | 🟠 | Kiến trúc cho phép đổi sang OSS cùng SDK; web có chunk fallback | **Chưa có số** |
| 7 | `expo-audio` + LiveKit RN chung audio session iOS; `react-native-sse` trên SDK 54 | 🟠 | Spike đầu P0; dự phòng Prüfer bot participant; polling fallback | Chưa spike |
| 8 | Bản quyền/nhãn hiệu Goethe–telc | 🟡 | Chỉ format, tự sinh nội dung, disclaimer, không logo | Nên có rà soát pháp lý ngắn trước marketing |
| 9 | Nút cổ chai duyệt đề (bài học Galerie) | 🟡 | Seed 5/Teil + auto-QA LLM trước hàng đợi duyệt | Owner bandwidth |
| 10 | Privacy: ghi âm học viên, giáo viên nghe lại, vị thành niên | 🟡 | Consent bắt buộc, retention 30 ngày, chỉ cùng lớp, nút báo cáo, gộp nợ privacy X.4 | Văn bản consent/privacy chưa viết |

### 5.3 Độ chín từng phần

| Phần | Trạng thái | Điều kiện để bắt đầu code |
|---|---|---|
| (1) Đ0 nền móng engine | **Sẵn sàng code** | Không chờ gì; xoay key Groq chạy song song |
| (1) Chấm điểm — tầng transcript/metrics/2-pass | **Sẵn sàng code** | Thiết kế đủ chi tiết; bảng ngưỡng lỗi sẽ tinh chỉnh bằng golden set |
| (1) Chấm điểm — Aussprache tầng 2/3 | **Cần spike** | Mở rộng Gemini client nhận audio; Azure PA quyết sau golden set |
| (1) Golden set A1 | **Cần owner** | Người chấm tay + lịch alpha nội bộ |
| (1) Đ1 phòng thi web A1 | Sẵn sàng sau Đ0 | — |
| (2) Contract 3 interface | Sẵn sàng (trong Đ0) | — |
| (2) P0 giao bài + GV xem + lobby | **Sẵn sàng code** (hạ tầng lớp/bài tập/push có sẵn) | Sau khi Đ0 công bố interface (stub đủ) |
| (2) P0 media + egress | **Cần owner quyết** | Vendor, vùng, giá; tài khoản LiveKit |
| (2) P0 mobile | **Cần spike + native build** | Audio session iOS, `react-native-sse`; xác nhận `scheme` deep link; build EAS (nợ Xcode cục bộ) |
| (2) Consent/privacy | **Cần owner** | Văn bản đồng ý ghi âm (ghi rõ giáo viên nghe lại) |

### 5.4 Nhất quán giữa hai doc — đã rà và sửa lần cuối (19/08)

- `POST …/turns` của engine giờ ghi rõ: **mock bắt buộc gửi audio** (server STT, phát hành transcript); drill mới cho transcript — khớp mục chấm điểm.
- Bảng tái dùng của engine bỏ tuyên bố quá lạc quan về `PronunciationScorerService`/phoneme; TTS chốt EdgeTts làm chính.
- Trạng thái session có thêm GRADING/RESULTS; mock cá nhân ghi rõ lý do AI thế vai partner (khác B2B).
- Doc B2B: bỏ hết tên cũ `PAIR_LOCAL`/"Bước 2", đổi tên service trong sơ đồ sang `PairSessionOrchestrator`/`PairRoomEventBroadcaster`, sơ đồ ghi đúng "egress là đường chuẩn, web chunk là fallback", đánh số lại §0.
- Đ5 của engine tham chiếu bộ primitive đa nền tảng của doc B2B §11 để phòng thi cá nhân trên app hành xử giống web.

---

## 6. Quyết định owner còn nợ (gộp)

| # | Quyết định | Cần trước | Ảnh hưởng nếu chậm |
|---|---|---|---|
| 1 | Xoay key Groq (FW.4) + chốt tier Whisper | Đ1 | Mock nhân ×15–25 call STT/phiên trên key đã lộ |
| 2 | `GEMINI_API_KEY` prod có/không | Đ1 | Không có → Aussprache "chưa chấm được" (chấp nhận được nhưng phiếu thiếu một tiêu chí) |
| 3 | Người chấm golden set (owner + ≥1 giáo viên) + lịch alpha | Đ1 | **Không có thì không mở public** — đây là gate |
| 4 | Vendor media (khuyến nghị LiveKit Cloud) + vùng + bảng giá + egress | P0 | P0 không bắt đầu phần media được |
| 5 | Văn bản consent ghi âm + privacy (gộp X.4), ghi rõ giáo viên nghe lại | P0 | Không ghi âm → không chấm |
| 6 | Gói org nào có tính năng nói đôi; hạn mức phiên/tháng | P0 | Feature flag cần giá trị |
| 7 | Lớp lẻ người xử lý thế nào trước P3 (bộ ba) | P0 | UI giao bài cần luật |
| 8 | Có cho "luyện không chấm" (không ghi âm) không | P0 | Ảnh hưởng consent & UX |
| 9 | Azure Pronunciation Assessment — chỉ quyết sau golden set | Đ2+ | Không chặn |
| 10 | Rà soát pháp lý ngắn về nhãn hiệu Goethe/telc trong UI/marketing | Trước ra mắt | Không chặn code |

---

## 7. Khối lượng tương đối & đề xuất bắt đầu

| Hạng mục | Cỡ | Ghi chú |
|---|---|---|
| (1) Đ0 | L | 5 bảng, orchestrator, metric extractor, rubric 2 hệ A1–B2 + unit test, seed A1, 3 interface |
| (1) Đ1 | L | UI phòng thi web + Ergebnisbogen 2 hệ + e2e + golden set |
| (1) Đ2 | M | A2 + ngưỡng nói riêng |
| (1) Đ3 | XL | B1: 5 Folien, Grafik, prep 15–20′, rubric 100/75 |
| (1) Đ4 | L | B2 hai hệ |
| (1) Đ5 | L | ôn yếu điểm + mobile |
| (2) P0 | XL | giao bài + GV xem + LiveKit + egress + SSE/polling + mobile native + QA chéo |
| (2) P1 / P2 / P3 | M / M / M | |

**Bắt đầu:** Đ0 của engine. Điều kiện đủ: worktree sạch từ `origin/main`, kiểm số Flyway trước merge, 3 interface có stub, IT `DEUTSCHFLOW_IT_REQUIRE_DB=true` xanh. Song song: owner xử lý mục 6 (#1–#5).

## 8. Chỉ số thành công gộp

- Engine: hoàn thành mock ≥70%, drill ≥2 phiên/tuần, điểm tiêu chí tăng theo thời gian, chuyển đổi FREE→PRO, đồng thuận với giám khảo người (đạt/trượt ≥85%, ±1 band ≥90%) **đo định kỳ, không chỉ lúc ra mắt**.
- B2B: % lớp kích hoạt nói đôi, phiên đôi/lớp/tuần, % cặp nộp đúng hạn, % giáo viên xem kết quả/nghe lại, tỉ lệ phiên SUSPENDED/INCOMPLETE, NPS giáo viên.
