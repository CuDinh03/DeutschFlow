# DeutschFlow — Đánh Giá Toàn Diện Dự Án

**Vai trò:** Senior Software Architect & AI Product Manager  
**Ngày đánh giá:** 2026-05-06  
**Phiên bản SRS tham chiếu:** v1.2 → Đề xuất nâng cấp v1.3

---

## 1. Tổng Quan Đánh Giá

### 1.1 Ma trận hoàn thiện SRS vs. Codebase

| Module SRS | Backend | Frontend | Test Coverage | Trạng thái |
|---|---|---|---|---|
| **AUTH & JWT** | ✅ Đầy đủ | ✅ Login/Register/Guard | ✅ Integration | **Production-ready** |
| **Onboarding** | ⚠️ Profile có, Wizard chưa | ✅ Wizard 4 bước (vừa mới) | ❌ Chưa test | **Beta** |
| **Learning Plan & Dashboard** | ✅ Session/Week/Progress API | ✅ Dashboard, Plan, Roadmap | ✅ Partial | **Production-ready** |
| **Vocabulary** | ✅ 10K+ từ, import pipeline | ✅ List/filter/detail/admin | ✅ Integration | **Production-ready** |
| **Vocab Practice** | ⚠️ Client-side only | ✅ Flashcard + TTS + SR | ✅ Unit (FE) | **Stable** |
| **AI Speaking (SSE/STT/TTS)** | ✅ Full pipeline | ✅ Chat/Stream/Record | ✅ Unit + Integration | **Production-ready** |
| **Persona System** | ✅ 4 personas + voice ID | ✅ Character components | ⚠️ Partial | **Stable** |
| **ElevenLabs TTS** | ✅ API + fallback | ✅ 2-tier cascade | ❌ | **Beta** |
| **Error Skills & Review** | ✅ API + scheduler | ✅ Error page | ✅ Integration | **Production-ready** |
| **Quota & Subscription** | ✅ Full (ví lăn, VN calendar) | ✅ Admin token analytics | ✅ Integration | **Production-ready** |
| **Quiz & Teacher** | ✅ CRUD + join + report | ⚠️ Routes exist, UI basic | ⚠️ Partial | **MVP** |
| **Admin Ops** | ✅ Auto-tag, import, audit | ✅ 9 admin pages | ✅ Partial | **Production-ready** |
| **Notifications (SSE)** | ✅ Full (stream + poll) | ✅ NotificationBell | ⚠️ Partial | **Stable** |
| **Weekly Speaking** | ✅ Rubric + prompts | ✅ UI page | ⚠️ | **Stable** |
| **Today/Adaptive** | ✅ API | ❌ Không có UI riêng | ❌ | **Backend-only** |
| **Curriculum** | ✅ Netzwerk A1 API | ❌ Không có UI | ❌ | **Backend-only** |
| **Training Dataset Export** | ✅ JSONL (Alpaca) | ❌ Chưa tích hợp UI | ❌ | **Backend-only** |
| **Coaching Companion** | ✅ DB + Service | ❌ Chưa có UI | ❌ | **Backend-only** |
| **Lego Game** | ❌ Không trong SRS | ✅ Full game UI | ❌ | **Undocumented** |
| **Swipe Cards** | ❌ Không trong SRS | ✅ Full UI | ❌ | **Undocumented** |

### 1.2 Điểm tổng kết

| Tiêu chí | Điểm (10) | Ghi chú |
|---|---|---|
| Kiến trúc backend | **8.5** | Modular, Flyway 57 migrations, quan tâm đến data integrity |
| AI Pipeline | **8.0** | Structured error catalog, fallback parser, adaptive policy |
| Frontend UX | **7.0** | Nhiều trang, nhưng thiếu nhất quán giữa các module |
| Test Coverage | **6.5** | Backend tốt; Frontend gần như zero automated test |
| SRS ↔ Code Sync | **7.0** | Một số feature FE vượt SRS; một số BE API không có FE |
| Scalability Design | **6.0** | Monolith Spring Boot, chưa có caching layer, chưa async queue |

---

## 2. Điểm Mạnh (Strengths)

