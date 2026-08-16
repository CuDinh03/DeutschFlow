# DeutschFlow Galerie — Báo cáo phân tích codebase & kế hoạch (CHƯA IMPLEMENT)

Ngày: 2026-08-16 · Trạng thái: **ĐÃ DUYỆT 16/08 → P0 code xong (nhánh `feat/galerie-p0-concept`, 22/22 unit test PASS)** · Spec gốc: master prompt "DeutschFlow Galerie" owner cung cấp 16/08.

> **Tiến độ P0 (16/08):** V274 (image_family/image_concept/image_status) · `GaleriePromptFactory` (concept + condensed + full, version `galerie-v1`) · `GalerieConceptService` (tier BATCH, ledger `galerie.concept`, lọc data bẩn theo Ô NGHĨA — đính chính 16/08: lemma TAB chỉ ~24 từ, phần bẩn thật là nghĩa nhồi/rác → filter `length(meaning)<=120` + `[[:cntrl:]]`) · `GalerieAdminController` (ADMIN-only: POST concepts, POST concepts/by-ids, GET overview, GET missing-count). CÒN P0: merge PR + deploy + chạy concept 30 từ pilot (cần token ADMIN).

> ⚠️ Ghi chú về ảnh tham chiếu owner gửi kèm: ảnh đó truyền tải đúng *tinh thần* (editorial, controlled imperfection, micro-scene, negative space) nhưng palette của nó (sage/xanh xám/pastel) **không phải palette Galerie** (gold–brick red–ink–cream). Chỉ dùng làm tham chiếu độ "artistic", không dùng làm style reference khi gen.

## 1. Kiến trúc hiện tại (đã verify 16/08)

- **Entity `Word`** (`vocabulary/entity/Word.java`): có sẵn `base_form`, `gender`, `dtype`, `cefr_level`, `meaning`, `frequency_rank`, `image_url`, `audio_url` + metadata ảnh từ V150: `image_source`, `image_style`, `image_prompt`, `image_generated_at`, `image_updated_at`. Kho ~10.900 từ.
- **Pipeline ảnh hiện tại = Unsplash-only**: `VocabularyImageGeneratorService` (SSRF allowlist chỉ `*.unsplash.com`) → tải bytes → `MediaAssetService.uploadMedia` → S3 → `VocabularyImageService.applyGeneratedImage()` ghi `words`. `VocabularyImageBatchService` lọc `image_url IS NULL` + filter cefr/dtype/tag + `approvedWordIds`. `VocabularyImageReviewService` chỉ hỗ trợ decision `APPROVE` và **đang coupling cứng với Unsplash**.
- **Module `aiimage`**: interface `ImageGenerationProvider` (`generate(prompt, style, size) → bytes`) + `BedrockImageGenerationProvider` (`@ConditionalOnBean` — `AwsBedrockConfig` gate `aws.bedrock.enabled=true`, **hiện TẮT, chưa từng bật prod**) + `AiImagePromptBuilder` (ghép chuỗi đơn giản) + `AiImageGenerationService` (tính năng TEACHER/ADMIN, đã có OrgPoolGuard + AiUsageLedger sau vá H-1, cố ý KHÔNG mở transaction quanh vòng gọi provider).
- **Storage**: `MediaAssetService` → `S3StorageService` (bucket `AWS_S3_BUCKET_NAME`, region ap-southeast-1), bảng `media_assets` có `scope/source/style`, URL public S3 trực tiếp (**chưa có CloudFront** — nợ cũ từ Materials).
- **LLM text**: `AiChatClientFactory` (`app.ai.chat-provider: local|groq`) → `GroqChatClient` (base-url configurable; prod đã flip env sang **Fireworks**, model gpt-oss-20b/120b) — có concurrency limiter, circuit breaker, retry. Comment trong yml ghi rõ tiền lệ "batch LLM (vocabulary tagging)".
- **FE**: admin có trang `v2/admin/vocabulary` (kèm tab "Duyệt chất lượng" từ A-3); student web có trang vocabulary. **Mobile hiện KHÔNG render `imageUrl` nào** — chỉ icon glyph local (`vocabGlyph.ts`, ~140 từ).
- **DTO**: `WordListItem` ĐÃ có `imageUrl`; `srs/dto/VocabReviewCard` **CHƯA có** `imageUrl` (hạng mục A1/A2 plan 14/07 chưa làm).

