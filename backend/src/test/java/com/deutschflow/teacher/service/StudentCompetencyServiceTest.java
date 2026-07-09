package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.SetCompetencyRequest;
import com.deutschflow.teacher.dto.StudentCompetencyDto;
import com.deutschflow.teacher.entity.CanDoStatement;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.StudentCompetency;
import com.deutschflow.teacher.repository.CanDoStatementRepository;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.StudentCompetencyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentCompetencyServiceTest {

    @Mock private StudentCompetencyRepository competencyRepository;
    @Mock private CanDoStatementRepository canDoRepository;
    @Mock private ClassLessonRepository lessonRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private ClassAssignmentRepository assignmentRepository;

    private StudentCompetencyService service;

    private static final Long STUDENT_ID = 200L;
    private static final Long CLASS_ID = 10L;
    private static final Long LESSON_ID = 1L;
    private static final Long CAN_DO_ID = 50L;
    private static final Long ASSIGNMENT_ID = 500L;

    @BeforeEach
    void setUp() {
        service = new StudentCompetencyService(
                competencyRepository, canDoRepository, lessonRepository, classStudentRepository,
                assignmentRepository);
    }

    private void enrolled() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(true);
    }

    private ClassLesson lesson(Long classId) {
        return ClassLesson.builder().id(LESSON_ID).classId(classId).orderIndex(0).title("Lektion").build();
    }

    private CanDoStatement canDo(Long lessonId) {
        return CanDoStatement.builder().id(CAN_DO_ID).lessonId(lessonId).orderIndex(0).text("Ich kann X.").build();
    }

    // ── getForClass ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("getForClass rejects a non-enrolled student")
    void getForClass_notEnrolled_throwsNotFound() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.getForClass(STUDENT_ID, CLASS_ID)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("getForClass returns only the student's rows scoped to this class's can-dos")
    void getForClass_returnsScopedRows() {
        enrolled();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(lesson(CLASS_ID)));
        when(canDoRepository.findByLessonIdInOrderByLessonIdAscOrderIndexAsc(List.of(LESSON_ID)))
                .thenReturn(List.of(canDo(LESSON_ID)));
        when(competencyRepository.findByStudentIdAndCanDoStatementIdIn(STUDENT_ID, List.of(CAN_DO_ID)))
                .thenReturn(List.of(StudentCompetency.builder()
                        .studentId(STUDENT_ID).canDoStatementId(CAN_DO_ID).status("MASTERED").source("SELF").build()));

        List<StudentCompetencyDto> out = service.getForClass(STUDENT_ID, CLASS_ID);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).canDoStatementId()).isEqualTo(CAN_DO_ID);
        assertThat(out.get(0).status()).isEqualTo("MASTERED");
    }

    @Test
    @DisplayName("getForClass returns empty when the class has no can-dos")
    void getForClass_noCanDos_returnsEmpty() {
        enrolled();
        when(lessonRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of());

        assertThat(service.getForClass(STUDENT_ID, CLASS_ID)).isEmpty();
        verify(competencyRepository, never()).findByStudentIdAndCanDoStatementIdIn(any(), any());
    }

    // ── setSelfAssessment ───────────────────────────────────────────────────

    @Test
    @DisplayName("setSelfAssessment inserts a new row (normalized status, source=SELF)")
    void setSelfAssessment_newRow_inserts() {
        enrolled();
        when(canDoRepository.findById(CAN_DO_ID)).thenReturn(Optional.of(canDo(LESSON_ID)));
        when(lessonRepository.findById(LESSON_ID)).thenReturn(Optional.of(lesson(CLASS_ID)));
        when(competencyRepository.findByStudentIdAndCanDoStatementId(STUDENT_ID, CAN_DO_ID)).thenReturn(Optional.empty());
        when(competencyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StudentCompetencyDto dto = service.setSelfAssessment(STUDENT_ID, CLASS_ID, CAN_DO_ID,
                new SetCompetencyRequest("mastered"));

        assertThat(dto.status()).isEqualTo("MASTERED");
        ArgumentCaptor<StudentCompetency> cap = ArgumentCaptor.forClass(StudentCompetency.class);
        verify(competencyRepository).save(cap.capture());
        assertThat(cap.getValue().getStudentId()).isEqualTo(STUDENT_ID);
        assertThat(cap.getValue().getCanDoStatementId()).isEqualTo(CAN_DO_ID);
        assertThat(cap.getValue().getStatus()).isEqualTo("MASTERED");
        assertThat(cap.getValue().getSource()).isEqualTo("SELF");
    }

    @Test
    @DisplayName("setSelfAssessment updates an existing row in place")
    void setSelfAssessment_existingRow_updates() {
        enrolled();
        when(canDoRepository.findById(CAN_DO_ID)).thenReturn(Optional.of(canDo(LESSON_ID)));
        when(lessonRepository.findById(LESSON_ID)).thenReturn(Optional.of(lesson(CLASS_ID)));
        StudentCompetency existing = StudentCompetency.builder()
                .id(9L).studentId(STUDENT_ID).canDoStatementId(CAN_DO_ID).status("NOT_STARTED").source("SELF").build();
        when(competencyRepository.findByStudentIdAndCanDoStatementId(STUDENT_ID, CAN_DO_ID)).thenReturn(Optional.of(existing));
        when(competencyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.setSelfAssessment(STUDENT_ID, CLASS_ID, CAN_DO_ID, new SetCompetencyRequest("IN_PROGRESS"));

        assertThat(existing.getStatus()).isEqualTo("IN_PROGRESS"); // mutated in place, not a new row
    }

    @Test
    @DisplayName("setSelfAssessment rejects a can-do from a different class (cross-class guard)")
    void setSelfAssessment_canDoFromOtherClass_throwsForbidden() {
        enrolled();
        when(canDoRepository.findById(CAN_DO_ID)).thenReturn(Optional.of(canDo(LESSON_ID)));
        when(lessonRepository.findById(LESSON_ID)).thenReturn(Optional.of(lesson(999L))); // other class

        assertThatThrownBy(() -> service.setSelfAssessment(STUDENT_ID, CLASS_ID, CAN_DO_ID,
                new SetCompetencyRequest("MASTERED")))
                .isInstanceOf(ForbiddenException.class);
        verify(competencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("setSelfAssessment rejects an unknown status value")
    void setSelfAssessment_invalidStatus_throwsBadRequest() {
        enrolled();

        assertThatThrownBy(() -> service.setSelfAssessment(STUDENT_ID, CLASS_ID, CAN_DO_ID,
                new SetCompetencyRequest("SUPER")))
                .isInstanceOf(BadRequestException.class);
        verify(competencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("setSelfAssessment rejects a non-enrolled student")
    void setSelfAssessment_notEnrolled_throwsNotFound() {
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, STUDENT_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.setSelfAssessment(STUDENT_ID, CLASS_ID, CAN_DO_ID,
                new SetCompetencyRequest("MASTERED")))
                .isInstanceOf(NotFoundException.class);
        verify(competencyRepository, never()).save(any());
    }

    // ── applyGradingResult (Phase 2b, source=GRADING) ─────────────────────────

    private CanDoStatement canDoTagged(Long id, String skillTag) {
        return CanDoStatement.builder().id(id).lessonId(LESSON_ID).orderIndex(0).skillTag(skillTag).text("Ich kann X.").build();
    }

    private ClassAssignment classAssignment(Long lessonId, String skill) {
        return ClassAssignment.builder().id(ASSIGNMENT_ID).classId(CLASS_ID).topic("T").lessonId(lessonId).skill(skill).build();
    }

    @Test
    @DisplayName("applyGradingResult no-ops on a null score (manual EVALUATED with no numeric grade)")
    void applyGradingResult_nullScore_noOp() {
        service.applyGradingResult(STUDENT_ID, ASSIGNMENT_ID, null);
        verifyNoInteractions(assignmentRepository, canDoRepository, competencyRepository);
    }

    @Test
    @DisplayName("applyGradingResult no-ops when the assignment is not linked to a lesson")
    void applyGradingResult_unlinkedAssignment_noOp() {
        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(classAssignment(null, "LESEN")));
        service.applyGradingResult(STUDENT_ID, ASSIGNMENT_ID, 90);
        verifyNoInteractions(canDoRepository);
        verify(competencyRepository, never()).save(any());
    }

    @Test
    @DisplayName("applyGradingResult marks a lesson's can-do MASTERED at score >= 80 (source=GRADING, new row)")
    void applyGradingResult_score80_marksMastered() {
        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(classAssignment(LESSON_ID, null)));
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(canDoTagged(CAN_DO_ID, null)));
        when(competencyRepository.findByStudentIdAndCanDoStatementIdIn(STUDENT_ID, List.of(CAN_DO_ID))).thenReturn(List.of());
        when(competencyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.applyGradingResult(STUDENT_ID, ASSIGNMENT_ID, 80);

        ArgumentCaptor<StudentCompetency> cap = ArgumentCaptor.forClass(StudentCompetency.class);
        verify(competencyRepository).save(cap.capture());
        assertThat(cap.getValue().getStatus()).isEqualTo("MASTERED");
        assertThat(cap.getValue().getSource()).isEqualTo("GRADING");
        assertThat(cap.getValue().getCanDoStatementId()).isEqualTo(CAN_DO_ID);
    }

    @Test
    @DisplayName("applyGradingResult routes by skill: HOREN grade normalizes to HOEREN, untagged is lesson-wide, other skills skipped")
    void applyGradingResult_skillRouting_normalizesHoren() {
        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(classAssignment(LESSON_ID, "HOREN")));
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(
                canDoTagged(51L, "HOEREN"),   // matches HOREN→HOEREN
                canDoTagged(52L, "LESEN"),    // different skill → skipped
                canDoTagged(53L, null)));     // untagged → lesson-wide, always included
        when(competencyRepository.findByStudentIdAndCanDoStatementIdIn(eq(STUDENT_ID), any())).thenReturn(List.of());
        when(competencyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.applyGradingResult(STUDENT_ID, ASSIGNMENT_ID, 90);

        // LESEN (52) is filtered out BEFORE the batch lookup — only the HOEREN + untagged can-dos are looked up…
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Long>> idsCap = ArgumentCaptor.forClass(List.class);
        verify(competencyRepository).findByStudentIdAndCanDoStatementIdIn(eq(STUDENT_ID), idsCap.capture());
        assertThat(idsCap.getValue()).containsExactlyInAnyOrder(51L, 53L);
        // …and only those two are written.
        ArgumentCaptor<StudentCompetency> cap = ArgumentCaptor.forClass(StudentCompetency.class);
        verify(competencyRepository, times(2)).save(cap.capture());
        assertThat(cap.getAllValues()).extracting(StudentCompetency::getCanDoStatementId)
                .containsExactlyInAnyOrder(51L, 53L);
    }

    @Test
    @DisplayName("applyGradingResult is upgrade-only: a lower grade never downgrades an existing MASTERED (protects SELF)")
    void applyGradingResult_upgradeOnly_neverDowngrades() {
        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(classAssignment(LESSON_ID, null)));
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(canDoTagged(CAN_DO_ID, null)));
        StudentCompetency existing = StudentCompetency.builder()
                .studentId(STUDENT_ID).canDoStatementId(CAN_DO_ID).status("MASTERED").source("SELF").build();
        when(competencyRepository.findByStudentIdAndCanDoStatementIdIn(STUDENT_ID, List.of(CAN_DO_ID)))
                .thenReturn(List.of(existing));

        service.applyGradingResult(STUDENT_ID, ASSIGNMENT_ID, 60); // score 60 → IN_PROGRESS (rank below MASTERED)

        verify(competencyRepository, never()).save(any());        // no downgrade write
        assertThat(existing.getStatus()).isEqualTo("MASTERED");   // student's self-assessment preserved
        assertThat(existing.getSource()).isEqualTo("SELF");
    }

    @Test
    @DisplayName("applyGradingResult: a GENERAL (non-skill) assignment marks ONLY untagged can-dos, never skill-tagged ones")
    void applyGradingResult_generalAssignment_onlyUntagged() {
        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(classAssignment(LESSON_ID, "GENERAL")));
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(
                canDoTagged(51L, "HOEREN"),   // skill-tagged → a GENERAL grade must NOT touch it
                canDoTagged(53L, null)));     // untagged → lesson-wide, marked
        when(competencyRepository.findByStudentIdAndCanDoStatementIdIn(eq(STUDENT_ID), any())).thenReturn(List.of());
        when(competencyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.applyGradingResult(STUDENT_ID, ASSIGNMENT_ID, 90);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Long>> idsCap = ArgumentCaptor.forClass(List.class);
        verify(competencyRepository).findByStudentIdAndCanDoStatementIdIn(eq(STUDENT_ID), idsCap.capture());
        assertThat(idsCap.getValue()).containsExactly(53L);       // only the untagged can-do, NOT the HOEREN one
        ArgumentCaptor<StudentCompetency> cap = ArgumentCaptor.forClass(StudentCompetency.class);
        verify(competencyRepository).save(cap.capture());
        assertThat(cap.getValue().getCanDoStatementId()).isEqualTo(53L);
    }

    @Test
    @DisplayName("applyGradingResult: a lower re-grade DOWNGRADES a prior GRADING row (teacher correction, latest grade wins)")
    void applyGradingResult_regradeGrading_downgrades() {
        when(assignmentRepository.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(classAssignment(LESSON_ID, null)));
        when(canDoRepository.findByLessonIdOrderByOrderIndexAsc(LESSON_ID)).thenReturn(List.of(canDoTagged(CAN_DO_ID, null)));
        StudentCompetency prior = StudentCompetency.builder()
                .studentId(STUDENT_ID).canDoStatementId(CAN_DO_ID).status("MASTERED").source("GRADING").build();
        when(competencyRepository.findByStudentIdAndCanDoStatementIdIn(STUDENT_ID, List.of(CAN_DO_ID))).thenReturn(List.of(prior));
        when(competencyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.applyGradingResult(STUDENT_ID, ASSIGNMENT_ID, 45); // → IN_PROGRESS

        verify(competencyRepository).save(prior);
        assertThat(prior.getStatus()).isEqualTo("IN_PROGRESS");   // a prior GRADING row is overwritten downward
        assertThat(prior.getSource()).isEqualTo("GRADING");
    }
}
