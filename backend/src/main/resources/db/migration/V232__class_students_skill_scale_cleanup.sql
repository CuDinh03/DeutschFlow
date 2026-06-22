-- V232 — Dọn thang điểm kỹ năng CEFR trên class_students + thắt CHECK (0–10).
-- (V231 slot đã thuộc về V231__assignment_grading_rubric.sql — concurrent PROMPT 6 work; migration này lấy V232.)
--
-- BỐI CẢNH: 4 cột skill_horen/lesen/schreiben/sprechen (V209, NUMERIC(4,1)) đang LẪN 2 thang:
--   • CHÍNH THỨC — set qua StudentEvaluationService.saveEvaluation (luôn stamp evaluated_at = now())
--     → thang 0–10 (ngưỡng đậu/cert ≥ 5.0; comment cột ở V209 ghi rõ "0–10").
--   • RÁC/CŨ — evaluated_at IS NULL (chưa từng qua luồng đánh giá thật) → thang 0–100 (vd 62, 68, 91).
-- FE class-detail (#148) đã né bằng cách chỉ hiện skill khi evaluated_at != NULL, nhưng DB vẫn bẩn.
--
-- QUYẾT ĐỊNH: với row evaluated_at IS NULL → set skill_* = NULL (coi như CHƯA đánh giá).
--   KHÔNG rescale /10: không có evaluated_at nghĩa là không phải đánh giá thật → rescale sẽ bịa ra
--   dữ liệu "trông chính thức" nhưng vô căn cứ; và FE vốn đã ẩn row evaluated_at NULL nên rescale
--   cũng vô hình. Invariant sau migration: skill_* chỉ mang giá trị khi đã có đánh giá thật.
--   Chỉ đụng 4 cột skill_*; teacher_comment giữ nguyên (không phải vấn đề thang điểm, không xoá dữ liệu).
--
-- AN TOÀN (đã kiểm DB local 2026-06-22): mọi row evaluated_at NULL có skill đều ở dải 0–100 (min 58),
--   0 row evaluated_at NULL nằm dải 0–10 (không nhập nhằng), 0 row đã-đánh-giá vượt 10,
--   0 row evaluated_at NULL kèm teacher_comment (không mất nhận xét nào).
--
-- THỨ TỰ: UPDATE dọn rác TRƯỚC → ADD CONSTRAINT SAU (validate trên dữ liệu đã sạch).
--
-- Rollback (thủ công — Flyway CE không undo; dữ liệu rác đã NULL KHÔNG khôi phục được):
--   ALTER TABLE class_students DROP CONSTRAINT IF EXISTS chk_class_students_skill_range;

-- 1) Dọn dữ liệu thang 0–100 — chỉ những row CHƯA từng đánh giá thật (evaluated_at IS NULL).
UPDATE class_students
   SET skill_horen     = NULL,
       skill_lesen     = NULL,
       skill_schreiben = NULL,
       skill_sprechen  = NULL
 WHERE evaluated_at IS NULL
   AND (skill_horen     IS NOT NULL
     OR skill_lesen     IS NOT NULL
     OR skill_schreiben IS NOT NULL
     OR skill_sprechen  IS NOT NULL);

-- 2) Phòng vệ: nếu còn sót skill ngoài 0–10 (vd row đã-đánh-giá bị nhập sai thang) thì DỪNG —
--    để không thắt constraint trên dữ liệu vẫn bẩn (lỗi constraint giữa chừng khó truy nguyên).
--    Cùng triết lý fail-loud với V229.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM class_students
     WHERE (skill_horen     IS NOT NULL AND (skill_horen     < 0 OR skill_horen     > 10))
        OR (skill_lesen     IS NOT NULL AND (skill_lesen     < 0 OR skill_lesen     > 10))
        OR (skill_schreiben IS NOT NULL AND (skill_schreiben < 0 OR skill_schreiben > 10))
        OR (skill_sprechen  IS NOT NULL AND (skill_sprechen  < 0 OR skill_sprechen  > 10))
  ) THEN
    RAISE EXCEPTION 'V232: còn row skill ngoài dải 0-10 (đã-đánh-giá nhập sai thang?) — rà soát thủ công trước khi thắt CHECK.';
  END IF;
END $$;

-- 3) Thắt CHECK 0–10. NULL được phép (NULL trong so sánh → NULL → CHECK chỉ fail khi FALSE).
--    Idempotent: DROP IF EXISTS + ADD.
ALTER TABLE class_students DROP CONSTRAINT IF EXISTS chk_class_students_skill_range;
ALTER TABLE class_students ADD CONSTRAINT chk_class_students_skill_range CHECK (
        (skill_horen     IS NULL OR (skill_horen     >= 0 AND skill_horen     <= 10)) AND
        (skill_lesen     IS NULL OR (skill_lesen     >= 0 AND skill_lesen     <= 10)) AND
        (skill_schreiben IS NULL OR (skill_schreiben >= 0 AND skill_schreiben <= 10)) AND
        (skill_sprechen  IS NULL OR (skill_sprechen  >= 0 AND skill_sprechen  <= 10))
);
