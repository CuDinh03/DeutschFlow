# BÁO CÁO CONTRACT-TEST TIER LLM — ĐO THẬT TRÊN FIREWORKS

**Ngày:** 2026-08-09 · **Việc:** F2.4 + đo trước cho F1/F3/G1.4 (checklist `plans/2026-08-07-checklist-khung-ai-tier.md`) · **Công cụ:** `scripts/ai-tier-contract-test.py` (PR này) · **Chạy bằng:** key/URL/model THẬT trong `.env.production` của prod

> **Một câu:** hiện trạng 8/8 tier đạt hợp đồng, nhưng **cả 3 ứng viên F1 đều KHÔNG chạy được ở ngân sách token hiện tại** — nên "flip model = sửa 1 dòng env" là SAI với danh mục đã chốt, và **CONTENT = Kimi K2.6 nếu flip hôm nay sẽ trả nội dung RỖNG** ở 2 call site của cây học tập.

---

## 1. Hiện trạng (baseline) — 8/8 tier đạt

Lệnh (không in secret, exit 0/1 dùng được làm cổng):

```bash
python3 scripts/ai-tier-contract-test.py --env-file /path/.env.production --all-tiers --runs 3
```

| Tier | Model | 3/3 JSON | Latency | out max / ngân sách | Biên an toàn | Cache hit |
|---|---|---|---|---|---|---|
| chat-free | gpt-oss-20b | ✅ | 1,24–1,33s | 174 / 800 | 78% | 201/202 |
| chat-paid | gpt-oss-20b | ✅ | 1,01–2,13s | 412 / 800 | 48% | 201/202 |
| error-verify | gpt-oss-20b | ✅ | 1,15–1,35s | 125 / 300 | 58% | 161/162 |
| grading-exam | gpt-oss-120b | ✅ | 2,04–2,85s | 292 / 800 | 64% | 249/250 |
| grading-daily | gpt-oss-120b | ✅ | 3,48–4,78s | 510 / 1000 | 49% | 183/184 |
| explain | gpt-oss-20b | ✅ | 1,07–1,45s | 109 / 256 | 57% | 125/126 |
| content | gpt-oss-20b | ✅ | 1,39–2,21s | 310 / 1024 | 70% | 165/166 |
| batch | gpt-oss-120b | ✅ | 0,86–1,26s | 94 / 600 | 84% | 134/135 |

STT: transcript đúng 100% (0,95s), `words[].probability` có (nguồn `avg_logprob` vì Fireworks không trả `segments`), không nuốt prompt trên mẫu 1 câu — khớp đúng phần đính chính FW.2a.

**Cache hit ~99% ở MỌI tier.** Đây là lý do PR này thêm cột cached-input vào `AiCostEstimator`: tính prompt theo giá input thường là khai vống, và với 120b thì cached-in chỉ bằng 10% giá gốc.

---

## 2. 🔴 Ba ứng viên F1 trượt hợp đồng ở ngân sách hiện tại

Cùng một prompt chấm, cùng `response_format=json_object`, 4 lượt mỗi cấu hình:

| Model | @800 tok *(ngân sách chật nhất của GRADING_EXAM)* | @1500 tok *(GradingService)* | @3000 tok | Latency | out tok |
|---|---|---|---|---|---|
| **gpt-oss-120b** (baseline) | ✅ 3/3 · biên 64% | — | — | 2,0–2,9s | ~292 |
| **deepseek-v4-flash** | 🔴 1/4 · CỤT đúng 800/800 | ✅ 4/4 · biên **20%** (sát) | ✅ 4/4 · biên 65% | 6,2–14,0s | ~1040–1200 |
| **qwen3p7-plus** | 🔴 0/4 · CỤT | 🔴 0/4 · CỤT | ✅ 4/4 · biên 36% | 5,1–11,3s | ~1929 |
| **kimi-k2p6** | 🔴 0/4 · **RỖNG** | 🔴 0/4 · **RỖNG** | ⚠️ 4/4 nhưng biên **2%** | **27,6–42,9s** | ~2925 |

Bỏ `reasoning_effort` (đặt rỗng) **không thay đổi gì** — đo lại cả 3 model ở 800 tok cho kết quả y hệt. Nghĩa là đây không phải chuyện knob như FW.7, mà là ba model này **dài dòng gấp 4–10× 120b** (và K2.6 tiêu trọn ngân sách vào phần "nghĩ" trước khi phát token nào ⇒ content rỗng).

### Hệ quả phải sửa kế hoạch

1. **F3.1/F3.2 không còn là "sửa 1 dòng env".** Flip GRADING_EXAM sang bất kỳ ứng viên nào **bắt buộc kèm nới `max_tokens` tại call site**: `AiExamEvaluatorService:59,183` (800), `SprechenTeil2Service:137` (1000), `AiSpeakingMockExamController:104` (1200), `GradingService` (1500). Không nới thì hỏng ÂM THẦM đúng kiểu FW.7 — `parseScore` có regex fallback nên bài vẫn lưu AI_GRADED với điểm trần trụi, mất sạch nhận xét.
2. **Latency chấm tăng 3–15×.** 120b 2,5s → V4 Flash 6–14s → K2.6 28–43s. Luồng chấm bài tập là async nên chịu được, nhưng `SkillTreeController:300` (CORRECT_WRITING) và lead-magnet là **đồng bộ** — cần kiểm timeout trước khi flip.
3. **F1 phải chạy ở ngân sách ≥3000 tok**, nếu không nó đo "model nào ít bị cắt JSON hơn" chứ không đo chất lượng chấm. Đây là lý do harness F1 (PR kế tiếp) phải cho phép đặt ngân sách theo lượt đo.

