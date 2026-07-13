# Plan: Hình ảnh hoá lộ trình · bài tập · flashcard (giảm "thuần chữ")

Ngày: 2026-07-14 · Trạng thái: **Hạng mục C ✅ CODE + TEST XANH (chưa commit)** · Scope: mobile + backend

> Tiến độ 14/07: **C xong + đã qua review đối kháng** (glyph roadmap + icon loại bài, JS-only OTA-safe) — `tsc` 0 lỗi, jest **210/210** (20 case topicGlyph). Review 5-finding (0 CRITICAL/HIGH) đã vá hết: (1) ẩn icon Prompt khỏi screen-reader; (2) bỏ icon trùng ở reveal card (giữ badge chữ); (3) thêm rule `grammar` (node ngữ pháp có glyph riêng thay vì dồn hết vào default) + làm đậm icon gold/orange/success đạt ≥3:1 (test tính luminance thật); (4) shopping thắng numbers khi cùng tag; (5) ghi chú collision substring tiềm ẩn (verify sạch trên seed V61–V258). Kế tiếp: A (render icon vocab). **Phát hiện quan trọng:** vì đổi sang icon (SVG local, không remote raster) nên **A KHÔNG cần `expo-image` → cũng ship OTA được, không chờ build 13** (A5 thành thừa).

## 1. Hiện trạng (đã khảo sát code)

Màn hình thuần chữ: `roadmap.tsx` (tab "Giai đoạn"), `node.tsx` (lý thuyết + VocabRow), `node-practice.tsx`, `srs.tsx`, `vocabulary.tsx`.

Hạ tầng đã có sẵn — **không cần migration cho ảnh từ vựng**:

- `words` đã có `image_url`, `audio_url`, `image_source`, `image_style`, `image_prompt`, `image_generated_at` (entity `Word.java:50`).
- Pipeline ảnh từ vựng hiện tại = **Unsplash** (không phải Bedrock): `VocabularyImageGeneratorService` search Unsplash → tải → S3 qua `MediaAssetService` → `applyGeneratedImage()` ghi full public URL vào `words.image_url`. Có batch (`VocabularyImageBatchService` lọc `image_url IS NULL`), review (`VocabularyImageReviewService`), admin manual-unsplash, SSRF guard chỉ cho `*.unsplash.com`.
- Module `aiimage` có **Bedrock provider** (`AiImageGenerationService` + `BedrockImageGenerationProvider` + `AiImagePromptBuilder` nhận preset/style) nhưng CHƯA nối vào vocab.
- DTO mang ảnh ra client: `VocabReviewCard` (SRS) thiếu `imageUrl`. ⚠️ SỬA (verify 14/07): `WordListItem` **ĐÃ có** `imageUrl` (field dòng 24) và `WordQueryService` đã SELECT + map (dòng 291) → **A3 backend coi như xong**, chỉ còn render mobile. `image_url` dùng chung cho cả URL raster lẫn convention `icon:<key>` (xem B0).
- `vocab_review_schedule` **denormalized** (german/meaning copy vào, `vocab_id` = slug, không FK tới `words`) — xem Q1.
- Mobile: chưa có `expo-image`, chưa render ảnh remote nào; đồ hoạ toàn SVG (`react-native-svg`) + `lucide-react-native`; theme Galerie warm-paper (`themes.ts`): gold `#FFCD00`, gold text `#C79A00`, đỏ `#DA291C`, paper `#FBFAF7`, sunken `#F6F3EC`, ink `#161513`, editorial violet/teal/orange.

## 2. Quyết định nguồn ảnh

