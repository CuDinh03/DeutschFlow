-- Gói 1 (DEC-22, owner chốt 09/09/2026) — nền dữ liệu cho HỌC VIÊN CHƯA THÀNH NIÊN.
--
-- Vì sao PHẢI xong TRƯỚC khi nhận dữ liệu thật: trung tâm pilot CÓ học sinh phổ thông, trong khi sản
-- phẩm hôm nay không biết tuổi của bất kỳ ai — AI đọc bài viết và GHI ÂM GIỌNG NÓI rồi gửi cho nhà
-- cung cấp bên ngoài. Không vá được sau khi đã có bài viết và bản ghi âm của trẻ trong hệ thống.
--
-- Chứng minh hiện trạng (trên origin/main = e8c31b1f):
--   git grep -niE "date_of_birth|birth_date|dateOfBirth|guardian|parental" -- backend/src/main
--        frontend/src mobile → chỉ trúng từ vựng tiếng Đức trong wordlists, không cột dữ liệu nào.
-- Tín hiệu tuổi DUY NHẤT đang có là `user_learning_profiles.age_range` (enum có UNDER_18) — TỰ KHAI,
-- nullable, không ai dùng để chặn gì, và mobile luôn gửi null. Không dùng được làm cơ sở pháp lý.
--
-- 🔴 SỐ HIỆU: V317 đã bị Gói 0 PR-0B chiếm, V318 dành cho trigger chặn admin-làm-thành-viên của
--    PR-0A (chờ kết quả cổng kiểm chỉ-đọc trên production). `spring.flyway.out-of-order = false` nên
--    thứ tự merge phải là 317 → 318 → 319.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ngày sinh — đặt trên `users`, không đặt trên bảng ghi danh
-- ─────────────────────────────────────────────────────────────────────────────
-- Vì sao `users` chứ không `org_members`: mọi chốt cần đọc cờ vị thành niên (đường gọi AI, đường ghi
-- âm, đường nhắn tin) chỉ cầm `user.getId()`, và học viên B2C không có dòng org nào. Đặt ở bảng ghi
-- danh là fail-open cho toàn bộ đường B2C — đúng nhóm mà chính sách quyền riêng tư đang nói tới.
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Ai ghi, lúc nào. `users` KHÔNG có `updated_at` (kiểm: không migration nào ALTER thêm cột đó), nên
-- không có hai cột này thì một lần sửa `birth_date` sẽ VIẾT LẠI HỒI TỐ "tuổi tại thời điểm ghi" của
-- mọi bản ghi quá khứ mà không để lại dấu vết ở tầng dữ liệu. Câu "bản ghi âm này thu lúc chủ thể
-- còn vị thành niên" phải chứng minh được về sau, không chỉ suy ra được hôm nay.
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date_recorded_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date_recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
    -- CHECK chỉ dùng hằng IMMUTABLE. PostgreSQL TỪ CHỐI `CURRENT_DATE` trong CHECK và trong generated
    -- column, nên không có cách nào đặt "phải ở quá khứ" ở tầng DB — chốt đó nằm ở tầng ứng dụng.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_birth_date_sane') THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_birth_date_sane
            CHECK (birth_date IS NULL OR birth_date BETWEEN DATE '1900-01-01' AND DATE '2100-01-01');
    END IF;
END $$;

-- Đếm "trung tâm này còn bao nhiêu học viên chưa khai ngày sinh" — câu hỏi vận hành của giám đốc
-- trong suốt đợt chuyển tiếp. Index MỘT PHẦN nên không tốn gì khi mọi người đã khai đủ.
CREATE INDEX IF NOT EXISTS idx_users_birth_date_missing
    ON users (org_id)
    WHERE birth_date IS NULL AND org_id IS NOT NULL AND role = 'STUDENT';

COMMENT ON COLUMN users.birth_date IS
    'Ngày sinh thật, dùng để suy vị thành niên LÚC ĐỌC (không lưu cột is_minor — xem MinorPolicy). '
    'NULL = chưa khai; tầng ứng dụng quyết định fail-closed hay không theo cấu hình của trung tâm.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Người giám hộ — PII, SỬA ĐƯỢC
