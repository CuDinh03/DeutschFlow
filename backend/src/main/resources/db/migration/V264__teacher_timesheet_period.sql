-- ============================================================
-- V264: teacher_timesheet_period — KỲ CÔNG + QUY TRÌNH DUYỆT + KHOÁ SỔ
-- ============================================================
-- Vòng đời: OPEN → SUBMITTED → APPROVED → LOCKED, nhánh phụ SUBMITTED → REJECTED → SUBMITTED.
-- Giáo viên nộp; manager (OWNER|MANAGER của tổ chức) duyệt / trả lại / khoá.
--
-- VÌ SAO PHẢI CÓ KHOÁ SỔ: không thể trả lương từ dữ liệu sửa–xoá tự do vô thời hạn. Khi kỳ đã
-- SUBMITTED trở đi, teacher_session_record trong kỳ bị chặn thêm/sửa/xoá (ép ở tầng service). Không
-- có ràng buộc này thì bước duyệt chỉ là hình thức.
--
-- PHẠM VI KHOÁ: chỉ khoá DÒNG CÔNG (teacher_session_record), KHÔNG khoá class_lesson_logs.
-- Sổ điểm danh học viên là dữ liệu học vụ, không phải dữ liệu lương — đóng băng nó theo kỳ lương sẽ
-- cản giáo viên sửa chính tả chủ đề hay bổ sung điểm danh sót cho một buổi đã qua. Việc tách bảng
-- ghi công ở V263 chính là để hai thứ này độc lập nhau.
--
-- SNAPSHOT SỐ CÔNG: total_sessions/total_minutes được chốt lại tại MỖI lần chuyển trạng thái, không
-- tính động khi đọc. Nếu tính động thì sửa dữ liệu sau khi duyệt sẽ âm thầm đổi con số đã trả lương
-- — đúng vấn đề mà org_certificates (V214) đã giải bằng cách chụp lại giá trị.
--
-- CHECK liệt kê ĐỦ ngay từ đầu, kể cả REJECTED: V229 đã phải viết migration sửa CHECK vì V204 bỏ sót
-- giá trị MANAGER và chặn cứng cả tính năng.
-- ============================================================

CREATE TABLE IF NOT EXISTS teacher_timesheet_period (
    id             BIGSERIAL PRIMARY KEY,

    teacher_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Snapshot org của giáo viên lúc mở kỳ. Giáo viên chuyển trung tâm thì kỳ cũ vẫn thuộc về
    -- tổ chức đã duyệt nó, không trôi theo tổ chức hiện tại (bài học 'Audit M-7' của V214).
    org_id         BIGINT      REFERENCES organizations(id) ON DELETE SET NULL,

    period_start   DATE        NOT NULL,
    period_end     DATE        NOT NULL,

    -- Đơn vị tính công mặc định của kỳ; teacher_classes.pay_unit (V263) ghi đè ở mức lớp.
    pay_unit       VARCHAR(8)  NOT NULL DEFAULT 'SESSION',

    status         VARCHAR(16) NOT NULL DEFAULT 'OPEN',

    -- Số công đã chốt tại lần chuyển trạng thái gần nhất.
    total_sessions INT         NOT NULL DEFAULT 0,
    total_minutes  INT         NOT NULL DEFAULT 0,

    submitted_at   TIMESTAMPTZ,
    reviewed_by    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ,
    reject_reason  TEXT,
    note           TEXT,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ttp_status   CHECK (status IN ('OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED')),
    CONSTRAINT chk_ttp_pay_unit CHECK (pay_unit IN ('SESSION', 'HOUR')),
    CONSTRAINT chk_ttp_range    CHECK (period_end >= period_start)
);

-- Một giáo viên chỉ có MỘT kỳ cho mỗi mốc bắt đầu. org_invoices (V206) thiếu ràng buộc này nên tạo
-- trùng kỳ được — không lặp lại ở đây, vì trùng kỳ nghĩa là trả lương hai lần cho cùng khoảng.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ttp_teacher_period
    ON teacher_timesheet_period(teacher_id, period_start);

-- Màn hình manager: mọi kỳ của tổ chức, mới nhất trước.
CREATE INDEX IF NOT EXISTS idx_ttp_org_period
    ON teacher_timesheet_period(org_id, period_start DESC) WHERE org_id IS NOT NULL;

COMMENT ON TABLE teacher_timesheet_period IS
    'Kỳ công của giáo viên + quy trình duyệt. Khi status khác OPEN/REJECTED, các teacher_session_record trong kỳ bị chặn sửa (ép ở tầng service).';
COMMENT ON COLUMN teacher_timesheet_period.total_sessions IS
    'Số buổi đã chốt tại lần chuyển trạng thái gần nhất — KHÔNG tính động khi đọc, để sửa dữ liệu sau khi duyệt không âm thầm đổi số đã trả.';

-- ============================================================
-- Nối dòng công vào kỳ. NULL = chưa thuộc kỳ nào (kỳ được tạo khi giáo viên mở bảng công).
-- ON DELETE SET NULL: xoá kỳ không được làm mất bản ghi công.
-- ============================================================
ALTER TABLE teacher_session_record
    ADD COLUMN IF NOT EXISTS period_id BIGINT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tsr_period') THEN
    ALTER TABLE teacher_session_record
      ADD CONSTRAINT fk_tsr_period FOREIGN KEY (period_id)
      REFERENCES teacher_timesheet_period(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tsr_period ON teacher_session_record(period_id)
    WHERE period_id IS NOT NULL;
