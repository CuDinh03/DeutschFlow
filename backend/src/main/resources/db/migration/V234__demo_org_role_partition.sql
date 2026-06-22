-- ============================================================
-- V234 — Demo org-role partition: keep "teacher" accounts as plain teachers
-- ============================================================
-- WHY: the login redirect (frontend/src/app/v2/login/page.tsx) sends a platform-role
-- TEACHER to /v2/org when their ORG role is OWNER/MANAGER, and to /v2/teacher otherwise.
-- A demo teacher account that was seeded as an org OWNER therefore lands in the org
-- console instead of the teacher workspace. This normalizes the DEMO org so demo
-- "teacher" accounts route to /v2/teacher; the dedicated owner@/manager@deutschflow.com
-- accounts are the org admins.
--
-- SCOPE (deliberately surgical — user decision 2026-06-22): touches ONLY the demo org
-- 'abc-center' and the known demo accounts. Any OTHER organization (real customers) is
-- left untouched, so this cannot lock a real center's owner out of their org console.
--
-- SAFE BY CONSTRUCTION: guarded on abc-center existing; demotes the demo teachers AND
-- installs owner@ as OWNER, so the demo org is never left without an owner. There is no
-- DB-level single-owner constraint (app-level invariant only), so intermediate states are
-- fine. Idempotent — re-run is a no-op (local is already in this state).
--
-- owner@/manager@ are created with a LOCKED password (random, NOT committed) only if they
-- do not already exist; set a real password via PATCH /api/admin/users/{id}/password.
-- ON CONFLICT DO NOTHING never clobbers an existing account's password.

DO $$
DECLARE
    v_org   BIGINT;
    v_owner BIGINT;
    v_mgr   BIGINT;
BEGIN
    SELECT id INTO v_org FROM organizations WHERE slug = 'abc-center';
    IF v_org IS NULL THEN
        RAISE NOTICE 'V234: demo org abc-center absent on this env — nothing to do';
        RETURN;
    END IF;

    -- 1) Ensure the dedicated org-admin accounts exist (locked pw; set via admin UI).
    INSERT INTO users (email, password_hash, display_name, role, locale, is_active, created_at)
    VALUES
        ('owner@deutschflow.com',   '$2a$10$NMyPvENDHH0KZlXwf2XVlO.p2bP3qXRKBofe6uF9ZHlxfmeCwgiWK', 'Demo Org Owner',   'TEACHER', 'vi', TRUE, now()),
        ('manager@deutschflow.com', '$2a$10$NMyPvENDHH0KZlXwf2XVlO.p2bP3qXRKBofe6uF9ZHlxfmeCwgiWK', 'Demo Org Manager', 'TEACHER', 'vi', TRUE, now())
    ON CONFLICT (email) DO NOTHING;

    SELECT id INTO v_owner FROM users WHERE email = 'owner@deutschflow.com';
    SELECT id INTO v_mgr   FROM users WHERE email = 'manager@deutschflow.com';

    -- 2) Demote the known demo teacher accounts to plain TEACHER in the demo org
    --    so the login redirect sends them to /v2/teacher (not /v2/org).
    UPDATE org_members
       SET role = 'TEACHER'
     WHERE org_id = v_org
       AND role IN ('OWNER', 'MANAGER')
       AND user_id IN (SELECT id FROM users WHERE email IN ('teacher@deutschflow.com', 'teacher@local.test'));

    -- 3) The known demo student account is a plain STUDENT.
    UPDATE org_members
       SET role = 'STUDENT'
     WHERE org_id = v_org
       AND role <> 'STUDENT'
       AND user_id IN (SELECT id FROM users WHERE email = 'student@deutschflow.com');

    -- 4) Install the dedicated admins (upsert membership; never orphans the demo org).
    INSERT INTO org_members (org_id, user_id, role, status, joined_at)
    VALUES (v_org, v_owner, 'OWNER', 'ACTIVE', now())
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'OWNER', status = 'ACTIVE';

    INSERT INTO org_members (org_id, user_id, role, status, joined_at)
    VALUES (v_org, v_mgr, 'MANAGER', 'ACTIVE', now())
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'MANAGER', status = 'ACTIVE';

    -- 5) users.org_id invariant for the admins (== their ACTIVE org membership).
    UPDATE users SET org_id = v_org WHERE id IN (v_owner, v_mgr);
END $$;