-- ─────────────────────────────────────────────────────────────────────────────
-- Khác bảng đồng ý bên dưới: đây là thông tin liên lạc, gõ sai thì phải sửa được, và sửa không làm
-- mất hiệu lực của lần đồng ý đã thu.
CREATE TABLE IF NOT EXISTS student_guardians (
    id              BIGSERIAL    PRIMARY KEY,
    student_user_id BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id          BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    full_name       VARCHAR(120) NOT NULL,
    relationship    VARCHAR(24)  NOT NULL,
    phone           VARCHAR(32),
    email           VARCHAR(255),
    is_primary      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_guardians_relationship') THEN
        ALTER TABLE student_guardians
            ADD CONSTRAINT chk_student_guardians_relationship
            CHECK (relationship IN ('MOTHER','FATHER','LEGAL_GUARDIAN','OTHER'));
    END IF;
    -- Một người giám hộ phải liên lạc được bằng ít nhất một đường, nếu không thì bản ghi vô dụng
    -- đúng lúc cần dùng nhất.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_guardians_contactable') THEN
        ALTER TABLE student_guardians
            ADD CONSTRAINT chk_student_guardians_contactable
            CHECK (phone IS NOT NULL OR email IS NOT NULL);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_guardians_primary
    ON student_guardians (student_user_id)
    WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_student_guardians_org
    ON student_guardians (org_id, created_at DESC)
    WHERE org_id IS NOT NULL;

COMMENT ON TABLE student_guardians IS
    'Người giám hộ của học viên chưa thành niên. PII, SỬA ĐƯỢC — khác student_consents là sổ bằng chứng.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vết đồng ý — SỔ BẰNG CHỨNG, CHỈ GHI THÊM
-- ─────────────────────────────────────────────────────────────────────────────
-- DEC-22 (18a): trung tâm cam kết ĐÃ THU đồng ý, hệ thống ghi vết theo TỪNG học viên. Trách nhiệm
-- thuộc trung tâm; DeutschFlow giữ bằng chứng. Rẻ hơn nhiều so với xây luồng thu đồng ý qua email.
--
-- `effective_at` (lúc đồng ý THẬT, ví dụ ngày ký giấy) tách khỏi `created_at` (lúc bấm nút nhập) —
-- lấy nguyên tiền lệ của V284: "Consent được ghi nhận ở đây chứ không phải suy diễn từ việc có audio".
CREATE TABLE IF NOT EXISTS student_consents (
    id                  BIGSERIAL    PRIMARY KEY,
    student_user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id              BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    scope               VARCHAR(32)  NOT NULL,
    action              VARCHAR(16)  NOT NULL,
    guardian_id         BIGINT       REFERENCES student_guardians(id) ON DELETE SET NULL,
    method              VARCHAR(24)  NOT NULL,
    terms_version       VARCHAR(32)  NOT NULL,
    effective_at        TIMESTAMPTZ  NOT NULL,
    recorded_by_user_id BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    note                VARCHAR(255),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_consents_scope') THEN
        ALTER TABLE student_consents
            ADD CONSTRAINT chk_student_consents_scope
            CHECK (scope IN ('DATA_PROCESSING','AI_PROCESSING','AUDIO_RECORDING','MESSAGING'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_consents_action') THEN
        ALTER TABLE student_consents
            ADD CONSTRAINT chk_student_consents_action
            CHECK (action IN ('GRANTED','REVOKED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_consents_method') THEN
        ALTER TABLE student_consents
            ADD CONSTRAINT chk_student_consents_method
            CHECK (method IN ('PAPER','EMAIL','IN_APP','PHONE'));
    END IF;
END $$;

-- "Trạng thái đồng ý hiện tại của học viên X cho phạm vi Y" = dòng effective_at mới nhất.
CREATE INDEX IF NOT EXISTS idx_student_consents_subject
    ON student_consents (student_user_id, scope, effective_at DESC);

-- "Trung tâm này đã thu đồng ý cho những ai" — đường đọc của giám đốc.
CREATE INDEX IF NOT EXISTS idx_student_consents_org
    ON student_consents (org_id, created_at DESC)
    WHERE org_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. Chỉ-ghi-thêm, cùng cơ chế với audit_logs (V303)
-- ─────────────────────────────────────────────────────────────────────────────
-- THU HỒI = ghi một dòng action='REVOKED' MỚI, không sửa và không xoá dòng cũ.
--
-- ⚠️ ĐÂY LÀ MỘT LUẬT KHÁC với bảng đồng ý đã có `speaking_exam_calibration_participants` (V284),
-- nơi comment ghi "Xoá dòng = rút đồng ý" và `ExamGoldenService.removeParticipant` thi hành đúng
-- thế. Khác biệt là CỐ Ý, không phải bỏ sót:
--   · V284 là CỜ VẬN HÀNH cho người lớn tự đồng ý cho mượn giọng làm chuẩn chấm — xoá dòng kèm xoá
--     audio là cách thi hành quyền xoá dữ liệu, và không ai cần chứng minh về sau.
--   · Bảng này là BẰNG CHỨNG PHÁP LÝ cho dữ liệu trẻ vị thành niên. Xoá dòng là mất luôn câu trả
--     lời cho "ai đồng ý, lúc nào, rồi rút lúc nào" — đúng ba câu cơ quan bảo vệ dữ liệu sẽ hỏi.
-- Việc hợp nhất hai bảng (hoặc chuyển V284 sang soft-revoke) là hạng mục riêng, cần owner quyết vì
-- nó đụng dữ liệu hiệu chuẩn đang dùng.
CREATE OR REPLACE FUNCTION student_consents_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'student_consents la append-only: % bi chan boi trg_student_consents_immutable (DEC-22). Thu hoi = ghi dong action=REVOKED moi.', TG_OP
        USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_consents_immutable ON student_consents;

-- 🔴 `WHEN (pg_trigger_depth() = 0)` KHÔNG PHẢI trang trí — thiếu nó thì bảng này KHOÁ CỨNG
-- QUYỀN XOÁ DỮ LIỆU, đúng với nhóm mà DEC-22 sinh ra để bảo vệ.
--
-- PostgreSQL thi hành `ON DELETE CASCADE` bằng một câu `DELETE FROM ONLY student_consents` và
-- `ON DELETE SET NULL` bằng `UPDATE ONLY student_consents` — cả hai đi qua đúng trigger này. Đo thật
-- trên Postgres 17 với bản không có mệnh đề WHEN:
--     DELETE FROM users …            → ERROR: append-only: DELETE   (xoá tài khoản BẤT KHẢ)
--     DELETE FROM student_guardians… → ERROR: append-only: UPDATE   (sửa PII người giám hộ BẤT KHẢ,
--                                                                    trái chính comment của bảng trên)
-- Nghĩa là ngay khi một học viên có DÙ CHỈ MỘT dòng đồng ý, tài khoản em ấy không xoá được nữa — và
-- mọi job hay ca test đang xoá user sẽ bắt đầu ném.
--
-- Với mệnh đề WHEN, đo lại đúng bốn chiều cần thiết:
--     UPDATE/DELETE trực tiếp trên student_consents  → vẫn bị chặn  ✅ sổ không sửa được
--     xoá người giám hộ (SET NULL)                   → cho qua       ✅ PII sửa/xoá được
--     xoá tài khoản (CASCADE)                        → cho qua       ✅ quyền xoá dữ liệu còn nguyên
--
-- Ngữ nghĩa được chọn có chủ đích: **xoá tài khoản mang theo cả bằng chứng đồng ý của người đó** —
-- đó là quyền xoá dữ liệu, và với trẻ vị thành niên thì nghĩa vụ này chặt nhất. Ta không mất khả năng
-- trả lời "đã từng thu đồng ý chưa": mỗi lần ghi đồng ý đều để lại một dòng trong `audit_logs`, mà
-- bảng đó KHÔNG có khoá ngoại tới `users` (V20: `actor_user_id BIGINT NULL`, không REFERENCES) nên
-- vết sống lâu hơn tài khoản. Sổ mang định danh, dòng consent mang PII — cái mang PII ra đi cùng
-- người, cái mang định danh ở lại.
CREATE TRIGGER trg_student_consents_immutable
    BEFORE UPDATE OR DELETE ON student_consents
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION student_consents_block_mutation();

COMMENT ON TABLE student_consents IS
    'Sổ bằng chứng đồng ý của người giám hộ (DEC-22). CHỈ GHI THÊM — trigger chặn UPDATE/DELETE; '
    'thu hồi = ghi dòng action=REVOKED mới. effective_at = lúc đồng ý THẬT, created_at = lúc nhập.';