## 2. Những gì reuse được (nhiều)

| Sẵn có | Dùng cho Galerie |
|---|---|
| `ImageGenerationProvider` interface | Thêm 1 provider mới implement là khớp pipeline |
| `MediaAssetService` + S3 + `media_assets` | Storage y nguyên, key mới `galerie/{version}/{wordId}.webp` |
| Cột `image_style/image_prompt/image_source/image_generated_at` | Ghi `galerie-v1` + visualConcept, không cần đổi schema cho phần này |
| `VocabularyImageBatchService` (filter cefr/dtype/tag, `image_url IS NULL`) | Khung batch + resume sẵn |
| `AiChatClientFactory` (Fireworks) | Semantic classification + visualConcept generation + Vision QA (text/vision model) |
| Admin trang vocabulary + review tab | Mở rộng thành Galerie review (grid collection) |
| `OrgPoolGuard`/`AiUsageLedger` | Kế toán chi phí gen (ledger riêng cho admin batch) |

## 3. Data model hiện tại

`words` đủ cho ảnh; **thiếu** cho spec đầy đủ: semantic family, visual concept, status lifecycle. `image_prompt` (TEXT) có thể tạm chứa visualConcept, nhưng family + status thì không có chỗ tử tế.

## 4. Hạ tầng ảnh/storage

S3 public-read + `media_assets` metadata. 5.000 WebP 1024² ≈ 250–400MB — S3 trực tiếp chịu được, CDN để sau (nợ CloudFront có sẵn, không phải blocker).

## 5. AI provider hiện tại

- Text: **Fireworks** (sống, có key, có resilience). 
- Image: **KHÔNG có provider nào sống** (Bedrock tắt; Unsplash là search, không phải gen). Phải thêm 1 provider mới — đề xuất ưu tiên kiểm tra **Fireworks image API (họ host FLUX)** để reuse key/billing/vendor; fallback fal.ai. Cần verify model list + giá trước khi chốt (⚠️ chưa verify).

## 6. File cần SỬA (khi được duyệt)

- `VocabularyImageReviewService` — tách khỏi Unsplash (hiện hardcode), thêm REJECT/REGENERATE.
- `VocabularyImageBatchService` — nhánh provider `galerie` song song Unsplash.
- `VocabularyImageService` — ghi status + version.
- `application.yml` — block `app.galerie.*` (provider, model, version, size).
- `srs/dto/VocabReviewCard` + `SrsService` — thêm `imageUrl` (A1/A2 plan cũ, join `vocab_id='word_'+id`).
- FE `v2/admin/vocabulary` — tab Galerie (grid overview + approve/regenerate/reject).

## 7. File MỚI cần tạo

Backend (đề xuất package `vocabulary/galerie/`):
- `GalerieConceptService` — LLM classify family + sinh visualConcept (batch).
- `GaleriePromptFactory` — master prompt `galerie-v1` **một nơi duy nhất** (mục 27), gồm bản full + bản condensed cho model context ngắn.
- `FluxImageGenerationProvider` (tên theo provider chốt) — implement `ImageGenerationProvider`.
- `GalerieGenerationService` — pipeline concept→gen→WebP convert→S3→status.
- `GalerieQaService` — Vision QA (semantic, không mớm đáp án) + palette check + text detection.
- `GalerieAdminController` — endpoints pilot/batch/review.
- Test tương ứng (`*Test` unit; IT đặt tên `*IntegrationTest` — gotcha harness).

FE: component grid Galerie overview trong trang admin vocabulary.

## 8. Migration cần: CÓ, một cái nhỏ

`V274+` (kiểm số MỚI NHẤT ngay trước merge — gotcha V272 trùng): thêm vào `words`:
- `image_family VARCHAR(20)` (OBJEKT/LEBEN/HANDLUNG/ORT/GEFUEHL_IDEE)
- `image_concept TEXT` (visualConcept)
- `image_status VARCHAR(20)` (PENDING/CONCEPT_READY/GENERATING/QA_PENDING/REVIEW_REQUIRED/APPROVED/FAILED — mục 23; NULL = chưa vào pipeline)

Không bảng mới (KISS, tránh over-engineer đúng mục 23).

## 9. Kiến trúc Galerie đề xuất

