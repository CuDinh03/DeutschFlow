package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.minor.MinorLearnerService;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.messaging.entity.Message;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.organization.dto.OrgMinorMessageDtos.MinorConversationDto;
import com.deutschflow.organization.dto.OrgMinorMessageDtos.MinorMessageDto;
import com.deutschflow.organization.dto.OrgMinorMessageDtos.MinorThreadDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * Giám đốc trung tâm đọc tin nhắn riêng giữa giáo viên và học viên CHƯA THÀNH NIÊN của chính trung
 * tâm mình (AC-ORG-CT-10, DEC-22 mục 18c — owner chốt 09/09/2026).
 *
 * <p><b>Đây là ngoại lệ, không phải một tính năng quản trị.</b> Mặc định của repo là không ai đọc
 * được tin nhắn riêng của người khác — {@code MessageService} chỉ phục vụ chính hai người trong
 * cuộc. Ngoại lệ này tồn tại vì một lý do hẹp: với người chưa thành niên, trung tâm là bên có nghĩa
 * vụ giám sát. Phạm vi vì vậy cũng phải hẹp đúng bằng lý do đó, và mỗi lượt đọc để lại vết
 * (ghi ở controller — xem {@code OrgMinorMessageController}).
 *
 * <p><b>Ba giới hạn của phạm vi, mỗi cái đóng một đường lạm dụng khác nhau:</b>
 * <ul>
 *   <li><b>Chỉ OWNER</b> — MANAGER là nhân sự vận hành, không phải người chịu trách nhiệm pháp lý
 *       với trẻ. Cùng lằn ranh với {@code OrgAuditController} và tài chính.</li>
 *   <li><b>Chỉ học viên chưa thành niên</b>. {@code ADULT} bị loại: một học viên 20 tuổi có quyền
 *       riêng tư đầy đủ với giáo viên của mình.</li>
 *   <li><b>{@code UNKNOWN} cũng bị loại</b> — xem {@link #assertReadableSubject}.</li>
 * </ul>
 *
 * <p>🪤 <b>Đối tác hội thoại lấy từ chính bảng {@code messages}, KHÔNG từ {@code class_teachers}.</b>
 * Bảng phân công lớp không có vòng đời: gỡ một giáo viên khỏi lớp là XOÁ dòng (DEC-14). Đi từ đó
 * thì hội thoại của giáo viên VỪA BỊ GỠ biến mất khỏi màn hình của giám đốc — tức là đúng cái ca
 * đáng ngờ nhất lại là ca duy nhất không đọc được. Neo phạm vi vào HỌC VIÊN (thành viên ACTIVE của
 * trung tâm) và lấy đối tác từ dữ liệu tin nhắn thật; đối tác đã rời trung tâm vẫn hiện, có cờ
 * {@code counterpartStillInOrg} để nói rõ.
 *
 * <p>🪤 <b>Tuyệt đối không đánh dấu đã đọc.</b> {@code MessageService.getThread} gọi
 * {@code markThreadRead} như một tác dụng phụ — hợp lý khi người đọc là người nhận, sai hoàn toàn ở
 * đây: học viên sẽ thấy tin của mình "đã đọc" chỉ vì giám đốc mở ra xem, và bằng chứng "học viên
 * chưa từng mở tin này" bị xoá. Lớp này chỉ dùng câu SELECT của repository.
 *
 * <p>Cũng KHÔNG lọc theo danh sách chặn ({@code UserBlockService}): người trong cuộc chặn nhau là
 * chuyện của họ, còn đây là đường đọc để đối chiếu — lọc bớt là làm sai lệch chính thứ cần đối chiếu.
 */
@Service
@RequiredArgsConstructor
public class OrgMinorMessageService {

    /**
     * Trần số hội thoại trả về cho một lần liệt kê. Danh mục này là để CHỌN, không phải để xuất dữ
     * liệu; trần cứng chặn một lần gọi kéo cả trung tâm về trong một response.
     */
    static final int MAX_CONVERSATIONS = 200;

    /**
     * Học viên có phải thành viên ACTIVE của ĐÚNG trung tâm này không.
     *
     * <p>{@code role = 'STUDENT'} là cố ý: một GIÁO VIÊN 17 tuổi cũng là người chưa thành niên
     * ({@code MinorGate} đã ghi rõ), nhưng nghĩa vụ giám sát của trung tâm với học viên vị thành
     * niên không phải là căn cứ để giám đốc đọc tin nhắn riêng của NHÂN VIÊN mình. Hai việc khác
     * nhau; việc kia (nếu có) là một quyết định riêng của owner.
     *
     * <p>Cổng là {@code org_members} chứ không phải {@code users.org_id}: cột kia là ảnh chụp phục
     * vụ định tuyến, còn bảng này mới là sự thật về tư cách thành viên — cùng lý do {@code OrgGuard}
     * luôn đọc lại từ DB.
     */
    private static final String SQL_IS_ACTIVE_STUDENT_OF_ORG = """
            SELECT EXISTS (
              SELECT 1 FROM org_members
               WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE' AND role = 'STUDENT')
            """;

    /**
     * Danh mục hội thoại của MỌI học viên đã khai ngày sinh trong trung tâm; việc loại
     * {@code ADULT} làm ở Java qua {@link MinorPolicy} để chỉ có MỘT nơi biết ngưỡng tuổi.
     *
     * <p>{@code birth_date IS NOT NULL} lọc sẵn {@code UNKNOWN} ngay ở SQL — vừa nhẹ, vừa khiến
     * nhánh fail-closed đúng cả khi ai đó lỡ nới {@link #assertReadableSubject} ở đợt sau.
     *
     * <p>{@code birth_date >= ?} là BỘ LỌC THÔ loại phần lớn học viên đã đủ tuổi, cần thiết vì
     * {@code LIMIT} chạy TRƯỚC phép phân loại ở Java: không lọc thì một trung tâm đông học viên
     * trưởng thành sẽ đẩy hết hội thoại của trẻ ra khỏi 200 dòng đầu. Mốc do
     * {@link MinorPolicy#centerPolicyThreshold()} sinh ra nên vẫn chỉ có MỘT nơi biết ngưỡng, và cố
     * ý nới rộng thêm một ngày để phép trừ năm của {@code LocalDate} (ca 29/02) không bao giờ loại
     * nhầm một em còn ở tuổi vị thành niên — quyền quyết định cuối vẫn thuộc
     * {@link MinorPolicy#statusAt}.
     *
     * <p>Hai nhánh {@code UNION ALL} thay cho một điều kiện {@code OR}: mỗi nhánh ăn đúng một index
     * có sẵn của V228 ({@code idx_messages_pair} theo {@code sender_id},
     * {@code idx_messages_recipient} theo {@code recipient_id}).
     */
    private static final String SQL_LIST_CONVERSATIONS = """
            WITH students AS (
              SELECT u.id, u.display_name, u.email, u.birth_date
                FROM org_members m
                JOIN users u ON u.id = m.user_id
               WHERE m.org_id = ? AND m.status = 'ACTIVE' AND m.role = 'STUDENT'
                 AND u.birth_date IS NOT NULL
                 AND u.birth_date >= ?
            ),
            pairs AS (
              SELECT student_id, other_id, COUNT(*) AS message_count, MAX(created_at) AS last_at
                FROM (
                  SELECT s.id AS student_id, msg.recipient_id AS other_id, msg.created_at
                    FROM students s JOIN messages msg ON msg.sender_id = s.id
                  UNION ALL
                  SELECT s.id AS student_id, msg.sender_id AS other_id, msg.created_at
                    FROM students s JOIN messages msg ON msg.recipient_id = s.id
                ) t
               GROUP BY student_id, other_id
            )
            SELECT s.id            AS student_id,
                   s.display_name  AS student_name,
                   s.email         AS student_email,
                   s.birth_date    AS birth_date,
                   p.other_id      AS counterpart_id,
                   o.display_name  AS counterpart_name,
                   o.email         AS counterpart_email,
                   p.message_count AS message_count,
                   p.last_at       AS last_at,
                   EXISTS (SELECT 1 FROM org_members om
                            WHERE om.org_id = ? AND om.user_id = p.other_id
                              AND om.status = 'ACTIVE') AS counterpart_in_org
              FROM pairs p
              JOIN students s ON s.id = p.student_id
              LEFT JOIN users o ON o.id = p.other_id
             ORDER BY p.last_at DESC
             LIMIT ?
            """;

    private final JdbcTemplate jdbcTemplate;
    private final MessageRepository messageRepository;
    private final MinorLearnerService minorLearnerService;
    private final MinorPolicy minorPolicy;
    private final UserRepository userRepository;

    /**
     * Danh mục hội thoại có học viên chưa thành niên của trung tâm — KHÔNG kèm nội dung tin nhắn.
     *
     * <p>Người gọi (controller) đã phải chứng minh mình là OWNER của {@code orgId}; hàm này không
     * kiểm quyền lần nữa mà kiểm PHẠM VI: chỉ học viên của chính trung tâm đó, và chỉ người chưa
     * thành niên.
     */
    @Transactional(readOnly = true)
    public List<MinorConversationDto> listConversations(Long orgId) {
        requireId(orgId, "orgId");
        // MỘT mốc thời gian cho cả trang: phân loại từng dòng bằng Instant.now() riêng sẽ cho hai
        // dòng của cùng một em nằm hai bên sinh nhật nếu request rơi đúng lúc giao ngày.
        Instant now = Instant.now();
        LocalDate oldestMinorBirthDate = LocalDate.ofInstant(now, MinorPolicy.ZONE)
                .minusYears(minorPolicy.centerPolicyThreshold())
                .minusDays(1);
        return jdbcTemplate.query(SQL_LIST_CONVERSATIONS, (rs, rowNum) -> {
            LocalDate birthDate = rs.getObject("birth_date", LocalDate.class);
            MinorPolicy.Status status = minorPolicy.statusAt(birthDate, now);
            if (!status.isMinor()) {
                return null;
            }
            return new MinorConversationDto(
                    rs.getLong("student_id"),
                    rs.getString("student_name"),
                    rs.getString("student_email"),
                    status.name(),
                    rs.getLong("counterpart_id"),
                    rs.getString("counterpart_name"),
                    rs.getString("counterpart_email"),
                    rs.getBoolean("counterpart_in_org"),
                    rs.getLong("message_count"),
                    toInstant(rs.getTimestamp("last_at")));
        }, orgId, oldestMinorBirthDate, orgId, MAX_CONVERSATIONS)
                .stream().filter(Objects::nonNull).toList();
    }

    /**
     * Trọn hội thoại giữa một học viên chưa thành niên của trung tâm và một đối tác, cũ → mới.
     *
     * <p>Không có tin nhắn nào giữa hai người ⇒ {@link NotFoundException}, KHÔNG phải danh sách
     * rỗng. Trả rỗng kèm tên và email của {@code counterpartUserId} sẽ biến endpoint này thành một
     * máy tra danh bạ: gõ id bất kỳ để lấy về danh tính người dùng bất kỳ trong hệ thống.
     */
    @Transactional(readOnly = true)
    public MinorThreadDto readThread(Long orgId, Long studentUserId, Long counterpartUserId) {
        requireId(orgId, "orgId");
        requireId(studentUserId, "studentUserId");
        requireId(counterpartUserId, "counterpartUserId");

        // 🪤 Tuổi nạp từ DB (MinorLearnerService SELECT thẳng cột users.birth_date), KHÔNG từ
        // @AuthenticationPrincipal — principal bị cache 60 giây nên vừa sửa ngày sinh xong vẫn còn
        // đọc được thêm một phút.
        MinorPolicy.Status status = minorLearnerService.statusOf(studentUserId);
        assertReadableSubject(studentUserId, isActiveStudentOfOrg(orgId, studentUserId), status);

        // CHỈ câu SELECT của repository — không markThreadRead, xem javadoc lớp.
        List<Message> thread = messageRepository
                .findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(
                        studentUserId, counterpartUserId, counterpartUserId, studentUserId);
        if (thread.isEmpty()) {
            throw new NotFoundException("Không có hội thoại nào giữa hai tài khoản này.");
        }

        User student = userRepository.findById(studentUserId).orElse(null);
        User counterpart = userRepository.findById(counterpartUserId).orElse(null);
        return new MinorThreadDto(
                studentUserId,
                student == null ? null : student.getDisplayName(),
                status.name(),
                counterpartUserId,
                counterpart == null ? null : counterpart.getDisplayName(),
                thread.stream()
                        .map(m -> new MinorMessageDto(m.getId(), m.getSenderId(), m.getRecipientId(),
                                m.getBody(), m.getCreatedAt(), m.getReadAt()))
                        .toList());
    }

    /**
     * Quyết định THUẦN: chủ thể này có nằm trong phạm vi đọc của giám đốc không.
     *
     * <p>Tách khỏi mọi truy vấn để một ca unit test chốt được đủ tám tổ hợp (bốn nhóm tuổi × trong
     * / ngoài trung tâm) mà không cần Postgres — đây là chỗ duy nhất nói "được đọc hay không", nên
     * nó phải là chỗ rẻ nhất để kiểm.
     *
     * <p><b>Vì sao {@code UNKNOWN} bị TỪ CHỐI</b> (khác {@code MinorGate}, nơi {@code UNKNOWN} là
     * một chính sách cấu hình được): hai cổng fail-closed về hai phía ngược nhau vì chúng bảo vệ
     * hai thứ ngược nhau. {@code MinorGate} chặn dữ liệu của trẻ ĐI RA nhà cung cấp AI — chưa rõ
     * tuổi thì an toàn là KHÔNG GỬI. Ở đây thứ được bảo vệ là quyền riêng tư của chính hội thoại,
     * và quyền đọc là NGOẠI LỆ cần căn cứ: chưa xác lập được người này là trẻ em thì chưa có căn cứ
     * nào để một người thứ ba đọc tin nhắn riêng của họ. Suy "chưa biết tuổi ⇒ cứ cho đọc" là biến
     * một thiếu sót dữ liệu thành quyền giám sát toàn trung tâm — trong khi 37 dòng ghi danh trên
     * production đang thiếu ngày sinh, tức mặc định sẽ mở, không phải đóng.
     *
     * <p>Cách mở đúng cho ca {@code UNKNOWN} là trung tâm đi thu ngày sinh (PR-1A/1B đã có đường),
     * không phải nới cổng này.
     */
    static void assertReadableSubject(Long studentUserId, boolean activeStudentOfOrg,
                                      MinorPolicy.Status status) {
        if (!activeStudentOfOrg) {
            // Cùng một thông điệp cho "không phải học viên của tôi" và "không phải trẻ vị thành
            // niên": phân biệt hai lý do là trả lời hộ câu hỏi "id này có thuộc trung tâm khác
            // không" cho bất kỳ ai đoán id.
            throw new ForbiddenException(
                    "Chỉ đọc được hội thoại của học viên chưa thành niên thuộc trung tâm của bạn.");
        }
        if (status == MinorPolicy.Status.UNKNOWN) {
            throw new ForbiddenException(
                    "Học viên này chưa có ngày sinh trong hồ sơ nên chưa xác định được là người chưa "
                            + "thành niên. Bổ sung ngày sinh vào hồ sơ học viên trước khi đọc hội thoại.");
        }
        if (!status.isMinor()) {
            throw new ForbiddenException(
                    "Chỉ đọc được hội thoại của học viên chưa thành niên thuộc trung tâm của bạn.");
        }
    }

    // ── nội bộ ──────────────────────────────────────────────────────────────

    private boolean isActiveStudentOfOrg(Long orgId, Long userId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                SQL_IS_ACTIVE_STUDENT_OF_ORG, Boolean.class, orgId, userId));
    }

    private static Instant toInstant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private static void requireId(Long value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " không được null");
        }
    }
}
