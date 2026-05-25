> **Version control:** This spec is tracked here because `docs/` is listed in `.gitignore`. An optional duplicate may exist locally under `docs/superpowers/specs/` for Cursor superpowers workflows.

# Continuous vocabulary enrichment (EN + VI) — roadmap & architecture

**Date:** 2026-05-02  
**Scope (per brainstorming):** Full roadmap — nguồn dữ liệu thay thế/kết hợp, fail-over, vận hành, và hướng schema/API sau này. Bao gồm **as-built** (đã có trong code) và **định hướng** (chưa implement).

## 1. Goal

- Làm đầy **nghĩa tiếng Anh** và **nghĩa tiếng Việt** cho bộ từ vựng lớn (~10k lemma thật trong Postgres) **theo thời gian**, không chặn request người dùng, có thể **tắt/bật** theo môi trường.
- Thống kê admin (“có nghĩa EN”, “cần enrich”) phản ánh đúng dữ liệu trong `word_translations` với quy ước placeholder hiện tại.

## 2. Non-goals (giai đoạn này)

- Thay đổi contract công khai cho app học viên (chỉ ghi **hướng** nếu cần sau).
- **DeepL Pro / bất kỳ API dịch trả phí theo usage vượt free tier có trong roadmap này** — loại khỏi lộ trình; chỉ chấp nhận các nguồn miễn phí được mô tả ở mục 4.
- Đảm bảo 100% lemma có **chất lượng pedagogic cao nhất** (machine translation có thể thiếu ngữ cảnh).
- Lưu embedding/vector search cho từ vựng.

## 3. Current system (as-built)

| Luồng | Nguồn | Đầu ra chính | Scheduler / API |
|--------|--------|----------------|-----------------|
| Wiktionary batch | Scrape EN Wiktionary | IPA, `locale=en` meaning/example, `locale=de` example, metadata verb/noun | `WiktionaryEnrichmentScheduler` + admin `POST .../wiktionary/enrich/batch` |
| Glosbe VI | Scrape Glosbe DE→VI | `locale=vi` meaning | `GlosbeViEnrichmentService` scheduled + admin `POST .../glosbe-vi/enrich/batch` |
| DeepL lemma backfill | DeepL API **Free** `DE→EN`, `DE→VI` (khi bật) | Bù EN và/hoặc VI khi thiếu | `DeepLLemmaBackfillScheduler` + admin `POST .../deepl-lemma-backfill/batch` |

**Chưa có trong code (định hướng):** adapter **Azure Cognitive Services Translator** (free tier) cho “càn quét” diện rộng theo mục 5; cần service + cấu hình key vùng rõ ràng.

**Cursor resume:** `vocabulary_import_state` theo `source_name` khác nhau cho từng luồng.

**Ưu tiên CEFR:** Wiktionary, Glosbe VI, DeepL backfill (và sau này Azure) nên sắp xếp A1→… trước `id`.

## 4. Approaches — **Smart Free** (khuyến nghị duy nhất)

**Loại khỏi lộ trình:** mọi “Tier 2 Paid”, DeepL Pro, và mô hình **paid-primary** / hybrid có trả phí theo usage vượt định mức free.

**Smart Free** = một stack **0 đồng** (theo định mức free của từng nhà cung cấp; vận hành phải tự xác minh điều khoản & hạn mức hiện tại):

| Lớp | Vai trò |
|-----|--------|
| **Scraping (chính)** | **Wiktionary (EN)** + **Glosbe (VI)** — nguồn “vô hạn” về mặt quota API tiền; chỉ bị giới hạn bởi delay an toàn, markup, và rủi ro ToS/block IP. Đây là lớp được ưu tiên chạy liên tục. |
| **DeepL API Free (bổ trợ chiến lược)** | Không làm nguồn chính. Dùng khi scraping thất bại hoặc từ “khó”; hard-cap **490k ký tự đầu vào/tháng** (dưới trần ~500k) để tránh **bất kỳ** phát sinh ngoài free tier (xem mục 5–7). |
| **Azure Cognitive Services Translator — Free Tier (cứu cánh)** | Ước tính **~2M ký tự/tháng** miễn phí (theo SKU free hiện tại của Microsoft; re-verify định kỳ). Dùng **càn quét** các lemma còn thiếu sau khi đã qua scraping + DeepL Free trong giới hạn. |

**Tóm lại:** không có nhánh “trả tiền” trong thiết kế sản phẩm này; chỉ scraping + hai API **free-tier có trần ký tự** được lên kế hoạch.

## 5. Fail-over và thứ tự (**0 đồng**, định hướng triển khai)

Áp dụng **per locale** (EN và VI có thể ở các bước khác nhau tại cùng một lemma):

1. **Ưu tiên 1 — Scraping:**  
   - **EN:** Wiktionary (IPA/ví dụ kèm theo khi có).  
   - **VI:** Glosbe DE→VI.  
   Không tính quota tiền; chỉ bounded bởi delay và ổn định scraper.

2. **Ưu tiên 2 — DeepL API Free:** Chỉ khi scraping **không** cho ra nghĩa hợp lệ, hoặc từ được đánh dấu “khó” (follow-up: heuristic rõ). **Dừng gọi** khi tổng ký tự đầu vào tháng hiện tại **≥ 490k** (buffer dưới 500k).

