package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.teacher.curriculumimport.dto.DraftCanDoStatement;
import com.deutschflow.teacher.curriculumimport.dto.DraftKnowledgePoint;
import com.deutschflow.teacher.curriculumimport.dto.DraftLesson;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The gate between an untrusted draft and the database.
 *
 * <p>A draft can reach commit having been round-tripped through a browser and edited by hand, and in
 * the OCR case its text originated inside an uploaded document. So the validator re-checks
 * everything the writer depends on rather than trusting the preview that produced it: tags against
 * the same whitelist {@code ClassLessonService} enforces, sizes against hard caps, and titles
 * against emptiness.
 */
class DraftValidatorTest {

    private final DraftValidator validator = new DraftValidator();

    private static DraftLesson lesson(String title, Integer units,
                                      List<DraftKnowledgePoint> points,
                                      List<DraftCanDoStatement> canDos) {
        return new DraftLesson("l1", title, "A1", units, null, 8, 17, points, canDos);
    }

    private static DraftModule module(List<DraftLesson> lessons) {
        return new DraftModule("m1", "K01 – Titel", DraftModule.KIND_CHAPTER, 8, 17, lessons);
    }

    private static List<DraftModule> oneLesson(DraftLesson l) {
        return List.of(module(List.of(l)));
    }

    private static final DraftKnowledgePoint OK_POINT =
            new DraftKnowledgePoint("Zahlen", "SPRECHEN", "WORTSCHATZ");
    private static final DraftCanDoStatement OK_CAN_DO =
            new DraftCanDoStatement("Ich kann zählen.", "A1", "SPRECHEN");

    @Test
    void acceptsAWellFormedDraftUnchanged() {
        List<DraftModule> out = validator.validate(oneLesson(
                lesson("K01.1 – Einstieg", 4, List.of(OK_POINT), List.of(OK_CAN_DO))));

        assertThat(out).hasSize(1);
        assertThat(out.get(0).lessons().get(0).title()).isEqualTo("K01.1 – Einstieg");
        assertThat(out.get(0).lessons().get(0).estimatedUnits()).isEqualTo(4);
    }

