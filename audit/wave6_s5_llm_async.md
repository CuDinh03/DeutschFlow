# Wave 6 — S-5: LLM Calls Off Tomcat Thread

**Date:** 2026-06-20
**Commit:** `e7ea78ff`
**Branch:** `feat/student-coin-currency`
**Status:** ✅ DONE

---

## Problem (from REMEDIATION.md S-5)

Synchronous LLM calls held Tomcat worker threads (default pool ~48).
Each LLM call takes 2–10 s; under moderate load this exhausts the pool
and causes 503s on unrelated endpoints — same failure mode as the
2026-06-12 DB-pool P0.

Three code paths were still synchronous before this wave:

| Path | Method | Approx latency |
|------|--------|----------------|
| `POST /skill-tree/{nodeId}/practice/{skill}/start` | PracticeNodeService.generatePracticeSession | 3–6 s |
| `POST /skill-tree/{nodeId}/practice/{skill}/next` | PracticeNodeService.generateNextGeneration | 3–6 s |
| `POST /mock-exam/attempts/{id}/finish` | MockExamController.finishExam | 5–15 s |

(SkillTreeService was already `@Async("speakingStreamExecutor")` — already fixed.
VideoRenderService was already async — already fixed.)

---

## What Was Done

### 1. `PracticeNodeService` — two new async wrappers

Added `startPracticeSessionAsync(userId, nodeId, skillType)` and
`generateNextAsync(userId, nodeId, skillType)`.

Both methods:
1. Call `asyncJobService.createJob(type, userId)` — DB row, returns UUID
2. Submit a `CompletableFuture.runAsync(…, aiExecutor)` lambda
3. Lambda calls the existing synchronous helper; on success
   `asyncJobService.completeJob(jobId, json)`; on failure
   `asyncJobService.failJob(jobId, message)` + error log
4. Return `Map.of("jobId", …, "status", "PENDING")` immediately

Executor: project's `aiExecutor` bean (bounded pool for LLM work).
`ObjectMapper om` (already a field via `@Autowired`) used to serialize result.

### 2. `PracticeNodeController` — endpoints changed to 202

`startPracticeSession` endpoint:
- Cache-hit path (sessions already exist) → still returns **200** with sessions
  (no LLM → no Tomcat hold)
- Cache-miss path → delegates to `startPracticeSessionAsync` → **202 + jobId**

`generateNextGeneration` endpoint:
- Always delegates to `generateNextAsync` → **202 + jobId**

Client must poll `GET /api/async-jobs/{jobId}` until `status=COMPLETED`,
then parse `resultPayload` as the exercises payload.

### 3. `MockExamController` — finishExam async

**Fields added** (field injection to avoid growing 10-param constructor):
```java
@Autowired private AsyncJobService asyncJobService;
@Autowired @Qualifier("aiExecutor") private Executor aiExecutor;
```

**`finishExam` endpoint** now:
1. Runs quota gate **synchronously** (fast DB read; propagates
   `QuotaExceededException` immediately before the async hop)
2. Creates AsyncJob
3. Submits `processFinishExam(uid, attemptId, safeBody, capturedPrincipal)`
   on `aiExecutor`
4. Returns **202 + jobId + attemptId**

**`processFinishExam`** private method contains all former finishExam body:
- Scoring calculation
- AI evaluation (the expensive LLM call)
- DB persistence
- Phase-engine recompute via `phaseEngineService.recompute(uid)` (Long overload)
- B1 readiness record — uses `caller instanceof User user` pattern; safe
  because `User` entity only accesses `user.getId()` in that code path

---

## API Contract Change

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /skill-tree/{nodeId}/practice/{skill}/start` (cache miss) | 200 + exercises | 202 + `{jobId, status}` |
| `POST /skill-tree/{nodeId}/practice/{skill}/next` | 200 + exercises | 202 + `{jobId, status}` |
| `POST /mock-exam/attempts/{id}/finish` | 200 + result | 202 + `{jobId, status, attemptId}` |

Poll endpoint (unchanged): `GET /api/async-jobs/{jobId}`
Response when done: `{status: "COMPLETED", resultPayload: "<json string>"}`

---

## Tests

`./mvnw -B test` — **970 tests, 0 failures, 1 skipped** — BUILD SUCCESS.
No tests broke. New async paths not separately unit-tested (the underlying
synchronous helpers already have coverage; async wrapper is a thin
`runAsync` shell pattern already used elsewhere in the codebase).

---

## Cross-Reference vs REMEDIATION.md

| REMEDIATION item | Status after this wave |
|------------------|------------------------|
| S-5 (LLM sync on Tomcat) | ✅ CLOSED — all three paths now async 202+jobId |

Remaining open items from REMEDIATION.md (genuinely deferred):

| Item | Reason deferred |
|------|-----------------|
| P-9: check-then-debit atomic | 20+ callers; large refactor |
| P-10 / S-3 full: org pool atomic counter | New table needed; product decision |
| M-5: FreeTierGuard for org member pool=0 | Policy decision |
| D-3/G: Invoice billing redesign | Product decision |
| O-3: RateLimiterService (speaking) still in-memory | Known O-3; breaks on multi-node |
| O-2: QuotaService 665 lines | Tech-debt; no correctness bug |
| O-1: Pipeline speaking | Accepted as-is |
| Section-6 items 2,3,6 | Require prod-DB access |

---

## Next Steps

1. **Frontend**: update `startPracticeSession` and `finishExam` callers to
   handle 202 + poll `GET /api/async-jobs/{jobId}`.
2. **Deploy**: include in next backend deploy batch.
3. **Prod verify**: confirm exam finish latency no longer blocks pool under
   concurrent load (k6 ramp same as `docs/LOAD_TEST_100CCU_CHECKLIST.md`).
