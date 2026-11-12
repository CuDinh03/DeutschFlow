-- Xưởng đề — Lesen Teil 1 nhiều chủ đề (owner chốt 13/11/2026): 5 đoạn trải trên nhiều chủ đề riêng, chỉ một cặp
-- được chung chủ đề. Bộ điều phối ghi lại mỗi bài nguồn được lấy cho chủ đề nào (địa chỉ đã chuẩn hoá → tên chủ đề)
-- để biết chủ đề nào còn thiếu nguồn khi một bài bị loại.
-- Chỉ thêm cột có mặc định: màu cũ vẫn chạy được trong lúc blue-green.

ALTER TABLE exam_set_run_teile
    ADD COLUMN IF NOT EXISTS source_themes JSONB NOT NULL DEFAULT '{}'::jsonb;