- **D1 (cập nhật chiều 14/07 — tối ưu chi phí) — Ảnh từ vựng: hybrid 3 tầng, ưu tiên miễn phí:**
  - **Tầng 1 (free, mặc định) — icon SVG tô màu Galerie:** từ cụ thể map sang icon phẳng — Lucide đã cài (~1.5k icon, ISC), bổ sung Phosphor (MIT, ~9k) nếu cần phủ rộng — tô ink/gold trong tile `#F6F3EC`. Đây là phương án ĐỒNG BỘ STYLE NHẤT vì app vốn thuần SVG flat (skill-tree glyphs, personas, BrandMark); render local → offline được, 0đ, không tốn S3/bandwidth. Map từ→icon bằng 1 lần chạy LLM (text, gần 0đ), lưu `icon_key`.
  - **Tầng 2 — AI-gen chỉ cho từ cụ thể KHÔNG có icon phù hợp:** local FLUX.1 schnell (license Apache 2.0, free kể cả thương mại) trên Mac Apple Silicon qua Draw Things/mflux/ComfyUI — 0đ API, chạy overnight; hoặc Bedrock Titan ($0.01/ảnh) nếu muốn nhanh. Style-lock prompt `galerie-v1` như cũ.
  - **Tầng 3 — từ trừu tượng/chức năng: không ảnh** (xem B5).
  - Unsplash hạ xuống fallback thủ công. Lý do bỏ photo mặc định: mỗi tấm một kiểu không đồng bộ editorial + rủi ro license khi dùng đại trà có hệ thống. Bedrock trả phí giờ là **tuỳ chọn tăng tốc**, không phải mặc định.
- **D2 — Lộ trình/chủ đề: KHÔNG dùng ảnh raster.** Dùng tile màu + icon lucide (rule-based, thuần mobile), về sau nâng thành bộ SVG glyph riêng (app đã có tiền lệ: 14 nhân vật speaking, skill-tree glyphs, YellowSquare).
- **D3 — Khung hiển thị đồng nhất:** mọi ảnh nằm trong tile nền `surfaceSunken #F6F3EC`, radius `sm` (4), tỉ lệ cố định (1:1 thumbnail 40px; 4:3 trên flashcard), `contentFit="contain"`. Nhất quán đến từ khung + style prompt, không phụ thuộc từng tấm ảnh.
- **Style prompt đề xuất (duyệt pilot trước khi chốt):** `flat vector illustration of {baseForm} ({meaning}), single centered object, solid warm cream background #F6F3EC, limited palette (mustard gold, brick red, ink black), sharp minimal geometric shapes, no text, no letters, no gradient, no shadow, no border`.

## 3. Hạng mục A — Nối `imageUrl` ra flashcard & từ điển

Backend (nhỏ, không migration nếu Q1 pass):

- A1. `VocabReviewCard` record: thêm `String imageUrl` (nullable).
- A2. `SrsService`: khi trả due cards, parse các `vocab_id` dạng `'word_'+id` → batch-lookup 1 query `SELECT id, image_url FROM words WHERE id IN (...)` (tránh N+1). **Q1 ĐÃ trả lời (14/07): không match qua german/base_form; chỉ thẻ có `vocab_id = 'word_'+id` join được words — thẻ từ luồng node/session/beginner thì không.** Quyết định: **phủ MỘT PHẦN, không migration** — thẻ không join được trả `imageUrl = null`, UI fallback sẵn (A6).
- A2b. Tăng coverage dần, không migration: sửa các luồng enqueue (node/session/beginner) từ nay ghi `vocab_id = 'word_'+id` khi có wordId → thẻ mới tự join được. Phase sau mới cân nhắc match best-effort `german` (bỏ mạo từ) ↔ `base_form` sau khi verify data — gắn nhầm ảnh tệ hơn không ảnh. Migration thêm cột vào `vocab_review_schedule` chỉ khi số liệu cho thấy coverage kẹt thấp.
- A3. `WordListItem`: thêm `imageUrl` — chỉ việc map ra DTO vì SQL đã SELECT sẵn.
- A4. DTO từ vựng trong node content (nguồn của `VocabRow` ở `node.tsx`): thêm `imageUrl` tương tự nếu thiếu.

Mobile:

