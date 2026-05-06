# DeutschFlow — Architectural Remediation Plan v1.0

> **Vai trò**: Principal System Architect · Full-stack Tech Lead
> **Ngày**: 06/05/2026
> **Phạm vi**: FE-BE Gap Resolution + Production Caching Architecture

---

## Phần 1: Chiến Lược Lấp Đầy FE-BE Gap

### 1.1. Bản Đồ Hiện Trạng

Sau khi kiểm kê toàn bộ codebase, hệ thống hiện có:

| Lớp | Số lượng | Ghi chú |
|-----|----------|---------|
| **Backend API endpoints** | ~85 endpoints | Across 12 controllers |
| **Frontend pages** | 41 page.tsx | Across student/admin/teacher shells |
| **API libs (FE)** | 8 api modules | aiSpeakingApi, todayApi, reviewTasksApi, weeklySpeakingApi, errors/drillApi, planAttemptsApi, localAiApi, adminApi |

**Vấn đề cốt lõi**: Backend đã xây ~85 endpoints nhưng Frontend chỉ consume ~45 trong số đó. Khoảng **40 endpoints đang "mồ côi"** — có logic phía server nhưng không có UI nào gọi tới.

---

### 1.2. Phân Loại & Ưu Tiên API

#### P0 — Cần UI ngay (User-facing, ảnh hưởng trực tiếp trải nghiệm học)

| API Group | Endpoints | UI cần xây | Lý do P0 |
|-----------|-----------|------------|----------|
| **AI Vocabulary** (`/api/vocabulary/ai/*`) | `POST /examples`, `/usage`, `/mnemonic`, `/similar`, `/story`, `/etymology`, `/quiz` — 7 endpoints | **Vocab Detail Modal** với tabs: Ví dụ · Cách nhớ · Từ tương tự · Câu chuyện · Nguồn gốc · Mini Quiz | 7 endpoint AI đã viết, FE vocab page chỉ hiển thị danh sách, **chưa có detail view** nào consume. Đây là core value proposition |
| **Error Skills + Review Tasks** | `GET /error-skills/me`, `POST /me/{code}/repair-attempt`, `GET /review-tasks/me/today`, `POST /{id}/complete` | **Error Drill Screen** — hiển thị lỗi cần sửa hôm nay + nút "Luyện sửa lỗi" | FE `/student/errors` chỉ liệt kê lỗi, **chưa có luồng repair/drill** |
| **XP & Gamification** | `GET /xp/me`, `POST /xp/me/badges/ack` | **XpLevelPill** (đã có) + **Leaderboard page** | Vừa xây xong V58 + XpService, FE pill đã gắn nhưng chưa có full leaderboard |
| **Spaced Repetition Reviews** | `GET /reviews/due`, `POST /reviews/{id}/grade` | **Review Queue Screen** — flashcard-style ôn tập theo lịch | Backend có SM-2 algorithm nhưng FE chưa có màn hình ôn tập |

#### P1 — Cần UI sớm (Nâng cao trải nghiệm, tăng retention)

| API Group | Endpoints | UI cần xây |
|-----------|-----------|------------|
| **AI Misc** (`/api/ai/*`) | `POST /translate/to-english`, `/translate/to-german`, `/grammar/correct`, `/grammar/explain` — 4 endpoints | **Quick Tools Toolbar** trong vocab/speaking pages — nút dịch nhanh, kiểm tra ngữ pháp |
| **AI Conversation + Roleplay** | `POST /speaking/ai/conversation`, `/roleplay`, `/scenario`, `/cultural-context` — 4 endpoints | Tích hợp vào **Speaking Welcome Screen** như các mode chọn |
| **Weekly Speaking Detail** | `GET /ai-speaking/weekly/me/submissions/{id}` | **Submission Detail View** — hiện FE weekly page chỉ có list, thiếu detail |
| **Word Coverage Analytics** | `GET /words/coverage`, `/coverage/history`, `/coverage/translation`, `/coverage/translation/history` | **Vocabulary Analytics Dashboard** — biểu đồ tiến độ từ vựng theo thời gian |

