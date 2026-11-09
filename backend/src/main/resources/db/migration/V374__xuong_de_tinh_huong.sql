-- Xưởng đề đợt 3 (10/11/2026): các Teil soạn theo tình huống đời thường (Lesen Teil 3, Sprachbausteine 1–2,
-- Schreiben) không có bước nguồn báo — admin nhập một tình huống (vd. "Thư khiếu nại: máy giặt mới hỏng sau
-- một tuần") để AI viết theo. Để trống thì AI tự chọn trong chủ đề trung lập.
-- Số V374: V371 = Xưởng đề đợt 1 (#812), V373 = #817; V372 để dành cho #819 (đang trùng V368 phải đổi số).
ALTER TABLE exam_drafts ADD COLUMN IF NOT EXISTS situation TEXT;
