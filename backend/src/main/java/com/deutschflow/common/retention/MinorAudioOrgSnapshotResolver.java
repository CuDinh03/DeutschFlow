package com.deutschflow.common.retention;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Trung tâm nào phải thấy lượt dọn này trong sổ của mình.
 *
 * <p>🔴 <b>KHÔNG dùng {@code users.org_id} lúc job chạy.</b> Đó là trạng thái HÔM NAY, còn thứ ta
 * đang ghi vết là một việc thuộc về QUÁ KHỨ (bản ghi âm thu 30+ ngày trước). Ba cách hỏng, cả ba đều
 * xảy ra được trên dữ liệu pilot:
 * <ul>
 *   <li>học viên chuyển sang trung tâm B sau khi thu ⇒ vết dọn rơi vào sổ của B, còn A — nơi thật sự
 *       đã giữ giọng nói của em ấy — không bao giờ thấy;</li>
 *   <li>học viên rời hẳn trung tâm ⇒ {@code org_id} NULL ⇒ vết rơi vào diện "hệ thống", mà đường đọc
 *       của giám đốc lọc {@code AND org_id = ?} nên loại sạch NULL. Đúng nghịch lý mà V317 đã phải vá
 *       cho vết của admin nền tảng;</li>
 *   <li>trung tâm gỡ thành viên đúng đêm job chạy ⇒ kết quả đổi theo thứ tự hai việc không liên quan.</li>
 * </ul>
 *
 * <p><b>Thứ tự ưu tiên — ảnh chụp gần dữ liệu nhất thắng:</b>
 * <ol>
 *   <li><b>Ảnh chụp trên chính dòng dữ liệu</b> ({@link MinorAudioCandidate#orgIdSnapshot}). Hai kho
 *       lớn đã có: {@code speaking_exam_sessions.org_id} (V320 §1 — ảnh chụp lúc TẠO PHIÊN, sinh ra
 *       đúng cho tình huống này) và {@code teacher_classes.org_id} của lớp mà bài được nộp vào (quan
 *       hệ theo huyết thống dữ liệu, lớp không rời trung tâm — V320 §4 giải thích vì sao bảng bài nộp
 *       không cần cột riêng).</li>
 *   <li><b>Sổ đồng ý</b> {@code student_consents.org_id} — V319 ghi {@code org_id} tại thời điểm THU
 *       ĐỒNG Ý, và bảng đó chỉ-ghi-thêm nên giá trị không bị sửa về sau. Đây chính là trung tâm đã
 *       đứng ra chịu trách nhiệm pháp lý cho học viên chưa thành niên này.</li>
 *   <li><b>Hồ sơ người giám hộ</b> {@code student_guardians.org_id} — khi mới nhập giám hộ mà chưa
 *       kịp ghi đồng ý.</li>
 *   <li>{@code null} — học viên B2C, hoặc chưa trung tâm nào nhận trách nhiệm. Vết vẫn được ghi với
 *       {@code org_id} NULL để con số không biến mất; admin nền tảng đọc được, giám đốc thì không.</li>
 * </ol>
 *
 * <p>Hai bậc dưới hiện chỉ còn phục vụ kho {@code ai_jobs.payload} — bảng đó neo vào một
 * {@code user_id} trần, không có lớp và không có ảnh chụp org.
 *
 * <p><b>Đây là ĐƯỜNG NỐI duy nhất.</b> Khi {@code ai_jobs} có ảnh chụp {@code org_id} tường minh,
 * chỉ cần đổi lớp này — không điểm gọi nào khác phải sửa.
 *
 * <p>Cache trong PHẠM VI MỘT LƯỢT ({@link Session}), không cache toàn cục: một lượt chạy đụng vài
 * trăm chủ thể và mỗi chủ thể xuất hiện ở nhiều dòng, nhưng giữa hai đêm thì dữ liệu đã đổi.
 */
@Component
@RequiredArgsConstructor
public class MinorAudioOrgSnapshotResolver {

    private static final String SQL_FROM_CONSENT = """
            SELECT org_id
            FROM   student_consents
            WHERE  student_user_id = ? AND org_id IS NOT NULL
            ORDER BY effective_at DESC, id DESC
            LIMIT  1
            """;

    private static final String SQL_FROM_GUARDIAN = """
            SELECT org_id
            FROM   student_guardians
            WHERE  student_user_id = ? AND org_id IS NOT NULL
            ORDER BY created_at DESC, id DESC
            LIMIT  1
            """;

    private final JdbcTemplate jdbcTemplate;

    /** Mở một lượt tra có cache riêng. Mỗi lượt chạy job dùng một {@link Session}. */
    public Session newSession() {
        return new Session();
    }

    /** Cache theo lượt chạy — xem javadoc lớp. Không dùng lại giữa hai đêm. */
    public final class Session {

        private final Map<Long, Long> bySubject = new HashMap<>();

        private Session() {
        }

        /** Trung tâm của một ứng viên, hoặc {@code null} khi không trung tâm nào nhận. */
        public Long orgOf(MinorAudioCandidate candidate) {
            if (candidate == null) {
                return null;
            }
            if (candidate.orgIdSnapshot() != null) {
                return candidate.orgIdSnapshot();
            }
            Long subject = candidate.subjectUserId();
            if (subject == null) {
                return null;
            }
            // computeIfAbsent không dùng được: giá trị null là một câu trả lời hợp lệ ("không trung
            // tâm nào"), và computeIfAbsent sẽ tra lại từ đầu ở mỗi dòng của cùng một học viên B2C.
            if (bySubject.containsKey(subject)) {
                return bySubject.get(subject);
            }
            Long resolved = lookup(subject);
            bySubject.put(subject, resolved);
            return resolved;
        }

        private Long lookup(Long subjectUserId) {
            Long fromConsent = single(SQL_FROM_CONSENT, subjectUserId);
            return fromConsent != null ? fromConsent : single(SQL_FROM_GUARDIAN, subjectUserId);
        }
    }

    private Long single(String sql, Long key) {
        return jdbcTemplate.query(sql, rs -> rs.next() ? (Long) rs.getObject(1) : null, key);
    }
}
