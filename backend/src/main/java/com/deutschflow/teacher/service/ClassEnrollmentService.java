package com.deutschflow.teacher.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.entity.NotificationOutbox;
import com.deutschflow.notification.repository.NotificationOutboxRepository;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * G-02 — vòng đời ghi danh của MỘT học viên trong MỘT lớp.
 *
 * <p>Gỡ học viên KHÔNG xoá dòng {@code class_students}: chỉ đặt {@code status='ENDED'} +
 * {@code ended_at} + {@code end_reason}. Theo quyết định D2, bài nộp, điểm và điểm danh của quá khứ
 * phải còn nguyên — xoá dòng thì roster quá khứ rỗng và mọi bản báo cáo/chứng chỉ đã phát nói dối.
 *
 * <p>Hai cửa vào theo D2: org-admin (OWNER/MANAGER — authz do {@code OrgGuard} lo ở controller,
 * ở đây kiểm lớp có đúng thuộc trung tâm ấy không) và giáo viên PHỤ TRÁCH lớp.
 *
 * <p>Thông báo "được thêm vào lớp" (DEC-18) cũng đi qua MỘT cửa ở đây —
 * {@link #enrollAndNotify} — cho cả hai đường nhân sự đưa học viên vào lớp (giáo viên thêm bằng
 * email, trung tâm nhập roster CSV), để mọi lượt vào lớp báo đúng một lần.
 */
@Service
@RequiredArgsConstructor
public class ClassEnrollmentService {

    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final AuditLogService auditLogService;
    private final UserRepository userRepository;
    private final NotificationOutboxRepository outboxRepository;

    /**
     * Ghi danh một học viên vào lớp — idempotent, và KHÔNG làm mất dữ liệu học tập cũ.
     *
     * <p>Dòng cũ đã đóng (ENDED/TRANSFERRED) được mở lại bằng một câu UPDATE có chọn cột, chứ không
     * phải {@code save()} một entity mới: khoá chính đã tồn tại nên {@code save()} là một lần merge
     * và sẽ ghi đè NULL lên {@code teacher_comment} cùng bốn cột {@code skill_*}.
     *
     * @return true nếu sau lời gọi này học viên MỚI trở lại lớp (chưa ghi danh trước đó)
     */
    @Transactional
    public boolean enroll(Long classId, Long studentId) {
        ClassStudentId key = new ClassStudentId(classId, studentId);
        if (classStudentRepository.existsById(key)) {
            // Có dòng: hoặc đang còn ghi danh (no-op), hoặc đã đóng (mở lại, giữ nguyên đánh giá).
            return classStudentRepository.reopenEnrollment(classId, studentId) > 0;
        }
        classStudentRepository.save(ClassStudent.builder().id(key).build());
        return true;
    }

    /**
     * Ghi danh do NHÂN SỰ chủ động (giáo viên phụ trách thêm bằng email; trung tâm nhập roster CSV)
     * = {@link #enroll} + báo học viên {@code ADDED_TO_CLASS} ĐÚNG MỘT LẦN khi lượt này thật sự đưa
     * họ (trở) vào lớp. Nhập lại roster với người đang học, hay người đang bảo lưu, không sinh
     * thông báo — {@code enroll} trả false thì im lặng.
     *
     * <p>Thông báo ghi vào OUTBOX trong cùng giao dịch (G2): {@code OrgRosterRowImporter.importRow}
     * là REQUIRES_NEW và lời gọi của giáo viên cũng nằm trong giao dịch ghi, phát trực tiếp ở đây là
     * bắn trước commit. Tái dùng loại {@code ADDED_TO_CLASS} có sẵn (mobile đã biết, không cần OTA);
     * {@code addedBy} = TEACHER khi người thao tác dạy lớp, ORG khi là nhân sự trung tâm — renderer
     * đọc cờ này để không nói "giáo viên đã thêm bạn" khi thực ra là trung tâm xếp lớp.
     *
     * <p>Đường DUYỆT yêu cầu tham gia KHÔNG đi qua đây: nó có {@code JOIN_REQUEST_APPROVED} riêng
     * (cùng nghĩa "bạn đã vào lớp"), gọi thêm ở đây là báo đôi.
     *
     * @param actorId người thao tác (giáo viên hoặc nhân sự trung tâm); {@code null} = không rõ
     * @return như {@link #enroll}
     */
    @Transactional
    public boolean enrollAndNotify(Long classId, Long studentId, Long actorId) {
        boolean joined = enroll(classId, studentId);
        if (joined) {
            enqueueAddedToClass(classId, studentId, actorId);
        }
        return joined;
    }