- A5. Cài `expo-image` (cache + placeholder). ⚠️ Native module → **cần build mới, KHÔNG OTA được**.
- A6. `srs.tsx`: type `RawDueCard`/`DueCard` + `imageUrl`; mặt trước render ảnh 4:3 trong tile phía trên từ (như mockup 14/07); `imageUrl == null` → giữ nguyên layout hiện tại, không placeholder xám.
- A7. `vocabulary.tsx` `WordRow` + `node.tsx` `VocabRow`: thumbnail 40×40 bên trái.
- A8. Prefetch ảnh 5 thẻ kế tiếp trong session SRS (`Image.prefetch`).

## 4. Hạng mục B — Nguồn ảnh style-lock (hybrid 3 tầng)

- B0. **Icon mapping (Tầng 1, làm trước):** chạy LLM 1 lần map toàn bộ từ cụ thể → tên icon Lucide/Phosphor + màu tile theo nhóm chủ đề (đồ ăn/con vật/phương tiện/nhà cửa...). Lưu `words.icon_key` (migration nhỏ, cột text nullable) hoặc convention `image_url = "icon:apple"` — chốt khi code. Mobile render qua map `icons` của lucide-react-native. Pilot map thử 100 từ A1 để đo coverage thực tế (kỳ vọng 50–70% từ cụ thể) → Q4.
- B1. Prompt builder riêng cho vocab (template ở D2/D3), hằng `STYLE = "galerie-v1"` ghi vào `image_style` — dùng chung cho cả local gen lẫn Bedrock.
- B2. `VocabularyImageGeneratorService`: thêm nhánh provider AI (`ImageGenerationProvider`/Bedrock) song song Unsplash; chọn qua config `app.vocab-image.provider=bedrock|unsplash`. Upload vẫn qua `MediaAssetService` → `applyGeneratedImage()` giữ nguyên (review/apply không đổi).
- B3. **Pilot 20 từ** trước batch: trộn danh từ cụ thể, trừu tượng, động từ, tính từ → duyệt qua màn review sẵn có → chỉnh prompt → mới chạy batch.
- B4. Batch re-style: `VocabularyImageBatchService` thêm mode `WHERE image_style IS DISTINCT FROM 'galerie-v1'` để thay dần ảnh Unsplash cũ (hiện batch chỉ lọc NULL).
- B5. Từ trừu tượng/chức năng ("vielleicht", "obwohl"...): mặc định **không sinh ảnh** (UI đã fallback); cân nhắc icon ẩn dụ sau pilot.
- Q2: format/size ảnh — mục tiêu ~512×512 WebP (nhẹ 3–5× PNG); kiểm tra output provider, nếu chỉ PNG thì convert trước khi upload.

### Chi phí (verify 14/07/2026, giá Bedrock public)

Trả **1 lần cho mỗi từ** (ảnh lưu S3 vĩnh viễn), KHÔNG theo user/lượt xem. Recurring chỉ là S3 + bandwidth (2k ảnh WebP ≈ 60MB lưu trữ, không đáng kể; client cache qua expo-image).

| Phương án | Đơn giá | 2.000 từ (+30% retry) |
|---|---|---|
| Icon SVG (Tầng 1) | 0đ | **0đ** |
| FLUX.1 schnell local (Mac) | 0đ API | **0đ** (thời gian máy chạy) |
| Bedrock Titan Image 1024² | $0.01/ảnh | ~$26 |
| Bedrock Stable Image Core | $0.04/ảnh | ~$104 |
| Bedrock Nova Canvas standard | $0.04–0.06/ảnh | ~$104–156 |

Với hybrid 3 tầng: Tầng 2 chỉ còn ~300–600 từ → local = 0đ, hoặc Titan ≈ **$4–8**. Ước lượng "$30–80" trước đó là kịch bản AI-gen toàn bộ kho — không còn là mặc định.

## 5. Hạng mục C — Glyph chủ đề roadmap & bài tập (không cần asset mới) ✅ ĐÃ LÀM 14/07

