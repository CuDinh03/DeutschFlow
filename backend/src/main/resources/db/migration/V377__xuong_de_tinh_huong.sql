-- Xưởng đề đợt 3 (10/11/2026): các Teil soạn theo tình huống đời thường (Lesen Teil 3, Sprachbausteine 1–2,
-- Schreiben) không có bước nguồn báo — admin nhập một tình huống (vd. "Thư khiếu nại: máy giặt mới hỏng sau
-- một tuần") để AI viết theo. Để trống thì AI tự chọn trong chủ đề trung lập.
-- Số V377: main đã chạy tới V375 (V374 = #817, V375 = #819); V376 = Xưởng đề đợt 1 (#812).
ALTER TABLE exam_drafts ADD COLUMN IF NOT EXISTS situation TEXT;
