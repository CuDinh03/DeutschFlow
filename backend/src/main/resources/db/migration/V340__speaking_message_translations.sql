-- ============================================================
-- V340: Bản dịch câu trợ lý trong phiên nói (22/10/2026, K4 định hướng A + B + E)
--
-- Học viên bấm "Dịch" dưới câu người phỏng vấn / bạn đồng hành ⇒ dịch một lần theo yêu cầu rồi
-- lưu lại, bấm lại (hoặc mở lại phiên) không gọi AI nữa. Không dịch sẵn mọi lượt: người học tự nghe
-- hiểu trước, và chỉ tốn token khi thật sự cần.
-- ============================================================

ALTER TABLE ai_speaking_messages ADD COLUMN IF NOT EXISTS translation_vi TEXT;
ALTER TABLE ai_speaking_messages ADD COLUMN IF NOT EXISTS translation_en TEXT;
