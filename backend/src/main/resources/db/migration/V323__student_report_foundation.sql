-- V323 — NỀN DỮ LIỆU CHO "PHIẾU ĐÁNH GIÁ GỬI PHỤ HUYNH" (owner chốt R2, R3, R6, R10, E6 ngày 10/09/2026).
--
-- ⚠️ ĐÂY LÀ MIGRATION DUY NHẤT CỦA CẢ ĐỢT PHIẾU (PR-R1 → PR-R4), gom trọn theo khuôn V316: các PR sau
-- (phát hành, PDF, web, mobile) KHÔNG thêm migration mới — cột/bảng đã có sẵn ở đây. Lý do vẫn là
-- `spring.flyway.out-of-order = false`: hai PR song song mỗi bên một migration là bẫy thứ tự kinh điển.
--
-- Vì sao PHẢI xong TRƯỚC khi trung tâm pilot có bài chấm đầu tiên (thiết kế 2026-09-10 §0, §3.1): hai lỗ
-- nền (1) và (2) không dựng lại được sau — điểm AI bị giáo viên ghi đè cùng cột thì mất vĩnh viễn; phiếu
-- không có kỳ và không ảnh chụp thì lần phát hành sau ghi đè mất lịch sử. Pilot nhập dữ liệu thật ≤ 2 tuần.
--
-- 🔴 SỐ HIỆU: nhánh moderation đã chiếm V321/V322 nên bản này là V323; thứ tự merge 317 → … → 323.
--
-- Bốn nhóm:
--   1. student_assignments: ai_score / ai_feedback / ai_graded_at — AI ghi cột RIÊNG (R3) + backfill.
--   2. student_report_issues: ảnh chụp BẤT BIẾN mỗi lần phát hành phiếu (R2) + trigger.
--   3. student_consents: thêm scope GUARDIAN_REPORT_SHARING (R6).
--   4. class_students.reserved_until: hạn mềm bảo lưu (E6) — cột thôi, CHƯA có hành vi.
-- Ngưỡng chứng nhận (R10) không cần schema: org_settings (V298) là key-value; khoá mới khai tĩnh ở
-- OrgSettingsService (certificate_min_avg = 50, certificate_min_attendance_pct = 80), thiếu dòng = mặc định.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Điểm AI đề xuất — cột RIÊNG, không dùng chung cột với điểm giáo viên (R3)
-- ─────────────────────────────────────────────────────────────────────────────
-- Hiện trạng (e8c31b1f): AI ghi `score/feedback` + status = AI_GRADED ở BA chỗ (GradingService
-- .aiGradeAssignment, GradingController.aiGradeSubmissionImage, TeacherAiGradingService.autoGradeSession);
-- giáo viên chốt ghi đè `score/feedback` + EVALUATED (TeacherService.evaluateAssignment). Sau khi chốt chỉ
-- còn `criteria_json`/`ai_confidence` (V231) sống sót — chính con số AI đề xuất thì mất. Mô hình đúng đã
-- có sẵn ở `ai_speaking_sessions` (ai_score/ai_feedback tách khỏi teacher_score/teacher_feedback).
--
-- Từ bản này: AI ghi ai_* VÀ vẫn chép sang score/feedback (hàng đợi chấm đang đọc `score` khi AI_GRADED —
-- không phá giao diện đang chạy); giáo viên chốt CHỈ ghi score/feedback, KHÔNG đụng ai_*. Phiếu phụ huynh
-- KHÔNG in ai_score (R4 cấm điểm AI thô). Cột này để (a) giáo viên thấy lại đề xuất sau khi đã sửa,
-- (b) đo độ lệch AI–GV: avg(|ai_score - score|) trên bài EVALUATED (chỉ số M5, §3.6).
ALTER TABLE student_assignments
    ADD COLUMN IF NOT EXISTS ai_score     INTEGER,
    ADD COLUMN IF NOT EXISTS ai_feedback  TEXT,
    ADD COLUMN IF NOT EXISTS ai_graded_at TIMESTAMPTZ;

