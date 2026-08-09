-- ============================================================
-- V270: ai_token_usage_events.cached_prompt_tokens
-- ============================================================
-- Nhà cung cấp LLM phục vụ một phần prompt từ CACHE và tính phần đó rẻ hơn hẳn:
-- Fireworks bật prompt caching tự động, cached-input = 50% giá input với gpt-oss-20b
-- và chỉ 10% với gpt-oss-120b. Đo thật 09/08/2026 thấy cache hit ~99% ở CẢ 8 tier
-- (system prompt lặp y nguyên mỗi lượt) ⇒ tính toàn bộ prompt theo giá input thường
-- làm mọi báo cáo COGS khai VỐNG chi phí chat khoảng 3×, đúng con số dùng để quyết
-- giá gói và ngân sách AI.
--
-- Cột này là phần CON của prompt_tokens (không cộng thêm): chi phí một event =
--   (prompt_tokens - cached_prompt_tokens) × giá input
-- + cached_prompt_tokens               × giá cached-input
-- + completion_tokens                  × giá output
--
-- DEFAULT 0 + NOT NULL: hàng lịch sử đọc ra 0 ⇒ định giá y như trước, KHÔNG viết lại
-- lịch sử (nguyên tắc của AiCostEstimator: rate đổi theo thời gian, hàng cũ không bị sửa).
-- Endpoint nào không trả `usage.prompt_tokens_details.cached_tokens` cũng ghi 0, vô hại.

ALTER TABLE ai_token_usage_events
    ADD COLUMN IF NOT EXISTS cached_prompt_tokens INTEGER NOT NULL DEFAULT 0;
