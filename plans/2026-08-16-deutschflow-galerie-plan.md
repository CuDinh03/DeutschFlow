# DeutschFlow Galerie — Báo cáo phân tích codebase & kế hoạch (CHƯA IMPLEMENT)

Ngày: 2026-08-16 · Trạng thái: **ĐÃ DUYỆT 16/08 → P0 code xong (nhánh `feat/galerie-p0-concept`, 22/22 unit test PASS)** · Spec gốc: master prompt "DeutschFlow Galerie" owner cung cấp 16/08.

> **Tiến độ P0 (16/08):** V274 (image_family/image_concept/image_status) · `GaleriePromptFactory` (concept + condensed + full, version `galerie-v1`) · `GalerieConceptService` (tier BATCH, ledger `galerie.concept`, lọc data bẩn theo Ô NGHĨA — đính chính 16/08: lemma TAB chỉ ~24 từ, phần bẩn thật là nghĩa nhồi/rác → filter `length(meaning)<=120` + `[[:cntrl:]]`) · `GalerieAdminController` (ADMIN-only: POST concepts, POST concepts/by-ids, GET overview, GET missing-count). CÒN P0: merge PR + deploy + chạy concept 30 từ pilot (cần token ADMIN).

> ⚠️ Ghi chú về ảnh tham chiếu owner gửi kèm: ảnh đó truyền tải đúng *tinh thần* (editorial, controlled imperfection, micro-scene, negative space) nhưng palette của nó (sage/xanh xám/pastel) **không phải palette Galerie** (gold–brick red–ink–cream). Chỉ dùng làm tham chiếu độ "artistic", không dùng làm style reference khi gen.

> 🔄 **ĐỔI HƯỚNG P1 (owner quyết 16/08): dùng CLAUDE tạo artwork.** Ràng buộc kỹ thuật: Claude API **không sinh ảnh raster** (không có image-generation endpoint) — Claude tạo artwork bằng cách **viết SVG**. Toàn bộ mục 5/12/19/20/22 bên dưới được viết lại theo hướng SVG-first; nhánh FLUX/diffusion hạ xuống làm phương án dự phòng nếu pilot SVG không đạt bar "organic editorial" của master prompt. Concept pipeline P0 giữ nguyên — visualConcept là đầu vào cho cả hai hướng.

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

- Text: **Fireworks** (sống, có key, có resilience) — giữ cho concept/classify (P0 đã chạy).
- Artwork: **Claude (Anthropic API)** theo quyết định owner 16/08. Claude không có endpoint sinh ảnh raster — artwork được tạo dưới dạng **SVG do Claude viết** từ visualConcept.
- **Kết quả pilot A/B (owner tự chạy 16/08, prompt `plans/galerie/prompt-pilot-svg-ab.md`): Sonnet 5 và Opus 5 đều "vẽ xấu hơn Fable 5"** ⇒ **model chốt: `claude-fable-5`** ($10/$50 per MTok; Batch API giảm 50% → $5/$25). Lưu ý kỹ thuật khi code P2 với Fable 5: xử lý `stop_reason: "refusal"` + bật `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`), org cần data-retention ≥30 ngày (không ZDR).
- Phép thử tiết kiệm để ngỏ: lượt A/B chưa có few-shot anchor — sau khi Fable 5 tạo xong anchor set APPROVED, thử lại Sonnet 5 + anchors; nếu bắt kịp thì chạy full bằng Sonnet (rẻ ~1/4). Nếu không, chạy full Fable 5.
- Cần `ANTHROPIC_API_KEY` mới (vendor mới — owner tạo key + đặt trần chi tiêu). Diffusion (FLUX) vẫn là DỰ PHÒNG xa.

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

## 12. Chiến lược artwork generation (SVG bằng Claude — sửa 16/08)

- **Master artwork = SVG** (viewBox vuông ~1024, canvas cream `#F6F3EC`), Claude viết từ visualConcept + master prompt full của owner (context Claude dài — KHÔNG cần bản condensed như FLUX; giữ bản condensed trong PromptFactory cho nhánh dự phòng diffusion).
- Prompt yêu cầu **organic editorial**: path bezier bất đối xứng có chủ đích, silhouette biểu cảm — KHÔNG lặp lại lỗi "geometric Bauhaus" của bộ mock 14 từ (spec mục 6–7). Đây là điểm pilot phải chứng minh.
- **Style anchors thật sự khả thi**: nhét 3–5 SVG đã APPROVED vào prompt làm few-shot (điều diffusion không làm được sạch) + **prompt caching** cho khối master-prompt+anchors ⇒ mọi lượt sau đọc cache ~0.1× giá.
- **Sanitize/validate bắt buộc trước khi lưu** (SVG là code): chỉ cho phép tập tag hình học an toàn (path/rect/circle/ellipse/polygon/g/defs/use), CẤM `<script>`, `<text>/<tspan>` (spec cấm chữ — enforce bằng parser, không cần vision!), event handler, href ngoài; cap kích thước ~20KB.
- **Serve SVG trực tiếp**: web render native; mobile đã có `react-native-svg` (SvgXml) — KHÔNG cần `expo-image`, mở lại khả năng **ship OTA** (đảo ngược ràng buộc build-native của nhánh raster!). Rasterize WebP (Batik) chỉ cho vision-QA + og-image nếu cần.
- **1 master artwork/từ** — SVG sắc nét mọi kích thước ⇒ mục 18 (thumbnail strategy) thành miễn phí, không crop metadata.
- Sinh qua **Anthropic Batch API** (50% giá, kết quả ≤1h, hợp chunk đêm) cho batch lớn; pilot chạy sync.

## 13. Chiến lược QA