-- Backfill: dòng đang AI_GRADED chưa bị ai đè — score/feedback CHÍNH LÀ đề xuất của AI. Dòng EVALUATED/
-- GRADED để NULL: điểm AI của chúng đã mất cùng lần chốt, không dựng lại được, và một con số đoán ở đây
-- sẽ làm bẩn chỉ số M5. Điều kiện `ai_score IS NULL` khiến chạy lại là no-op (cổng fresh-migration).
-- `graded_at` là TIMESTAMP không múi giờ → ép sang TIMESTAMPTZ theo múi giờ của phiên migrate: xấp xỉ
-- có ý thức chỉ áp cho dữ liệu quá khứ (cùng lối V320); dòng mới do mã ghi Instant tường minh.
-- Chốt 0–100 phòng dữ liệu cũ lệch thang (AiGradeResultParser đã kẹp, nhưng CHECK bên dưới không được
-- phép làm migration đỏ vì một dòng rác).
UPDATE student_assignments
SET    ai_score     = score,
       ai_feedback  = feedback,
       ai_graded_at = graded_at
WHERE  status = 'AI_GRADED'
  AND  ai_score IS NULL
  AND  score BETWEEN 0 AND 100;

-- CHECK tách khỏi ADD COLUMN để chạy lại được (ADD CONSTRAINT không có IF NOT EXISTS) — khuôn V316/V320.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_assignments_ai_score') THEN
        ALTER TABLE student_assignments
            ADD CONSTRAINT chk_student_assignments_ai_score
            CHECK (ai_score IS NULL OR ai_score BETWEEN 0 AND 100);
    END IF;
END $$;

COMMENT ON COLUMN student_assignments.ai_score IS
    'Điểm AI ĐỀ XUẤT (0–100), cột riêng từ V323 (R3). Giáo viên chốt ghi score/feedback, KHÔNG đụng cột '
    'này. NULL ở dòng EVALUATED trước V323 = điểm AI đã mất, không dựng lại. Không in lên phiếu phụ huynh.';
COMMENT ON COLUMN student_assignments.ai_feedback IS
    'Nhận xét AI ĐỀ XUẤT, đi cặp với ai_score (V323, R3).';
COMMENT ON COLUMN student_assignments.ai_graded_at IS
    'Lúc AI đề xuất (V323). Dòng cũ backfill từ graded_at (TIMESTAMP → TIMESTAMPTZ theo múi giờ phiên migrate).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Phiếu đã phát hành — ẢNH CHỤP BẤT BIẾN mỗi lần phát hành (R2)
