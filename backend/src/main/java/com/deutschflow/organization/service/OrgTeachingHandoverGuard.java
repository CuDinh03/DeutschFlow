package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ConflictException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chặn việc BỎ RƠI LỚP: một người mất năng lực dạy trong khi vẫn là người duy nhất đứng lớp (G-07).
 *
 * <p><b>Vì sao cần:</b> đổi vai, tắt năng lực dạy, hay gỡ một giáo viên khỏi trung tâm đều là thao
 * tác một-nút, và không đường nào trong số đó nhìn xuống các lớp người đó đang phụ trách. Lớp không
 * biến mất — nó ở lại với một {@code teacher_id} trỏ tới người không còn quyền dạy, nên:
 * <ul>
 *   <li>không ai ghi được nhật ký buổi học, điểm danh hay chấm bài cho lớp đó nữa —
 *       {@code hasRole('TEACHER')} chặn ở cổng vào, {@code class_teachers} chặn mọi người khác;</li>
 *   <li>lớp chỉ hiện ra dưới dạng một con số trên bảng điều khiển ("lớp thiếu giáo viên") mà không
 *       ai được báo là vừa gây ra nó, nên học viên là người phát hiện đầu tiên.</li>
 * </ul>
 *
 * <p><b>Luật (G-07):</b> thao tác bị TỪ CHỐI (409) kèm thông điệp nêu rõ số lớp sẽ mất người dạy và
 * việc phải làm trước — bàn giao lớp cho người khác. Chốt này chỉ chặn: không tự bàn giao hộ, không
 * tự xoá lớp. Cùng khuôn với {@code AccountDeletionGuard} (Đợt 4 G-09) để hai chốt đọc lên giống
 * nhau: một câu SQL đếm, một hàm quyết định thuần test được, một {@link ConflictException}.
 *
 * <p><b>Không chặn khi lớp còn người khác dạy:</b> "còn người khác" = còn một thành viên ACTIVE
 * đứng lớp đó được, dù là {@code teacher_id} hay trợ giảng trong {@code class_teachers}.

 * <p><b>Cứu từ nhánh WIP {@code feat/b2b-tach-chuc-danh-nang-luc} (09/09/2026).</b> Bản gốc lấy
 * mệnh đề "ai được đứng lớp" từ {@code OrgTeachingCapability} — lớp của G-06, hạng mục mà DEC-10
 * đã HUỶ: owner xác nhận giám đốc và quản lý không đứng lớp, nên mô hình một-người-một-vai là
 * đúng yêu cầu và cột {@code org_members.can_teach} của V316 để trống. Mệnh đề vì thế quay về
 * đúng chức danh, khai ngay tại đây thay vì ở một lớp riêng — xem {@link #TEACHING_MEMBER_PREDICATE}.
 * Phần chặn lớp mồ côi thì KHÔNG bị DEC-10 huỷ, mà DEC-14 còn làm nó cần hơn: đổi giáo viên phụ
 * trách nay là GỠ HẲN người cũ khỏi lớp, tức chính là đường đẻ ra lớp mồ côi.
 */
@Service
@RequiredArgsConstructor
public class OrgTeachingHandoverGuard {

    /**
     * Mệnh đề SQL trên một alias {@code om} của {@code org_members}: dòng này có phải một người
     * ĐANG đứng lớp được của trung tâm không.
     *
     * <p>Theo DEC-10 (owner chốt 09/09/2026) quyền dạy đi thẳng theo chức danh — không có cột năng
     * lực riêng, không có cấp bậc vai trò. Giám đốc và quản lý KHÔNG đứng lớp; đó là ràng buộc đã
     * chọn, không phải khiếm khuyết. Sửa nghĩa "được dạy" = sửa đúng dòng này.
     */
    static final String TEACHING_MEMBER_PREDICATE =
            "om.status = 'ACTIVE' AND om.role = 'TEACHER'";

    /**
     * Số lớp CỦA TRUNG TÂM mà {@code userId} đang đứng và sẽ KHÔNG CÒN AI dạy nếu người này mất
     * năng lực dạy.
     *
     * <p>Lớp ngoài trung tâm ({@code org_id IS NULL} — lớp riêng của chính người dùng) không tính:
     * rời trung tâm không đụng gì tới chúng.
     */
    private static final String ORPHANED_CLASSES_SQL = """
            SELECT COUNT(*) FROM teacher_classes tc
             WHERE tc.org_id = ?
               AND (tc.teacher_id = ?
                    OR EXISTS (SELECT 1 FROM class_teachers ct
                                WHERE ct.class_id = tc.id AND ct.teacher_id = ?))
               AND NOT EXISTS (
                   SELECT 1 FROM org_members om
                    WHERE om.org_id = tc.org_id
                      AND om.user_id <> ?
                      AND """ + TEACHING_MEMBER_PREDICATE + """
                      AND (om.user_id = tc.teacher_id
                           OR om.user_id IN (SELECT ct.teacher_id FROM class_teachers ct
                                              WHERE ct.class_id = tc.id))
               )
            """;

    /** Tên lớp để nêu đích danh trong thông điệp — giới hạn 3 cái, đủ để nhận ra mà không tràn. */
    private static final String ORPHANED_NAMES_SQL = """
            SELECT tc.name FROM teacher_classes tc
             WHERE tc.org_id = ?
               AND (tc.teacher_id = ?
                    OR EXISTS (SELECT 1 FROM class_teachers ct
                                WHERE ct.class_id = tc.id AND ct.teacher_id = ?))
               AND NOT EXISTS (
                   SELECT 1 FROM org_members om
                    WHERE om.org_id = tc.org_id
                      AND om.user_id <> ?
                      AND """ + TEACHING_MEMBER_PREDICATE + """
                      AND (om.user_id = tc.teacher_id
                           OR om.user_id IN (SELECT ct.teacher_id FROM class_teachers ct
                                              WHERE ct.class_id = tc.id))
               )
             ORDER BY tc.name
             LIMIT 3
            """;

    /** Việc người gọi đang định làm — quyết định câu "cách xử lý" ở cuối thông điệp. */
    public enum Action {
        /** Tắt công tắc "được dạy" của một thành viên. */
        REVOKE_TEACHING,
        /** Gỡ một thành viên khỏi trung tâm (org-admin bấm). */
        REMOVE_FROM_ORG,
        /** Thành viên tự rời trung tâm. */
        LEAVE_ORG
    }

    private final JdbcTemplate jdbc;

    /**
     * Ném 409 nếu thao tác sẽ để lại lớp không còn ai dạy. Không có lớp nào như vậy thì im lặng đi
     * tiếp — chốt này KHÔNG phải cổng phân quyền, quyền đã được kiểm ở trên.
     */
    @Transactional(readOnly = true)
    public void assertNoOrphanedClasses(Long orgId, Long userId, Action action) {
        long orphaned = countOrphanedClasses(orgId, userId);
        String blocked = blockReason(orphaned, sampleClassNames(orgId, userId, orphaned), action);
        if (blocked != null) {
            throw new ConflictException(blocked);
        }
    }

    /** Số lớp sẽ mồ côi — công khai để bảng điều khiển/giao diện hỏi trước khi mở hộp thoại. */
    @Transactional(readOnly = true)
    public long countOrphanedClasses(Long orgId, Long userId) {
        Long n = jdbc.queryForObject(ORPHANED_CLASSES_SQL, Long.class, orgId, userId, userId, userId);
        return n == null ? 0L : n;
    }

    private java.util.List<String> sampleClassNames(Long orgId, Long userId, long orphaned) {
        if (orphaned <= 0) {
            return java.util.List.of();
        }
        return jdbc.queryForList(ORPHANED_NAMES_SQL, String.class, orgId, userId, userId, userId);
    }

    /**
     * Quyết định thuần (tách khỏi JDBC để test được từng nhánh thông điệp): lý do chặn, hoặc
     * {@code null} khi thao tác đi tiếp được.
     */
    static String blockReason(long orphanedClasses, java.util.List<String> sampleNames, Action action) {
        // 🔴 Cứu 09/09/2026: bản gốc trên nhánh WIP viết `< 0` kèm dấu `// MUTANT E` — một mutant
        // cố ý tiêm vào cho vòng kiểm đột biến và CHƯA ĐƯỢC GỠ khi phiên bị dừng giữa chừng. Với
        // `< 0`, đường thuận (0 lớp mồ côi) vẫn dựng ra thông điệp chặn ⇒ mọi thao tác gỡ giáo viên
        // đều 409. Nhánh đó còn 5 mutant nữa ở các tệp không cứu (User.getAuthorities có
        // `boolean orgAdmin = true`). Đúng ngưỡng là `<= 0`.
        if (orphanedClasses <= 0) {
            return null;
        }
        String head = subject(action) + " sẽ để lại " + orphanedClasses + " lớp không còn ai dạy"
                + names(sampleNames, orphanedClasses) + ".";
        String consequence = " Lớp vẫn còn nguyên học viên nhưng sẽ không ai ghi được nhật ký buổi"
                + " học, điểm danh hay chấm bài cho lớp đó nữa.";
        return head + consequence + " Hãy bàn giao " + (orphanedClasses > 1 ? "các lớp này" : "lớp này")
                + " cho người khác trước (trang Lớp học → Phân công giáo viên), rồi " + retry(action) + ".";
    }

    private static String subject(Action action) {
        return switch (action) {
            case REVOKE_TEACHING -> "Tắt quyền dạy của người này";
            case REMOVE_FROM_ORG -> "Gỡ người này khỏi trung tâm";
            case LEAVE_ORG -> "Rời trung tâm lúc này";
        };
    }

    private static String retry(Action action) {
        return switch (action) {
            case REVOKE_TEACHING -> "tắt lại quyền dạy";
            case REMOVE_FROM_ORG -> "gỡ khỏi trung tâm";
            case LEAVE_ORG -> "rời trung tâm";
        };
    }

    /** " (Lớp A, Lớp B và 2 lớp khác)" — im lặng nếu không đọc được tên nào. */
    private static String names(java.util.List<String> sampleNames, long total) {
        if (sampleNames == null || sampleNames.isEmpty()) {
            return "";
        }
        String listed = String.join(", ", sampleNames);
        long rest = total - sampleNames.size();
        return rest > 0 ? " (" + listed + " và " + rest + " lớp khác)" : " (" + listed + ")";
    }
}
