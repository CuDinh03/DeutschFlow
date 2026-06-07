package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.CreateLessonRequest;
import com.deutschflow.teacher.dto.ReorderLessonsRequest;
import com.deutschflow.teacher.dto.UpdateLessonRequest;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClassLessonServiceTest {

    @Mock private ClassLessonRepository lessonRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private ClassStudentRepository classStudentRepository;

    private ClassLessonService service;

    private static final Long TEACHER_ID = 100L;
    private static final Long STUDENT_ID = 200L;
    private static final Long CLASS_ID = 10L;
    private static final Long LESSON_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new ClassLessonService(lessonRepository, classTeacherRepository, classStudentRepository);
    }

    @Test
    @DisplayName("create lesson appends with next order_index and persists")
    void create_appendsNextOrder() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(2);
        when(lessonRepository.save(any())).thenAnswer(inv -> {
            ClassLesson l = inv.getArgument(0);
            l.setId(LESSON_ID);
            return l;
        });

        ClassLessonDto dto = service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("Modalverben", "Können / müssen"));

        ArgumentCaptor<ClassLesson> captor = ArgumentCaptor.forClass(ClassLesson.class);
        verify(lessonRepository).save(captor.capture());
        assertThat(captor.getValue().getOrderIndex()).isEqualTo(3);
        assertThat(captor.getValue().getTitle()).isEqualTo("Modalverben");
        assertThat(captor.getValue().isCompleted()).isFalse();
        assertThat(dto.title()).isEqualTo("Modalverben");
    }

    @Test
    @DisplayName("create rejects when title blank")
    void create_rejectsBlankTitle() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID, new CreateLessonRequest("  ", null)))
                .isInstanceOf(BadRequestException.class);
        verify(lessonRepository, never()).save(any());
    }

    @Test
    @DisplayName("create rejects when teacher does not own class")
    void create_rejectsNonOwner() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID, new CreateLessonRequest("X", null)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("update toggling completed sets completedAt and completedByTeacherId")
    void update_completedSetsAuditFields() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("Begrüßung")
                .completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClassLessonDto dto = service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, true));

        assertThat(dto.completed()).isTrue();
        assertThat(dto.completedAt()).isNotNull();
        assertThat(dto.completedByTeacherId()).isEqualTo(TEACHER_ID);
    }

    @Test
    @DisplayName("update untick clears completedAt + completedByTeacherId")
    void update_untickClearsAudit() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X")
                .completed(true).completedAt(LocalDateTime.now()).completedByTeacherId(TEACHER_ID)
                .build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClassLessonDto dto = service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, false));

        assertThat(dto.completed()).isFalse();
        assertThat(dto.completedAt()).isNull();
        assertThat(dto.completedByTeacherId()).isNull();
    }

    @Test
    @DisplayName("update rejects when lesson belongs to a different class")
    void update_rejectsCrossClass() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(99L).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));

        assertThatThrownBy(() -> service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest("y", null, true)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("reorder rewrites orderIndex according to given list")
    void reorder_rewritesOrder() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson a = ClassLesson.builder().id(1L).classId(CLASS_ID).orderIndex(0).title("A").build();
        ClassLesson b = ClassLesson.builder().id(2L).classId(CLASS_ID).orderIndex(1).title("B").build();
        ClassLesson c = ClassLesson.builder().id(3L).classId(CLASS_ID).orderIndex(2).title("C").build();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID))
                .thenReturn(List.of(a, b, c))
                .thenReturn(List.of(c, a, b));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.reorder(TEACHER_ID, CLASS_ID, new ReorderLessonsRequest(List.of(3L, 1L, 2L)));

        assertThat(c.getOrderIndex()).isEqualTo(0);
        assertThat(a.getOrderIndex()).isEqualTo(1);
        assertThat(b.getOrderIndex()).isEqualTo(2);
    }

    @Test
    @DisplayName("reorder rejects mismatched id sets")
    void reorder_rejectsMismatch() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson a = ClassLesson.builder().id(1L).classId(CLASS_ID).orderIndex(0).title("A").build();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(a));

        assertThatThrownBy(() -> service.reorder(TEACHER_ID, CLASS_ID,
                new ReorderLessonsRequest(List.of(1L, 99L))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("listForStudent rejects when not enrolled")
    void listForStudent_rejectsNonMember() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.listForStudent(STUDENT_ID, CLASS_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("listForStudent returns lessons ordered by orderIndex")
    void listForStudent_returnsOrdered() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        ClassLesson a = ClassLesson.builder().id(1L).classId(CLASS_ID).orderIndex(0).title("A").build();
        ClassLesson b = ClassLesson.builder().id(2L).classId(CLASS_ID).orderIndex(1).title("B").completed(true).build();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(a, b));

        List<ClassLessonDto> out = service.listForStudent(STUDENT_ID, CLASS_ID);

        assertThat(out).hasSize(2);
        assertThat(out.get(0).title()).isEqualTo("A");
        assertThat(out.get(1).completed()).isTrue();
    }
}
