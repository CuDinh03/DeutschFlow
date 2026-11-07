-- Làm mới Luyện thi đợt (d) (07/11/2026): lịch tuần chia theo ngày, học viên đổi chỗ được buổi chưa làm.
-- Lịch theo ngày vẫn sinh lại lúc đọc; bảng chỉ giữ thứ tự học viên đã đổi, dạng hoán vị chỉ số của
-- thứ tự mặc định: {"3": [0, 2, 1, 3, 4, 5, 6]} = tuần 3, ngày 2 và ngày 3 đã đổi chỗ.
-- Đổi ngày thi / kỳ thi / bậc thì kế hoạch tính lại và cột này về '{}' (ExamPlanService).
ALTER TABLE exam_plan_state
    ADD COLUMN IF NOT EXISTS day_order_json JSONB NOT NULL DEFAULT '{}'::jsonb;
