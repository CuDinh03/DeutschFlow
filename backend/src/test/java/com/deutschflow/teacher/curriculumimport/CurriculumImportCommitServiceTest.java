package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitRequest;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportCommitResult;
import com.deutschflow.teacher.curriculumimport.dto.DraftCanDoStatement;
import com.deutschflow.teacher.curriculumimport.dto.DraftKnowledgePoint;
import com.deutschflow.teacher.curriculumimport.dto.DraftLesson;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.deutschflow.teacher.entity.CanDoStatement;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.CurriculumModule;
import com.deutschflow.teacher.entity.LessonKnowledgePoint;
import com.deutschflow.teacher.repository.CanDoStatementRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.CurriculumModuleRepository;
import com.deutschflow.teacher.repository.LessonKnowledgePointRepository;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Writing the approved draft.
 *
 * <p>The properties under test are the ones a teacher's work depends on: nothing existing is ever
 * touched, a retry cannot double-import, and a name clash is reported rather than resolved silently.
 */
@ExtendWith(MockitoExtension.class)
class CurriculumImportCommitServiceTest {

    @Mock private CurriculumModuleRepository moduleRepository;
    @Mock private ClassLessonRepository lessonRepository;
    @Mock private LessonKnowledgePointRepository pointRepository;
    @Mock private CanDoStatementRepository canDoRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private CurriculumImportCommitRepository commitRepository;
    @Mock private com.deutschflow.material.service.MaterialService materialService;

    private CurriculumImportCommitService service;
    private CurriculumImportWriter writer;

    private static final Long TEACHER_ID = 100L;
    private static final Long CLASS_ID = 10L;
    private static final Long MATERIAL_ID = 55L;

    private final AtomicLong moduleIds = new AtomicLong(1000);
    private final AtomicLong lessonIds = new AtomicLong(2000);

    private User teacher;