- **Semantic** (ưu tiên 1, mục 19): rasterize SVG → Claude **vision** (cùng vendor, cùng key) nhìn ảnh KHÔNG mớm từ → mô tả → so khớp meaning → PASS/REVIEW.
- **Palette compliance = DETERMINISTIC, 0đ** (lợi thế lớn của SVG): parse thuộc tính fill/stroke, whitelist đúng 5 mã hex Galerie — không cần histogram xấp xỉ như raster.
- **Text detection = DETERMINISTIC, 0đ**: sanitizer đã cấm `<text>/<tspan>` từ đầu (chữ vẽ bằng path vẫn có thể lọt → vision semantic bắt nốt).
- **Thumbnail readability**: SVG scale vô hạn nên chỉ cần soi độ rối (đếm element > ngưỡng ⇒ REVIEW); QA thủ công ở pilot.

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

Ước tính mỗi SVG: ~1.5–3K token input (master prompt + anchors, phần lớn CACHE ~0.1×) + ~2–4K token output. Giá niêm yết (Batch API = 50%):

| Hạng mục | Pilot 30 | Full ~4.000 từ sạch (+30% retry) |
|---|---|---|
| Concept LLM (Fireworks — P0 giữ nguyên) | ~0đ | < $1 |
| **SVG Claude Fable 5 batch ($5/$25 MTok) — MODEL CHỐT** | **0đ — sinh ngay trong phiên Claude Code (chính là Fable 5)** | ~$350–500 |
| SVG Sonnet 5 + anchors (phép thử tiết kiệm, chưa chốt) | — | ~$80–130 nếu bắt kịp chất lượng |
| Vision QA (Claude vision, batch) | ~0đ | ~$15–25 |
| Nhánh dự phòng FLUX dev-class | — | ~$130 |

(SVG đắt hơn FLUX schnell trên đơn giá nhưng bù lại: QA palette/text 0đ, storage ~3–5KB/file, thumbnail miễn phí, mobile OTA được, style ổn định hơn.) Rate-limit: throttle 2–4 concurrent khi sync; Batch API tự quản. Ledger: ghi `AiUsageLedger` provider `anthropic` cho COGS (bài học H-1).

## 20. Rủi ro style-drift (rủi ro số 1)

- Với SVG-bằng-Claude, drift **màu/chữ/khung** gần như triệt tiêu (enforce bằng code); rủi ro chuyển sang **chất "organic handcrafted"**: SVG do LLM viết dễ trượt về geometric/icon-look — chính điểm master prompt cấm (mục 6, STRICTLY AVOID "icon library").
- Giảm nhẹ: few-shot 3–5 SVG anchor đã APPROVED trong prompt (khả thi thật với text model) + prompt yêu cầu path bezier bất đối xứng + collection review mỗi batch + chấp nhận regenerate 20–30%.
- **Cửa quyết định nằm ở pilot P1**: nếu 30 SVG bị owner đánh giá "vẫn như icon", kích hoạt nhánh dự phòng diffusion (FLUX) thay vì cố ép.

## 21. Scale lên 5.000+

Batch theo CEFR (A1 → A2 → B1...), chunk 100/đêm, resumable nhờ filter `image_url IS NULL` + `image_status`, ưu tiên từ có `frequency_rank` cao trước. Từ bẩn (mục 10) tự động bị loại tới khi dọn xong.

## 22. Kế hoạch pilot (đề xuất, CHỜ DUYỆT)

1. **P0** ✅ (16/08): migration V274 + PromptFactory + ConceptService + endpoints, MERGED #364 + hotfix schema #365; chạy concept 30 từ pilot sau deploy fix.
2. **P1 (SVG pilot, 0đ API)**: sinh 30 SVG **ngay trong phiên Claude Code** từ 30 visualConcept pilot (đủ 5 families, gồm cả HANDLUNG/GEFÜHL — thử thách organic thật sự) → dựng grid overview → owner collection-review theo checklist mục 31. Đây là cổng go/no-go SVG-vs-diffusion.
3. **P2 (nếu SVG đạt)**: backend `GalerieSvgGenerationService` (Anthropic Java SDK + Batch API + sanitizer + validator palette/text) + tab review admin; cần owner tạo `ANTHROPIC_API_KEY`.
4. **P3**: QA tự động (validator deterministic + Claude vision semantic) → đo tỉ lệ PASS trên pilot.
5. **P4**: batch A1 (~700 từ sạch) qua Batch API → review → APPROVED dần.
6. Song song: A1/A2 plan cũ (VocabReviewCard.imageUrl) để flashcard SRS nhận ảnh; **SVG + react-native-svg sẵn có ⇒ mobile ship OTA được, KHÔNG cần expo-image/build native** (đảo ngược ràng buộc cũ).

## Điểm cần owner QUYẾT

1. ~~Provider pilot A/B~~ → **ĐÃ QUYẾT 16/08: Claude (SVG-first)**, diffusion là dự phòng nếu pilot fail bar organic.
2. ~~Migration 3 cột~~ → đã merge V274 (#364).
3. ~~Chốt model~~ → **ĐÃ QUYẾT (pilot A/B 16/08): `claude-fable-5`** — Sonnet 5/Opus 5 bị owner đánh giá vẽ xấu hơn. Còn lại: owner tạo `ANTHROPIC_API_KEY` + trần chi tiêu (~$350–500 full kho, Batch API) khi bước vào P2; phép thử Sonnet+anchors để hạ giá quyết sau khi có anchor set.
4. **Quan hệ với chiến lược 3 tầng cũ (plan 14/07)**: đề xuất Galerie = nguồn chính; vocabGlyph icon = placeholder khi chưa APPROVED (mục 24). → Xác nhận?
