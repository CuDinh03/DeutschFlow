-- V321 — `content_reports`: quyền riêng tư của bản chụp, hạn lưu, và trung tâm đóng băng.
-- Owner chốt 10/09/2026: 8 quyết định buổi sáng + B1–B4 buổi chiều (moderation).
--
--   1. Người BỊ TỐ CÁO xoá tài khoản ⇒ ẨN DANH nội dung: snapshot_body = NULL, details = NULL,
--      GIỮ dòng, GIỮ reporter_id (B1 — người tố cáo là người khác, chưa hề yêu cầu xoá gì).
--      Việc này làm ở AccountDeletionService (trước DELETE users), không phải ở đây.
--   2. Người TỐ CÁO xoá tài khoản ⇒ giữ báo cáo, reporter_id CASCADE → SET NULL (cột bỏ NOT NULL).
--   3. Thêm org_id, ĐÓNG BĂNG lúc ghi, gán theo NGƯỜI BỊ TỐ CÁO: CLASS_MESSAGE → lớp → teacher_classes.org_id;
--      DIRECT_MESSAGE/USER → membership ACTIVE của reportedUserId trong org_members. Dòng cũ để NULL.
--      Đợt này KHÔNG mở endpoint đọc theo trung tâm (B3) — cột tồn tại để vết admin rơi đúng sổ.
--   4. details đi cùng luật với snapshot_body (cùng bị ẩn danh, cùng bị dọn).
--   5. Hạn lưu 90 NGÀY sau RESOLVED/DISMISSED: job 05:00 VN xoá NỘI DUNG, giữ dòng, đóng dấu
--      content_purged_at. PENDING không dọn, nhưng tồn đọng > 30 ngày thì job log.warn (B4).
--   6. Throttle POST /api/moderation/report theo người 10/giờ + 30/ngày; trùng khoá khi còn PENDING
--      ⇒ 200 idempotent với id cũ; quá ngưỡng ⇒ 429 có Retry-After (B2). Không đụng schema.
--   7. Đường đọc admin GET /api/admin/moderation/reports ghi vết, một vết cho MỖI trung tâm bị chạm —
--      cần org_id trên dòng để nhóm. POST resolve chuyển sang vết có touchedOrgId = org_id của báo cáo.
--   8. Thông báo ACCOUNT_DELETED bỏ email + tên, chỉ giữ deletedUserId — phần dữ liệu cũ dọn ở cuối tệp.
--
-- Hiện trạng V244 (kiểm 10/09): reporter_id NOT NULL ... ON DELETE CASCADE; reported_user_id SET NULL;
-- resolved_at TIMESTAMPTZ có sẵn (V244:36) — job dùng đúng cột này làm mốc 90 ngày; không org_id;
-- chỉ hai index (status, created_at DESC) và (reporter_id); KHÔNG index reported_user_id (nợ B-8).
-- Không migration nào sau V244 chạm bảng này.
--
-- 🔴 SỐ HIỆU: V317/V319/V320 đã chiếm trên nhánh Gói 0/Gói 1; V318 thuộc nhánh Gói 0 khác (trigger
--    chặn admin-làm-thành-viên) — KHÔNG dùng lại. `spring.flyway.out-of-order = false` nên nếu V318
--    merge SAU bản này thì phải đánh số lại V318 → V322+ ở nhánh đó, không phải ở đây.
--
-- ⛔ KHÔNG GẮN TRIGGER append-only. Job dọn và AccountDeletionService đều UPDATE bảng này — một
--    trigger chặn mutation sẽ giết đúng tính năng mà migration sinh ra (cùng bài học V320 vừa ghi).
--    Bằng chứng "ai dọn, lúc nào, bao nhiêu" nằm ở audit_logs (bất biến từ V303), không ở đây.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. reporter_id: NOT NULL + CASCADE  →  NULL + SET NULL  (quyết định 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- Vì sao SET NULL chứ không CASCADE: báo cáo là bằng chứng kiểm duyệt về NGƯỜI KHÁC (người bị tố
-- cáo). Người tố cáo rút khỏi hệ thống không làm bằng chứng đó mất giá trị — chỉ mất danh tính người
-- nộp. CASCADE (V244) đã xoá cả báo cáo lẫn snapshot đang chờ xử lý mỗi khi một người tố cáo xoá
-- tài khoản — tức người bị tố cáo có thể "xoá" báo cáo về mình bằng cách thuyết phục người kia rời đi.
ALTER TABLE content_reports ALTER COLUMN reporter_id DROP NOT NULL;

-- Tên FK do Postgres tự đặt (V244 khai inline, không đặt tên) — tra động qua pg_constraint thay vì
-- đoán 'content_reports_reporter_id_fkey': tên có thể khác trên DB đã từng được sửa tay.
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT con.conname INTO fk_name
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.conrelid = 'content_reports'::regclass
       AND con.contype = 'f'
       AND con.confrelid = 'users'::regclass
       AND att.attname = 'reporter_id'
     LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE content_reports DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

ALTER TABLE content_reports
    ADD CONSTRAINT fk_content_reports_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. org_id — ẢNH CHỤP trung tâm của NGƯỜI BỊ TỐ CÁO tại thời điểm ghi (quyết định 3)
-- ─────────────────────────────────────────────────────────────────────────────
-- Khoá ngoại NO ACTION (không ON DELETE), cùng khuôn audit_logs.org_id (V315) và
-- speaking_exam_sessions.org_id (V320): ảnh chụp mà SET NULL thì vết mất trung tâm đúng lúc trung
-- tâm bị xoá — là lúc người ta hỏi "trước đây nó thuộc ai".
--
-- KHÔNG BACKFILL dòng cũ, cố ý:
--   · DIRECT_MESSAGE không suy được: tin nhắn riêng không thuộc lớp nào, và messages đã có thể bị
--     xoá cứng (AccountDeletionService) — không còn gì để suy.
--   · Suy từ users.org_id HIỆN TẠI của reported_user_id là lặp lại đúng sai lầm mà V315 tự cảnh
--     báo và V317 phải đi vá: trạng thái hiện tại ≠ trạng thái lúc sự việc xảy ra. Một người rời
--     trung tâm rồi thì báo cáo cũ về họ sẽ bị gán NULL (mất) hoặc gán sang trung tâm mới (sai).
--   · Dòng cũ org_id NULL vẫn đọc được ở màn admin như trước; chúng chỉ không rơi vào sổ trung tâm.
ALTER TABLE content_reports ADD COLUMN org_id BIGINT REFERENCES organizations(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. content_purged_at — mốc nội dung đã bị dọn (quyết định 1, 5)
-- ─────────────────────────────────────────────────────────────────────────────
-- Phân biệt "chưa bao giờ có nội dung" (USER report không details) với "đã có, đã dọn". Cả hai đường
-- dọn đều đóng dấu: AccountDeletionService (chủ thể xoá tài khoản) và ContentReportRetentionService
-- (90 ngày sau phán quyết). Cột này TỒN TẠI ĐỂ ĐƯỢC GHI — xem cảnh báo trigger ở đầu tệp.
ALTER TABLE content_reports ADD COLUMN content_purged_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Index
-- ─────────────────────────────────────────────────────────────────────────────
-- Job dọn quét đúng vị từ này mỗi đêm: chỉ dòng đã phán quyết, chưa dọn, còn nội dung. Partial index
-- nên phần lớn bảng (PENDING, đã dọn, không nội dung) không nằm trong index — nó co lại theo nhịp job.
CREATE INDEX idx_content_reports_retention_due
    ON content_reports (resolved_at)
    WHERE status IN ('RESOLVED', 'DISMISSED')
      AND content_purged_at IS NULL
      AND (snapshot_body IS NOT NULL OR details IS NOT NULL);

-- Nợ B-8: AccountDeletionService UPDATE ... WHERE reported_user_id = ? — không index là quét cả bảng
-- trong transaction xoá tài khoản. NULL không bao giờ được tra nên loại khỏi index.
CREATE INDEX idx_content_reports_reported_user
    ON content_reports (reported_user_id)
    WHERE reported_user_id IS NOT NULL;

-- Sẵn cho đường đọc theo trung tâm (B3 — đợt sau) và cho việc nhóm vết theo org_id ở đường admin.
CREATE INDEX idx_content_reports_org_created
    ON content_reports (org_id, created_at DESC)
    WHERE org_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Thông báo ACCOUNT_DELETED cũ: bóc email + tên khỏi payload (quyết định 8, phần dữ liệu)
-- ─────────────────────────────────────────────────────────────────────────────
-- UserNotificationService.onAccountDeleted từng nhét email + displayName của NGƯỜI VỪA XOÁ TÀI KHOẢN
-- vào payload gửi mọi admin, và UserNotificationRetentionService không bao giờ xoá thông báo chưa
-- đọc ⇒ PII của người đã thực thi quyền xoá nằm lại vô thời hạn. Code từ V321 chỉ gửi deletedUserId;
-- dòng cũ dọn tại đây bằng phép trừ khoá jsonb — không đụng thông báo loại khác.
-- jsonb_exists() thay cho toán tử `?` — cố ý, để không tầng JDBC nào đọc nhầm `?` thành tham số.
UPDATE user_notifications
   SET payload_json = payload_json - 'email' - 'displayName'
 WHERE notification_type = 'ACCOUNT_DELETED'
   AND (jsonb_exists(payload_json, 'email') OR jsonb_exists(payload_json, 'displayName'));
