-- Gói 0 PR-0B (DEC-13, owner chốt 09/09/2026) — sổ hoạt động thấy được thao tác của ADMIN NỀN TẢNG.
--
-- Vì sao: V315 điền `org_id` bằng ảnh chụp `users.org_id` của NGƯỜI THAO TÁC. Với người trong trung
-- tâm thì đúng. Nhưng DEC-13 nói admin nền tảng KHÔNG BAO GIỜ là thành viên trung tâm ⇒
-- `users.org_id` của admin luôn NULL ⇒ mọi vết admin ghi ra có `org_id = NULL`, mà đường đọc của
-- giám đốc lọc `AND org_id = ?` nên loại sạch NULL. Nghịch lý: admin càng tuân thủ quyết định thì
-- càng VÔ HÌNH với chính người mà quyết định muốn cho họ thấy.
--
-- Từ nay `AuditLogService` nhận `orgId` TƯỜNG MINH của trung tâm bị tác động (đường lùi vẫn là suy
-- từ actor khi không truyền). Migration này vá phần DỮ LIỆU CŨ đã ghi trước bản vá đó.
--
-- 🔴 BẪY 1 — trigger append-only. V303 gắn `trg_audit_logs_immutable` chặn MỌI update/delete. Backfill
--    thẳng là migration đứng. Phải gỡ → UPDATE → GẮN LẠI trong cùng tệp này, đúng vũ điệu V315 đã
--    làm. `OrgAuditLogIntegrationTest` kiểm trigger còn sống sau khi migration chạy; quên gắn lại là
--    bảng mất tính bất biến TRONG IM LẶNG.
--
-- 🔴 BẪY 2 — `target_id` KHÔNG phải số. Cột là VARCHAR(120) (V20) và dữ liệu thật chứa
--    'glosbe-vi', 'llm-vi', 'dtype-fix', 'wiktionary-gender', 'auto-tag', 'ALL', 'SINGLE_USER'.
--    Một câu `target_id::bigint` không lọc sẽ ném `invalid input syntax for type bigint`, Flyway
--    đứng, và BACKEND KHÔNG BOOT. Mọi nhánh dưới đây đều phải có `~ '^[0-9]+$'`.
--
-- 🔴 BẪY 3 — cột có KHOÁ NGOẠI tới organizations(id) (V315:14). Một id trỏ tới trung tâm đã bị xoá
--    sẽ làm UPDATE ném FK violation. Mọi nhánh đều phải kèm `EXISTS (SELECT 1 FROM organizations …)`.

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;

-- ─────────────────────────────────────────────────────────────────────────────
-- Nhánh 1 — vết mà chính TRUNG TÂM là đối tượng: target_type='ORG', target_id = id trung tâm.
--
-- Đây là nhóm có giá trị nhất và là nhóm mà backfill theo metadata BỎ SÓT hoàn toàn: năm sự kiện
-- của AdminOrgService (org.created, org.status.changed, member.upserted, entitlements.granted,
-- licence.activated_by_invoice) đều KHÔNG đặt khoá `orgId` trong metadata — id trung tâm nằm ở
-- target_id. Chúng đúng là "admin nền tảng đổi gói / đổi ghế / đình chỉ / gán vai trong trung tâm
-- của tôi", tức thứ giám đốc cần đọc nhất.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE audit_logs a
SET    org_id = CAST(a.target_id AS BIGINT)
WHERE  a.org_id IS NULL
  AND  a.target_type IN ('ORG', 'ORG_TIMESHEET')
  AND  a.target_id ~ '^[0-9]+$'
  AND  EXISTS (SELECT 1 FROM organizations o WHERE o.id = CAST(a.target_id AS BIGINT));

-- ─────────────────────────────────────────────────────────────────────────────
-- Nhánh 2 — vết có `orgId` trong metadata_json.
--
-- Nhóm này gồm break-glass xem hồ sơ giáo viên (AdminTeacherService), tạm dừng/khôi phục quyền lợi
-- (OrgEntitlementService — cố ý truyền actor null nên đường lùi theo actor cũng không cứu được), và
-- chấm công cấp trung tâm. `metadata_json ? 'orgId'` dùng toán tử tồn-tại-khoá của jsonb.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE audit_logs a
SET    org_id = CAST(a.metadata_json ->> 'orgId' AS BIGINT)
WHERE  a.org_id IS NULL
  AND  a.metadata_json IS NOT NULL
  AND  a.metadata_json ? 'orgId'
  AND  a.metadata_json ->> 'orgId' ~ '^[0-9]+$'
  AND  EXISTS (SELECT 1 FROM organizations o
                WHERE o.id = CAST(a.metadata_json ->> 'orgId' AS BIGINT));

-- ─────────────────────────────────────────────────────────────────────────────
-- Nhánh 3 — vết mà đối tượng là MỘT NGƯỜI đang thuộc một trung tâm (target_type='USER').
--
-- Đây là nhóm "admin đổi mật khẩu / khoá / đổi gói của một thành viên trung tâm". Suy org từ
-- `users.org_id` HIỆN TẠI của người bị tác động là một phép đoán — đúng ngữ nghĩa chỉ khi người đó
-- chưa rời trung tâm kể từ lúc vết được ghi. Chấp nhận có ý thức, vì đường thay thế (đọc lịch sử
-- thành viên) không tồn tại cho dữ liệu quá khứ: `org_member_history` chỉ vừa được tạo ở V316 và
-- CHƯA AI GHI. Vết MỚI thì không dựa vào phép đoán này — điểm gọi truyền orgId tường minh.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE audit_logs a
SET    org_id = u.org_id
FROM   users u
WHERE  a.org_id IS NULL
  AND  a.target_type = 'USER'
  AND  a.target_id ~ '^[0-9]+$'
  AND  u.id = CAST(a.target_id AS BIGINT)
  AND  u.org_id IS NOT NULL;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_logs_block_mutation();

-- Sổ của giám đốc lọc thêm theo loại đối tượng (`cat`) khá thường xuyên, và bộ lọc "chỉ vết của
-- admin nền tảng" sắp thêm cũng chạy trong cùng phạm vi org. Index của V315 là (org_id, created_at
-- DESC); thêm bản có target_type để nhánh lọc theo loại không phải quét lại toàn bộ trang.
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_target_created
    ON audit_logs (org_id, target_type, created_at DESC)
    WHERE org_id IS NOT NULL;

COMMENT ON COLUMN audit_logs.org_id IS
    'Trung tâm mà vết THUỘC VỀ, ảnh chụp lúc ghi. Ưu tiên trung tâm BỊ TÁC ĐỘNG do điểm gọi truyền '
    'vào (DEC-13, để thao tác của admin nền tảng lọt vào sổ của giám đốc); không truyền thì suy từ '
    'users.org_id của người thao tác. NULL = hoạt động B2C hoặc job nền.';
