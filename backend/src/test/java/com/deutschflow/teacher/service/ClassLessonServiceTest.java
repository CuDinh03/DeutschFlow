package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.CanDoStatementInput;
import com.deutschflow.teacher.dto.ClassLessonDto;
import com.deutschflow.teacher.dto.CreateLessonRequest;
import com.deutschflow.teacher.dto.KnowledgePointDto;
import com.deutschflow.teacher.dto.KnowledgePointInput;
import com.deutschflow.teacher.dto.ReorderLessonsRequest;
import com.deutschflow.teacher.dto.UpdateLessonRequest;
import com.deutschflow.teacher.entity.CanDoStatement;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.LessonKnowledgePoint;
import com.deutschflow.teacher.repository.CanDoStatementRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.CurriculumModuleRepository;
import com.deutschflow.teacher.repository.LessonKnowledgePointRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
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
    @Mock private LessonKnowledgePointRepository knowledgePointRepository;
    @Mock private CurriculumModuleRepository moduleRepository;
    @Mock private CanDoStatementRepository canDoRepository;

    private ClassLessonService service;

    private static final Long TEACHER_ID = 100L;
    private static final Long STUDENT_ID = 200L;
    private static final Long CLASS_ID = 10L;
    private static final Long LESSON_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new ClassLessonService(lessonRepository, classTeacherRepository, classStudentRepository, knowledgePointRepository, moduleRepository, canDoRepository);
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
                new CreateLessonRequest("Modalverben", "Können / müssen", null, null, null, null, null));

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

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID, new CreateLessonRequest("  ", null, null, null, null, null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(lessonRepository, never()).save(any());
    }

    @Test
    @DisplayName("create rejects when teacher does not own class")
    void create_rejectsNonOwner() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID, new CreateLessonRequest("X", null, null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
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
                new UpdateLessonRequest(null, null, true, null, null, null, null, null, null, null, null));

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
                new UpdateLessonRequest(null, null, false, null, null, null, null, null, null, null, null));

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
                new UpdateLessonRequest("y", null, true, null, null, null, null, null, null, null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("create persists CEFR level (normalized) + planned date + estimated units")
    void create_persistsCefrAndPacing() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(-1);
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        LocalDate planned = LocalDate.of(2026, 7, 20);

        ClassLessonDto dto = service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("Lektion 1", null, "a1", planned, 3, null, null));

        ArgumentCaptor<ClassLesson> captor = ArgumentCaptor.forClass(ClassLesson.class);
        verify(lessonRepository).save(captor.capture());
        assertThat(captor.getValue().getCefrLevel()).isEqualTo("A1"); // normalized to upper-case
        assertThat(captor.getValue().getPlannedDate()).isEqualTo(planned);
        assertThat(captor.getValue().getEstimatedUnits()).isEqualTo(3);
        assertThat(dto.cefrLevel()).isEqualTo("A1");
        assertThat(dto.plannedDate()).isEqualTo(planned);
        assertThat(dto.estimatedUnits()).isEqualTo(3);
    }

    @Test
    @DisplayName("create rejects an unknown CEFR level")
    void create_rejectsInvalidCefr() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("X", null, "Z9", null, null, null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(lessonRepository, never()).save(any());
    }

    @Test
    @DisplayName("create rejects a non-positive estimated units value")
    void create_rejectsNonPositiveUnits() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("X", null, null, null, 0, null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(lessonRepository, never()).save(any());
    }

    @Test
    @DisplayName("update applies CEFR + pacing when provided")
    void update_appliesCefrAndPacing() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        LocalDate planned = LocalDate.of(2026, 8, 1);

        ClassLessonDto dto = service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, null, "b1", planned, 4, null, null, null, null, null));

        assertThat(dto.cefrLevel()).isEqualTo("B1");
        assertThat(dto.plannedDate()).isEqualTo(planned);
        assertThat(dto.estimatedUnits()).isEqualTo(4);
    }

    @Test
    @DisplayName("completion-toggle update leaves existing CEFR + pacing untouched (null = leave)")
    void update_completedOnly_preservesCefrAndPacing() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        LocalDate planned = LocalDate.of(2026, 8, 1);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X")
                .cefrLevel("A2").plannedDate(planned).estimatedUnits(2)
                .completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClassLessonDto dto = service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, true, null, null, null, null, null, null, null, null));

        assertThat(dto.completed()).isTrue();
        assertThat(dto.cefrLevel()).isEqualTo("A2");
        assertThat(dto.plannedDate()).isEqualTo(planned);
        assertThat(dto.estimatedUnits()).isEqualTo(2);
    }

    @Test
    @DisplayName("create rejects an out-of-range planned date (clean 400, not a DB 500)")
    void create_rejectsOutOfRangePlannedDate() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("X", null, null, LocalDate.of(999_999_999, 12, 31), null, null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(lessonRepository, never()).save(any());
    }

    @Test
    @DisplayName("update with a blank cefrLevel leaves the existing level untouched (no clear)")
    void update_blankCefrPreservesLevel() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X")
                .cefrLevel("B1").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClassLessonDto dto = service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, null, "  ", null, null, null, null, null, null, null));

        assertThat(dto.cefrLevel()).isEqualTo("B1");
    }

    @Test
    @DisplayName("update clears CEFR + planned date + units when the clear flags are set")
    void update_clearFlagsNullFields() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X")
                .cefrLevel("B1").plannedDate(LocalDate.of(2026, 8, 1)).estimatedUnits(3)
                .completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClassLessonDto dto = service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, null, null, null, null, null, true, true, true, null));

        assertThat(dto.cefrLevel()).isNull();
        assertThat(dto.plannedDate()).isNull();
        assertThat(dto.estimatedUnits()).isNull();
    }

    @Test
    @DisplayName("create with structured knowledgePoints persists sub-table rows + mirrors description")
    @SuppressWarnings("unchecked")
    void create_persistsStructuredKnowledgePoints() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(-1);
        when(lessonRepository.save(any())).thenAnswer(inv -> {
            ClassLesson l = inv.getArgument(0);
            l.setId(LESSON_ID);
            return l;
        });

        List<KnowledgePointInput> pts = List.of(
                new KnowledgePointInput("Từ vựng gia đình", "hoeren", "wortschatz"),
                new KnowledgePointInput("   ", null, null),          // blank → dropped
                new KnowledgePointInput("Sở hữu cách", null, "grammatik"));

        service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("Lektion 1", null, null, null, null, pts, null));

        verify(knowledgePointRepository).deleteByLessonId(LESSON_ID);
        ArgumentCaptor<List<LessonKnowledgePoint>> rowsCap = ArgumentCaptor.forClass(List.class);
        verify(knowledgePointRepository).saveAll(rowsCap.capture());
        List<LessonKnowledgePoint> rows = rowsCap.getValue();
        assertThat(rows).hasSize(2); // blank dropped
        assertThat(rows.get(0).getText()).isEqualTo("Từ vựng gia đình");
        assertThat(rows.get(0).getSkillTag()).isEqualTo("HOEREN");     // normalized upper-case
        assertThat(rows.get(0).getContentTag()).isEqualTo("WORTSCHATZ");
        assertThat(rows.get(0).getOrderIndex()).isZero();
        assertThat(rows.get(1).getText()).isEqualTo("Sở hữu cách");
        assertThat(rows.get(1).getOrderIndex()).isEqualTo(1);         // 0-based, re-sequenced

        ArgumentCaptor<ClassLesson> lessonCap = ArgumentCaptor.forClass(ClassLesson.class);
        verify(lessonRepository).save(lessonCap.capture());
        assertThat(lessonCap.getValue().getDescription()).isEqualTo("Từ vựng gia đình\nSở hữu cách");
    }

    @Test
    @DisplayName("create rejects an unknown skill tag on a knowledge point")
    void create_rejectsInvalidSkillTag() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(-1);
        when(lessonRepository.save(any())).thenAnswer(inv -> {
            ClassLesson l = inv.getArgument(0);
            l.setId(LESSON_ID);
            return l;
        });

        assertThatThrownBy(() -> service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("X", null, null, null, null,
                        List.of(new KnowledgePointInput("pt", "NOPE", null)), null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("create persists can-do statements with normalized CEFR + skill tag, blanks dropped")
    @SuppressWarnings("unchecked")
    void create_persistsCanDoStatements() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(-1);
        when(lessonRepository.save(any())).thenAnswer(inv -> {
            ClassLesson l = inv.getArgument(0);
            l.setId(LESSON_ID);
            return l;
        });

        List<CanDoStatementInput> canDos = List.of(
                new CanDoStatementInput(null, "Ich kann mich vorstellen.", "a1", "sprechen"),
                new CanDoStatementInput(null, "   ", null, null),               // blank → dropped
                new CanDoStatementInput(null, "Ich kann einen kurzen Text verstehen.", null, null));

        service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("Lektion 1", null, null, null, null, null, canDos));

        // A fresh lesson has nothing to remove — and nothing is blanket-deleted any more.
        verify(canDoRepository, never()).deleteByLessonId(any());
        verify(canDoRepository, never()).deleteAll(any());
        ArgumentCaptor<List<CanDoStatement>> cap = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository).saveAll(cap.capture());
        List<CanDoStatement> rows = cap.getValue();
        assertThat(rows).hasSize(2);                                            // blank dropped
        assertThat(rows.get(0).getText()).isEqualTo("Ich kann mich vorstellen.");
        assertThat(rows.get(0).getCefrLevel()).isEqualTo("A1");                 // normalized
        assertThat(rows.get(0).getSkillTag()).isEqualTo("SPRECHEN");            // normalized
        assertThat(rows.get(0).getOrderIndex()).isZero();
        assertThat(rows.get(1).getOrderIndex()).isEqualTo(1);                   // 0-based re-sequenced
    }

    /**
     * The audit bug: every save deleted the lesson's can-do statements and re-inserted them, so each
     * one came back with a NEW id. student_competency references can_do_statement ON DELETE CASCADE
     * (V256), so fixing a typo silently erased the whole class's competency ledger — self-assessments
     * and grading-derived rows alike. Editing a statement must keep its id.
     */
    @Test
    @DisplayName("update: editing a can-do keeps its id (student_competency survives the cascade)")
    @SuppressWarnings("unchecked")
    void update_editingCanDo_preservesId() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CanDoStatement saved = CanDoStatement.builder()
                .id(77L).lessonId(LESSON_ID).orderIndex(0)
                .text("Ich kann mich vorstelen.")        // typo the teacher is about to fix
                .cefrLevel("A1").skillTag("SPRECHEN").build();
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(saved));

        service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, null, null, null, null, null, null, null, null,
                        List.of(new CanDoStatementInput(77L, "Ich kann mich vorstellen.", "a1", "sprechen"))));

        // Nothing removed: the statement is still there, just corrected.
        verify(canDoRepository, never()).deleteByLessonId(any());
        verify(canDoRepository, never()).deleteAll(any());

        ArgumentCaptor<List<CanDoStatement>> cap = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository).saveAll(cap.capture());
        List<CanDoStatement> rows = cap.getValue();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getId()).isEqualTo(77L);   // ← the whole point: same row, no cascade
        assertThat(rows.get(0).getText()).isEqualTo("Ich kann mich vorstellen.");
    }

    @Test
    @DisplayName("update: a can-do the client stops sending is deleted; the others keep their ids")
    @SuppressWarnings("unchecked")
    void update_removedCanDo_isDeleted_othersKeepIds() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CanDoStatement keep = CanDoStatement.builder()
                .id(1L).lessonId(LESSON_ID).orderIndex(0).text("Behalten").build();
        CanDoStatement drop = CanDoStatement.builder()
                .id(2L).lessonId(LESSON_ID).orderIndex(1).text("Entfernen").build();
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(keep, drop));

        service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, null, null, null, null, null, null, null, null,
                        List.of(
                                new CanDoStatementInput(1L, "Behalten", null, null),
                                new CanDoStatementInput(null, "Ganz neu", null, null))));

        ArgumentCaptor<List<CanDoStatement>> delCap = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository).deleteAll(delCap.capture());
        assertThat(delCap.getValue()).extracting(CanDoStatement::getId).containsExactly(2L);

        ArgumentCaptor<List<CanDoStatement>> cap = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository).saveAll(cap.capture());
        List<CanDoStatement> rows = cap.getValue();
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).getId()).isEqualTo(1L);    // survivor keeps its id
        assertThat(rows.get(1).getId()).isNull();         // brand-new row
        assertThat(rows.get(1).getOrderIndex()).isEqualTo(1);
    }

    @Test
    @DisplayName("update: an id from another lesson is not trusted — it is inserted as a new row")
    @SuppressWarnings("unchecked")
    void update_foreignCanDoId_isNotAdopted() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of());

        // id 999 belongs to some other lesson (possibly another teacher's class) — must not be re-homed.
        service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, null, null, null, null, null, null, null, null,
                        List.of(new CanDoStatementInput(999L, "Ich kann X.", null, null))));

        ArgumentCaptor<List<CanDoStatement>> cap = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository).saveAll(cap.capture());
        assertThat(cap.getValue()).hasSize(1);
        assertThat(cap.getValue().get(0).getId()).isNull();               // inserted, not adopted
        assertThat(cap.getValue().get(0).getLessonId()).isEqualTo(LESSON_ID);
    }

    @Test
    @DisplayName("update with null canDoStatements leaves existing can-dos untouched (no delete)")
    void update_nullCanDos_leavesUntouched() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, true, null, null, null, null, null, null, null, null));

        verify(canDoRepository, never()).deleteByLessonId(any());
        verify(canDoRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("update with an empty canDoStatements list clears all can-dos (delete, no insert)")
    @SuppressWarnings("unchecked")
    void update_emptyCanDos_clears() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder()
                .id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CanDoStatement existing = CanDoStatement.builder()
                .id(3L).lessonId(LESSON_ID).orderIndex(0).text("Weg damit").build();
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(existing));

        service.update(TEACHER_ID, CLASS_ID, LESSON_ID,
                new UpdateLessonRequest(null, null, null, null, null, null, null, null, null, null, List.of()));

        // Sending [] still means "clear them all" — the rows are gone, so the cascade to
        // student_competency is correct here (the targets no longer exist).
        ArgumentCaptor<List<CanDoStatement>> delCap = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository).deleteAll(delCap.capture());
        assertThat(delCap.getValue()).extracting(CanDoStatement::getId).containsExactly(3L);
        verify(canDoRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("create tolerates a null array element in knowledgePoints/canDoStatements (no NPE/500, null dropped)")
    @SuppressWarnings("unchecked")
    void create_toleratesNullListElements() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(-1);
        when(lessonRepository.save(any())).thenAnswer(inv -> {
            ClassLesson l = inv.getArgument(0);
            l.setId(LESSON_ID);
            return l;
        });

        // List.of() rejects null → use ArrayList to inject the malformed null element.
        List<KnowledgePointInput> pts = new java.util.ArrayList<>();
        pts.add(new KnowledgePointInput("Gültig", null, null));
        pts.add(null);
        List<CanDoStatementInput> canDos = new java.util.ArrayList<>();
        canDos.add(null);
        canDos.add(new CanDoStatementInput(null, "Ich kann X.", null, null));

        // Must not throw (was NPE → HTTP 500 before the null-element guard).
        service.create(TEACHER_ID, CLASS_ID,
                new CreateLessonRequest("Lektion", null, null, null, null, pts, canDos));

        ArgumentCaptor<List<LessonKnowledgePoint>> kpCap = ArgumentCaptor.forClass(List.class);
        verify(knowledgePointRepository).saveAll(kpCap.capture());
        assertThat(kpCap.getValue()).hasSize(1);        // null element dropped
        ArgumentCaptor<List<CanDoStatement>> cdCap = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository).saveAll(cdCap.capture());
        assertThat(cdCap.getValue()).hasSize(1);        // null element dropped
    }

    @Test
    @DisplayName("listForStudent falls back to description-parsed points when the sub-table is empty")
    void listForStudent_fallsBackToDescription() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        ClassLesson a = ClassLesson.builder()
                .id(1L).classId(CLASS_ID).orderIndex(0).title("A")
                .description("Chào hỏi\n- Giới thiệu").build();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(a));

        List<ClassLessonDto> out = service.listForStudent(STUDENT_ID, CLASS_ID);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).knowledgePoints())
                .extracting(KnowledgePointDto::text)
                .containsExactly("Chào hỏi", "Giới thiệu"); // bullet stripped, order preserved
    }

    @Test
    @DisplayName("listForStudent returns sub-table points (with tags) over the description fallback")
    void listForStudent_prefersSubTable() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
        ClassLesson a = ClassLesson.builder()
                .id(1L).classId(CLASS_ID).orderIndex(0).title("A").description("legacy text").build();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(a));
        LessonKnowledgePoint p = LessonKnowledgePoint.builder()
                .id(9L).lessonId(1L).orderIndex(0).text("Từ vựng").skillTag("HOEREN").contentTag("WORTSCHATZ").build();
        when(knowledgePointRepository.findByLessonIdInOrderByLessonIdAscOrderIndexAsc(List.of(1L)))
                .thenReturn(List.of(p));

        List<ClassLessonDto> out = service.listForStudent(STUDENT_ID, CLASS_ID);

        assertThat(out.get(0).knowledgePoints()).hasSize(1);
        assertThat(out.get(0).knowledgePoints().get(0).text()).isEqualTo("Từ vựng");
        assertThat(out.get(0).knowledgePoints().get(0).skillTag()).isEqualTo("HOEREN");
    }

    @Test
    @DisplayName("assignModule sets moduleId when the module belongs to the same class")
    void assignModule_setsModule() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder().id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(moduleRepository.existsByIdAndClassId(7L, CLASS_ID)).thenReturn(true);
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClassLessonDto dto = service.assignModule(TEACHER_ID, CLASS_ID, LESSON_ID, 7L);

        assertThat(dto.moduleId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("assignModule rejects a module from a different class")
    void assignModule_rejectsForeignModule() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder().id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(moduleRepository.existsByIdAndClassId(99L, CLASS_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.assignModule(TEACHER_ID, CLASS_ID, LESSON_ID, 99L))
                .isInstanceOf(BadRequestException.class);
        verify(lessonRepository, never()).save(any());
    }

    @Test
    @DisplayName("assignModule with null moduleId ungroups the lesson (no module check)")
    void assignModule_ungroups() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson l = ClassLesson.builder().id(LESSON_ID).classId(CLASS_ID).orderIndex(0).title("X").moduleId(7L).completed(false).build();
        when(lessonRepository.findById(LESSON_ID)).thenReturn(java.util.Optional.of(l));
        when(lessonRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClassLessonDto dto = service.assignModule(TEACHER_ID, CLASS_ID, LESSON_ID, null);

        assertThat(dto.moduleId()).isNull();
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
    @DisplayName("reorder rejects a duplicate id that omits another (same length) without corrupting orderIndex")
    void reorder_rejectsDuplicatePermutation() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
        ClassLesson a = ClassLesson.builder().id(1L).classId(CLASS_ID).orderIndex(0).title("A").build();
        ClassLesson b = ClassLesson.builder().id(2L).classId(CLASS_ID).orderIndex(1).title("B").build();
        ClassLesson c = ClassLesson.builder().id(3L).classId(CLASS_ID).orderIndex(2).title("C").build();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(a, b, c));

        // [1,2,2] is same length + only known ids, but not a permutation (omits 3): must be rejected.
        assertThatThrownBy(() -> service.reorder(TEACHER_ID, CLASS_ID,
                new ReorderLessonsRequest(List.of(1L, 2L, 2L))))
                .isInstanceOf(BadRequestException.class);
        assertThat(c.getOrderIndex()).isEqualTo(2);
        verify(lessonRepository, never()).save(any());
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