3. **Ưu tiên 3 — Azure Translator (Free Tier):** Dùng cho **càn quét** các từ vẫn thiếu EN hoặc VI sau bước 1–2, trong định mức free Azure; có hard-limit theo telemetry (follow-up trong implementation plan).

4. **Không ghi đè** ý đã curate tốt: giữ các `CASE`/`ON CONFLICT` hiện có (không downgrade meaning đã hợp lệ).

**Tùy chọn kiến trúc:** façade `EnrichmentOrchestrator` thực thi policy trên (hiện tại: **scheduler độc lập**, cần hợp nhất sau để khớp thứ tự ưu tiên và meter ký tự).

## 6. Data model & quality rules

- **`word_translations`:** một hàng/`locale`; EN và VI độc lập.
- **Placeholder:** Giữ filter chung (`not in wordlists…`, `chưa có trong…`) cho thống kê và upsert để tránh đếm “giả enriched”.
- **“Done ~10k” (free-only):**  
  - **100%** số `words.id` trong tập ~10k có **ít nhất một** bản dịch EN **và** một bản dịch VI với `meaning` non-null, không thuộc placeholder.  
  - Nguồn **chỉ** từ các lớp **Smart Free** (mục 4): scraping, DeepL Free (trong cap), Azure Free (trong cap).  
  - **Chấp nhận** tốc độ tổng thể **chậm hơn** do delay an toàn khi scrape (tránh ban IP) và do xếp hàng sau khi chạm cap API free.  
  - Tùy chọn sau: cột `translation_source` / `enrichment_quality` để phân biệt Wiktionary vs Glosbe vs DeepL-free vs Azure-free.

## 7. Operations & configuration

| Concern | Mechanism |
|--------|-----------|
| **Strict free mode** | `app.vocabulary.strict-free-mode` (default khuyến nghị prod: `true`). Khi **bật**: hệ thống **không gọi** bất kỳ endpoint nào có thể **phát sinh phí** nếu vượt định mức free (hard-off cho paid SKU); chỉ cho phép scraping + DeepL Free (trong cap) + Azure Free (trong cap). Nếu không thể chứng minh “chỉ free tier”, adapter bị tắt. |
| Bật/tắt Wiktionary | `app.vocabulary.wiktionary-scheduler.enabled` |
| Bật/tắt Glosbe VI | `app.vocabulary.glosbe-vi.enabled` |
| DeepL Free backfill | `DEEPL_LEMMA_BACKFILL_ENABLED`; không key → không gọi; **meter tháng** + dừng @ **490k** ký tự đầu vào (config snapshot / DB state — follow-up implementation). |
| Azure Free | `AZURE_TRANSLATOR_*` (định hướng) + hard-limit theo free tier; tắt khi `strict-free-mode=true` nếu key không phải free tier hoặc chưa xác minh. |
| Rate / an toàn scrape | Delay, User-Agent, batch size — giữ bảo thủ để chấp nhận “Done” chậm hơn (mục 6). |

## 8. Observability (định hướng)

- Log structured mỗi batch: `{source, processed, enUpserts, viUpserts, failed, charsUsedEstimate}` (một phần đã có).
- **Bắt buộc follow-up:** counter ký tự **theo tháng** cho DeepL Free (và Azure) để enforce 490k / Azure free cap.
- Metrics (Micrometer): counter theo source + histogram thời gian batch — **follow-up**.
- Admin: view “coverage EN/VI %” — **follow-up**.

## 9. API / schema (future)

- **Public read:** Không đổi trong spec này.
- **Admin:** Endpoint batch hiện có; thêm `GET enrichment/status` (scraping + DeepL chars tháng + Azure chars tháng) — **follow-up**.
- **Schema:** `translation_source`, `updated_by` — **later**.

## 10. Risks

- Scraping: markup thay đổi, rate limit, ToS, block IP — mitigated bằng delay (trade-off tốc độ, chấp nhận trong mục 6).
- **DeepL Free:** vượt 500k → risk billing nếu cấu hình sai; **490k hard stop** + `strict-free-mode`.
- **Azure Free:** điều khoản & quota thay đổi theo Microsoft; cần re-verify định kỳ; key lộ trong `.env`.
- Race ghi `word_translations`: upsert + `CASE` như hiện tại.

## 11. Next step after approval

- **writing-plans:** Azure Translator adapter (free tier), monthly char meters (DeepL 490k, Azure per current free SKU), `strict-free-mode` wiring, orchestration hoặc thứ tự gọi rõ ràng giữa ba lớp, test với client mock (không gọi mạng CI).

---

### Spec self-review (checklist)

- **Placeholders:** Follow-up cho meter, Azure adapter, orchestrator — đã gắn nhãn.
- **Consistency:** Không còn khuyến nghị hybrid paid; Smart Free + fail-over 3 tầng + strict-free-mode.
- **Scope:** As-built (scrape + DeepL free code) vs chưa code (Azure, meters, strict flag behavior).
- **Ambiguity:** “Done ~10k” = 100% EN+VI hợp lệ chỉ từ nguồn free đã liệt kê; tốc độ có thể chậm.
