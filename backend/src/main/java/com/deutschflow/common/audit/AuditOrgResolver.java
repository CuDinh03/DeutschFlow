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

    /**
     * Trung tâm mà một người đang là THÀNH VIÊN ACTIVE trong {@code org_members}, hoặc {@code null}.
     *
     * <p>Khác {@link #forUser(Long)} ở nguồn: {@code users.org_id} là đường tắt được
     * {@code OrgMembershipService} giữ đồng bộ, còn đây đọc thẳng bảng thành viên — đúng chữ owner
     * chốt cho {@code content_reports.org_id} (10/09/2026: "membership ACTIVE trong org_members").
     *
     * <p>Đa trung tâm (chỉ TEACHER được phép): ưu tiên trung tâm trùng {@code users.org_id} (trung
     * tâm "nhà"), không có thì lấy membership ACTIVE gia nhập gần nhất. Đây là phép chọn xấp xỉ cho
     * ca hiếm; ca thường (học viên) chỉ có đúng một dòng.
     */
    public Long forActiveMember(Long userId) {
        return single("""
                SELECT om.org_id FROM org_members om
                 WHERE om.user_id = ? AND om.status = 'ACTIVE'
                 ORDER BY (om.org_id = (SELECT u.org_id FROM users u WHERE u.id = om.user_id)) DESC NULLS LAST,
                          om.joined_at DESC
                 LIMIT 1
                """, userId);
    }

    /** Trung tâm ĐÓNG BĂNG trên một BÁO CÁO NỘI DUNG (V321), hoặc {@code null} với dòng cũ / B2C. */
    public Long forContentReport(Long reportId) {
        return single("SELECT org_id FROM content_reports WHERE id = ?", reportId);
    }

    private Long single(String sql, Long key) {
        if (key == null) {
            return null;
        }
        return jdbcTemplate.query(sql, rs -> rs.next() ? (Long) rs.getObject(1) : null, key);
    }
}
