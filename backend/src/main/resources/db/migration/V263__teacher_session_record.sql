-- ============================================================
-- V263: teacher_session_record — BẢN GHI CÔNG CỦA GIÁO VIÊN
-- ============================================================
-- Đây KHÔNG phải sổ điểm danh học viên. class_lesson_logs + class_attendance ghi "học viên Y có
-- mặt buổi này"; bảng này ghi "giáo viên X đã dạy buổi này, bao nhiêu phút" — căn cứ tính công.
--
-- VÌ SAO PHẢI LÀ BẢNG RIÊNG, không tái dùng class_lesson_logs:
--   * class_sessions KHÔNG có teacher_id → không suy được ai thực dạy, chỉ biết "lớp này GV X có
--     tham gia" qua class_teachers. Một lớp có 1 PRIMARY + N ASSISTANT (TeacherService.addCoTeacher).
--   * class_lesson_logs.created_by là NGƯỜI GHI, không phải NGƯỜI DẠY: nullable, và updateLog không
--     cập nhật lại nó — trợ giảng sửa log của giáo viên chính thì created_by vẫn là người tạo.
--   * class_lesson_logs không có thời lượng, chỉ có session_date kiểu DATE.
--
-- VÌ SAO PHẢI SNAPSHOT (điểm quan trọng nhất của migration này):
--   ClassScheduleService.regenerate() XOÁ THẬT mọi class_sessions tương lai chưa được chỉnh tay,
--   và class_sessions.class_id là ON DELETE CASCADE. Nếu dòng công chỉ trỏ FK sang class_sessions
--   thì một lần sinh lại lịch (hoặc xoá lớp) sẽ làm số công đã chốt bốc hơi hoặc đổi giá trị.
--   Vì vậy started_at / duration_minutes / class_name_snapshot / org_id được CHỐT vào chính dòng
--   công; các FK chỉ là liên kết tham chiếu và đều ON DELETE SET NULL.
--   Cùng lý do với org_certificates (V214): số đã chốt không được join live.
--
-- KIỂU THỜI GIAN (repo đang không nhất quán, nên chọn có chủ ý):
--   * started_at dùng TIMESTAMP (không tz) để KHỚP class_sessions.start_at / LocalDateTime.
--   * created_at/updated_at dùng TIMESTAMPTZ như các bảng nghiệp vụ khác (class_lesson_logs, V214).
--
-- CHECK liệt kê ĐỦ ngay từ đầu: V229 đã phải viết migration sửa CHECK vì V204 bỏ sót giá trị
-- MANAGER, chặn cứng cả tính năng. Ở đây liệt kê sẵn cả SUBSTITUTE (dạy thay) dù chưa dùng ngay.
-- ============================================================

CREATE TABLE IF NOT EXISTS teacher_session_record (
    id                  BIGSERIAL PRIMARY KEY,

    -- Chủ thể chấm công. Bắt buộc và độc lập — KHÔNG suy từ class_teachers lúc đọc.
    teacher_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Liên kết tham chiếu (có thể mất) — mọi giá trị cần cho tính công đều đã snapshot bên dưới.
    class_id            BIGINT      REFERENCES teacher_classes(id) ON DELETE SET NULL,
    session_id          BIGINT      REFERENCES class_sessions(id)  ON DELETE SET NULL,
    lesson_log_id       BIGINT      REFERENCES class_lesson_logs(id) ON DELETE SET NULL,

    -- SNAPSHOT: nguồn sự thật của số công, chốt một lần lúc ghi nhận.
    org_id              BIGINT      REFERENCES organizations(id) ON DELETE SET NULL,
    class_name_snapshot VARCHAR(255),
    started_at          TIMESTAMP   NOT NULL,
    duration_minutes    INT         NOT NULL CHECK (duration_minutes > 0),

    teacher_role        VARCHAR(16) NOT NULL DEFAULT 'PRIMARY',
    note                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tsr_role CHECK (teacher_role IN ('PRIMARY', 'ASSISTANT', 'SUBSTITUTE'))
);

-- Chống trả thừa công. Khoá theo (giáo viên, thời điểm bắt đầu) chứ KHÔNG theo (lớp, ngày):
--   * theo ngày sẽ chặn oan giáo viên dạy cùng một lớp hai ca trong ngày;
--   * theo session_id sẽ lọt trùng với buổi dạy ad-hoc, vì Postgres coi mọi NULL là khác nhau;
--   * theo (teacher_id, started_at) đúng với thực tế "không ai đứng hai lớp cùng lúc", và trùng
--     khớp với guard assertTeacherFree đã có trong ClassScheduleService.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tsr_teacher_start
    ON teacher_session_record(teacher_id, started_at);

-- Tổng hợp bảng công theo giáo viên trong một kỳ.
CREATE INDEX IF NOT EXISTS idx_tsr_teacher_period
    ON teacher_session_record(teacher_id, started_at DESC);

-- Tổng hợp phía manager: toàn tổ chức trong một kỳ. org_id đã snapshot nên không phải bắc cầu
-- qua teacher_classes như ClassScheduleService.weekForOrg buộc phải làm.
CREATE INDEX IF NOT EXISTS idx_tsr_org_period
    ON teacher_session_record(org_id, started_at DESC) WHERE org_id IS NOT NULL;

COMMENT ON TABLE teacher_session_record IS
    'Bản ghi công của giáo viên (ai dạy, khi nào, bao nhiêu phút). Khác class_lesson_logs — bảng kia là sổ điểm danh học viên. Các cột snapshot là nguồn sự thật; FK chỉ để tham chiếu.';
COMMENT ON COLUMN teacher_session_record.started_at IS
    'Thời điểm bắt đầu THỰC TẾ, đã snapshot. Buổi bị dời tính vào kỳ theo mốc này (thực dạy), không theo class_sessions.original_date (ô lịch gốc).';
COMMENT ON COLUMN teacher_session_record.duration_minutes IS
    'Thời lượng THỰC TẾ đã snapshot — không đọc lại class_sessions.duration_minutes, vì sửa lịch sau khi chốt sẽ làm lệch số công.';

-- ============================================================
-- Đơn vị tính công theo lớp. NULL = theo mặc định của kỳ công (V264).
-- Hợp đồng có thể tính theo buổi hoặc theo giờ, nên phải cấu hình được ở mức lớp.
-- ============================================================
ALTER TABLE teacher_classes
    ADD COLUMN IF NOT EXISTS pay_unit VARCHAR(8);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tc_pay_unit') THEN
    ALTER TABLE teacher_classes
      ADD CONSTRAINT chk_tc_pay_unit CHECK (pay_unit IS NULL OR pay_unit IN ('SESSION', 'HOUR'));
  END IF;
END $$;

COMMENT ON COLUMN teacher_classes.pay_unit IS
    'Đơn vị tính công của lớp: SESSION (theo buổi) hoặc HOUR (theo giờ). NULL = kế thừa mặc định của kỳ công.';
