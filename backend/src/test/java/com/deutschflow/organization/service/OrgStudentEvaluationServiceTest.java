package com.deutschflow.organization.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.OrgStudentEvaluationDto;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.entity.OrgMemberId;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.teacher.dto.StudentEvaluationDto;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.StudentEvaluationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Phạm vi của đường "trung tâm đọc hồ sơ đánh giá một học viên" (R12).
 *
 * <p>Ba thứ phải đúng ở đây vì chúng quyết định AI ĐƯỢC THẤY GÌ, và cả ba đều là loại lỗi im lặng:
 * <ol>
 *   <li><b>404 khi học viên không thuộc trung tâm</b> — cùng khuôn chống IDOR của
 *       {@code OrgService#getStudentDetail}. Thiếu chốt này thì một giám đốc gõ id lung tung sẽ đọc
 *       được điểm và nhận xét của học viên trung tâm khác.</li>
 *   <li><b>Chỉ lớp CỦA trung tâm đó.</b> Một học viên có thể vừa học lớp của trung tâm, vừa học lớp
 *       B2C (org NULL) hoặc lớp của trung tâm khác — hồ sơ trả về không được rò hai loại sau.</li>
 *   <li><b>Lớp đã kết thúc vẫn nằm trong hồ sơ</b> kèm {@code enrollmentStatus}: "hồ sơ đánh giá" là
 *       thứ đọc để nhìn lại cả quá trình, lọc mất ENDED thì học viên vừa kết thúc khoá bỗng không có
 *       quá khứ học tập nào.</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Trung tâm đọc hồ sơ đánh giá học viên (R12)")
class OrgStudentEvaluationServiceTest {

    private static final Long ORG_ID = 7L;
    private static final Long STUDENT_ID = 42L;

    @Mock private OrgMemberRepository memberRepo;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private TeacherClassRepository teacherClassRepository;
    @Mock private StudentEvaluationService evaluationService;

    @InjectMocks private OrgStudentEvaluationService service;

    @Test
    @DisplayName("🔴 Học viên không thuộc trung tâm ⇒ 404, KHÔNG đụng tới lớp nào")
    void studentOutsideOrg_is404() {
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, STUDENT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.forStudent(ORG_ID, STUDENT_ID))
                .isInstanceOf(NotFoundException.class);

        verify(classStudentRepository, never()).findAllEnrollmentsOfStudent(anyLong());
        verify(evaluationService, never()).evaluationOf(anyLong(), anyLong());
    }

    @Test
    @DisplayName("🔴 Chỉ trả lớp CỦA trung tâm: lớp trung tâm khác và lớp B2C (org NULL) bị loại")
    void onlyClassesOfThatOrg() {
        memberExists();
        when(classStudentRepository.findAllEnrollmentsOfStudent(STUDENT_ID)).thenReturn(List.of(
                enrollment(100L, ClassStudent.STATUS_ACTIVE, LocalDateTime.of(2026, 9, 1, 8, 0)),
                enrollment(200L, ClassStudent.STATUS_ACTIVE, LocalDateTime.of(2026, 9, 2, 8, 0)),
                enrollment(300L, ClassStudent.STATUS_ACTIVE, LocalDateTime.of(2026, 9, 3, 8, 0))));
        when(teacherClassRepository.findAllById(List.of(100L, 200L, 300L))).thenReturn(List.of(
                clazz(100L, ORG_ID, "B1 buổi tối"),
                clazz(200L, 8L, "Lớp trung tâm khác"),
                clazz(300L, null, "Lớp tự do B2C")));
        when(evaluationService.evaluationOf(100L, STUDENT_ID))
                .thenReturn(evaluation(100L, "B1 buổi tối"));

        List<OrgStudentEvaluationDto> out = service.forStudent(ORG_ID, STUDENT_ID);

        assertThat(out).extracting(OrgStudentEvaluationDto::classId).containsExactly(100L);
        verify(evaluationService, never()).evaluationOf(200L, STUDENT_ID);
        verify(evaluationService, never()).evaluationOf(300L, STUDENT_ID);
    }

    @Test
    @DisplayName("🔴 Lớp đã kết thúc vẫn nằm trong hồ sơ, mang enrollmentStatus và endedAt")
    void endedEnrollmentStaysInTheRecord() {
        memberExists();
        ClassStudent ended = enrollment(100L, ClassStudent.STATUS_ENDED, LocalDateTime.of(2026, 3, 1, 8, 0));
        ended.setEndedAt(LocalDateTime.of(2026, 6, 30, 17, 0));
        when(classStudentRepository.findAllEnrollmentsOfStudent(STUDENT_ID)).thenReturn(List.of(ended));
        when(teacherClassRepository.findAllById(List.of(100L)))
                .thenReturn(List.of(clazz(100L, ORG_ID, "A2 khoá xuân")));
        when(evaluationService.evaluationOf(100L, STUDENT_ID))
                .thenReturn(evaluation(100L, "A2 khoá xuân"));

        List<OrgStudentEvaluationDto> out = service.forStudent(ORG_ID, STUDENT_ID);

        assertThat(out).singleElement().satisfies(dto -> {
            assertThat(dto.enrollmentStatus()).isEqualTo(ClassStudent.STATUS_ENDED);
            assertThat(dto.endedAt()).isEqualTo(LocalDateTime.of(2026, 6, 30, 17, 0));
            assertThat(dto.teacherComment()).isEqualTo("Tiến bộ đều");
            assertThat(dto.skillSprechen()).isEqualByComparingTo("7.5");
        });
    }

    @Test
    @DisplayName("Lớp đang học xếp trước lớp đã kết thúc; cùng nhóm thì lớp vào sau xếp trước")
    void ordersActiveFirstThenNewest() {
        memberExists();
        when(classStudentRepository.findAllEnrollmentsOfStudent(STUDENT_ID)).thenReturn(List.of(
                enrollment(100L, ClassStudent.STATUS_ENDED, LocalDateTime.of(2026, 1, 10, 8, 0)),
                enrollment(200L, ClassStudent.STATUS_ACTIVE, LocalDateTime.of(2026, 5, 1, 8, 0)),
                enrollment(300L, ClassStudent.STATUS_ACTIVE, LocalDateTime.of(2026, 9, 1, 8, 0))));
        when(teacherClassRepository.findAllById(List.of(100L, 200L, 300L))).thenReturn(List.of(
                clazz(100L, ORG_ID, "A2"), clazz(200L, ORG_ID, "B1"), clazz(300L, ORG_ID, "B1+")));
        when(evaluationService.evaluationOf(anyLong(), anyLong()))
                .thenAnswer(inv -> evaluation(inv.getArgument(0), "x"));

        List<OrgStudentEvaluationDto> out = service.forStudent(ORG_ID, STUDENT_ID);

        assertThat(out).extracting(OrgStudentEvaluationDto::classId).containsExactly(300L, 200L, 100L);
    }

    @Test
    @DisplayName("Học viên của trung tâm nhưng chưa vào lớp nào ⇒ danh sách rỗng, không phải 404")
    void memberWithoutClasses_isEmptyList() {
        memberExists();
        when(classStudentRepository.findAllEnrollmentsOfStudent(STUDENT_ID)).thenReturn(List.of());

        assertThat(service.forStudent(ORG_ID, STUDENT_ID)).isEmpty();
        verify(teacherClassRepository, never()).findAllById(org.mockito.ArgumentMatchers.anyIterable());
    }

    // ── dựng dữ liệu ────────────────────────────────────────────────────────

    private void memberExists() {
        OrgMember member = new OrgMember();
        member.setId(new OrgMemberId(ORG_ID, STUDENT_ID));
        member.setRole("STUDENT");
        member.setStatus("ACTIVE");
        when(memberRepo.findByIdOrgIdAndIdUserId(ORG_ID, STUDENT_ID)).thenReturn(Optional.of(member));
    }

    private static ClassStudent enrollment(Long classId, String status, LocalDateTime joinedAt) {
        ClassStudent cs = new ClassStudent();
        cs.setId(new ClassStudentId(classId, STUDENT_ID));
        cs.setStatus(status);
        cs.setJoinedAt(joinedAt);
        return cs;
    }

    private static TeacherClass clazz(Long id, Long orgId, String name) {
        TeacherClass c = new TeacherClass();
        c.setId(id);
        c.setOrgId(orgId);
        c.setName(name);
        return c;
    }

    private static StudentEvaluationDto evaluation(Long classId, String className) {
        return new StudentEvaluationDto(STUDENT_ID, "Nguyễn Văn A", "a@example.com", classId, className,
                "Tiến bộ đều", new BigDecimal("6.0"), new BigDecimal("6.5"), new BigDecimal("7.0"),
                new BigDecimal("7.5"), 72.5, 10, 9, 1, 0, true, LocalDateTime.of(2026, 6, 30, 10, 0));
    }
}