- C1. ✅ `mobile/lib/topicGlyph.ts` (thuần, test được) — `matchTopicGlyph(node)` → `{ key, tint }` bằng keyword title/tags/coreTopics (DE+VI), `topicGlyphColors(colors, tint)` → `{ tileBg, iconColor }` theo palette editorial. Map key→icon Lucide + render ở `components/ui/TopicGlyphTile.tsx`. Fallback `default=BookOpen/gold` (không bao giờ tile rỗng). ⚠️ Bài học: substring dễ va nhau (`zeit`∈`jahreszeit`/`freizeit`, `haus`∈`krankenhaus`, `nummer`∈`telefonnummer`) — đã né bằng bỏ keyword trần + xếp health trước home; có unit test `__tests__/topicGlyph.test.ts` (16 case) chốt lại.
- C2. ✅ `roadmap.tsx` `NodeRow` (tab Giai đoạn): tile glyph 40×40 radius sm bên trái nội dung card (dim khi locked). **Progress-bar mỏng HOÃN** — `SkillNode` không có % tiến độ per-node trên wire; không bịa data. Cần field mới nếu muốn.
- C3. ✅ `node-practice.tsx`: `Prompt` nhận `icon?` — tile 22px nền sunken cạnh số thứ tự, theo loại bài (MULTIPLE_CHOICE=ListChecks/FILL_BLANK=PenLine/TRANSLATE=Languages/REORDER=Shuffle). `skill-practice.tsx` **HOÃN** (đã có sẵn `SKILL_EMOJI/SKILL_LABEL`, để đợt polish sau nếu muốn đổi emoji→lucide).
- C4. (Phase sau, sau A) Bài tập "chọn icon đúng nghĩa" dùng `icon_key`/`image_url` — giảm chữ mạnh nhất cho practice.
- **Verify:** `tsc --noEmit` exit 0; jest 206/206 (16 mới cho topicGlyph). Device-QA trên simulator/TestFlight còn nợ (agent không preview được Expo).

## 6. Thứ tự triển khai & rollout

1. ✅ **C** (JS-only → ship OTA, không cần build mới): DONE 14/07, chờ device-QA + commit.
2. **A** (BE nhỏ: `VocabReviewCard.imageUrl` + join `vocab_id='word_'+id` phủ một phần; FE render `TopicGlyphTile`/icon cho vocab). ⚠️ Vì đã chuyển sang icon local → **KHÔNG cần `expo-image`, ship OTA được luôn** (không phụ thuộc build 13). Còn phần ảnh raster (nếu sau này bật B Tầng 2) mới cần `expo-image`.
3. **B** (icon-mapping Tầng 1 trước: LLM map từ→`icon_key`; Tầng 2 AI-gen chỉ khi cần). B0 độc lập deploy: `icon_key` nằm chờ trong DB, client cũ bỏ qua field mới → an toàn.

## 7. Verification

- BE: unit test `SrsService` map `imageUrl` (có/null); xác nhận lookup 1 query, không N+1; API response size due-cards.
- FE: simulator kiểm 2 case ảnh có/null trên srs/vocabulary/node; kiểm cache expo-image khi offline.
- Ảnh: 100% ảnh galerie-v1 đi qua màn review trước khi apply.

## Câu hỏi mở

- ~~Q1~~ ĐÃ trả lời 14/07: join qua `vocab_id = 'word_'+id` (một phần thẻ); german/base_form không dùng để match ở v1. Chốt: phủ một phần + A2b.
- Q2: output format Bedrock + convert WebP.
- Q3: model Bedrock nào đang cấu hình cho `BedrockImageGenerationProvider` (Stable Image Core/SD3?) — ảnh hưởng chất lượng flat vector + giá. Chỉ cần trả lời nếu chọn nhánh Bedrock ở Tầng 2.
- Q4: coverage icon thực tế của Tầng 1 — map thử 100 từ A1, đo % có icon đạt; quyết định quy mô Tầng 2 từ số này.
