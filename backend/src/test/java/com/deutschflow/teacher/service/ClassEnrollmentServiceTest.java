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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * G-02: gỡ MỘT học viên khỏi MỘT lớp — hai cửa vào theo D2 (org-admin và giáo viên phụ trách),
 * và ghi danh lại KHÔNG được xoá dữ liệu học tập cũ.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ClassEnrollmentService Unit Tests (G-02)")
class ClassEnrollmentServiceTest {

    private static final Long ORG_ID = 42L;
    private static final Long CLASS_ID = 100L;
    private static final Long STUDENT_ID = 7L;
    private static final Long TEACHER_ID = 1L;
    private static final AuditActor ACTOR = new AuditActor(1L, "gv@tt.vn", "TEACHER");

    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private UserRepository userRepository;
    @Mock private NotificationOutboxRepository outboxRepository;

    @InjectMocks private ClassEnrollmentService service;

    private ClassStudent enrolledRow(String status) {
        return ClassStudent.builder()
                .id(new ClassStudentId(CLASS_ID, STUDENT_ID))
                .status(status)
                .skillHoren(new BigDecimal("8.5"))
                .teacherComment("Chăm chỉ")
                .build();
    }

    // ── Giáo viên phụ trách ───────────────────────────────────────────────────

    @Test
    @DisplayName("Giáo viên phụ trách gỡ học viên: đóng dòng ghi danh, KHÔNG xoá, giữ nguyên đánh giá")
    void endByTeacher_marksEndedAndKeepsLearningData() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherIdAndRole(CLASS_ID, TEACHER_ID, "PRIMARY"))
                .thenReturn(true);
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).orgId(ORG_ID).build()));
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(enrolledRow(ClassStudent.STATUS_ACTIVE)));

        service.endByTeacher(TEACHER_ID, CLASS_ID, STUDENT_ID, ACTOR);

        ArgumentCaptor<ClassStudent> saved = ArgumentCaptor.forClass(ClassStudent.class);
        verify(classStudentRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ClassStudent.STATUS_ENDED);
        assertThat(saved.getValue().getEndedAt()).isNotNull();
        assertThat(saved.getValue().getEndReason()).isEqualTo(ClassStudent.END_REASON_BY_TEACHER);
        // D2: dữ liệu học tập giữ nguyên — chỉ đổi trạng thái, không xoá dòng.
        assertThat(saved.getValue().getSkillHoren()).isEqualByComparingTo("8.5");
        assertThat(saved.getValue().getTeacherComment()).isEqualTo("Chăm chỉ");
        verify(classStudentRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Gỡ học viên có ghi vết audit kèm lớp, học viên, lý do và trung tâm")
    void endByTeacher_writesAudit() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherIdAndRole(CLASS_ID, TEACHER_ID, "PRIMARY"))
                .thenReturn(true);
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).orgId(ORG_ID).build()));
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(enrolledRow(ClassStudent.STATUS_ACTIVE)));

        service.endByTeacher(TEACHER_ID, CLASS_ID, STUDENT_ID, ACTOR);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        // ORG_ID đi vào CỘT org_id (org của LỚP) — đó là thứ sổ hoạt động của giám đốc lọc.
        verify(auditLogService).log(eq("class_student_removed"), eq(ACTOR), eq("CLASS_STUDENT"),
                eq(CLASS_ID + ":" + STUDENT_ID), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue())
                .containsEntry("classId", CLASS_ID)
                .containsEntry("studentId", STUDENT_ID)
                .containsEntry("reason", ClassStudent.END_REASON_BY_TEACHER)
                .containsEntry("orgId", ORG_ID);
    }

    @Test
    @DisplayName("Trợ giảng KHÔNG gỡ được học viên — chỉ giáo viên phụ trách (D2)")
    void endByTeacher_assistant_forbidden() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherIdAndRole(CLASS_ID, 9L, "PRIMARY"))
                .thenReturn(false);

        assertThatThrownBy(() -> service.endByTeacher(9L, CLASS_ID, STUDENT_ID, ACTOR))
                .isInstanceOf(ForbiddenException.class);

        verify(classStudentRepository, never()).save(any());
        // verifyNoInteractions phủ MỌI overload của log(); never() trên một chữ ký thì im lặng
        // bỏ qua lần gọi đi bằng chữ ký kia.
        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("Học viên đã rời lớp thì gỡ lần nữa trả 404, không ghi đè ended_at cũ")
    void end_alreadyEnded_notFound() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherIdAndRole(CLASS_ID, TEACHER_ID, "PRIMARY"))
                .thenReturn(true);
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).build()));
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(enrolledRow(ClassStudent.STATUS_ENDED)));

        assertThatThrownBy(() -> service.endByTeacher(TEACHER_ID, CLASS_ID, STUDENT_ID, ACTOR))
                .isInstanceOf(NotFoundException.class);

        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Học viên BẢO LƯU vẫn gỡ được (D1: vẫn đang giữ chỗ)")
    void end_reservedStudent_isRemovable() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherIdAndRole(CLASS_ID, TEACHER_ID, "PRIMARY"))
                .thenReturn(true);
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).build()));
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(enrolledRow(ClassStudent.STATUS_RESERVED)));

        service.endByTeacher(TEACHER_ID, CLASS_ID, STUDENT_ID, ACTOR);

        ArgumentCaptor<ClassStudent> saved = ArgumentCaptor.forClass(ClassStudent.class);
        verify(classStudentRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ClassStudent.STATUS_ENDED);
    }

    // ── Org-admin ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Org-admin gỡ học viên khỏi lớp của chính trung tâm mình")
    void endByOrgAdmin_ownClass_ok() {
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).orgId(ORG_ID).build()));
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(enrolledRow(ClassStudent.STATUS_ACTIVE)));

        service.endByOrgAdmin(ORG_ID, CLASS_ID, STUDENT_ID, ACTOR);

        ArgumentCaptor<ClassStudent> saved = ArgumentCaptor.forClass(ClassStudent.class);
        verify(classStudentRepository).save(saved.capture());
        assertThat(saved.getValue().getEndReason()).isEqualTo(ClassStudent.END_REASON_BY_ORG);
    }

    @Test
    @DisplayName("Chống IDOR: lớp của trung tâm KHÁC trả 404 và không đụng dòng ghi danh nào")
    void endByOrgAdmin_foreignClass_notFound() {
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).orgId(999L).build()));

        assertThatThrownBy(() -> service.endByOrgAdmin(ORG_ID, CLASS_ID, STUDENT_ID, ACTOR))
                .isInstanceOf(NotFoundException.class);

        verify(classStudentRepository, never()).findById(any());
        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Chống IDOR: lớp B2C (không thuộc trung tâm nào) cũng trả 404 cho org-admin")
    void endByOrgAdmin_personalClass_notFound() {
        when(teacherClassRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(TeacherClass.builder().id(CLASS_ID).build()));   // orgId = null

        assertThatThrownBy(() -> service.endByOrgAdmin(ORG_ID, CLASS_ID, STUDENT_ID, ACTOR))
                .isInstanceOf(NotFoundException.class);

        verify(classStudentRepository, never()).save(any());
    }

    // ── Ghi danh (lại) ────────────────────────────────────────────────────────

    @Test
    @DisplayName("Ghi danh lại người từng rời lớp: MỞ LẠI dòng cũ, không save() đè NULL lên đánh giá")
    void enroll_existingRow_reopensInsteadOfSave() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(true);
        when(classStudentRepository.reopenEnrollment(CLASS_ID, STUDENT_ID)).thenReturn(1);

        assertThat(service.enroll(CLASS_ID, STUDENT_ID)).isTrue();

        verify(classStudentRepository).reopenEnrollment(CLASS_ID, STUDENT_ID);
        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Ghi danh người đang còn trong lớp là no-op và trả false")
    void enroll_alreadyActive_isNoOp() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(true);
        when(classStudentRepository.reopenEnrollment(CLASS_ID, STUDENT_ID)).thenReturn(0);

        assertThat(service.enroll(CLASS_ID, STUDENT_ID)).isFalse();

        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Ghi danh người chưa có dòng nào: tạo dòng mới trạng thái ACTIVE")
    void enroll_newRow_savesActive() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(false);

        assertThat(service.enroll(CLASS_ID, STUDENT_ID)).isTrue();

        ArgumentCaptor<ClassStudent> saved = ArgumentCaptor.forClass(ClassStudent.class);
        verify(classStudentRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ClassStudent.STATUS_ACTIVE);
        verify(classStudentRepository, never()).reopenEnrollment(anyLong(), anyLong());
    }

    // ── DEC-18: enrollAndNotify — một cửa cho mọi đường nhân sự đưa học viên vào lớp ──────────

    private void stubClass(Long primaryTeacherId) {
        when(teacherClassRepository.findById(CLASS_ID)).thenReturn(Optional.of(
                TeacherClass.builder().id(CLASS_ID).orgId(ORG_ID).name("A1 Sáng").teacherId(primaryTeacherId).build()));
    }

    @Test
    @DisplayName("enrollAndNotify: giáo viên của lớp thêm học viên mới → outbox ADDED_TO_CLASS, addedBy=TEACHER, tên người thao tác")
    void enrollAndNotify_byTeacher_enqueuesAddedToClass() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(false);
        stubClass(TEACHER_ID);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(userRepository.findById(TEACHER_ID)).thenReturn(Optional.of(User.builder().id(TEACHER_ID).displayName("Cô Lan").build()));

        assertThat(service.enrollAndNotify(CLASS_ID, STUDENT_ID, TEACHER_ID)).isTrue();

        ArgumentCaptor<NotificationOutbox> row = ArgumentCaptor.forClass(NotificationOutbox.class);
        verify(outboxRepository).save(row.capture());
        assertThat(row.getValue().getNotificationType()).isEqualTo(NotificationType.ADDED_TO_CLASS);
        assertThat(row.getValue().getRecipientId()).isEqualTo(STUDENT_ID);
        assertThat(row.getValue().getClassId()).isEqualTo(CLASS_ID);
        assertThat(row.getValue().getDedupKey()).startsWith("enroll:" + CLASS_ID + ":u" + STUDENT_ID + ":t");
        assertThat(row.getValue().getPayload())
                .containsEntry("classId", CLASS_ID)
                .containsEntry("className", "A1 Sáng")
                .containsEntry("teacherName", "Cô Lan")
                .containsEntry("addedBy", "TEACHER");
    }

    @Test
    @DisplayName("enrollAndNotify: nhân sự trung tâm (CSV) xếp lớp → addedBy=ORG, teacherName = giáo viên chính của lớp")
    void enrollAndNotify_byOrgStaff_marksOrgAndNamesPrimaryTeacher() {
        Long managerId = 55L;
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(false);
        stubClass(TEACHER_ID);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, managerId)).thenReturn(false);
        when(userRepository.findById(TEACHER_ID)).thenReturn(Optional.of(User.builder().id(TEACHER_ID).displayName("Cô Lan").build()));

        service.enrollAndNotify(CLASS_ID, STUDENT_ID, managerId);

        ArgumentCaptor<NotificationOutbox> row = ArgumentCaptor.forClass(NotificationOutbox.class);
        verify(outboxRepository).save(row.capture());
        assertThat(row.getValue().getPayload())
                .containsEntry("addedBy", "ORG")
                .containsEntry("teacherName", "Cô Lan");
    }

    @Test
    @DisplayName("enrollAndNotify: học viên đang học (nhập lại roster) hoặc đang bảo lưu → KHÔNG thông báo, không đè dữ liệu")
    void enrollAndNotify_alreadyEnrolled_isSilent() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(true);
        when(classStudentRepository.reopenEnrollment(CLASS_ID, STUDENT_ID)).thenReturn(0);

        assertThat(service.enrollAndNotify(CLASS_ID, STUDENT_ID, TEACHER_ID)).isFalse();

        verify(outboxRepository, never()).save(any());
        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("enrollAndNotify: mở lại dòng đã ENDED (đưa trở lại lớp) → báo đúng một lần như lượt vào lớp mới")
    void enrollAndNotify_reopen_notifiesOnce() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(true);
        when(classStudentRepository.reopenEnrollment(CLASS_ID, STUDENT_ID)).thenReturn(1);
        stubClass(TEACHER_ID);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(userRepository.findById(TEACHER_ID)).thenReturn(Optional.of(User.builder().id(TEACHER_ID).displayName("Cô Lan").build()));

        assertThat(service.enrollAndNotify(CLASS_ID, STUDENT_ID, TEACHER_ID)).isTrue();

        verify(outboxRepository).save(any(NotificationOutbox.class));
    }
}