Đúng pipeline mục 22, chạy admin-triggered theo chunk:
```
words (lọc data sạch) → GalerieConceptService (LLM batch, rẻ)
  → image_family + image_concept (persist, chạy 1 lần)
→ GalerieGenerationService: PromptFactory(galerie-v1) → Provider → WebP → S3 → media_assets
→ GalerieQaService: Vision semantic + palette + text-detect → QA_PENDING/REVIEW_REQUIRED
→ Admin grid review → APPROVED → words.image_url cập nhật
→ FE đọc imageUrl như hiện tại; fallback = vocabGlyph icon (mục 24: không ảnh vẫn chạy bình thường — FE hiện đã như vậy)
```

## 10. Chiến lược semantic classification

- `dtype` + `gender` + `cefr_level` đã có → VERB ⇒ HANDLUNG, ADJ/ADV ⇒ GEFÜHL&IDEE (đa số) là rule-based được; NOUN cần LLM tách OBJEKT/LEBEN/ORT/abstract. LLM batch 1 lần (Fireworks, ~0đ), persist `image_family`.
- ⛔ **Chặn trước: ~870 từ data bẩn** (QA 15/08: `base_form` dính 2 từ, nghĩa nhồi trích dẫn Wiktionary) — phải loại khỏi mọi batch Galerie cho tới khi content team dọn; gen ảnh trên data bẩn = ảnh sai vĩnh viễn trên S3.

## 11. Chiến lược visualConcept

LLM (Fireworks gpt-oss-120b) với few-shot đúng 8 ví dụ mục 16, output 1–2 câu tiếng Anh, persist `image_concept`. Regenerate concept chỉ khi prompt-version đổi hoặc admin yêu cầu.

## 12. Chiến lược image generation

- Master 1024×1024 → convert **WebP** trước khi upload (chốt Q2 cũ; thư viện Java: TwelveMonkeys/webp-imageio — verify khi code).
- **1 master artwork/từ** — thumbnail bằng CSS crop/resize FE (mục 18), không gen riêng.
- ⚠️ **Master prompt của spec quá dài cho FLUX** (T5 encoder giới hạn ~512 token): cần `GaleriePromptFactory` xuất 2 bản — bản condensed (~250 từ, giữ palette/form/avoid cốt lõi + visualConcept) cho FLUX, bản full cho model context dài (gpt-image-1) nếu pilot chọn nó.
- Style anchors (mục 28): sau pilot chọn 8–12 artwork APPROVED làm reference set nếu provider hỗ trợ (FLUX Redux/img2img trên fal; Fireworks image-to-image — verify).

## 13. Chiến lược QA

- **Semantic** (ưu tiên 1, mục 19): Vision model nhìn ảnh KHÔNG được mớm từ → mô tả → LLM text so khớp meaning → PASS/REVIEW. Vision qua chat client với model vision trên Fireworks (verify model), hoặc Groq llama-4-scout còn key.
- **Palette compliance**: script đếm histogram pixel, % pixel ngoài 5 màu (± tolerance ΔE) > ngưỡng ⇒ REVIEW. Chạy local, 0đ.
- **Text detection**: hỏi vision "any letters/text?" trong cùng lượt gọi semantic.
- **Thumbnail readability**: chỉ QA thủ công ở pilot (đắt nếu tự động toàn kho).

## 14. Chiến lược storage

Giữ nguyên S3 + `media_assets` (`source='AI_GENERATED'`, `style='galerie-v1'` — cột đã có từ V150). Không thêm vendor storage nào (đúng mục 25).

## 15. Chiến lược cache

`words.image_url` chính là cache (mục 26 thoả sẵn). Guard regenerate: chỉ khi `image_url IS NULL` ∨ `image_style <> version hiện hành` ∨ admin force. Dedupe: `image_status='GENERATING'` + check trước khi enqueue.

## 16. Chiến lược admin review

Mở rộng trang admin vocabulary: tab Galerie = grid xem **cả collection cạnh nhau** (bắt buộc theo mục 30–31, không review lẻ), nút Approve/Regenerate/Reject per-artwork + checklist collection (style drift, icon-looking, quá detail...). Chỉ APPROVED mới ghi `words.image_url` production.

## 17. Prompt versioning

`image_style = 'galerie-v1'` (cột sẵn) + template sống duy nhất trong `GaleriePromptFactory`. Batch re-style tương lai: filter `image_style IS DISTINCT FROM 'galerie-v2'` (skeleton B4 cũ đã tính).