### 2.1 🏗️ Kiến trúc AI Speaking Pipeline
- **Structured Error Catalog** (~25 mã lỗi whitelist) — hiếm có trong EdTech; cho phép theo dõi tiến bộ ngữ pháp theo từng loại lỗi cụ thể.
- **Adaptive Policy Service** (`AdaptivePolicyService.java`, 14K lines) — hệ thống "focus error codes" và gợi ý topic/CEFR thông minh, tiếp cận đúng hướng Spaced Repetition cho speaking.
- **AiResponseParser** có fallback robustness — không crash khi LLM trả JSON sai format, vẫn tạo bubble chat hợp lệ.

### 2.2 🎯 Hệ thống Quota Token Tinh Vi
- **Ví token lăn** theo Asia/Ho_Chi_Minh calendar — thiết kế sát thực tế thị trường VN.
- **Ledger-based** (`ai_token_usage_events`) — audit trail cho mọi transaction token, phục vụ compliance và debug.
- **Tách biệt FREE daily vs PRO wallet** — business model linh hoạt, dễ mở rộng tier mới.

### 2.3 📚 Vocabulary Data Pipeline
- **3-source enrichment**: Goethe B1 core + German frequency 50K + local lexicon TSV.
- **Auto-tag taxonomy** qua LLM batch — chỉ 1 API call tag hàng trăm từ.
- **10,000+ từ** A1→C1 với IPA, ví dụ, dịch VI/EN/DE — dataset phong phú hiếm thấy ở MVP.

### 2.4 🎭 Persona System
- 4 nhân vật (Lukas, Emma, Anna, Klaus) với voice ID riêng trên ElevenLabs.
- System prompt builder tùy biến theo persona + industry + career field.
- Interview mode với "Pluspunkt" suggestions — pedagogically innovative.

### 2.5 🔄 Full-Stack Feature Breadth
- **17+ routes FE student** (Dashboard, Plan, Roadmap, Speaking, Vocab, Swipe Cards, Lego Game, Errors, Weekly Speaking, Tutor Profile...).
- **9 admin pages** (Overview, Revenue, Token Analytics, Users, Plans, Vocabulary, Reports, AI Config, Settings).
- **Flyway 57 migrations** — schema evolution có kỷ luật.

---

## 3. Điểm Cần Cải Thiện (Weaknesses & Bottlenecks)

### 3.1 🔴 Critical: Frontend-Backend Desync

**Vấn đề**: Nhiều API backend mạnh mẽ nhưng **không có UI tương ứng**:
- `GET /api/today/me` — Adaptive Today → Không có trang "Hôm nay nên học gì".
- `GET /api/curriculum/netzwerk-neu/a1` — Giáo trình → Không có UI curriculum browser.
- Coaching Companion (DB + rollup service) → Không có learner-facing check-in/report.
- Training Dataset Export → Chỉ admin API, không có download button trên Admin UI.

**Rủi ro**: Chi phí phát triển backend cao nhưng ROI thấp vì user không tiếp cận được feature.

### 3.2 🔴 Critical: Thiếu Caching & Performance Layer

```
User Request → Spring Controller → JdbcTemplate → PostgreSQL (mỗi lần)
```

**Vấn đề**:
- Không có **Redis/Caffeine cache** cho `/api/words` (10K+ records, query tốn I/O mỗi request).
- Tag list, curriculum data, subscription plans — **static/semi-static data** nhưng query DB mỗi lần.
- AI quota check (`assertAllowed`) query DB **trước mỗi lượt chat** — under load sẽ thành bottleneck.

**Ước tính impact**: Với 100 concurrent users, DB connection pool (HikariCP default 10) sẽ saturate nhanh.

### 3.3 🟡 High: Monolith Boundary Concerns

**Hiện tại**: 1 Spring Boot app xử lý tất cả:
- REST API serving
- SSE streaming (long-lived connections)
- Groq API calls (high latency, 2-10s)
- Whisper transcription (multipart upload + API call)
- Batch vocabulary import (startup, blocking main thread)
- Weekly rollup jobs

**Rủi ro**: SSE connections giữ thread pool, Groq calls blocking → thread starvation khi scale.