---

## 3. 🔴 Quyết định #9 (CONTENT = K2.6 "flip ngay, không cần chờ F1") sẽ làm hỏng cây học tập

Tier CONTENT có **hai** ngân sách thật: 4096 (`PracticeNodeService:172,198`, `SkillTreeService:465`) và **1024** (`SkillTreeService:1107,1248`).

| K2.6 @ CONTENT | Kết quả |
|---|---|
| budget **1024** | 🔴 **3/3 RỖNG** — model không kịp phát token nội dung nào |
| budget 4096 | ✅ 3/3, out 3151/4096 (biên 23%), nhưng **32,5–41,4s mỗi node** |

Nếu flip `AI_LLM_TIER_CONTENT_MODEL=accounts/fireworks/models/kimi-k2p6` hôm nay: hai call site 1024 tok trả rỗng ⇒ node cây học tập sinh nội dung trắng. Không có exception, không 503 — đúng dạng hỏng khó thấy nhất.

**Điều kiện tiên quyết trước F3.4:** nới `SkillTreeService:1107,1248` lên ≥4096 và cân nhắc lại 32–41s/node (regen P5 144 node ≈ 1,3–1,6 giờ chạy tuần tự — vẫn ổn cho việc one-off, nhưng luồng unlock node CỦA HỌC VIÊN thì không chờ được; xem lại đường sinh-khi-unlock).

---

## 4. G1.4 — TTFT stream, điều kiện của CHAT_PAID (quyết định #10)

n=12 lượt mỗi model, đo tới **token nội dung đầu tiên** ở chế độ stream:

| Model | Trung vị | Min | Max | Số lượt vượt 1,5s | Mẫu |
|---|---|---|---|---|---|
| gpt-oss-20b (CHAT_FREE hiện tại) | **0,83s** | 0,56 | 1,13 | **0/12** | 0.56 0.60 0.70 0.72 0.73 0.80 0.83 1.00 1.03 1.07 1.10 1.13 |
| gpt-oss-120b (ứng viên CHAT_PAID) | **1,29s** | 0,65 | 1,88 | **4/12** | 0.65 0.71 0.85 1.07 1.11 1.17 1.29 1.34 1.61 1.62 1.66 1.88 |

Đính chính bench cũ: 120b **không phải 3,4s** — số đó là non-stream (toàn bộ phản hồi). Đo lại non-stream ở đây là 2,0–2,9s, còn TTFT stream trung vị 1,29s.

**Trạng thái điều kiện #10:** trung vị 1,29s < 1,5s ⇒ **đạt theo trung vị**, nhưng 1/3 lượt vượt ngưỡng và max 1,88s. 👤 Owner chốt: ship G với 120b (chấp nhận đuôi phân phối chậm hơn FREE ~1,5×), hay giữ PAID = FREE và phân biệt gói bằng quota/tính năng.

---

## 5. Đính chính số liệu trong báo cáo model 09/08

| Chỗ ghi | Đang ghi | Docs Fireworks (tra 09/08) |
|---|---|---|
| Giảm giá Batch API (quyết định #12) | −40% | **billed at 50% of serverless pricing** ⇒ **−50%** |
| GLM 5.2 cached-in | "—" | **$0.14** |
| TTFT 120b | 3,4s (non-stream) | stream **1,29s** trung vị |

Giá LLM còn lại của 9 model trong báo cáo: **khớp đúng** docs khi tra lại.

---

## 6. Việc phát sinh (đã đưa vào checklist)

- [ ] **F1.0 (mới, chặn F1)** — nới ngân sách token của các call site chấm trước khi calibrate, hoặc cho harness đặt ngân sách riêng theo lượt đo.
- [ ] **F3.4 tiền đề (mới, chặn CONTENT=K2.6)** — nới `SkillTreeService:1107,1248` lên ≥4096 và xử lý latency 32–41s/node.
- [ ] **F2.4b** — cắm script này vào quy trình: chạy trước MỌI lần đổi `AI_LLM_TIER_*_MODEL`, dán kết quả vào PR flip.
- [x] Sửa "−40%" → "−50%" trong báo cáo model + checklist (quyết định #12 lời hơn dự tính).

---

*Mọi số trong báo cáo này đo bằng `scripts/ai-tier-contract-test.py` trên endpoint Fireworks thật ngày 09/08/2026, lặp lại được bằng lệnh ghi ở mục 1. Slug model lấy từ `GET /inference/v1/models`; giá từ docs.fireworks.ai/serverless/pricing và fireworks.ai/blog/audio-transcription-launch.*
