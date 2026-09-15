-- C6 (kế hoạch B2B §8) — sổ hoạt động theo TỔ CHỨC.
--
-- Vì sao: audit_logs hiện chỉ có actor (user), không có tổ chức. Muốn trả lời "trung tâm X đã có
-- những thao tác nào" thì phải JOIN sang users/org_members và đoán theo trạng thái HIỆN TẠI của
-- actor — sai ngay khi một người rời trung tâm hoặc đổi vai. Cột org_id là ẢNH CHỤP tại thời điểm
-- ghi vết, đúng ngữ nghĩa của một sổ bằng chứng. Đây cũng là nợ treo từ đợt đối soát B2B 25/07.
--
-- 🔴 BẪY ĐÃ TÍNH TRƯỚC: V303 gắn trigger BEFORE UPDATE OR DELETE chặn MỌI mutation trên bảng này
-- (append-only, C14). Một câu UPDATE backfill thẳng sẽ bị trigger ném lỗi và migration đứng. Nên
-- phải gỡ trigger → backfill → GẮN LẠI trong cùng một migration. Ca IT
-- `OrgAuditLogIntegrationTest` kiểm đúng chuyện trigger còn sống sau khi migration chạy — nếu ai đó
-- sửa file này mà quên gắn lại, bảng mất tính bất biến trong im lặng.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES organizations(id);

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;

-- Backfill theo ảnh chụp hiện tại của actor (giống cách V223 làm cho ai_token_usage_events).
-- Dòng không có actor, hoặc actor không thuộc trung tâm nào, giữ NULL — đó là dữ liệu B2C.
UPDATE audit_logs a
SET    org_id = u.org_id
FROM   users u
WHERE  u.id = a.actor_user_id
  AND  u.org_id IS NOT NULL
  AND  a.org_id IS NULL;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_logs_block_mutation();

-- Đọc sổ của một trung tâm luôn là "mới nhất trước" trong một khoảng thời gian.
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
    ON audit_logs (org_id, created_at DESC)
    WHERE org_id IS NOT NULL;
