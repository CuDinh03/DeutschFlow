-- ============================================================
-- V238 — Canonicalize user emails (lowercase + trim) and enforce
--         case-insensitive uniqueness at the DB level.
-- ============================================================
-- WHY: email writes were inconsistent — admin createUser lowercased, but self-service register stored
-- the address exactly as typed (e.g. 'nguyenvanB@gmail.com'). Login, however, matched email
-- case-sensitively (findByEmail). So a single capital letter (mobile keyboards auto-capitalize the
-- first character) or a stray leading/trailing space made the lookup miss the row; Spring Security then
-- hides "user not found" as BadCredentials, surfacing to the user as a misleading "wrong password" —
-- most visibly right after an admin set a new password for the account.
--
-- The application code now looks up email case-insensitively (UserRepository#findByEmailIgnoreCase used
-- by login + UserDetailsService) and normalizes on every write. This migration makes the EXISTING
-- stored data canonical and installs a DB-level guard so case-variant duplicates can never be created.
--
-- SAFE BY CONSTRUCTION: collision-guarded. If any two rows would collapse to the same
-- lower(btrim(email)) the migration ABORTS with the offending values instead of corrupting data or
-- hitting a unique-violation mid-update. Resolve the duplicate (merge/rename) and re-run.
-- Idempotent: rows already canonical are skipped; the index uses IF NOT EXISTS.

DO $$
DECLARE
    v_dups TEXT;
BEGIN
    -- 1) Refuse to run if normalizing would create a collision (two accounts differing only by
    --    case/whitespace). This must be handled by a human — we never silently merge accounts.
    SELECT string_agg(norm, ', ') INTO v_dups
    FROM (
        SELECT lower(btrim(email)) AS norm
        FROM users
        GROUP BY lower(btrim(email))
        HAVING count(*) > 1
    ) d;

    IF v_dups IS NOT NULL THEN
        RAISE EXCEPTION
            'V238 aborted: case/whitespace-variant duplicate emails exist (%). Merge or rename them, then re-run.',
            v_dups;
    END IF;

    -- 2) Backfill: canonicalize any non-normalized addresses.
    UPDATE users
       SET email = lower(btrim(email))
     WHERE email <> lower(btrim(email));
END $$;

-- 3) DB-level case-insensitive uniqueness guard. The plain UNIQUE(email) constraint from V3 only
--    blocks exact-match duplicates; this stops 'Foo@x.com' and 'foo@x.com' from coexisting again.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower ON users (lower(email));