## 18. API flow ước tính

```
POST /api/admin/vocabulary/galerie/concepts?limit&cefr     — batch classify + concept
POST /api/admin/vocabulary/galerie/generate?limit&cefr     — gen + QA (chunk nhỏ, sync từng ảnh, status ghi dần)
GET  /api/admin/vocabulary/galerie/review?status=          — grid data
POST /api/admin/vocabulary/galerie/{wordId}/decision       — APPROVE/REGENERATE/REJECT
```
Pilot 30 ảnh chạy sync loop được (5–15s/ảnh); scale thì chunk 50–100/lượt gọi, không cần queue infra mới.

## 19. Rủi ro chi phí / rate-limit

| Hạng mục | Pilot 30 | Full ~4.000 từ sạch (+30% retry) |
|---|---|---|
| Concept LLM (Fireworks) | ~0đ | < $1 |
| Image FLUX schnell-class | ~$0.1 | ~$15–25 |
| Image FLUX dev-class | ~$0.8 | ~$130 |
| Image gpt-image-1 | ~$1.5 | ~$220+ |
| Vision QA | ~$0.1 | ~$10–20 |

(Giá ước lượng, PHẢI verify pricing provider trước khi chốt.) Rate-limit: đã có concurrency limiter/circuit breaker phía text; image provider cần throttle ~2–4 concurrent. Ledger: ghi `AiUsageLedger` cho batch admin để COGS nhìn thấy (bài học H-1).

## 20. Rủi ro style-drift (rủi ro số 1)

- Editorial "controlled imperfection" khó giữ ổn định hơn flat-geometric; 5.000 ảnh sẽ drift nếu chỉ dựa prompt chay.
- Giảm nhẹ: reference set 8–12 anchor + seed cố định họ hàng + condensed prompt chặt + palette QA tự động + collection review mỗi batch + chấp nhận tỉ lệ regenerate 20–30%.
- Model khác nhau "hiểu" prompt này rất khác nhau ⇒ **pilot phải chạy A/B tối thiểu 2 provider** trước khi cam kết.

## 21. Scale lên 5.000+

Batch theo CEFR (A1 → A2 → B1...), chunk 100/đêm, resumable nhờ filter `image_url IS NULL` + `image_status`, ưu tiên từ có `frequency_rank` cao trước. Từ bẩn (mục 10) tự động bị loại tới khi dọn xong.

## 22. Kế hoạch pilot (đề xuất, CHỜ DUYỆT)

1. **P0**: migration V274+ (3 cột) + `GaleriePromptFactory` + `GalerieConceptService`; chạy concept cho đúng 30 từ pilot mục 30 (đủ 5 families).
2. **P1**: provider A/B — gen 30 từ × 2 provider (đề xuất: FLUX-dev-class + 1 model khác), cùng visualConcept.
3. **P2**: Galerie overview grid (admin) hiển thị 2 bộ cạnh nhau → owner collection-review theo checklist mục 31 → chốt provider + chốt `galerie-v1`.
4. **P3**: QA tự động (vision + palette) chạy trên bộ chốt → đo tỉ lệ PASS.
5. **P4**: batch A1 (~700 từ sạch) → review → APPROVED dần.
6. Song song: A1/A2 plan cũ (VocabReviewCard.imageUrl) để flashcard SRS nhận ảnh; mobile cần `expo-image` ⇒ **native build mới, không OTA** (đã biết từ plan 14/07) — web nhận trước, mobile theo build kế.

## Điểm cần owner QUYẾT trước khi code

1. **Quan hệ với chiến lược 3 tầng cũ (plan 14/07)**: Galerie spec cho MỌI từ có artwork (kể cả abstract → metaphor), khác Tầng 3 "không ảnh". Đề xuất: Galerie = nguồn chính; vocabGlyph icon = placeholder khi chưa APPROVED (mục 24). Icon Tầng 1 không còn là đích, chỉ là fallback. → Xác nhận?
2. **Provider pilot A/B**: chốt cặp nào (Fireworks-FLUX nếu có + fal.ai FLUX dev? thêm gpt-image-1?). Cần key nào owner cấp?
3. **Ngân sách pilot** (~$1–3) và ngân sách full (~$15–130 tuỳ model) — trần bao nhiêu?
4. Migration 3 cột trên `words` — OK không, hay muốn bảng riêng?
