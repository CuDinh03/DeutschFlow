-- ============================================================
-- V259: assignment_material — gắn tài liệu (thư viện) vào bài tập giao cho học viên (M:N)
-- ============================================================
-- Trước đây giáo viên chỉ nhập tay topic/description + 1 attachmentUrl (link ngoài) cho một bài tập.
-- Bảng NỐI này cho phép đính KÈM tài liệu có sẵn trong thư viện (materials) vào một bài tập —
-- giống hệt lesson_material (V254)/class_materials: một tài liệu tái sử dụng được cho nhiều bài tập,
-- nên dùng bảng nối M:N thay vì cột đơn trên class_assignments (sẽ khoá tài liệu vào 1 bài tập).
-- order_index cho phép sắp thứ tự tài liệu hiển thị trong một bài tập.
--
-- CASCADE: đây là các dòng NỐI (không phải bản thân tài liệu) — xoá bài tập hoặc xoá tài liệu chỉ
-- gỡ liên kết. Bản thân materials vẫn còn (quản lý riêng qua status ACTIVE/ARCHIVED). Xoá bài tập
-- (nếu có) cũng chỉ gỡ liên kết, không đụng tới tài liệu gốc.
-- ============================================================

CREATE TABLE IF NOT EXISTS assignment_material (
    assignment_id BIGINT NOT NULL,
    material_id   BIGINT NOT NULL,
    order_index   INT NOT NULL DEFAULT 0,
    attached_by   BIGINT NOT NULL,
    attached_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (assignment_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_material_assignment
    ON assignment_material(assignment_id, order_index);

-- Đọc ngược "tài liệu này đang gắn ở bao nhiêu bài tập" (cảnh báo trước khi lưu trữ tài liệu).
CREATE INDEX IF NOT EXISTS idx_assignment_material_material
    ON assignment_material(material_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_material_assignment') THEN
    ALTER TABLE assignment_material
      ADD CONSTRAINT fk_assignment_material_assignment
      FOREIGN KEY (assignment_id) REFERENCES class_assignments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_material_material') THEN
    ALTER TABLE assignment_material
      ADD CONSTRAINT fk_assignment_material_material
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE;
  END IF;
END $$;
