# DeutschFlow

Nền tảng học tiếng Đức kết hợp mã hóa màu sắc theo giống từ, logic ngữ pháp kiểu Lego và AI.

## Tech Stack

- **Backend:** Java 17 + Spring Boot 3.2
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** MySQL 8.0
- **Realtime:** STOMP over WebSocket
- **AI:** OpenAI GPT-4o + Whisper

## Yêu cầu

- Java 17+, Maven 3.8+
- Node.js 18+
- MySQL 8.0 (local hoặc remote)

## Cấu hình môi trường

```bash
cp .env.example .env
```

Cập nhật tối thiểu các biến sau trong `.env`:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET` (ít nhất 32 ký tự)

## Chạy local không Docker

```bash
# 0. Kiểm tra duplicate repeatable migration (an toàn cho profile local)
./scripts/check-flyway-repeatables.sh

# 1. Chạy Backend
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# 2. Chạy Frontend
cd frontend && npm install && npm run dev
```

Nếu guard báo lỗi duplicate repeatable giữa `db/migration` và `db/migration-local`, hãy giữ mỗi description ở đúng một nơi trước khi chạy backend.

Truy cập: `http://localhost:3000`

> Demo users chỉ được seed khi chạy profile `local` (migration-local).  
> Môi trường shared/prod sẽ tự dọn các tài khoản demo bằng migration `V11`.

### Vocabulary: import CEFR ~10k và batch IPA (admin)

Sau khi đăng nhập **ADMIN**, có thể gọi:

- `POST /api/admin/vocabulary/cefr/import` — import wordlist theo cấp (mặc định ~10k, dedup ưu tiên cấp cao), tag `CEFR_CURATED`. Mặc định đọc wordlist từ `backend/src/main/resources/wordlists/` (offline, không HTTP). Enrich nghĩa/IPA qua `wordlists/local_lexicon.tsv` khi `GOETHE_ENRICH_SOURCE=local_only` (mặc định).
- `POST /api/admin/vocabulary/cefr/import/sample` — import file mẫu `classpath:wordlists/cefr_import_sample.csv` (kiểm thử nhanh).
- `POST /api/admin/vocabulary/ipa/batch?limit=200&resetCursor=false` — làm đầy `words.phonetic` từ Wiktionary, chuẩn hóa IPA dạng `[…]`; có resume qua bảng `vocabulary_import_state` (nguồn `WIKTIONARY_IPA`).

**Offline (không API):** `wordlists/goethe_sorted.txt`, `de_50k.txt`, `cefr_a1_patsy.txt` + `wordlists/local_lexicon.tsv` (thêm dòng để mở rộng nghĩa VI/EN và IPA). Profile **`local`** dùng `application-local.yml`: `enrich-source: local_only`, `wordlist-source: classpath`, `cefr-curated.use-remote-sources: false`.

**DeepL / Wiktionary (tuỳ chọn):** đặt `GOETHE_ENRICH_SOURCE=online`, `DEEPL_API_KEY`, và có thể `GOETHE_ENRICH_WITH_WIKTIONARY=true` — gọi dịch vụ bên ngoài. `CEFR_CURATED_REMOTE_SOURCES=true` để import CEFR tải wordlist qua HTTP thay vì file trong classpath.

**Batch IPA** (`POST .../ipa/batch`) vẫn gọi Wiktionary qua HTTP — chỉ dùng nếu bạn chấp nhận kết nối đó.

Biến khác: `CEFR_CURATED_*`, `IPA_BATCH_WORDS_PER_RUN`, `IPA_BATCH_REQUEST_DELAY_MS`, `LOCAL_LEXICON_RESOURCE`.

## Tùy chọn: chạy MySQL bằng Docker

Nếu bạn không có MySQL local, có thể dùng Docker chỉ cho DB:

```bash
# chuẩn bị env
cp .env.example .env
# điền DB_ROOT_PASSWORD, DB_USERNAME, DB_PASSWORD trước khi chạy

docker compose up -d
```