### 3.4 🟡 High: Error Handling Inconsistency

- Backend có `PSQLException` crash trên startup (parameter type inference) — đã fix nhưng cho thấy thiếu startup health check.
- Frontend có `toastApiError` import nhưng function không tồn tại trong `@/lib/api`.
- Onboarding ban đầu phụ thuộc `useStudentPracticeSession` → crash cho user mới chưa có profile.
- `MODULE_NOT_FOUND` errors lặp lại do `.next` cache corruption.

### 3.5 🟡 High: Test Gap ở Frontend

| Layer | Coverage |
|---|---|
| Backend Unit | ✅ AiResponseParser, ErrorCatalog, WeeklyRubricParser |
| Backend Integration | ✅ Auth, Quota, Speaking SSE |
| Frontend Unit | ⚠️ Chỉ normalize/fuzzy matching |
| Frontend Integration | ❌ |
| E2E | ❌ |

**Rủi ro**: Regression bugs khi refactor UI (ví dụ: LanguageSwitcher import path sai, không ai phát hiện cho đến runtime).

### 3.6 🟡 Medium: UX Consistency

- Onboarding cũ vs mới: design system khác nhau (auth-shell vs dark immersive).
- Admin: hầu hết tiếng Việt nhưng vẫn sót hardcode English ("Refresh").
- StudentShell: 12 nav items — cognitive overload cho user mới.
- Speaking page: `page 2.tsx` tồn tại song song `page.tsx` — code duplicate.

### 3.7 🟡 Medium: SRS Documentation Gaps

- **Lego Game**, **Swipe Cards**, **Groq Usage page** — có trong FE nhưng **không có trong SRS**.
- **ElevenLabs TTS integration** — production feature nhưng SRS chỉ đề cập "Web Speech API phía client".
- **Onboarding Wizard** (4-step) — vừa xây nhưng SRS §6 chỉ mô tả cũ.
- **Persona voice mapping** — chưa documented trong SRS.

---

## 4. Đề Xuất Phương Án Cải Tiến

### 4.1 🎯 Sản Phẩm / Trải Nghiệm Người Dùng

#### A. "Today Dashboard" — Trang chủ thông minh
> **Ưu tiên: P0 (Critical)**

Hiện tại user vào Dashboard thấy static metrics. Thay vào đó:

```
┌─────────────────────────────────────┐
│  🌅 Chào buổi sáng, Cường!         │
│                                      │
│  📋 Hôm nay nên làm:               │
│  ├── 🔴 Ôn lỗi: VERB_AUX_ORDER    │ ← Error Review Task due
│  ├── 🎯 Speaking: Reise (B1)       │ ← Adaptive suggestion
│  └── 📖 Vocab: 15 từ Beruf         │ ← SRS due
│                                      │
│  🔥 Streak: 7 ngày liên tục        │
│  📊 Tuần này: 4/5 buổi hoàn thành  │
└─────────────────────────────────────┘
```

**Backend đã sẵn sàng** (`GET /api/today/me`). Chỉ cần FE consume.

#### B. Gamification Layer
> **Ưu tiên: P1 (High)**

- **XP system**: Mỗi action (hoàn thành buổi học, nói đúng, ôn từ) +XP.
- **Badges**: "Nói 100 câu", "7 ngày liên tục", "Zero lỗi ngữ pháp".
- **Leaderboard**: So sánh trong lớp (Teacher module).

Lego Game và Swipe Cards đã cho thấy hướng đi đúng — cần hệ thống hóa.

#### C. Speaking Session Replay
> **Ưu tiên: P1**

Cho phép user xem lại transcript speaking session cũ + nghe lại audio (nếu lưu). Hiện `GET /api/ai-speaking/sessions/{id}/messages` đã có — cần UI timeline/replay.

#### D. Simplify Navigation (StudentShell)
> **Ưu tiên: P2**

12 nav items → Nhóm thành 4 categories:
1. **Học** (Dashboard, Plan, Roadmap)
2. **Luyện** (Speaking, Vocab Practice, Swipe Cards)
3. **Ôn** (Errors, Weekly Speaking, Game)
4. **Hồ sơ** (Tutor Profile, Settings)