    @BeforeEach
    void setUp() {
        writer = new CurriculumImportWriter(
                moduleRepository, lessonRepository, pointRepository, canDoRepository,
                commitRepository, new ObjectMapper());
        service = new CurriculumImportCommitService(
                moduleRepository, classTeacherRepository, commitRepository, writer,
                materialService, new DraftValidator(), new ObjectMapper());

        teacher = new User();
        teacher.setId(TEACHER_ID);

        lenient().when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID))
                .thenReturn(true);
        lenient().when(commitRepository.findByClassIdAndIdempotencyKey(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        lenient().when(moduleRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID))
                .thenReturn(List.of());
        lenient().when(moduleRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(-1);
        lenient().when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(-1);
        lenient().when(moduleRepository.save(any(CurriculumModule.class))).thenAnswer(inv -> {
            CurriculumModule m = inv.getArgument(0);
            if (m.getId() == null) m.setId(moduleIds.incrementAndGet());
            return m;
        });
        lenient().when(lessonRepository.save(any(ClassLesson.class))).thenAnswer(inv -> {
            ClassLesson l = inv.getArgument(0);
            if (l.getId() == null) l.setId(lessonIds.incrementAndGet());
            return l;
        });
        lenient().when(commitRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ── Fixtures ────────────────────────────────────────────────────────────

    private static DraftLesson lesson(String title) {
        return new DraftLesson("c-" + title, title, "A1", 4, null, 8, 12,
                List.of(new DraftKnowledgePoint("Zahlen", "SPRECHEN", "WORTSCHATZ"),
                        new DraftKnowledgePoint("Länder", null, "WORTSCHATZ")),
                List.of(new DraftCanDoStatement("Ich kann zählen.", "A1", "SPRECHEN")));
    }

    private static DraftModule module(String title, String... lessonTitles) {
        List<DraftLesson> lessons = new ArrayList<>();
        for (String t : lessonTitles) lessons.add(lesson(t));
        return new DraftModule("cm-" + title, title, DraftModule.KIND_CHAPTER, 8, 17, lessons);
    }

    private CurriculumImportCommitRequest request(String key, List<DraftModule> modules) {
        return new CurriculumImportCommitRequest(MATERIAL_ID, key,
                CurriculumImportCommitRequest.ON_DUPLICATE_FAIL, modules);
    }

    // ── Happy path ──────────────────────────────────────────────────────────

    @Test
    void writesEveryModuleLessonKnowledgePointAndCanDo() {
        CurriculumImportCommitResult r = service.commit(teacher, CLASS_ID, request("k1", List.of(
                module("K01 – A", "K01.1", "K01.2", "K01.3"),
                module("K02 – B", "K02.1"))));

        assertThat(r.modulesCreated()).isEqualTo(2);
        assertThat(r.lessonsCreated()).isEqualTo(4);
        assertThat(r.replayed()).isFalse();
        assertThat(r.moduleIds()).hasSize(2);

        verify(moduleRepository, org.mockito.Mockito.times(2)).save(any(CurriculumModule.class));
        verify(lessonRepository, org.mockito.Mockito.times(4)).save(any(ClassLesson.class));

        ArgumentCaptor<List<LessonKnowledgePoint>> points = ArgumentCaptor.forClass(List.class);
        verify(pointRepository, org.mockito.Mockito.times(4)).saveAll(points.capture());
        assertThat(points.getAllValues()).allSatisfy(l -> assertThat(l).hasSize(2));

        ArgumentCaptor<List<CanDoStatement>> canDos = ArgumentCaptor.forClass(List.class);
        verify(canDoRepository, org.mockito.Mockito.times(4)).saveAll(canDos.capture());
        assertThat(canDos.getAllValues()).allSatisfy(l -> assertThat(l).hasSize(1));
    }

    @Test
    void newLessonsAreAppendedAfterTheClassesExistingOnes() {
        when(moduleRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(2);
        when(lessonRepository.findMaxOrderIndex(CLASS_ID)).thenReturn(6);

        service.commit(teacher, CLASS_ID, request("k1", List.of(module("K01 – A", "K01.1", "K01.2"))));

        ArgumentCaptor<ClassLesson> saved = ArgumentCaptor.forClass(ClassLesson.class);
        verify(lessonRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(ClassLesson::getOrderIndex).containsExactly(7, 8);

        ArgumentCaptor<CurriculumModule> savedModule = ArgumentCaptor.forClass(CurriculumModule.class);
        verify(moduleRepository).save(savedModule.capture());
        assertThat(savedModule.getValue().getOrderIndex()).isEqualTo(3);
    }

    @Test
    void lessonsCarryTheDraftsFieldsAndAreLinkedToTheirModule() {
        service.commit(teacher, CLASS_ID, request("k1", List.of(module("K01 – A", "K01.1"))));

        ArgumentCaptor<ClassLesson> saved = ArgumentCaptor.forClass(ClassLesson.class);
        verify(lessonRepository).save(saved.capture());
        ClassLesson l = saved.getValue();

        assertThat(l.getClassId()).isEqualTo(CLASS_ID);
        assertThat(l.getTitle()).isEqualTo("K01.1");
        assertThat(l.getCefrLevel()).isEqualTo("A1");
        assertThat(l.getEstimatedUnits()).isEqualTo(4);
        assertThat(l.getPlannedDate()).isNull();
        assertThat(l.isCompleted()).isFalse();
        assertThat(l.getModuleId()).isNotNull();
        // description mirrors the points, the way the lesson writer keeps it in sync
        assertThat(l.getDescription()).isEqualTo("Zahlen\nLänder");
    }

    @Test
    void checksTheMaterialTheImportClaimsToComeFrom() {
        service.commit(teacher, CLASS_ID, request("k1", List.of(module("K01 – A", "K01.1"))));

        verify(materialService).requireReadable(teacher, MATERIAL_ID);
    }

    // ── Permissions ─────────────────────────────────────────────────────────

    @Test
    void refusesAClassTheTeacherDoesNotTeach() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID,
                request("k1", List.of(module("K01 – A", "K01.1")))))
                .isInstanceOf(ForbiddenException.class);

        verify(moduleRepository, never()).save(any());
        verify(lessonRepository, never()).save(any());
    }

    @Test
    void writesNothingWhenTheMaterialIsNotAccessible() {
        org.mockito.Mockito.doThrow(new ForbiddenException("nope"))
                .when(materialService).requireReadable(teacher, MATERIAL_ID);

        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID,
                request("k1", List.of(module("K01 – A", "K01.1")))))
                .isInstanceOf(ForbiddenException.class);

        verify(moduleRepository, never()).save(any());
    }

    // ── Idempotency ─────────────────────────────────────────────────────────

    @Test
    void aRetryWithTheSameKeyReplaysTheOriginalResultAndWritesNothing() {
        CurriculumImportCommitResult original =
                new CurriculumImportCommitResult(16, 40, List.of(1L, 2L), List.of(), false);
        CurriculumImportCommitRecord record = CurriculumImportCommitRecord.builder()
                .classId(CLASS_ID).teacherId(TEACHER_ID).idempotencyKey("k1")
                .modulesCreated(16).lessonsCreated(40)
                .resultPayload(json(original))
                .build();
        when(commitRepository.findByClassIdAndIdempotencyKey(CLASS_ID, "k1"))
                .thenReturn(Optional.of(record));

        CurriculumImportCommitResult r = service.commit(teacher, CLASS_ID,
                request("k1", List.of(module("K01 – A", "K01.1"))));

        assertThat(r.replayed()).isTrue();
        assertThat(r.modulesCreated()).isEqualTo(16);
        assertThat(r.lessonsCreated()).isEqualTo(40);
        verify(moduleRepository, never()).save(any());
        verify(lessonRepository, never()).save(any());
    }

    @Test
    void aRaceOnTheSameKeyLosesTheInsertAndReplaysInsteadOfDoubleImporting() {
        // Two requests carrying one key reach the check together. The loser's write transaction dies
        // on the unique index; the orchestrator — which is deliberately OUTSIDE that transaction —
        // then reads the winner's row. Anything less would either 500 or import a second curriculum.
        CurriculumImportCommitResult winner =
                new CurriculumImportCommitResult(2, 4, List.of(9L), List.of(), false);
        when(commitRepository.save(any())).thenThrow(new DataIntegrityViolationException("dup"));
        when(commitRepository.findByClassIdAndIdempotencyKey(CLASS_ID, "k1"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(CurriculumImportCommitRecord.builder()
                        .classId(CLASS_ID).teacherId(TEACHER_ID).idempotencyKey("k1")
                        .modulesCreated(2).lessonsCreated(4)
                        .resultPayload(json(winner))
                        .build()));

        CurriculumImportCommitResult r = service.commit(teacher, CLASS_ID,
                request("k1", List.of(module("K01 – A", "K01.1"))));

        assertThat(r.replayed()).isTrue();
        assertThat(r.modulesCreated()).isEqualTo(2);
    }

    @Test
    void theWriterOwnsTheTransactionSoTheReplayReadHappensAfterTheRollback() throws Exception {
        // The orchestrator must NOT be transactional: a constraint violation marks the surrounding
        // transaction rollback-only, and a replay read inside it could never see the winner's row.
        assertThat(CurriculumImportCommitService.class
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class))
                .as("commit orchestrator must not carry its own transaction")
                .isNull();
        assertThat(CurriculumImportCommitService.class
                .getMethod("commit", com.deutschflow.user.entity.User.class, Long.class,
                        CurriculumImportCommitRequest.class)
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class))
                .isNull();
        assertThat(CurriculumImportWriter.class
                .getMethod("write", Long.class, Long.class, String.class, Long.class,
                        java.util.List.class, String.class)
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class))
                .as("the write itself must be one transaction")
                .isNotNull();
    }

    @Test
    void reportsTwoDraftModulesThatShareATitleRatherThanSilentlyRenamingOne() {
        // Hand-editing in the preview can leave two modules with the same name. Under "stop and
        // tell me", suffixing the second would be exactly the silent resolution the teacher declined.
        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID,
                request("k1", List.of(module("K01 – A", "K01.1"), module("K01 – A", "K01.2")))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("K01 – A");

        verify(moduleRepository, never()).save(any());
    }

    @Test
    void refusesAnIdempotencyKeyLongerThanTheColumnCanHold() {
        // Cột là VARCHAR(120). Không chặn ở đây thì Postgres ném 22001, bị catch bên dưới hiểu
        // nhầm thành "có người giành cùng khoá" và trả 409 sai hẳn nguyên nhân.
        String tooLong = "k".repeat(121);

        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID,
                request(tooLong, List.of(module("K01 – A", "K01.1")))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("120");

        verify(moduleRepository, never()).save(any());
    }

    @Test
    void aDataErrorThatIsNotAKeyClashSurfacesInsteadOfBecomingAFakeConflict() {
        // Vi phạm toàn vẹn KHÔNG phải do trùng khoá (FK/CHECK/quá dài…) không được đội lốt
        // "đang xử lý đồng thời" — che như vậy là giấu lỗi thật khỏi log và khỏi người dùng.
        DataIntegrityViolationException real = new DataIntegrityViolationException("check constraint bể");
        when(commitRepository.save(any())).thenThrow(real);
        when(commitRepository.findByClassIdAndIdempotencyKey(CLASS_ID, "k1"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID,
                request("k1", List.of(module("K01 – A", "K01.1")))))
                .isSameAs(real);
    }

    @Test
    void refusesACommitWithoutAnIdempotencyKey() {
        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID,
                request("  ", List.of(module("K01 – A", "K01.1")))))
                .isInstanceOf(BadRequestException.class);

        verify(moduleRepository, never()).save(any());
    }

    // ── Existing content is never touched ───────────────────────────────────

    @Test
    void reportsADuplicateModuleTitleInsteadOfOverwritingIt() {
        CurriculumModule existing = CurriculumModule.builder()
                .id(500L).classId(CLASS_ID).orderIndex(0).title("K01 – A").build();
        when(moduleRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(existing));

        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID,
                request("k1", List.of(module("K01 – A", "K01.1")))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("K01 – A");

        verify(moduleRepository, never()).save(any());
        verify(lessonRepository, never()).save(any());
    }

    @Test
    void skipsADuplicateModuleWhenTheTeacherChoseSkip() {
        CurriculumModule existing = CurriculumModule.builder()
                .id(500L).classId(CLASS_ID).orderIndex(0).title("K01 – A").build();
        when(moduleRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(existing));

        CurriculumImportCommitResult r = service.commit(teacher, CLASS_ID,
                new CurriculumImportCommitRequest(MATERIAL_ID, "k1",
                        CurriculumImportCommitRequest.ON_DUPLICATE_SKIP,
                        List.of(module("K01 – A", "K01.1"), module("K02 – B", "K02.1"))));

        assertThat(r.modulesCreated()).isEqualTo(1);
        assertThat(r.lessonsCreated()).isEqualTo(1);
        assertThat(r.skippedModuleTitles()).containsExactly("K01 – A");

        ArgumentCaptor<CurriculumModule> saved = ArgumentCaptor.forClass(CurriculumModule.class);
        verify(moduleRepository).save(saved.capture());
        assertThat(saved.getValue().getTitle()).isEqualTo("K02 – B");
    }

    @Test
    void renamesADuplicateModuleWhenTheTeacherChoseRename() {
        CurriculumModule existing = CurriculumModule.builder()
                .id(500L).classId(CLASS_ID).orderIndex(0).title("K01 – A").build();
        when(moduleRepository.findByClassIdOrderByOrderIndexAsc(CLASS_ID)).thenReturn(List.of(existing));

        CurriculumImportCommitResult r = service.commit(teacher, CLASS_ID,
                new CurriculumImportCommitRequest(MATERIAL_ID, "k1",
                        CurriculumImportCommitRequest.ON_DUPLICATE_RENAME,
                        List.of(module("K01 – A", "K01.1"))));

        assertThat(r.modulesCreated()).isEqualTo(1);
        ArgumentCaptor<CurriculumModule> saved = ArgumentCaptor.forClass(CurriculumModule.class);
        verify(moduleRepository).save(saved.capture());
        assertThat(saved.getValue().getTitle()).isNotEqualTo("K01 – A").startsWith("K01 – A");
    }

    @Test
    void rejectsADraftThatFailsValidationBeforeWritingAnything() {
        DraftModule bad = new DraftModule("m", "K01", "HOMEWORK", 1, 2, List.of(lesson("L")));

        assertThatThrownBy(() -> service.commit(teacher, CLASS_ID, request("k1", List.of(bad))))
                .isInstanceOf(BadRequestException.class);

        verify(moduleRepository, never()).save(any());
    }

    private static String json(CurriculumImportCommitResult r) {
        try {
            return new ObjectMapper().writeValueAsString(r);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
