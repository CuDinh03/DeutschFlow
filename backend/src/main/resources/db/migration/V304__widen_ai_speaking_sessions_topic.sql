-- Nới trần topic phiên AI speaking 200 → 2000 ký tự (05/09/2026).
-- Bài giao SPEAKING_SCENARIO ghép "Chủ đề / Mô tả chi tiết / Gợi ý" từ kịch bản AI sinh, thường
-- dài hơn 200 → CreateSessionRequest @Size(200) trả 400 "One or more fields are invalid" ngay khi
-- học viên bấm bắt đầu (web + mobile từng phải cắt chuỗi, mất ngữ cảnh cho gia sư AI).
-- Postgres nới VARCHAR(n) chỉ đổi metadata, không rewrite bảng.
ALTER TABLE ai_speaking_sessions ALTER COLUMN topic TYPE VARCHAR(2000);
