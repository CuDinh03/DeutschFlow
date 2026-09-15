-- V313 — Gói cá nhân TẠM DỪNG khi học viên vào trung tâm, khôi phục khi rời (DEC-09, PR-A4).
--
-- Trước đợt này, cấp gói trung tâm đi qua `activateWithExplicitEnd`, hàm đó ENDED MỌI dòng ACTIVE
-- của người dùng. Nghĩa là một học viên đang trả tiền gói cá nhân (Apple/SePay) mà được thêm vào
-- trung tâm thì phần thời gian đã trả bị xoá sổ, rời trung tâm cũng không lấy lại được. Owner chốt
-- ngày 07/09 (Q1): quyền của trung tâm hiệu lực trong lúc là thành viên, còn gói cá nhân chỉ TẠM
-- DỪNG và giữ nguyên phần thời hạn còn lại.
--
-- `paused_at` là mốc để tính phần còn lại: lúc khôi phục, `ends_at` mới = now + (ends_at − paused_at).
-- Không cột nào khác đủ dùng — `updated_at` bị mọi lần ghi khác đè lên.
--
-- Trạng thái mới 'PAUSED' an toàn với mã hiện có: đã soát toàn bộ vị từ trên cột `status` của bảng
-- này (07/09) — tất cả đều là so sánh BẰNG với 'ACTIVE' hoặc 'ENDED', không có `!= 'ENDED'` hay
-- `IN (...)` nào, nên dòng PAUSED không lọt vào bất kỳ đường tính quyền lợi nào.
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ NULL;

-- Chỉ mục riêng phần: đường khôi phục hỏi "người này còn dòng PAUSED nào không" mỗi lần rời trung
-- tâm và mỗi vòng job đối soát. Toàn bảng hầu như không có dòng PAUSED nên chỉ mục đầy đủ là lãng phí.
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_paused
    ON user_subscriptions (user_id)
    WHERE status = 'PAUSED';

COMMENT ON COLUMN user_subscriptions.paused_at IS
    'Thời điểm gói cá nhân bị tạm dừng vì học viên vào trung tâm (DEC-09). NULL với mọi dòng khác. '
    'Phần thời hạn còn lại = ends_at - paused_at; lúc khôi phục ends_at mới = now + phần còn lại.';
