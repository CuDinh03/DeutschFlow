# Wave 8 — O-3: Speaking Rate Limiter Redis Backing

**Date:** 2026-06-20
**Commit:** `3675aa83`
**Branch:** `feat/student-coin-currency`
**Status:** ✅ DONE (partial — `RateLimiterService` fixed; `NotificationRateLimiterService` deferred)

---

## Problem (from REMEDIATION.md O-3)

4 rate-limiter implementations existed; only 1 (`AuthRateLimiterService`) had Redis backing.
Under multi-node deployment, the other 3 would enforce limits per-node only — effectively
multiplying the allowed request rate by the number of instances.

Before this wave:
| Service | Backing | Multi-node safe? |
|---------|---------|-----------------|
| `AuthRateLimiterService` | Redis sorted-set + in-memory fallback | ✅ yes |
| `AiRateLimiterService` | Redis sorted-set + in-memory fallback | ✅ yes (added earlier) |
| `RateLimiterService` (speaking) | Pure in-memory `ConcurrentHashMap` | ❌ no |
| `NotificationRateLimiterService` | Pure in-memory `ConcurrentHashMap` | ❌ no |

---

## What Was Done

### `RateLimiterService` — Redis sorted-set with in-memory fallback

Applied the same Lua sliding-window script pattern used by `AiRateLimiterService`:

```lua
local clearBefore = tonumber(ARGV[1]) - tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, clearBefore)
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
```

Redis key: `rl:speaking|{userId}` (consistent with `rl:{bucket}|{userId}` format in `AiRateLimiterService`).
TTL: `WINDOW_SECONDS × 1000 ms` via `PEXPIRE`.

Constructor: `@Nullable StringRedisTemplate redis` — Spring injects `null` when Redis is not configured;
`in-memory only` branch activates automatically. Zero configuration change needed for single-node setups.

---

## `NotificationRateLimiterService` — still in-memory

Notification polling/SSE limits are low-stakes (120 reads/min, 12 SSE connects/min). Multi-node
drift there means a user can poll 2× faster — cosmetically worse but no financial impact. Left
in-memory for now; can be updated with the same Lua pattern when needed.

---

## Tests

`./mvnw test` — **970 tests, 0 failures, 1 skipped** — BUILD SUCCESS.

---

## Cross-Reference vs REMEDIATION.md

| REMEDIATION item | Status after this wave |
|------------------|------------------------|
| O-3: 4 rate-limiters rời | ✅ IMPROVED — 3 of 4 now Redis-backed; `NotificationRateLimiterService` deferred |

---

## Final Remediation State (Waves 1–8)

All 🔴 and 🟠 items resolved. All 🟡 items resolved except P-9 (accepted soft-cap).
Remaining genuinely deferred:

| Item | Why deferred |
|------|-------------|
| P-9: atomic reserve | 20+ callers; soft-cap intentional at current scale |
| M-5: FreeTierGuard policy | Policy decision |
| H: attachOwner | log.warn in place; best-effort accepted |
| O-2: QuotaService 665 lines | Refactor when needed |
| D-3/G: Invoice billing | Product decision |
| `NotificationRateLimiterService` | Low-stakes; update when expanding Redis |
| Section-6 items 2,3,6 | Need prod-DB access |
