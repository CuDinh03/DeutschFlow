-- V280: Huỷ các job AI tồn đọng quá 7 ngày ở trạng thái PENDING.
--
-- BỐI CẢNH: từ commit a7e48b28 (10/06/2026) đến bản vá 23/08/2026, AiJobWorker.processPendingJobs()
-- tự gọi claimJobs() trong cùng bean nên proxy bị bỏ qua → @Transactional(REQUIRES_NEW) vô hiệu →
-- bulkUpdateStatus ném TransactionRequiredException mỗi 2 giây và worker KHÔNG claim được job nào.
-- Mọi job xếp hàng trong ~2,5 tháng đó vẫn nằm nguyên ở PENDING.
--
-- VÌ SAO PHẢI CẮT: claimPendingJobs() sắp xếp `ORDER BY created_at ASC` và không lọc theo tuổi job,
-- nên sau khi worker sống lại nó sẽ xử lý backlog cũ TRƯỚC — gọi AI thật (tốn token, đụng rate limit)
-- để sinh ra kết quả mà người học đã rời phiên từ lâu không còn đọc nữa.
--
-- PHẠM VI: chỉ đụng status='PENDING' và created_at cũ hơn 7 ngày. Job PENDING mới (trong 7 ngày)
-- vẫn được worker xử lý bình thường. Không đụng PROCESSING/COMPLETED/FAILED.
--
-- TRA CỨU SAU: đếm số job đã huỷ bằng
--   SELECT count(*) FROM ai_jobs WHERE error_msg LIKE 'STALE_BACKLOG_CANCELLED_V280%';
UPDATE ai_jobs
SET status     = 'FAILED',
    error_msg  = 'STALE_BACKLOG_CANCELLED_V280: job tồn đọng >7 ngày do lỗi AiJobWorker không claim được job '
                 || '(10/06/2026 – 23/08/2026). Huỷ để worker không gọi AI cho kết quả đã hết giá trị. '
                 || 'Người học cần chạy lại nếu vẫn muốn có đánh giá.',
    updated_at = NOW()
WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '7 days';
