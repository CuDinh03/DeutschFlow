-- V199 — P1-13: convert bare TIMESTAMP (no time zone) -> TIMESTAMPTZ on the quota / revenue tables.
--
-- WHY
--   The daily AI-token quota window is computed in Asia/Ho_Chi_Minh (QuotaVnCalendar) and revenue is
--   bucketed by month (getMonthlyRevenue: TO_CHAR(created_at,'YYYY-MM')). A bare TIMESTAMP stores
--   wall-clock with NO zone, so the values are only correct while every writer and reader share one
--   timezone. That holds today -- the app container sets no TZ (JVM defaults to UTC) and RDS defaults
--   to UTC -- but it is unsafe-by-construction: one infra change (a host defaulting to another zone,
--   a read replica, a JVM with -Duser.timezone) would silently shift every subscription boundary and
--   revenue bucket by hours, with no error.
--
-- WHAT
--   Reinterpret each existing bare timestamp as the zone it was actually written in -- UTC (see above)
--   -- via `USING col AT TIME ZONE 'UTC'`, turning it into a proper instant (timestamptz). After this,
--   JDBC Timestamp<->timestamptz binding is timezone-agnostic and the latent risk is closed.
--
-- SAFETY
--   This rewrite is irreversible. To avoid silently corrupting financial data if the UTC assumption is
--   ever false, the guard below ABORTS the migration unless the database session timezone is UTC -- a
--   loud, safe failure that blocks the deploy rather than shifting data. If prod legitimately runs a
--   non-UTC DB timezone, confirm the real write-zone (`SHOW timezone;` + the wall-clock of a known row)
--   and replace the guard list + the 'UTC' literals with that zone before deploying.
--
-- OPERATIONS
--   ALTER COLUMN ... TYPE rewrites the table under an ACCESS EXCLUSIVE lock. user_subscriptions and
--   payment_transactions are tiny (instant). ai_token_usage_events can be large -- run this deploy
--   OFF-PEAK so the brief lock does not stall quota writes. Column DEFAULTs (CURRENT_TIMESTAMP / now())
--   remain valid for timestamptz and are preserved automatically.

DO $$
BEGIN
    IF upper(current_setting('TimeZone')) NOT IN ('UTC', 'ETC/UTC', 'GMT', 'UCT', 'UNIVERSAL') THEN
        RAISE EXCEPTION
            'V199 aborted: expected DB session timezone UTC for a safe TIMESTAMP->TIMESTAMPTZ reinterpretation, but got "%". Confirm the zone the existing timestamps were written in (SHOW timezone) and adjust V199 before deploying.',
            current_setting('TimeZone');
    END IF;
END $$;

-- Tiny tables — rewrite is instantaneous.
ALTER TABLE user_subscriptions
    ALTER COLUMN starts_at  TYPE timestamptz USING starts_at  AT TIME ZONE 'UTC',
    ALTER COLUMN ends_at    TYPE timestamptz USING ends_at    AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE payment_transactions
    ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- Potentially large — see OPERATIONS note above (deploy off-peak).
ALTER TABLE ai_token_usage_events
    ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
