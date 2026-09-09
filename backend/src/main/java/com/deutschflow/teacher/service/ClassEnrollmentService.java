package com.deutschflow.teacher.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 */
@Service
@RequiredArgsConstructor
public class ClassEnrollmentService {

    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final AuditLogService auditLogService;

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
        // orgId là org của LỚP, đã tra ở đường gọi TRƯỚC khi động vào hàng ghi danh. Lớp riêng
        // ngoài trung tâm thì null hợp lệ — cứ truyền thẳng, AuditLogService hiểu null là "rơi về
        // đường lùi suy từ actor", đúng hành vi cũ cho ca B2C.
        auditLogService.log("class_student_removed", actor, "CLASS_STUDENT",
                classId + ":" + studentId, orgId, meta);
    }
}
