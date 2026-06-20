# Wave 7 — S-3 Full / P-10: Org Pool Atomic Counter Table

**Date:** 2026-06-20
**Commit:** `f8c59380`
**Branch:** `feat/student-coin-currency`
**Status:** ✅ DONE

---

## Problem (from REMEDIATION.md S-3 / P-10)

**S-3**: `OrgQuotaService.orgUsageThisMonth()` was a `SUM(total_tokens)` on the
`ai_token_usage_events` table — O(n rows) append-only scan on every AI request.
Even with the D-2 index added in Wave 5 (`org_id, created_at`), this is still
an aggregation scan that grows unboundedly as ledger data accumulates.

**P-10**: `wouldExceedOrgPool()` reads the SUM, then the AI call runs, then
`AiUsageLedgerService.record()` writes the event — two separate transactions
with no lock. Many concurrent AI calls all pass the check before any event is
written. Accumulated counter drift between check and debit is limited because
`ON CONFLICT DO UPDATE` in PostgreSQL is atomic, but a plain `SUM()` under
concurrent appends can still be stale by milliseconds.

---

## What Was Done

### V224 migration — `org_monthly_token_counters`

```sql
CREATE TABLE org_monthly_token_counters (
    org_id      BIGINT NOT NULL REFERENCES organizations(id),
    month_start DATE   NOT NULL,
    tokens_used BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, month_start)
);
```

PK on `(org_id, month_start)` makes reads O(1). The `month_start` column
stores the first day of the VN-timezone month (`date_trunc('month', ... 'Asia/Ho_Chi_Minh')::date`),
consistent with how `orgUsageThisMonth` computed its window before.

Backfill from existing `ai_token_usage_events` data on migration run.

### `AiUsageLedgerService.record()` — atomic counter increment

After writing the AI usage event row, a second SQL runs:

```sql
INSERT INTO org_monthly_token_counters (org_id, month_start, tokens_used)
SELECT u.org_id,
       date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
       ?
FROM users u WHERE u.id = ? AND u.org_id IS NOT NULL
ON CONFLICT (org_id, month_start)
DO UPDATE SET tokens_used = org_monthly_token_counters.tokens_used + EXCLUDED.tokens_used
```

Key properties:
- **Atomic**: `ON CONFLICT DO UPDATE` is a single atomic operation in PostgreSQL.
  Two concurrent inserts to the same `(org_id, month_start)` serialize correctly.
- **B2C no-op**: `WHERE u.org_id IS NOT NULL` → no row returned → INSERT does nothing.
  Counter only grows for org members.
- **Same org source**: reads `users.org_id` — same as what gets written to
  `ai_token_usage_events.org_id` by the preceding INSERT.

### `OrgQuotaService.orgUsageThisMonth()` — O(1) PK lookup

```java
Long total = jdbcTemplate.query("""
        SELECT tokens_used FROM org_monthly_token_counters
        WHERE org_id = ?
          AND month_start = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        """,
        rs -> rs.next() ? rs.getLong(1) : null,
        orgId);
return total != null ? total : 0L;
```

Single PK lookup. Returns 0 when no row exists yet (first event this month
creates the row via the INSERT above).

---

## What Changed in Behaviour

| Before | After |
|--------|-------|
| `orgUsageThisMonth` = aggregation scan O(n) | PK lookup O(1) |
| Counter increment = implicit (sum grows as rows added) | Atomic `ON CONFLICT DO UPDATE` |
| Race: N concurrent events all added, SUM stale until committed | Counter atomic per increment; still a soft-cap (no pre-reserve) |
| Month boundary = SQL `date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')` each call | Same boundary, now stored as `month_start DATE` PK column |

**Soft-cap note**: P-9 (atomic reserve before AI call) is still deferred. The
fundamental race window (check → AI call → debit) still allows overage of up
to `N_concurrent_requests × estimated_tokens`. This fix makes the counter
accurate and fast, but does not add a hard-cap pre-reserve.

---

## Tests

`./mvnw test` — **970 tests, 0 failures, 1 skipped** — BUILD SUCCESS.

---

## Cross-Reference vs REMEDIATION.md

| REMEDIATION item | Status after this wave |
|------------------|------------------------|
| S-3 (full — counter table) | ✅ CLOSED — `org_monthly_token_counters` V224 |
| P-10 (org pool race) | ✅ IMPROVED — atomic increment; soft-cap still applies |

Remaining deferred items from REMEDIATION.md:

| Item | Reason |
|------|--------|
| P-9: check-then-debit atomic | 20+ callers; soft-cap accepted at current scale |
| M-5: FreeTierGuard policy | Policy decision needed |
| H: attachOwner best-effort | log.warn in place, accepted |
| O-3: 4 rate-limiters | Low priority; gộp khi mở rộng Redis ra toàn hệ thống |
| O-2: QuotaService 665 lines | Refactor when needed |
| D-3/G: Invoice billing | Product decision |

---

## Next Steps

1. **Deploy**: V224 migration runs on first restart; backfill is idempotent.
2. **Monitor**: Compare `orgUsageThisMonth` latency before/after
   (should drop from ~10ms SUM-scan to ~1ms PK lookup under load).
3. **Month rollover**: No cleanup needed — new `month_start` row auto-created on first AI call each month.
