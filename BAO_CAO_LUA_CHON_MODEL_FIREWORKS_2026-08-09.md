# BÁO CÁO CHỌN MODEL THEO CHỨC NĂNG — THỜI KỲ FIREWORKS (BỎ OPENROUTER)

**Ngày:** 2026-08-09 · **Trạng thái: ✅ ĐÃ CHỐT — owner duyệt trọn 7 khuyến nghị 09/08 (quyết định #7–#13, ghi tại `plans/2026-08-07-ke-hoach-khung-ai-tier.md`)** · **Thay thế phần ma trận model của:** `BAO_CAO_PHAN_TICH_MODEL_NOI_2026-08-06.md` (mục 6) · **Bối cảnh:** đã flip Fireworks 09/08 (#310, #311), quyết định owner bỏ OpenRouter ⇒ đường Haiku/Sonnet/Gemini/Cerebras trong kế hoạch cũ ĐÓNG.

**7 quyết định đã chốt:** (7) chấm = hướng 3, F1 calibration 120b vs V4 Flash/Qwen 3.7 Plus/K2.6 rồi mới flip · (8) ERROR_VERIFY = DeepSeek V4 Flash · (9) CONTENT = Kimi K2.6 ngay, regen P5 = Kimi K3, verifier H = V4 Flash · (10) CHAT_PAID = 120b có điều kiện TTFT stream <1,5s · (11) STT đo D1.3 rồi quyết, ≤1% đóng mục D · (12) BATCH + weekly → Batch API −50%, ticket riêng sau FW sạch · (13) placement chưa tách, chờ số F1. Mọi "đề xuất/khuyến nghị" bên dưới đọc là **quyết định đã duyệt**.

---

## 1. Cái gì đã đổi so với báo cáo 06/08 (và làm lệch mọi kết luận cũ)

| Giả định cũ (06/08) | Thực tế sau flip (09/08) | Hệ quả cho việc chọn model |
|---|---|---|
| Groq free tier, trần 8.000 TPM theo "đặt chỗ" | Fireworks postpaid, **không trần TPM kiểu Groq** | Mục 4 báo cáo cũ (thu hồi TPM) hết là ưu tiên số 1; nút cổ chai mới là semaphore của mình + **credit cạn khi Auto Reload OFF** (FW.3) |
| Groq **không có prompt caching** — system prompt 2K bị tính đủ mỗi lượt | Fireworks **cache tự động**: cached input = 50% giá (20b) tới **10% giá (120b)**; đo thật 1150/1151 token cache hit từ lượt 2 | Kinh tế học chat đổi hẳn: chi phí LLM/phiên giảm ~3×; **STT càng trở thành khoản chi lớn nhất** — kết luận số 1 của báo cáo cũ càng đúng |
| Nâng chấm = Claude Haiku, nâng content = Sonnet, verify = Gemini, PAID = Cerebras (đều qua OpenRouter) | Fireworks **không serve Anthropic/Google/Cerebras** | Toàn bộ cột "ứng viên nâng cấp" cũ vô hiệu — phải chọn lại trong danh mục Fireworks (mục 3) |
| Fallback đa nhà = OpenRouter cùng model | Một nhà duy nhất; rollback = block `#[GROQ-CŨ]#` trong `.env.production` | Rủi ro tương quan đơn-nhà **vẫn nguyên**, chỉ đổi tên chủ nợ từ Groq sang Fireworks |

---

## 2. Nguyên tắc phân loại: chức năng nào cần gì

Ba tiêu chí trội, mỗi chức năng chỉ được tối ưu cho MỘT tiêu chí chính:

- **⚡ TỐC ĐỘ** — người dùng đang chờ trong hội thoại real-time (SSE TTFT < 1,5s). Sai một chút chấp nhận được, chậm là chết tính năng.
- **🎯 CHÍNH XÁC** — kết quả là **phán quyết** (điểm thi, xếp lớp) hoặc bị **persist vào dữ liệu học** (SRS, user_grammar_errors). Sai ở đây là sai lâu dài: học viên ôn lỗi bịa, xếp nhầm trình độ, điểm oan. Latency vài giây vô nghĩa.
- **💰 CHI PHÍ** — chạy nền/batch/đêm hoặc sinh-một-lần-rồi-cache. Không ai chờ, nên mua chất lượng cao nhất mà ngân sách chịu, hoặc rẻ nhất nếu chất lượng đã đủ.

---

## 3. Danh mục Fireworks serverless 08/2026 (giá xác nhận docs.fireworks.ai 09/08)

Định dạng giá: **$in / $cached-in / $out** per 1M token, tier Standard.

| Model | Giá | Vai trò tiềm năng |
|---|---|---|
| `gpt-oss-20b` | 0.07 / 0.035 / 0.30 | Chat real-time (đang chạy, đã QA) |
| `gpt-oss-120b` | 0.15 / **0.015** / 0.60 | Chấm + batch (đang chạy); cached-in 10% cực rẻ cho prompt chấm lặp |
| **DeepSeek V4 Flash** | **0.14 / 0.028 / 0.28** | ⭐ Ứng viên sáng nhất: thế hệ mới hơn 120b mà **out rẻ hơn một nửa** — thử cho chấm + verify + explain |
| Qwen 3.7 Plus | 0.40 / 0.08 / 1.60 | Ứng viên chấm/multilingual (họ Qwen mạnh đa ngữ) |
| MiniMax M3 / M2.7 | 0.30 / 0.06 / 1.20 | Ứng viên verify/chấm hạng trung |
| Kimi K2.6 | 0.95 / 0.16 / 4.00 | Ứng viên content (văn phong, biên soạn) |
| DeepSeek V4 Pro | 1.74 / 0.145 / 3.48 | Ứng viên content/chấm cao cấp |
| GLM 5.1 / 5.2 | 1.40 / — / 4.40 | Dự phòng so sánh |
| **Kimi K3** | 3.00 / 0.30 / 15.00 | Frontier-class: chỉ đáng cho **regen cây học tập một lần** (P5) và có thể placement |
| `whisper-v3-turbo` | **$0.0009/phút** | STT transcript (đang chạy cả 2 tầng) |
| `whisper-v3` | ~$0.0015/phút | STT chấm phát âm nếu D1.3 cho thấy đáng |
| Batch API | **−50%** giá, trả trong 24h | Đáng xem cho tier BATCH + weekly rubric |

⚠️ Mọi ứng viên ngoài họ gpt-oss đều **chưa được đo tiếng Đức** (hình thái học: cách, đuôi tính từ, trật tự từ) — giá là dữ kiện, chất lượng phải qua F1 calibration mới thành quyết định. Và nhớ bài học FW.7: model không-reasoning thì đặt `AI_LLM_TIER_*_EFFORT=` (rỗng); model reasoning họ khác có knob khác — contract test (F2.4) trước khi flip bất kỳ tier nào.

---

## 4. MA TRẬN MODEL THEO CHỨC NĂNG (bản Fireworks-only, thay mục 6 báo cáo cũ)

### 4.1. Nhóm ⚡ TỐC ĐỘ — không đổi gì, đừng đụng vào

| Chức năng (tier) | Model chốt | Lý do |
|---|---|---|
| Chat lượt + greeting + interview turn (`CHAT_FREE`) | `gpt-oss-20b`, effort=low | TTFT 0,37–0,48s ấm, JSON 9 field QA 100%, cache 50% input. Không ứng viên nào trên Fireworks vừa nhanh hơn vừa rẻ hơn. **Giữ nguyên.** |
| Chat gói trả phí (`CHAT_PAID`, P4-G) | `gpt-oss-120b`, effort=low | Cùng họ ⇒ JSON contract byte-compatible, degrade PAID→FREE không lệch giọng. **Điều kiện tiên quyết G1.4: đo TTFT ở chế độ STREAM** (bench 08/08 chỉ có 3,4s non-stream — chưa đủ để hứa real-time). Nếu stream không đạt <1,5s TTFT: ứng viên thay là Qwen 3.7 Plus, nhưng khi đó mất tính cùng-họ — thà giữ PAID=FREE còn hơn ship chat chậm. |
| Sinh câu hỏi PV (~80 tok) | `gpt-oss-20b` | Chi phí ~0, latency là tất cả. Giữ. |
| Helper gợi ý/dịch (200–300 tok) | `gpt-oss-20b` | Như trên. |
| STT transcript chat/PV | `whisper-v3-turbo` @ host `audio-turbo` | 1,4–3,2s cho ~10s audio, transcript QA 100%, $0.0009/phút, **đã chạy prod không khiếu nại**. Giữ. |

### 4.2. Nhóm 🎯 CHÍNH XÁC — nơi duy nhất đáng tiêu tiền nâng cấp

| Chức năng (tier) | Model hiện tại | Đề xuất | Ghi chú |
|---|---|---|---|
| **Chấm phán quyết** (`GRADING_EXAM`): mock exam, grammar exam, Sprechen Teil 2, placement, essay B2B, CORRECT_WRITING, Schreiben (#311) | `gpt-oss-120b` + effort=low (20/20 sau vá) | **Giữ 120b làm baseline; đưa DeepSeek V4 Flash + Qwen 3.7 Plus + Kimi K2.6 vào F1 calibration (~100 bài).** Flip chỉ khi thắng rõ về precision/recall phát hiện lỗi | V4 Flash là ca hiếm "vừa mới hơn vừa rẻ hơn" (~15đ/bài vs 22đ của 120b) — nếu F1 xác nhận ≥ 120b thì nâng chất **kèm giảm giá**. Đây là câu trả lời cho khung 3 lựa chọn đầu P3: **chọn hướng 3**, hướng 1 là mặc định an toàn nếu F1 không có ứng viên thắng |
| Chấm feedback thường nhật (`GRADING_DAILY`): ConversationEval, InterviewEval, weekly rubric | `gpt-oss-120b` + effort=low | Đi theo kết quả F1 của GRADING_EXAM (cùng ứng viên). Env riêng đã có sẵn làm đòn bẩy: nếu cần cắt chi phí, tier này hạ trước | Weekly rubric chạy đêm — nếu dùng Batch API −50% thì tách về BATCH, nhưng đừng làm phức tạp trước khi có số |
| **Thẩm định correction trước khi persist SRS** (`ERROR_VERIFY`, P4-C) | tạm `gpt-oss-20b` (chưa bật) | **DeepSeek V4 Flash, temp 0, max ~300 tok** | Nguyên tắc bắt buộc: model verify phải **KHÁC HỌ** model sinh (20b sinh lỗi → gpt-oss verify là tự xác nhận, vô nghĩa). Gemini đóng đường thì V4 Flash là lựa chọn khác-họ rẻ nhất đủ thông minh. Chạy shadow 1 tuần như quyết định #2 |
| STT chấm phát âm / phoneme (word timestamps) | `whisper-v3-turbo` (cả 2 tầng từ sau flip) | **Chạy D1.3 (WER turbo vs `whisper-v3` trên ~50 audio prod) rồi mới quyết.** Chênh ≤1% ⇒ đóng mục D, giữ turbo cho cả hai | Điểm cộng riêng Fireworks: `verbose_json` có per-word `probability` + `hallucination_score` — giàu hơn Groq; tận dụng được để scorer lọc từ bịa (ticket riêng, không chặn) |
| Placement test (một lần/học viên, quyết cả lộ trình) | đi chung GRADING_EXAM | Tùy chọn tách: đây là bài chấm hiếm + hệ quả nặng nhất — nếu muốn "chính xác tuyệt đối" đúng nghĩa, một env override cho riêng luồng này lên **Kimi K3** (~500đ/bài) là mua được, vì mỗi user chỉ chấm 1 lần | Chỉ làm sau khi F1 có số; khung tier hỗ trợ per-tier model sẵn |

### 4.3. Nhóm 💰 CHI PHÍ — batch, đêm, sinh-một-lần

| Chức năng (tier) | Model hiện tại | Đề xuất | Ghi chú |
|---|---|---|---|
| Vocab tagging đêm (`BATCH`) | `gpt-oss-120b` + effort=low | Giữ 120b; **ticket riêng: chuyển sang Fireworks Batch API (−50%)** — đúng nghĩa batch, trả trong 24h, không ai chờ | B4.2 (chạy thử 50 từ staging) vẫn nợ |
| Sinh nội dung bài học (`CONTENT`: SkillTree/PracticeNode — cache một lần) | `gpt-oss-20b` (!) | **Nâng lên Kimi K2.6 hoặc DeepSeek V4 Pro** cho lần sinh mới; **regen toàn cây (P5) dùng Kimi K3** | Đây là chỗ 20b đang "gánh" sai vai: nội dung sư phạm sinh MỘT lần rồi cache phục vụ nghìn lượt — chi phí model xịn khấu hao về ~0. Tính thử regen 144 node bằng K3 (~3K in/2K out mỗi node): **~$5,6 một lần** — rẻ hơn một bữa trưa cho chất lượng giáo trình. Sonnet đóng đường không phải là mất mát ở đây |
| Giải thích lỗi/sửa câu (`EXPLAIN`) | `gpt-oss-20b` + effort=low | Đưa vào F1 cùng đợt: ứng viên V4 Flash | Học viên ĐỌC phần giải thích tiếng Việt để học — chất lượng có giá trị sư phạm trực tiếp, và V4 Flash gần như không đắt hơn |
| TTS | Edge TTS / XTTS | Giữ nguyên | Ngoài phạm vi LLM, không đổi |

---

## 5. Kinh tế học cập nhật (phiên 10 lượt, tỷ giá 25.400)

| Khoản | Báo cáo cũ (Groq, không cache) | Fireworks hiện tại | Ghi chú |
|---|---|---|---|
| LLM chat 10 lượt (20b) | ~86đ | **~25đ** (đo thật ~$0.0001/lượt nhờ cache 1150/1151) | Cache tự động là món quà lớn nhất của flip |
| STT 10 lượt × 15s (turbo) | ~42đ | **~57đ** ($0.0009/phút — nhỉnh hơn giá Groq turbo cũ nhưng nửa giá large-v3) | Vẫn là khoản chi lớn nhất/phiên — đúng kết luận #1 báo cáo cũ |
| Chấm cuối phiên (120b, 2.5K in/800 out) | ~22đ | ~22đ (V4 Flash nếu flip: **~15đ**) | |
| **Tổng/phiên** | ~150đ (bản đề xuất cũ) | **~104đ** | COGS mục tiêu 307đ/user/tháng ⇒ ~**3 phiên/user/tháng** trong ngân sách (cũ: ~2) |

Trần mới cần canh không phải TPM mà là **ví prepaid**: Auto Reload đang OFF (FW.3) — credit cạn = Suspended = Speaking sập giữa giờ, đây là "8K TPM" phiên bản Fireworks. Bật Auto Reload + usage alert ~$15/tháng trước khi nghĩ đến bất kỳ nâng cấp model nào.

---

## 6. Thứ tự thực thi đề xuất

| # | Việc | Gắn checklist | Ưu tiên |
|---|---|---|---|
| 0 | 👤 FW.1 deploy 3 PR (#309+#310+#311, SHA `4c34c29c`) + FW.3 Auto Reload + FW.4 revoke key Groq lộ | FW | 🔴 trước mọi thứ |
| 1 | F2.4: đưa `qa_fw.py`/`rate_test.py` vào repo thành contract-test chính thức (chạy mỗi lần đổi model) | P3 | Cao — điều kiện cho mọi flip |
| 2 | F1.1–F1.4: calibration harness, ~100 bài, chấm chéo **120b (baseline) vs DeepSeek V4 Flash vs Qwen 3.7 Plus vs Kimi K2.6** — xuất precision/recall lỗi + offset band + cost | P3 | Cao — quyết định lớn nhất còn lại |
| 3 | G1.4 đo TTFT stream của 120b → quyết CHAT_PAID (ship G) | P4 | Trung |
| 4 | D1.3 đo WER turbo vs v3 → quyết đóng hay tách 2 tầng STT | P4 | Trung |
| 5 | C1.x verify pipeline với ERROR_VERIFY = V4 Flash, shadow 1 tuần | P4 | Trung |
| 6 | Flip CONTENT → K2.6/V4 Pro (lần sinh mới); lập dự toán regen P5 bằng K3 (~$6) | P3/P5 | Thấp nhưng rẻ và lời |
| 7 | Ticket Batch API −50% cho BATCH + weekly | — | Thấp |

**Tóm một câu:** tốc độ đã có (20b + cache, giữ nguyên toàn bộ nhóm real-time); chính xác tuyệt đối dồn tiền và công đo vào đúng hai chỗ — chấm phán quyết và verify-trước-khi-persist; chi phí thì để cache + Batch API làm việc, và mua hẳn model frontier cho nội dung sinh-một-lần vì nó gần như miễn phí sau khấu hao.

---

*Giá LLM xác nhận tại docs.fireworks.ai/serverless/pricing ngày 09/08/2026; giá whisper theo bench thực đo 08/08 + trang công bố Fireworks ($0.0009–0.0015/phút). Chất lượng tiếng Đức của mọi ứng viên ngoài gpt-oss: CHƯA CÓ SỐ — F1 là cửa duy nhất trước khi flip.*
