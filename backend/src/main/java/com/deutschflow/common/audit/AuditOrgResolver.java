package com.deutschflow.common.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Tra ra TRUNG TÂM BỊ TÁC ĐỘNG của một đối tượng, để ghi vết theo đối tượng thay vì theo người
 * thao tác (DEC-13, owner chốt 09/09/2026).
 *
 * <p><b>Vì sao tồn tại.</b> Phần lớn điểm gọi ghi vết đã cầm sẵn {@code orgId} — chúng chỉ cần
 * truyền thêm một tham số. Nhưng các đường của admin nền tảng thì không: chúng nhận
 * {@code userId} hay {@code classId} từ đường dẫn và không bao giờ nhắc tới trung tâm. Không có
 * lớp này thì mười chỗ như vậy mỗi chỗ tự viết một câu truy vấn, và đợt sau sẽ có chỗ viết khác đi.
 *
 * <p><b>Dùng ở CONTROLLER, trước khi gọi service.</b> Hai lý do, cả hai đều đã trả giá ở nơi khác
 * trong repo:
 * <ul>
 *   <li>Nhiều thao tác admin GỠ người khỏi trung tâm (đổi vai gọi {@code syncPlatformRole}, khoá
 *       tài khoản, gỡ thành viên). Tra sau khi service chạy thì {@code users.org_id} đã bị xoá và
 *       vết mất trung tâm — đúng lúc giám đốc cần nó nhất.</li>
 *   <li>Các service đọc là {@code @Transactional(readOnly = true)}, mà {@code AuditLogService} dùng
 *       chung connection qua {@code DataSourceUtils}; một INSERT trong transaction read-only của
 *       PostgreSQL sẽ ném <em>"cannot execute INSERT in a read-only transaction"</em>. Khuôn ghi vết
 *       ở controller đã có sẵn tại {@code OrgTimesheetController}.</li>
 * </ul>
 *
 * <p>Trả {@code null} khi đối tượng không thuộc trung tâm nào (người dùng B2C, lớp riêng) hoặc
 * không tồn tại — điểm gọi cứ truyền thẳng xuống {@code AuditLogService}, ở đó {@code null} nghĩa
 * là "rơi về đường lùi suy từ actor", đúng hành vi cũ.
 *
 * <p>Cố ý dùng {@code JdbcTemplate} chứ không repository JPA: các đường này chạy ngoài transaction
 * nghiệp vụ, không nên kéo entity vào persistence context chỉ để đọc một cột.
 */
@Component
@RequiredArgsConstructor
public class AuditOrgResolver {

    private final JdbcTemplate jdbcTemplate;

    /** Trung tâm của một NGƯỜI DÙNG, hoặc {@code null} nếu người đó không thuộc trung tâm nào. */
    public Long forUser(Long userId) {
        return single("SELECT org_id FROM users WHERE id = ?", userId);
    }

    /** Trung tâm của một LỚP, hoặc {@code null} nếu là lớp riêng ngoài trung tâm. */
    public Long forClass(Long classId) {
        return single("SELECT org_id FROM teacher_classes WHERE id = ?", classId);
    }

    /** Trung tâm của một HOÁ ĐƠN. */
    public Long forInvoice(Long invoiceId) {
        return single("SELECT org_id FROM org_invoices WHERE id = ?", invoiceId);
    }

    private Long single(String sql, Long key) {
        if (key == null) {
            return null;
        }
        return jdbcTemplate.query(sql, rs -> rs.next() ? (Long) rs.getObject(1) : null, key);
    }
}