    /**
     * {@code dedup_key} mang mốc thời gian: một học viên có thể vào lớp, bị gỡ, rồi được đưa lại —
     * mỗi lượt là một sự kiện riêng và đều đáng báo; khoá theo (lớp, học viên) thôi sẽ chặn nhầm
     * lượt sau bằng UNIQUE. Hai lượt trong cùng một mili-giây không xảy ra: lượt thứ hai gặp dòng đã
     * ACTIVE nên {@code enroll} trả false và không tới đây.
     */
    private void enqueueAddedToClass(Long classId, Long studentId, Long actorId) {
        TeacherClass tc = teacherClassRepository.findById(classId).orElse(null);
        String className = tc != null && tc.getName() != null ? tc.getName() : "Lớp #" + classId;
        boolean actorTeaches = actorId != null
                && classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, actorId);
        // Người thao tác không dạy lớp (nhân sự trung tâm) → ghi tên giáo viên chính của lớp để học
        // viên biết mình học với ai; lớp chưa có giáo viên thì để trống, renderer tự bỏ vế đó.
        Long teacherId = actorTeaches ? actorId : (tc != null ? tc.getTeacherId() : null);
        String teacherName = teacherId == null ? ""
                : userRepository.findById(teacherId).map(User::getDisplayName).orElse("");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("teacherName", teacherName == null ? "" : teacherName);
        payload.put("addedBy", actorTeaches ? "TEACHER" : "ORG");
        outboxRepository.save(NotificationOutbox.builder()
                .dedupKey("enroll:" + classId + ":u" + studentId + ":t" + Instant.now().toEpochMilli())
                .notificationType(NotificationType.ADDED_TO_CLASS)
                .classId(classId)
                .recipientId(studentId)
                .payload(payload)
                .build());
    }

    /** Org-admin (OWNER/MANAGER) gỡ học viên khỏi lớp. Lớp phải thuộc chính trung tâm của người gọi. */
    @Transactional
    public void endByOrgAdmin(Long orgId, Long classId, Long studentId, AuditActor actor) {
        TeacherClass tc = teacherClassRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp trong tổ chức"));
        // Chống IDOR: lớp của trung tâm khác trả NotFound (không phải Forbidden) để không lộ sự tồn tại.
        if (!orgId.equals(tc.getOrgId())) {
            throw new NotFoundException("Không tìm thấy lớp trong tổ chức");
        }
        end(classId, studentId, ClassStudent.END_REASON_BY_ORG, actor, orgId);
    }

    /** Giáo viên PHỤ TRÁCH lớp gỡ học viên khỏi lớp của mình (D2). Trợ giảng không có quyền này. */
    @Transactional
    public void endByTeacher(Long teacherId, Long classId, Long studentId, AuditActor actor) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherIdAndRole(classId, teacherId, "PRIMARY")) {
            throw new ForbiddenException("Chỉ giáo viên phụ trách lớp mới được gỡ học viên");
        }
        Long orgId = teacherClassRepository.findById(classId).map(TeacherClass::getOrgId).orElse(null);
        end(classId, studentId, ClassStudent.END_REASON_BY_TEACHER, actor, orgId);
    }

    private void end(Long classId, Long studentId, String reason, AuditActor actor, Long orgId) {
        ClassStudent row = classStudentRepository.findById(new ClassStudentId(classId, studentId))
                .orElseThrow(() -> new NotFoundException("Học viên không thuộc lớp này"));
        if (!ClassStudent.STATUS_ACTIVE.equals(row.getStatus())
                && !ClassStudent.STATUS_RESERVED.equals(row.getStatus())) {
            throw new NotFoundException("Học viên không thuộc lớp này");
        }
        String previousStatus = row.getStatus();
        row.setStatus(ClassStudent.STATUS_ENDED);
        row.setEndedAt(LocalDateTime.now());
        row.setEndReason(reason);
        classStudentRepository.save(row);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("classId", classId);
        meta.put("studentId", studentId);
        meta.put("fromStatus", previousStatus);
        meta.put("reason", reason);
        if (orgId != null) {
            meta.put("orgId", orgId);
        }
        auditLogService.log("class_student_removed", actor, "CLASS_STUDENT",
                classId + ":" + studentId, meta);
    }
}