    @Test
    void rejectsASkillTagOutsideTheWhitelist() {
        assertThatThrownBy(() -> validator.validate(oneLesson(lesson(
                "K01.1", 4,
                List.of(new DraftKnowledgePoint("x", "SINGEN", "WORTSCHATZ")),
                List.of(OK_CAN_DO)))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("SINGEN");
    }

    @Test
    void rejectsAContentTagOutsideTheWhitelist() {
        assertThatThrownBy(() -> validator.validate(oneLesson(lesson(
                "K01.1", 4,
                List.of(new DraftKnowledgePoint("x", "LESEN", "HAUSAUFGABE")),
                List.of(OK_CAN_DO)))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("HAUSAUFGABE");
    }

    @Test
    void rejectsACefrLevelOutsideTheWhitelist() {
        DraftLesson bad = new DraftLesson("l", "K01.1", "A9", 4, null, 1, 2,
                List.of(OK_POINT), List.of(OK_CAN_DO));

        assertThatThrownBy(() -> validator.validate(oneLesson(bad)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAModuleKindOutsideTheWhitelist() {
        DraftModule bad = new DraftModule("m", "K01", "HOMEWORK", 1, 2,
                List.of(lesson("K01.1", 4, List.of(OK_POINT), List.of(OK_CAN_DO))));

        assertThatThrownBy(() -> validator.validate(List.of(bad)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsNonPositiveOrAbsurdEstimatedUnits() {
        assertThatThrownBy(() -> validator.validate(oneLesson(
                lesson("K01.1", 0, List.of(OK_POINT), List.of(OK_CAN_DO)))))
                .isInstanceOf(BadRequestException.class);

        assertThatThrownBy(() -> validator.validate(oneLesson(
                lesson("K01.1", 999, List.of(OK_POINT), List.of(OK_CAN_DO)))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsBlankTitles() {
        assertThatThrownBy(() -> validator.validate(oneLesson(
                lesson("   ", 4, List.of(OK_POINT), List.of(OK_CAN_DO)))))
                .isInstanceOf(BadRequestException.class);

        assertThatThrownBy(() -> validator.validate(List.of(
                new DraftModule("m", " ", DraftModule.KIND_CHAPTER, 1, 2,
                        List.of(lesson("K01.1", 4, List.of(OK_POINT), List.of(OK_CAN_DO)))))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAModuleWithNoLessons() {
        assertThatThrownBy(() -> validator.validate(List.of(module(List.of()))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAnEmptyDraft() {
        assertThatThrownBy(() -> validator.validate(List.of()))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> validator.validate(null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void normalisesWhitespaceAndTrimsOverlongTitles() {
        List<DraftModule> out = validator.validate(oneLesson(
                lesson("  K01.1   –    Einstieg  ", 4, List.of(
                        new DraftKnowledgePoint("  Zahlen   von  1–20 ", null, null)),
                        List.of(new DraftCanDoStatement(" Ich kann  zählen. ", "a1", "sprechen")))));

        DraftLesson l = out.get(0).lessons().get(0);
        assertThat(l.title()).isEqualTo("K01.1 – Einstieg");
        assertThat(l.knowledgePoints().get(0).text()).isEqualTo("Zahlen von 1–20");
        // Case is folded to the stored form so a hand-edited draft still matches the whitelist.
        assertThat(l.canDoStatements().get(0).cefrLevel()).isEqualTo("A1");
        assertThat(l.canDoStatements().get(0).skillTag()).isEqualTo("SPRECHEN");
        assertThat(l.canDoStatements().get(0).text()).isEqualTo("Ich kann zählen.");
    }

    @Test
    void dropsEmptyPointsAndStatementsInsteadOfWritingBlankRows() {
        List<DraftModule> out = validator.validate(oneLesson(lesson("K01.1", 4,
                new ArrayList<>(java.util.Arrays.asList(OK_POINT, new DraftKnowledgePoint("  ", null, null), null)),
                new ArrayList<>(java.util.Arrays.asList(OK_CAN_DO, new DraftCanDoStatement("", null, null))))));

        assertThat(out.get(0).lessons().get(0).knowledgePoints()).hasSize(1);
        assertThat(out.get(0).lessons().get(0).canDoStatements()).hasSize(1);
    }

    @Test
    void rejectsADraftLargerThanAnyRealCurriculum() {
        List<DraftModule> tooMany = new ArrayList<>();
        for (int i = 0; i < DraftValidator.MAX_MODULES + 1; i++) {
            tooMany.add(new DraftModule("m" + i, "M" + i, DraftModule.KIND_CHAPTER, 1, 2,
                    List.of(lesson("L", 4, List.of(OK_POINT), List.of(OK_CAN_DO)))));
        }

        assertThatThrownBy(() -> validator.validate(tooMany))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsAModuleWithMoreLessonsThanAnyRealChapter() {
        List<DraftLesson> tooMany = new ArrayList<>();
        for (int i = 0; i < DraftValidator.MAX_LESSONS_PER_MODULE + 1; i++) {
            tooMany.add(lesson("L" + i, 4, List.of(OK_POINT), List.of(OK_CAN_DO)));
        }

        assertThatThrownBy(() -> validator.validate(List.of(module(tooMany))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void capsPointsAndStatementsPerLesson() {
        List<DraftKnowledgePoint> manyPoints = new ArrayList<>();
        for (int i = 0; i < DraftValidator.MAX_POINTS_PER_LESSON + 5; i++) {
            manyPoints.add(new DraftKnowledgePoint("p" + i, null, null));
        }
        List<DraftCanDoStatement> manyCanDos = new ArrayList<>();
        for (int i = 0; i < DraftValidator.MAX_CAN_DO_PER_LESSON + 5; i++) {
            manyCanDos.add(new DraftCanDoStatement("Ich kann " + i + ".", "A1", null));
        }

        DraftLesson l = validator.validate(oneLesson(lesson("K01.1", 4, manyPoints, manyCanDos)))
                .get(0).lessons().get(0);

        assertThat(l.knowledgePoints()).hasSize(DraftValidator.MAX_POINTS_PER_LESSON);
        assertThat(l.canDoStatements()).hasSize(DraftValidator.MAX_CAN_DO_PER_LESSON);
    }

    @Test
    void keepsPlannedDateWithinTheSameBoundsTheLessonWriterAccepts() {
        DraftLesson tooEarly = new DraftLesson("l", "K01.1", "A1", 4,
                java.time.LocalDate.of(1899, 1, 1), 1, 2, List.of(OK_POINT), List.of(OK_CAN_DO));

        assertThatThrownBy(() -> validator.validate(oneLesson(tooEarly)))
                .isInstanceOf(BadRequestException.class);
    }
}