#### P2 — Chạy ngầm / Admin-only (Không cần UI student)

| API Group | Endpoints | Xử lý |
|-----------|-----------|-------|
| **Admin Vocab Operations** | `POST /admin/vocabulary/glosbe-vi/enrich/batch`, `/deepl-lemma-backfill/batch`, `/goethe/import`, `/cefr/import`, `/ipa/batch`, `/wiktionary/enrich/*`, `/auto-tag/batch`, `/reset`, `/cleanup/*` — 12 endpoints | Giữ nguyên admin-only. Chỉ cần **nút trigger** trong Admin Vocabulary page (đã có) |
| **Admin Debug** | `GET /admin/debug/db-info`, `/vocabulary/debug/*` — 3 endpoints | Internal tooling, không cần UI riêng |
| **Teacher Quiz** | CRUD `/teacher/quizzes/*` — 8 endpoints | FE teacher shell đã consume đầy đủ ✅ |

#### P3 — Deprecated / Redundant (Cân nhắc loại bỏ)

| API | Lý do |
|-----|-------|
| `POST /api/ai/conversation/respond` | Trùng chức năng với `/api/ai-speaking/sessions/{id}/chat/stream` (SSE version). Giữ để backward compat nhưng không cần UI mới |
| `POST /api/speaking/ai/conversation` | Tương tự — phiên bản cũ trước khi có session-based architecture |

---

### 1.3. Đề Xuất Pattern Kiến Trúc

#### Tại sao KHÔNG cần API Gateway / BFF cho DeutschFlow hiện tại

DeutschFlow là **monolith modular** (1 Spring Boot app, 1 Next.js app), chưa phải microservices thực sự. Việc thêm API Gateway hay BFF layer lúc này sẽ:
- Tăng complexity không cần thiết (thêm 1 hop mạng, thêm 1 service deploy)
- Gây over-engineering cho team 1-2 dev

**Đề xuất thay thế**: Áp dụng **"Thin API Adapter" pattern** ở frontend:

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js)                          │
│                                              │
│  src/lib/                                    │
│    ├── api.ts           ← Axios instance     │
│    ├── aiSpeakingApi.ts ← Speaking adapter   │
│    ├── vocabAiApi.ts    ← [MỚI] Vocab AI    │
│    ├── reviewApi.ts     ← [MỚI] Reviews     │
│    ├── xpApi.ts         ← [MỚI] XP/Badges   │
│    └── ...                                   │
│                                              │
│  Mỗi adapter:                                │
│    - Type-safe (TypeScript interfaces)        │
│    - Xử lý error/retry riêng                 │
│    - Map BE response → FE domain model        │
└──────────────────┬──────────────────────────┘
                   │ HTTP (axios)