-- ─────────────────────────────────────────────────────────────────────────────
-- Không có bảng "kỳ" riêng: kỳ (MIDTERM/FINAL) là thuộc tính của LẦN PHÁT HÀNH, giáo viên chọn lúc bấm.
-- Phát hành lại cùng kỳ = INSERT dòng mới, dòng cũ tự revoked_at với revoke_reason = 'SUPERSEDED' (giữ
-- lịch sử, link cũ chết ngay). `payload_json` mang TOÀN BỘ nội dung phiếu — trang công khai và PDF không
-- đọc lại bảng nguồn, nên sửa điểm sau khi phát hành không làm phiếu đã gửi "tự đổi".
--
-- Khoá ngoại — theo đúng câu hỏi "ai xoá thì phiếu ra sao":
--   • student_id  ON DELETE CASCADE  — xoá tài khoản mang theo phiếu (App Store 5.1.1(v); phiếu mang tên
--                                       và điểm của chính em ấy). Không SET NULL: phiếu không chủ là PII mồ côi.
--   • class_id    ON DELETE CASCADE  — xoá lớp là xoá cả sổ điểm lớp (V133), phiếu đi theo.
--   • org_id      ON DELETE SET NULL — ĐÓNG BĂNG theo LỚP lúc phát hành (teacher_classes.org_id), không suy
--                                       từ users.org_id (V320 đã trả giá cho phép suy đó). org_name_snapshot
--                                       ở lại nên mất FK không mất tên trung tâm trên phiếu.
--   • issued_by / revoked_by SET NULL — tên người phát hành đã snapshot; người rời hệ thống không kéo phiếu đi.
-- Tên/logo/tên người phát hành là snapshot (cùng khuôn org_certificates V214) để phiếu không đổi khi
-- hồ sơ gốc đổi.
CREATE TABLE IF NOT EXISTS student_report_issues (
    id                      BIGSERIAL    PRIMARY KEY,
    class_id                BIGINT       NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    student_id              BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id                  BIGINT       REFERENCES organizations(id) ON DELETE SET NULL,
    period                  VARCHAR(16)  NOT NULL,
    lang                    VARCHAR(2)   NOT NULL DEFAULT 'vi',
    payload_json            JSONB        NOT NULL,
    org_name_snapshot       VARCHAR(160),
    org_logo_url_snapshot   VARCHAR(512),
    student_name_snapshot   VARCHAR(160) NOT NULL,
    issued_by               BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    issued_by_name_snapshot VARCHAR(160),
    issued_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Bí mật trong URL công khai (R1/R9): 30 ngày, thu hồi được, xoay = token mới trên cùng dòng.
    token                   VARCHAR(40)  NOT NULL,
    token_expires_at        TIMESTAMPTZ  NOT NULL,
    revoked_at              TIMESTAMPTZ,
    revoked_by              BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    -- Mã, không phải văn tự do: SUPERSEDED (phát hành lại) | OWNER | TEACHER | … — tầng ứng dụng liệt kê.
    revoke_reason           VARCHAR(64),
    view_count              INT          NOT NULL DEFAULT 0,
    last_viewed_at          TIMESTAMPTZ,
    CONSTRAINT uq_student_report_issues_token UNIQUE (token)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_report_issues_period') THEN
        ALTER TABLE student_report_issues
            ADD CONSTRAINT chk_student_report_issues_period
            CHECK (period IN ('MIDTERM','FINAL'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_report_issues_lang') THEN
        ALTER TABLE student_report_issues
            ADD CONSTRAINT chk_student_report_issues_lang
            CHECK (lang IN ('vi','en','de'));
    END IF;
    -- Mốc thu hồi và lý do đi thành cặp (khuôn V320): một mốc không lý do là một phiếu biến mất không ai
    -- giải thích được. KHÔNG ghép revoked_by vào cặp này: cột đó là FK SET NULL, người thu hồi xoá tài
    -- khoản thì Postgres tự đặt NULL — một CHECK đòi nó khác NULL sẽ làm chính lệnh xoá tài khoản đó đổ.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_report_issues_revoke_pair') THEN
        ALTER TABLE student_report_issues
            ADD CONSTRAINT chk_student_report_issues_revoke_pair
            CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_report_issues_view_count') THEN
        ALTER TABLE student_report_issues
            ADD CONSTRAINT chk_student_report_issues_view_count
            CHECK (view_count >= 0);
    END IF;
END $$;

-- "Phiếu kỳ X của lớp Y, mới nhất trước" — màn phát hành của giáo viên.
CREATE INDEX IF NOT EXISTS idx_student_report_issues_class_period
    ON student_report_issues (class_id, period, issued_at DESC);
-- "Phiếu đã gửi gia đình" của một học viên — R6: học viên xem đúng bản đã gửi.
CREATE INDEX IF NOT EXISTS idx_student_report_issues_student
    ON student_report_issues (student_id, issued_at DESC);
-- Đường đọc của giám đốc (R5/R12); một phần vì phiếu B2C không có org.
CREATE INDEX IF NOT EXISTS idx_student_report_issues_org
    ON student_report_issues (org_id, issued_at DESC)
    WHERE org_id IS NOT NULL;
-- Tra token còn hiệu lực trên đường công khai: index MỘT PHẦN chỉ chứa phiếu chưa thu hồi — nhỏ hơn
-- UNIQUE đầy đủ ở trên và tự rơi khỏi index khi thu hồi. UNIQUE đầy đủ vẫn giữ để token thu hồi rồi
-- không bao giờ được cấp lại cho phiếu khác (link cũ chết hẳn, không "sống lại" dưới tên người khác).
CREATE INDEX IF NOT EXISTS idx_student_report_issues_active_token
    ON student_report_issues (token)
    WHERE revoked_at IS NULL;

-- ── 2b. Bất biến — chỉ cho UPDATE nhóm cột token/thu hồi/lượt xem ────────────
-- Cách làm: so sánh toàn bộ dòng TRỪ nhóm cột được phép đổi. Danh sách trắng thay vì liệt kê cột bị khoá,
-- để cột thêm sau này MẶC ĐỊNH bị đóng băng — ai muốn mở phải sửa trigger, tức phải nói ra.
-- DELETE cố ý KHÔNG chặn: xoá tài khoản (CASCADE) phải mang phiếu đi (xem FK ở trên).
--
-- 🔴 `WHEN (pg_trigger_depth() = 0)` KHÔNG PHẢI trang trí — V319 đã trả giá cho một trigger thiếu nó:
-- PostgreSQL thi hành `ON DELETE SET NULL` cho issued_by/revoked_by/org_id bằng `UPDATE ONLY
-- student_report_issues`, đi qua đúng trigger này ở depth ≥ 1 — và issued_by NẰM TRONG nhóm bị so sánh
-- (danh sách trắng chỉ có token/thu hồi/lượt xem), nên thiếu WHEN thì xoá tài khoản một giáo viên từng
-- phát hành phiếu sẽ đổ ngay tại trigger này. Với WHEN, lệnh do người gõ (depth 0) vẫn bị chặn, còn lệnh
-- do khoá ngoại tự dọn (depth > 0) đi qua.
CREATE OR REPLACE FUNCTION student_report_issues_block_snapshot_mutation() RETURNS trigger AS $$
DECLARE
    mutable_cols text[] := ARRAY['token', 'token_expires_at',
                                 'revoked_at', 'revoked_by', 'revoke_reason',
                                 'view_count', 'last_viewed_at'];
BEGIN
    IF (to_jsonb(OLD) - mutable_cols) IS DISTINCT FROM (to_jsonb(NEW) - mutable_cols) THEN
        RAISE EXCEPTION 'student_report_issues la anh chup bat bien: UPDATE bi chan boi trg_student_report_issues_immutable (R2). Chi duoc doi token/token_expires_at/revoked_at/revoked_by/revoke_reason/view_count/last_viewed_at; phat hanh lai = INSERT dong moi.'
            USING ERRCODE = 'raise_exception';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_report_issues_immutable ON student_report_issues;

CREATE TRIGGER trg_student_report_issues_immutable
    BEFORE UPDATE ON student_report_issues
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION student_report_issues_block_snapshot_mutation();

COMMENT ON TABLE student_report_issues IS
    'Phiếu đánh giá đã PHÁT HÀNH cho gia đình (R1/R2, V323): ảnh chụp bất biến — payload_json mang toàn bộ '
    'nội dung, trigger chỉ cho đổi token/thu hồi/lượt xem. Phát hành lại = dòng mới, dòng cũ '
    'revoke_reason=SUPERSEDED. org_id đóng băng theo LỚP lúc phát hành. Xoá tài khoản học viên mang theo phiếu.';
COMMENT ON COLUMN student_report_issues.payload_json IS
    'Toàn bộ nội dung phiếu (R4). CẤM chứa: email học viên, ghi âm, transcript, bài nguyên văn, ai_score, tin nhắn.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Đồng ý chia sẻ phiếu với người giám hộ (R6)
-- ─────────────────────────────────────────────────────────────────────────────
-- Chính sách công bố hiện nói "không chia sẻ với bên thứ ba khác"; với học viên chưa thành niên, việc
-- trung tâm gửi phiếu cho gia đình cần một phạm vi đồng ý RIÊNG, thu bằng giấy cùng phiếu D1 (R6). Đường
-- ghi đã có (OrgGuardianConsentService.parseEnum nhận mọi hằng của enum) — chỉ CHECK ở DB là chưa biết
-- giá trị này. Thay CHECK bằng DROP + ADD (idempotent) vì ALTER CONSTRAINT không sửa được biểu thức.
ALTER TABLE student_consents DROP CONSTRAINT IF EXISTS chk_student_consents_scope;
ALTER TABLE student_consents
    ADD CONSTRAINT chk_student_consents_scope
    CHECK (scope IN ('DATA_PROCESSING', 'AI_PROCESSING', 'AUDIO_RECORDING', 'MESSAGING',
                     'GUARDIAN_REPORT_SHARING'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Hạn mềm bảo lưu (E6) — cột thôi, hành vi để đợt sau
-- ─────────────────────────────────────────────────────────────────────────────
-- RESERVED (V316) hôm nay không có hạn: một học viên bảo lưu giữ ghế vô thời hạn. E6 chốt hạn MỀM — hết
-- hạn thì nhắc trung tâm, không tự đổi trạng thái. NULL = không hạn (giữ nguyên hành vi hiện tại).
ALTER TABLE class_students ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;

COMMENT ON COLUMN class_students.reserved_until IS
    'Hạn MỀM của trạng thái RESERVED (E6, V323): hết hạn chỉ nhắc, không tự đổi trạng thái. NULL = không hạn.';
