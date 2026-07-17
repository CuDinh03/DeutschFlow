-- ============================================================
-- V259: assignment_material — bổ sung metadata attach (Phase 3) cho bảng NỐI đã có ở V258
-- ============================================================
-- V258 (§4) ĐÃ tạo sẵn bảng NỐI `assignment_material(assignment_id, material_id, order_index)` như
-- DDL Phase 1 ("attach/detach + API học viên là Phase 3"). Đây CHÍNH là Phase 3: gắn tài liệu thư viện
-- vào bài tập. Entity AssignmentMaterial thêm hai cột `attached_by` + `attached_at` (mirror
-- lesson_material V254), nên KHÔNG tạo lại bảng (CREATE IF NOT EXISTS sẽ bị bỏ qua và Hibernate
-- ddl-auto=validate báo thiếu cột) mà ALTER bảng sẵn có.
--
-- An toàn: tính năng attach chưa từng tồn tại nên bảng đang RỖNG ở mọi môi trường → thêm cột NOT NULL
-- không rủi ro. Additive, không di trú dữ liệu.
-- ============================================================

-- attached_at: thêm với DEFAULT NOW() (khớp lesson_material V254); entity cũng set qua @PrePersist.
ALTER TABLE assignment_material ADD COLUMN IF NOT EXISTS attached_at TIMESTAMP NOT NULL DEFAULT NOW();

-- attached_by: thêm nullable trước, back-fill dòng lạc (nếu có) rồi siết NOT NULL đúng như entity.
ALTER TABLE assignment_material ADD COLUMN IF NOT EXISTS attached_by BIGINT;
UPDATE assignment_material SET attached_by = 0 WHERE attached_by IS NULL;
ALTER TABLE assignment_material ALTER COLUMN attached_by SET NOT NULL;

-- Đọc ngược "tài liệu này đang gắn ở bao nhiêu bài tập" (cảnh báo trước khi lưu trữ tài liệu) —
-- V258 mới chỉ có index theo (assignment_id, order_index).
CREATE INDEX IF NOT EXISTS idx_assignment_material_material
    ON assignment_material (material_id);

-- V258 tạo FK material KHÔNG có ON DELETE CASCADE. Căn chỉnh theo lesson_material: xoá một tài liệu chỉ
-- gỡ các dòng NỐI thay vì lỗi FK. Bảng rỗng nên drop+add an toàn.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_material_material') THEN
    ALTER TABLE assignment_material DROP CONSTRAINT fk_assignment_material_material;
  END IF;
  ALTER TABLE assignment_material
    ADD CONSTRAINT fk_assignment_material_material
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE;
END $$;
