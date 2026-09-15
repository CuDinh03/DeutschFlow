-- V312: Hai gói đề mới cho A2 và C1 (nội dung ở V308, V311) và xếp lại catalog theo bậc trình độ.
-- Gói là "khung nhìn" theo (cefr_level, exam_format) — thêm gói là đủ để 5 đề mỗi cấp lên catalog.

INSERT INTO mock_exam_packs (title, description_vi, cefr_level, exam_format, requires_paid, sort_order) VALUES
 ('Luyện thi Goethe A2', 'Bộ đề thi thử Goethe-Zertifikat A2 — 5 đề đủ 4 kỹ năng, có chấm điểm + nhận xét AI.', 'A2', 'GOETHE', TRUE, 2),
 ('Luyện thi Goethe C1', 'Bộ đề thi thử Goethe-Zertifikat C1 — 5 đề nâng cao cho bậc cao nhất của lộ trình.', 'C1', 'GOETHE', TRUE, 5);

-- Trước đợt này thứ tự là B1 (1) · B2 (2) · A1 (3); chèn A2/C1 vào giữa sẽ ra catalog lộn xộn.
UPDATE mock_exam_packs SET sort_order = 1 WHERE cefr_level = 'A1' AND exam_format = 'GOETHE' AND title = 'Làm quen Goethe A1';
UPDATE mock_exam_packs SET sort_order = 3 WHERE cefr_level = 'B1' AND exam_format = 'GOETHE' AND title = 'Luyện thi Goethe B1 — Bộ đề đầy đủ';
UPDATE mock_exam_packs SET sort_order = 4 WHERE cefr_level = 'B2' AND exam_format = 'GOETHE' AND title = 'Luyện thi Goethe B2';