┌──────────────────▼──────────────────────────┐
│  Backend (Spring Boot Monolith)              │
│  /api/* endpoints                            │
└─────────────────────────────────────────────┘
```

**Khi nào chuyển sang BFF**: Khi có **>1 client** (mobile app, 3rd-party integration) hoặc team >5 FE developers.

---

### 1.4. Workflow Map: API → User Flow Screens

```
┌──────────────────────────────────────────────────────────────┐
│                    STUDENT LEARNING FLOW                      │
│                                                              │
│  [Dashboard]──→[Lộ trình]──→[Buổi học]──→[Vocab Detail]     │
│     │              │            │              │              │
│     │              │            │         /vocabulary/ai/*    │
│     │              │            │         (7 AI endpoints)    │
│     │              │            │                             │
│     │         /plan/me      /plan/sessions/submit             │
│     │                                                        │
│  /today/me                                                   │
│  /xp/me ←─── XpLevelPill (header)                           │
│                                                              │
│  [Speaking]──→[Chat SSE]──→[History]──→[Error Drill]         │
│     │            │             │            │                 │
│     │    /sessions/{id}/     /sessions    /error-skills/me    │
│     │     chat/stream        /messages    /repair-attempt     │
│     │                                                        │
│  /ai-speaking/sessions                                       │
│                                                              │
│  [Review Queue]──→[Grade Card]──→[Swipe Cards]               │
│       │                │              │                       │
│   /reviews/due    /reviews/{id}/   (local state)             │
│                    grade                                      │
│                                                              │
│  [Weekly Speaking]──→[Submit]──→[Detail/Rubric]              │
│       │                              │                        │
│  /weekly/current-prompt    /weekly/me/submissions/{id}       │
└──────────────────────────────────────────────────────────────┘
```

**6 màn hình ưu tiên cần xây** (theo thứ tự):

1. **Vocab Detail Modal** — consume 7 AI vocab endpoints
2. **Error Drill Screen** — consume error-skills + repair-attempt
3. **Review Queue** — consume /reviews/due + grade
4. **Quick AI Tools** — dịch nhanh, sửa ngữ pháp inline
5. **Vocab Analytics** — biểu đồ coverage theo thời gian
6. **Leaderboard** — XP ranking (cần thêm 1 endpoint BE)

---

## Phần 2: Thiết Kế Kiến Trúc Caching Cho Production

### 2.1. Tổng Quan Hiện Trạng

| Khía cạnh | Trạng thái hiện tại |
|-----------|---------------------|
| **Application Cache** | Caffeine — 4 caches (tags 10min, words 5min, plans 30min, curriculum 60min). Chỉ `TagQueryService` dùng `@Cacheable` |
| **Distributed Cache** | ❌ Chưa có Redis/Memcached |
| **AI Response Cache** | ❌ Mỗi lần gọi Groq/ElevenLabs đều tốn token/chars |
| **Session Cache** | ❌ JWT stateless, không cache user profile |
| **CDN** | ❌ Static assets serve từ Next.js dev server |

**Rủi ro khi scale**: Với 100 concurrent users, hệ thống sẽ tạo ~200 DB queries/sec cho vocabulary + ~50 AI API calls/min. Không có cache = DB saturation + API cost explosion.

---

### 2.2. Chiến Lược Multi-Layer Caching

```
┌─────────────────────────────────────────────────────────────┐
│                      REQUEST FLOW                            │
│                                                              │
│  Client ──→ [L0: Browser/CDN] ──→ [L1: Caffeine] ──→       │
│             [L2: Redis] ──→ [L3: PostgreSQL / AI API]       │
│                                                              │
│  Mỗi layer là "chốt chặn" — request chỉ đi xuống           │
│  layer tiếp theo khi cache miss.                             │
└─────────────────────────────────────────────────────────────┘
```

#### L0 — Browser & CDN Cache

| Dữ liệu | Chiến lược | TTL |
|----------|-----------|-----|
| Static assets (JS, CSS, fonts) | `Cache-Control: immutable, max-age=31536000` | 1 năm (hash trong filename) |
| Companion images (Lukas, Emma, Anna, Klaus) | `Cache-Control: public, max-age=86400` | 1 ngày |
| API responses (tags, words) | `ETag` + `304 Not Modified` | Theo ETag |

**Lưu ý**: Response có dữ liệu cá nhân (XP, errors, sessions) **KHÔNG BAO GIỜ** cache ở CDN — chỉ `private, no-store`.

#### L1 — Caffeine (Application-level, In-Process)

Dành cho dữ liệu **read-heavy, shared across users, ít thay đổi**.

| Cache Name | Dữ liệu | Max Size | TTL | Eviction |
|------------|----------|----------|-----|----------|
| `tags` | Tag list theo locale | 200 entries | 10 min | Admin tag CRUD |
| `words` | Word search results (keyed by query params) | 500 entries | 5 min | Admin vocab import/edit |
| `subscriptionPlans` | Active plans list | 20 entries | 30 min | Admin plan change |
| `curriculum` | Curriculum JSON (read-only) | 50 entries | 60 min | — |
| `achievements` ⭐ | Achievement definitions | 50 entries | 60 min | Flyway migration (restart) |
| `weeklyPrompts` ⭐ | Current weekly speaking prompt | 10 entries | 30 min | Admin prompt CRUD |
| `aiVocabCache` ⭐ | AI-generated vocab responses | 2000 entries | 24 giờ | LRU tự động |

> ⭐ = cần bổ sung vào CacheConfig hiện tại

**Tại sao Caffeine (không phải Redis) cho L1**: Caffeine chạy in-process, latency ~ns (so với Redis ~ms). Cho single-instance deployment hiện tại, Caffeine đủ dùng và zero-ops.

#### L2 — Redis (Distributed Cache) — Phase 2

Cần khi: **>1 backend instance** (horizontal scaling) hoặc **cache cần persist qua restart**.

| Dữ liệu | Lý do cần Redis | TTL | Key Pattern |
|----------|-----------------|-----|-------------|
| **User session profile** | Giảm `/auth/me` DB query (mỗi page load gọi 1 lần) | 15 min | `user:profile:{userId}` |
| **AI response dedup** | Tránh gọi lại Groq cho cùng prompt (cross-instance) | 24h | `ai:vocab:{hash(word+type)}` |
| **Rate limit counters** | Distributed rate limiting cho AI APIs | Sliding window | `ratelimit:{userId}:{endpoint}` |
| **XP leaderboard** | Redis Sorted Set cho ranking realtime | — | `xp:leaderboard` |
| **Today plan** | Adaptive plan tính toán nặng, cache per-user per-day | Đến 00:00 | `today:{userId}:{date}` |

**Khi nào triển khai Redis**: Khi hệ thống cần **>1 pod/instance** hoặc lượng user >500 DAU.

---

### 2.3. Chiến Lược Cache AI Responses (Trọng Tâm)

Đây là nơi **tiết kiệm nhiều tiền nhất** — mỗi Groq API call tốn token, mỗi ElevenLabs call tốn characters.

#### Nguyên tắc: AI responses chia 2 loại

```
┌──────────────────────────────────────────────┐
│  DETERMINISTIC AI (cacheable)                │
│  ─────────────────────────────               │
│  Input giống nhau → Output giống nhau        │
│                                              │
│  • Vocab examples cho "Tisch"                │
│  • Etymology của "Kindergarten"              │
│  • Mnemonic cho "Brücke"                     │
│  • TTS audio cho "Wie geht es dir?"          │
│                                              │
│  → Cache 24h, key = hash(word + type)        │
│  → Tiết kiệm ~70% AI API calls              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  CONTEXTUAL AI (KHÔNG cacheable)             │
│  ────────────────────────────────            │
│  Phụ thuộc user context, conversation state  │
│                                              │
│  • Speaking chat turn (dựa vào history)      │
│  • Error correction (dựa vào user input)     │
│  • Adaptive suggestions (dựa vào profile)    │
│                                              │
│  → KHÔNG cache response                      │
│  → Chỉ cache INPUT context (system prompt)   │
└──────────────────────────────────────────────┘
```

#### Cụ thể cho từng AI endpoint:

| Endpoint | Loại | Cache Strategy | Key | TTL |
|----------|------|---------------|-----|-----|
| `POST /vocabulary/ai/examples` | Deterministic | ✅ Cache L1 (Caffeine) | `vocab:examples:{word}` | 24h |
| `POST /vocabulary/ai/mnemonic` | Deterministic | ✅ Cache L1 | `vocab:mnemonic:{word}` | 24h |
| `POST /vocabulary/ai/similar` | Deterministic | ✅ Cache L1 | `vocab:similar:{word}` | 24h |
| `POST /vocabulary/ai/etymology` | Deterministic | ✅ Cache L1 | `vocab:etymology:{word}` | 24h |
| `POST /vocabulary/ai/story` | Semi-det | ✅ Cache L1 (shorter) | `vocab:story:{word}` | 6h |
| `POST /vocabulary/ai/usage` | Deterministic | ✅ Cache L1 | `vocab:usage:{word}` | 12h |
| `POST /vocabulary/ai/quiz` | Semi-det | ⚠️ Cache 1h only | `vocab:quiz:{word}` | 1h |
| `POST /ai-speaking/tts` | Deterministic | ✅ Cache L1 | `tts:{hash(text+persona)}` | 24h |
| `POST /ai-speaking/sessions/{id}/chat` | Contextual | ❌ NO cache | — | — |
| `POST /ai-speaking/sessions/{id}/chat/stream` | Contextual | ❌ NO cache | — | — |
| `POST /ai/translate/*` | Deterministic | ✅ Cache L1 | `translate:{hash(text+dir)}` | 12h |
| `POST /ai/grammar/correct` | Semi-det | ✅ Cache L1 | `grammar:correct:{hash(text)}` | 6h |

**Ước tính tiết kiệm**: Với 100 DAU, mỗi user tra ~20 từ/ngày → 2000 vocab AI calls/ngày. Cache hit rate ~70% → tiết kiệm **1400 API calls/ngày** = ~40K tokens/ngày = **~$1.2/ngày giảm chi phí Groq**.

#### Cache cho TTS (ElevenLabs) — Quan trọng nhất về cost

ElevenLabs tính tiền theo **characters/tháng**. Free plan chỉ 10K chars.

Chiến lược 3 tầng:
1. **Pre-generate**: Các câu phổ biến (greetings, common feedback) → render sẵn thành MP3, serve từ `/public/voices/`
2. **Runtime cache**: Caffeine cache `byte[]` audio, keyed by `hash(text + persona + voiceId)`, TTL 24h, max 500 entries (~50MB RAM)
3. **Truncate**: Text >200 chars → cắt thành chunks, chỉ TTS chunk đầu tiên (đủ cho preview)

---

### 2.4. Chiến Lược Cache Invalidation

> [!CAUTION]
> Cache invalidation sai = **user thấy dữ liệu cũ** → mất trust. Đặc biệt nguy hiểm cho dữ liệu học tập (XP, errors, progress).

#### Phân loại dữ liệu theo mức độ nhạy cảm

| Mức | Dữ liệu | Tolerance | Strategy |
|-----|----------|-----------|----------|
| 🔴 **Realtime** | XP, streak, session status, errors | 0s | **Không cache** hoặc write-through |
| 🟡 **Near-realtime** | Today plan, dashboard stats | ≤30s | **Event-driven evict** (publish event sau mỗi action) |
| 🟢 **Eventual** | Tags, word list, plans, curriculum | ≤10min | **TTL-based** (Caffeine tự expire) |
| ⚪ **Static** | Achievements defs, TTS audio, vocab AI | ≤24h | **TTL dài** + manual evict khi cần |

#### Pattern áp dụng

**1. TTL-based (cho dữ liệu 🟢⚪)**

Đơn giản nhất. Caffeine tự xóa sau TTL. Không cần code eviction.

Rủi ro: User có thể thấy data cũ trong TTL window. Chấp nhận được vì:
- Tags thay đổi hiếm (admin action)
- Words thay đổi hiếm (import batch)
- TTL ngắn (5-10 phút)

**2. Write-through + Evict (cho dữ liệu 🟡)**

Khi có write operation → evict cache cùng transaction.

Ví dụ flow:
```
User hoàn thành speaking turn
  → save message to DB
  → award XP (XpService)
  → evict cache "todayPlan:{userId}" ← KEY STEP
  → return response
```

Dùng `@CacheEvict` trên các service methods:
- `TagQueryService` (đã có ✅)
- `XpService.award*()` → evict `todayPlan` cache
- `AiSpeakingServiceImpl.endSession()` → evict `todayPlan` + `speakingSessions` cache

**3. Event-driven Evict (cho dữ liệu 🟡 cross-service)**

Khi service A thay đổi data mà service B cache:

```
Service A (Speaking) ──publish──→ ApplicationEvent
                                       │
Service B (Today Plan) ←──listen───────┘
                          @CacheEvict("todayPlan")
```

Dùng Spring `ApplicationEventPublisher` (in-process, zero-latency):
- `XpAwardedEvent` → evict today plan cache
- `SessionEndedEvent` → evict dashboard stats cache
- `ErrorResolvedEvent` → evict error skills cache

**4. Manual Purge (Admin safety valve)**

Thêm endpoint `POST /api/admin/cache/purge?name={cacheName}` để admin có thể force-clear cache khi cần. Chỉ dùng trong emergencies.

---

### 2.5. Roadmap Triển Khai Theo Phase

#### Phase 1: Quick Wins (1-2 tuần) — Chỉ Caffeine

- Mở rộng `CacheConfig.java`: thêm `achievements`, `weeklyPrompts`, `aiVocabCache`, `ttsAudio`
- Thêm `@Cacheable` cho:
  - `AchievementRepository.findAll()` → cache "achievements"
  - AI Vocabulary endpoints (7 endpoints) → cache "aiVocabCache"
  - TTS audio synthesis → cache "ttsAudio"
- Thêm `@CacheEvict` cho admin actions tương ứng
- **Không cần infrastructure change** — chỉ code annotation

#### Phase 2: Redis Integration (2-3 tuần) — Khi cần scale

- Thêm `spring-boot-starter-data-redis` + `spring-boot-starter-cache` Redis adapter
- Chuyển `CacheConfig` sang `RedisCacheManager` cho distributed caches
- Giữ Caffeine cho L1 (hot data), Redis cho L2 (shared data)
- Setup Redis Sentinel hoặc Redis Cluster cho HA

#### Phase 3: Advanced (1 tháng) — Production hardening

- Cache metrics dashboard (Caffeine stats → Prometheus → Grafana)
- Cache warming on startup (pre-load hot data)
- Circuit breaker cho AI calls (Resilience4j) + fallback to cache
- CDN (Cloudflare/Vercel Edge) cho static + pre-rendered pages

---

### 2.6. Anti-Patterns Cần Tránh

| ❌ Anti-pattern | ✅ Thay thế |
|----------------|------------|
| Cache user-specific AI chat responses | Chỉ cache deterministic responses (vocab, translate) |
| Cache với key quá generic (`"words"`) | Key chi tiết: `words:A1:locale_vi:page_0:size_20` |
| TTL quá dài cho learning data | XP/streak/errors: không cache hoặc TTL ≤30s |
| Invalidate bằng timer thay vì event | Event-driven evict cho near-realtime data |
| Cache DB entities trực tiếp | Cache DTO/response objects (tránh LazyInitException) |
| Quên cache null responses | Cache null/empty list với short TTL (1min) để tránh "cache stampede" |

---

## Tổng Kết

### Bảng Ma Trận Ưu Tiên

| # | Hành động | Phase | Effort | Impact | Risk |
|---|-----------|-------|--------|--------|------|
| 1 | Caffeine cache cho 7 AI Vocab endpoints | Phase 1 | 2 ngày | ⬆️⬆️⬆️ Cost | Thấp |
| 2 | TTS audio cache (Caffeine byte[]) | Phase 1 | 1 ngày | ⬆️⬆️⬆️ Cost | Thấp |
| 3 | Vocab Detail Modal (FE consume 7 APIs) | FE Gap | 3 ngày | ⬆️⬆️⬆️ UX | Trung bình |
| 4 | Error Drill Screen (repair flow) | FE Gap | 2 ngày | ⬆️⬆️⬆️ Learning | Trung bình |
| 5 | Review Queue (spaced repetition UI) | FE Gap | 2 ngày | ⬆️⬆️ Retention | Trung bình |
| 6 | Event-driven cache eviction | Phase 1 | 1 ngày | ⬆️⬆️ Correctness | Thấp |
| 7 | Redis integration | Phase 2 | 3 ngày | ⬆️⬆️ Scale | Trung bình |
| 8 | BFF refactor | Phase 3+ | 5 ngày | ⬆️ Maintenance | Cao |

> [!IMPORTANT]
> **Khuyến nghị**: Bắt đầu từ **Caffeine cache cho AI Vocab (item 1-2)** — effort thấp nhất, impact cao nhất. Mỗi cache hit cho vocab AI = tiết kiệm ~20 Groq tokens. Sau đó song song xây **Vocab Detail Modal (item 3)** để unlock 7 API đang mồ côi.
