-- V200 — Consistency batch (đuôi còn lại của 2 đợt fix V196 FK + V199 TIMESTAMPTZ).
--
-- 1. FK cho class_teachers (V196 vá FK 7 bảng nhưng bỏ sót bảng này).
--    Nghiêm trọng hơn FK thường: codebase dùng class_teachers để CHECK QUYỀN truy cập
--    lớp/học viên (assertTeacherOwnsClass, getClassesForTeacher) — orphan row nghĩa là
--    teacher/lớp đã xóa vẫn pass authorization. Dọn orphan trước rồi mới thêm FK.
--
-- 2. TIMESTAMPTZ cho các bảng V199 bỏ sót (cùng lý do V199: bare TIMESTAMP chỉ đúng
--    khi mọi writer/reader cùng timezone; apple_subscriptions.expires_at quyết định
--    hạn subscription → lệch giờ = sai quyền truy cập trả phí).
--
-- 3. Index hỗ trợ các query nóng: admin đếm user theo role (overview chạy mỗi lần mở
--    dashboard) + tra cứu giao dịch theo user/trạng thái.
--
-- SAFETY: cùng guard UTC như V199 — abort to nếu session timezone không phải UTC,
-- tránh reinterpret sai dữ liệu. Các bảng đều nhỏ (lock ACCESS EXCLUSIVE tức thời).

DO $$
BEGIN
    IF upper(current_setting('TimeZone')) NOT IN ('UTC', 'ETC/UTC', 'GMT', 'UCT', 'UNIVERSAL') THEN
        RAISE EXCEPTION
            'V200 aborted: expected DB session timezone UTC for a safe TIMESTAMP->TIMESTAMPTZ reinterpretation, but got "%". Confirm the zone the existing timestamps were written in (SHOW timezone) and adjust V200 before deploying.',
            current_setting('TimeZone');
    END IF;
END $$;

-- ─── 1. class_teachers: dọn orphan + FK ──────────────────────────────────────

DELETE FROM class_teachers ct
WHERE NOT EXISTS (SELECT 1 FROM teacher_classes tc WHERE tc.id = ct.class_id);

DELETE FROM class_teachers ct
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ct.teacher_id);

ALTER TABLE class_teachers
    ADD CONSTRAINT fk_class_teachers_class
        FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE;

ALTER TABLE class_teachers
    ADD CONSTRAINT fk_class_teachers_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;

-- ─── 2. TIMESTAMPTZ batch ────────────────────────────────────────────────────

-- Apple IAP (V189): expires_at quyết định hạn subscription trả phí.
ALTER TABLE apple_subscriptions
    ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE apple_processed_notifications
    ALTER COLUMN processed_at TYPE timestamptz USING processed_at AT TIME ZONE 'UTC';

-- Marketplace 1-1 (V179): scheduled_at là giờ hẹn thật giữa người với người.
ALTER TABLE teacher_sessions
    ALTER COLUMN scheduled_at        TYPE timestamptz USING scheduled_at        AT TIME ZONE 'UTC',
    ALTER COLUMN payout_processed_at TYPE timestamptz USING payout_processed_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at          TYPE timestamptz USING created_at          AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at          TYPE timestamptz USING updated_at          AT TIME ZONE 'UTC';

-- B1 assessment (V162)
ALTER TABLE b1_assessment_states
    ALTER COLUMN last_assessment_at      TYPE timestamptz USING last_assessment_at      AT TIME ZONE 'UTC',
    ALTER COLUMN graduation_confirmed_at TYPE timestamptz USING graduation_confirmed_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at              TYPE timestamptz USING created_at              AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at              TYPE timestamptz USING updated_at              AT TIME ZONE 'UTC';

-- Class lessons (V197)
ALTER TABLE class_lessons
    ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at   TYPE timestamptz USING created_at   AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at   TYPE timestamptz USING updated_at   AT TIME ZONE 'UTC';

-- user_learning_profiles: 2 cột thêm sau V199 (V178, V194)
ALTER TABLE user_learning_profiles
    ALTER COLUMN fsrs_weights_updated_at TYPE timestamptz USING fsrs_weights_updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN upsell_opt_in_at        TYPE timestamptz USING upsell_opt_in_at        AT TIME ZONE 'UTC';

-- refresh_tokens (V3): expires_at quyết định phiên đăng nhập còn hạn hay không.
ALTER TABLE refresh_tokens
    ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC';

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────

-- Admin overview đếm user theo role mỗi lần mở dashboard (V129 mới có index đơn lẻ
-- user_id và status cho payment_transactions, chưa có composite cho query "giao dịch
-- của user X trạng thái Y" + chưa có index role cho users).
CREATE INDEX IF NOT EXISTS idx_users_role_active
    ON users(role) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_payment_tx_user_status
    ON payment_transactions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_tx_created_at
    ON payment_transactions(created_at DESC);
