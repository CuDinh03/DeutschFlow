package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassroomDetailDto;
import com.deutschflow.teacher.dto.MyClassroomDto;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentClassroomServiceTest {

    @Mock private TeacherClassRepository classRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private ClassAssignmentRepository assignmentRepository;
    @Mock private ClassLessonRepository lessonRepository;
    @Mock private StudentAssignmentRepository studentAssignmentRepository;
    @Mock private UserRepository userRepository;

    private StudentClassroomService service;

    private static final Long STUDENT_ID = 200L;
    private static final Long CLASS_ID = 10L;
    private static final Long TEACHER_ID = 100L;

    @BeforeEach
    void setUp() {
        service = new StudentClassroomService(
                classRepository, classStudentRepository, classTeacherRepository,
                assignmentRepository, lessonRepository, studentAssignmentRepository, userRepository);
    }

    @Test
    @DisplayName("listMyClasses returns empty when student not in any class")
    void listMyClasses_emptyWhenNoMembership() {
        when(classStudentRepository.findByIdStudentId(STUDENT_ID)).thenReturn(List.of());

        assertThat(service.listMyClasses(STUDENT_ID)).isEmpty();
    }

    @Test
    @DisplayName("listMyClasses aggregates teachers + stats per class")
    void listMyClasses_aggregates() {
        LocalDateTime now = LocalDateTime.of(2026, 6, 1, 10, 0);
        ClassStudent membership = membership(CLASS_ID, STUDENT_ID, now);
        when(classStudentRepository.findByIdStudentId(STUDENT_ID)).thenReturn(List.of(membership));

        TeacherClass cls = TeacherClass.builder()
                .id(CLASS_ID).teacherId(TEACHER_ID).name("Lớp A1 Sáng")
                .inviteCode("INV123").createdAt(now).build();
        when(classRepository.findAllById(List.of(CLASS_ID))).thenReturn(List.of(cls));

        ClassTeacher ct = ClassTeacher.builder()
                .id(new ClassTeacherId(CLASS_ID, TEACHER_ID)).role("PRIMARY").joinedAt(now).build();
        when(classTeacherRepository.findByIdClassIdIn(List.of(CLASS_ID))).thenReturn(List.of(ct));

        User teacher = new User();
        teacher.setId(TEACHER_ID);
        teacher.setDisplayName("Cô Anna");
        teacher.setEmail("anna@x.com");
        when(userRepository.findAllById(any())).thenReturn(List.of(teacher));

        ClassAssignment a1 = assignment(1L, "Begrüßung", now.minusDays(2));
        ClassAssignment a2 = assignment(2L, "Modalverben", now.minusDays(1));
        ClassAssignment a3 = assignment(3L, "Konjunktiv", now);
        when(assignmentRepository.findByClassIdIn(List.of(CLASS_ID))).thenReturn(List.of(a1, a2, a3));

        StudentAssignment sa1 = sa(1L, "GRADED", 8);
        StudentAssignment sa2 = sa(2L, "SUBMITTED", null);
        // sa3 missing → counts as pending
        when(studentAssignmentRepository.findByAssignmentIds(any())).thenReturn(List.of(sa1, sa2));

        when(lessonRepository.countByClassId(CLASS_ID)).thenReturn(5L);
        when(lessonRepository.countByClassIdAndCompletedTrue(CLASS_ID)).thenReturn(2L);

        List<MyClassroomDto> out = service.listMyClasses(STUDENT_ID);

        assertThat(out).hasSize(1);
        MyClassroomDto dto = out.get(0);
        assertThat(dto.name()).isEqualTo("Lớp A1 Sáng");
        assertThat(dto.teachers()).hasSize(1).first().extracting("displayName").isEqualTo("Cô Anna");
        assertThat(dto.assignmentCount()).isEqualTo(3);
        assertThat(dto.gradedCount()).isEqualTo(1);
        assertThat(dto.submittedCount()).isEqualTo(1);
        assertThat(dto.pendingCount()).isEqualTo(1);
        assertThat(dto.avgScore()).isEqualTo(8.0);
        assertThat(dto.latestAssignmentTopic()).isEqualTo("Konjunktiv");
        assertThat(dto.lessonTotal()).isEqualTo(5L);
        assertThat(dto.lessonCompleted()).isEqualTo(2L);
    }

    @Test
    @DisplayName("getClassDetail rejects when student not in class (IDOR guard)")
    void getClassDetail_rejectsNonMember() {
        when(classStudentRepository.findByIdStudentId(STUDENT_ID)).thenReturn(List.of());

        assertThatThrownBy(() -> service.getClassDetail(STUDENT_ID, CLASS_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getClassDetail surfaces current lesson = first non-completed")
    void getClassDetail_currentLesson() {
        LocalDateTime now = LocalDateTime.of(2026, 6, 1, 10, 0);
        ClassStudent membership = membership(CLASS_ID, STUDENT_ID, now);
        when(classStudentRepository.findByIdStudentId(STUDENT_ID)).thenReturn(List.of(membership));

        TeacherClass cls = TeacherClass.builder()
                .id(CLASS_ID).teacherId(TEACHER_ID).name("Lớp").inviteCode("X").createdAt(now).build();
        when(classRepository.findById(CLASS_ID)).thenReturn(java.util.Optional.of(cls));

        when(classTeacherRepository.findByIdClassIdIn(List.of(CLASS_ID))).thenReturn(List.of());
        when(userRepository.findAllById(any())).thenReturn(List.of());
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of());

        ClassLesson l1 = ClassLesson.builder().id(1L).classId(CLASS_ID).orderIndex(0)
                .title("Done").completed(true).build();
        ClassLesson l2 = ClassLesson.builder().id(2L).classId(CLASS_ID).orderIndex(1)
                .title("Current").completed(false).build();
        ClassLesson l3 = ClassLesson.builder().id(3L).classId(CLASS_ID).orderIndex(2)
                .title("Future").completed(false).build();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID))
                .thenReturn(List.of(l1, l2, l3));
        lenient().when(lessonRepository.countByClassId(CLASS_ID)).thenReturn(3L);
        lenient().when(lessonRepository.countByClassIdAndCompletedTrue(CLASS_ID)).thenReturn(1L);
        when(classStudentRepository.countByIdClassId(CLASS_ID)).thenReturn(5L);

        ClassroomDetailDto dto = service.getClassDetail(STUDENT_ID, CLASS_ID);

        assertThat(dto.currentLessonTitle()).isEqualTo("Current");
        assertThat(dto.lessonTotal()).isEqualTo(3L);
        assertThat(dto.lessonCompleted()).isEqualTo(1L);
        assertThat(dto.studentCount()).isEqualTo(5L);
    }

    @Test
    @DisplayName("listAssignments rejects when student not enrolled")
    void listAssignments_rejectsNonMember() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.listAssignments(STUDENT_ID, CLASS_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("listAssignments returns only this student's submissions for the class")
    void listAssignments_filtersByStudent() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        ClassAssignment a1 = assignment(1L, "T1", LocalDateTime.now());
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of(a1));

        StudentAssignment mine = sa(1L, "GRADED", 7);
        mine.setStudentId(STUDENT_ID);
        StudentAssignment other = sa(1L, "GRADED", 9);
        other.setStudentId(999L);
        when(studentAssignmentRepository.findByAssignmentIds(any())).thenReturn(List.of(mine, other));

        List<StudentAssignmentDto> out = service.listAssignments(STUDENT_ID, CLASS_ID);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).studentId()).isEqualTo(STUDENT_ID);
        assertThat(out.get(0).teacherScore()).isEqualTo(7);
    }

    // ── helpers ───────────────────────────────────────────────

    private static ClassStudent membership(Long classId, Long studentId, LocalDateTime joinedAt) {
        return ClassStudent.builder()
                .id(new ClassStudentId(classId, studentId))
                .joinedAt(joinedAt)
                .build();
    }

    private static ClassAssignment assignment(Long id, String topic, LocalDateTime createdAt) {
        return ClassAssignment.builder()
                .id(id).classId(CLASS_ID).topic(topic).assignmentType("GENERAL")
                .createdAt(createdAt).build();
    }

    private static StudentAssignment sa(Long assignmentId, String status, Integer score) {
        return StudentAssignment.builder()
                .id(assignmentId * 1000)
                .assignmentId(assignmentId)
                .studentId(STUDENT_ID)
                .status(status)
                .score(score)
                .createdAt(LocalDateTime.now())
                .build();
    }
}