### 4.2 🔧 Kỹ Thuật (Technical)

#### A. Cache Layer
> **Ưu tiên: P0**

```java
// Caffeine in-memory cache (không cần Redis cho monolith)
@Cacheable("tags")
public List<TagDto> getAllTags(String locale) { ... }

@Cacheable(value = "words", key = "#filter.hashCode()")
public Page<WordDto> findWords(WordFilter filter) { ... }

@Cacheable("subscriptionPlans")
public List<SubscriptionPlan> getActivePlans() { ... }
```

**Eviction**: Tag/word changes → `@CacheEvict`. Plan changes → startup + admin action.

#### B. Async Queue cho AI Calls
> **Ưu tiên: P1**

```
Hiện tại:  User → Controller Thread → Groq API (2-10s block) → Response
Đề xuất:   User → Controller → CompletableFuture/Virtual Thread → Groq → SSE push
```

Java 21 Virtual Threads hoặc Spring `@Async` + `TaskExecutor` riêng cho AI calls, tách khỏi Tomcat thread pool.

#### C. Startup Job Isolation
> **Ưu tiên: P1**

`GoetheVocabularyAutoImportRunner` và `CefrCuratedVocabularyImportRunner` chạy **đồng bộ trên main thread** khi startup → chậm khởi động 40s+, crash nếu DB có vấn đề.

```java
// Đề xuất: chạy async, non-blocking
@Async("importExecutor")
@EventListener(ApplicationReadyEvent.class)
public void runAsync() {
    try { importService.importGoetheVocabularyA1ToC1(); }
    catch (Exception e) { log.warn("Import failed, will retry next startup", e); }
}
```

#### D. Database Indexing Audit
> **Ưu tiên: P2**

Cần verify indexes cho:
- `words(LOWER(base_form))` — dùng trong upsert nhưng có thể thiếu functional index.
- `ai_token_usage_events(user_id, created_at)` — quota check window query.
- `user_grammar_errors(user_id, error_code, created_at)` — error skills aggregation.

#### E. Frontend Test Infrastructure
> **Ưu tiên: P2**

Setup Vitest + React Testing Library + MSW (Mock Service Worker):
```
frontend/
  __tests__/
    hooks/useSpeakingChat.test.ts    ← SSE parsing
    components/OnboardingWizard.test.tsx
    utils/normalize.test.ts          ← đã có logic, cần test file
```

---

## 5. Tóm Tắt Hành Động Theo Ưu Tiên

| # | Action | Ưu tiên | Effort | Impact |
|---|---|---|---|---|
| 1 | Cache layer (Caffeine) cho words/tags/plans | P0 | 2 ngày | ⬆️⬆️⬆️ Performance |
| 2 | Today Dashboard UI (consume `/api/today/me`) | P0 | 3 ngày | ⬆️⬆️⬆️ Engagement |
| 3 | Async AI calls (Virtual Threads / TaskExecutor) | P1 | 2 ngày | ⬆️⬆️ Scalability |
| 4 | Startup import isolation | P1 | 0.5 ngày | ⬆️⬆️ Stability |
| 5 | Gamification XP/Badges | P1 | 5 ngày | ⬆️⬆️⬆️ Retention |
| 6 | Speaking Replay UI | P1 | 2 ngày | ⬆️⬆️ Learning quality |
| 7 | Frontend test infra | P2 | 3 ngày | ⬆️⬆️ Dev velocity |
| 8 | Nav simplification | P2 | 1 ngày | ⬆️ UX clarity |
| 9 | SRS v1.3 sync (see below) | P0 | 1 ngày | ⬆️⬆️ Documentation |

---

> [!IMPORTANT]
> **Kết luận**: DeutschFlow là một dự án EdTech **impressively ambitious** cho một MVP. Backend architecture solid (Flyway discipline, AI error catalog, quota system). Điểm yếu chính là **FE-BE gap** (nhiều API không có UI) và **thiếu caching** cho production scale. SRS v1.2 cần nâng cấp lên v1.3 để phản ánh các module mới (Persona, ElevenLabs, Onboarding Wizard, Lego Game, Swipe Cards).
