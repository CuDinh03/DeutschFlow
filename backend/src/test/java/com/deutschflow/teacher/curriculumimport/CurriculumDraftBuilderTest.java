package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportConfig;
import com.deutschflow.teacher.curriculumimport.dto.CurriculumImportPreview;
import com.deutschflow.teacher.curriculumimport.dto.DraftCanDoStatement;
import com.deutschflow.teacher.curriculumimport.dto.DraftKnowledgePoint;
import com.deutschflow.teacher.curriculumimport.dto.DraftLesson;
import com.deutschflow.teacher.curriculumimport.dto.DraftModule;
import com.deutschflow.teacher.curriculumimport.template.CurriculumTemplate;
import com.deutschflow.teacher.curriculumimport.template.TemplateUnit;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The draft builder is the whole feature's contract with the teacher: what the preview shows is
 * exactly what commit will write. It is deterministic and offline, so it is tested end-to-end
 * against the shipped template — including the headline numbers the centre plans around
 * (16 modules, 40 sessions, 160 teaching units).
 */
class CurriculumDraftBuilderTest {

    private static final Set<String> SKILL_TAGS = Set.of("HOEREN", "LESEN", "SCHREIBEN", "SPRECHEN");
    private static final Set<String> CONTENT_TAGS =
            Set.of("WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "LANDESKUNDE", "REDEMITTEL", "STRATEGIE");

    private CurriculumTemplateCatalog catalog;
    private CurriculumDraftBuilder builder;

    @BeforeEach
    void setUp() {
        catalog = new CurriculumTemplateCatalog(new ObjectMapper());
        builder = new CurriculumDraftBuilder();
    }

    private CurriculumImportPreview buildNetzwerk() {
        return builder.build(
                catalog.require("netzwerk-neu-a1"),
                new CurriculumImportConfig("netzwerk-neu-a1", 7L, null, null, null, null, null, null).normalized(),
                List.of(),
                "netzwerk-neu-a1-kursbuch.pdf");
    }

    // ── The headline plan ───────────────────────────────────────────────────

    @Test
    void netzwerkA1DefaultsProduce16ModulesAnd40Sessions() {
        CurriculumImportPreview p = buildNetzwerk();

        assertThat(p.modules()).hasSize(16);
        assertThat(p.modules().stream().mapToInt(m -> m.lessons().size()).sum()).isEqualTo(40);
        assertThat(p.detectedLevel()).isEqualTo("A1");
        assertThat(p.source()).isEqualTo(CurriculumImportPreview.SOURCE_TEMPLATE);
        assertThat(p.sourceMaterialId()).isEqualTo(7L);
    }

    @Test
    void chapterModulesGetThreeSessionsAndReviewModulesGetOne() {
        CurriculumImportPreview p = buildNetzwerk();

        List<DraftModule> chapters = p.modules().stream()
                .filter(m -> DraftModule.KIND_CHAPTER.equals(m.kind())).toList();
        List<DraftModule> reviews = p.modules().stream()
                .filter(m -> DraftModule.KIND_REVIEW.equals(m.kind())).toList();

        assertThat(chapters).hasSize(12).allSatisfy(m -> assertThat(m.lessons()).hasSize(3));
        assertThat(reviews).hasSize(4).allSatisfy(m -> assertThat(m.lessons()).hasSize(1));
    }

    @Test
    void everySessionCarriesTheConfiguredUnitsSoTheTotalIs160() {
        CurriculumImportPreview p = buildNetzwerk();

        List<DraftLesson> lessons = p.modules().stream().flatMap(m -> m.lessons().stream()).toList();

        assertThat(lessons).allSatisfy(l -> assertThat(l.estimatedUnits()).isEqualTo(4));
        assertThat(lessons.stream().mapToInt(DraftLesson::estimatedUnits).sum()).isEqualTo(160);
    }

    @Test
    void moduleTitlesAreNumberedAndOrdered() {
        List<String> titles = buildNetzwerk().modules().stream().map(DraftModule::title).toList();

        assertThat(titles.get(0)).isEqualTo("K01 – Guten Tag!");
        assertThat(titles.get(3)).isEqualTo("P01 – Plattform 1");
        assertThat(titles.get(15)).isEqualTo("P04 – Plattform 4");
        assertThat(titles.get(14)).isEqualTo("K12 – Ab in den Urlaub!");
    }

    @Test
    void lessonTitlesAreNumberedWithinTheirModule() {
        DraftModule first = buildNetzwerk().modules().get(0);

        assertThat(first.lessons()).extracting(DraftLesson::title)
                .allSatisfy(t -> assertThat(t).startsWith("K01."));
        assertThat(first.lessons().get(0).title()).startsWith("K01.1 – ");
        assertThat(first.lessons().get(2).title()).startsWith("K01.3 – ");
    }

    // ── Per-lesson content rules ────────────────────────────────────────────

    @Test
    void everyLessonHasThreeToSixKnowledgePointsWithWhitelistedTags() {
        for (DraftLesson l : allLessons()) {
            assertThat(l.knowledgePoints()).as("points of %s", l.title()).hasSizeBetween(3, 6);
            for (DraftKnowledgePoint kp : l.knowledgePoints()) {
                assertThat(kp.text()).isNotBlank();
                if (kp.skillTag() != null) assertThat(kp.skillTag()).isIn(SKILL_TAGS);
                if (kp.contentTag() != null) assertThat(kp.contentTag()).isIn(CONTENT_TAGS);
            }
        }
    }

    @Test
    void everyLessonHasTwoToFourGermanCanDoStatements() {
        for (DraftLesson l : allLessons()) {
            assertThat(l.canDoStatements()).as("can-dos of %s", l.title()).hasSizeBetween(2, 4);
            for (DraftCanDoStatement c : l.canDoStatements()) {
                assertThat(c.text()).as("can-do of %s", l.title()).startsWith("Ich kann ");
                assertThat(c.cefrLevel()).isEqualTo("A1");
                if (c.skillTag() != null) assertThat(c.skillTag()).isIn(SKILL_TAGS);
            }
        }
    }

    @Test
    void canDoStatementsAreNotVagueGrammarGoals() {
        // "Ich kann Grammatik lernen" is the spec's example of a target nobody can assess.
        for (DraftLesson l : allLessons()) {
            assertThat(l.canDoStatements()).extracting(DraftCanDoStatement::text)
                    .as("can-dos of %s", l.title())
                    .noneMatch(t -> t.equalsIgnoreCase("Ich kann Grammatik lernen."));
        }
    }

    @Test
    void everyLessonInheritsTheConfiguredCefrLevel() {
        assertThat(allLessons()).allSatisfy(l -> assertThat(l.cefrLevel()).isEqualTo("A1"));
    }

    @Test
    void plannedDateStaysNullWhenNoScheduleWasSupplied() {
        assertThat(allLessons()).allSatisfy(l -> assertThat(l.plannedDate()).isNull());
    }

    @Test
    void sessionsTakeTheClassScheduleDatesInOrderWhenSupplied() {
        List<LocalDate> dates = List.of(
                LocalDate.of(2026, 9, 7), LocalDate.of(2026, 9, 9), LocalDate.of(2026, 9, 11));

        CurriculumImportPreview p = builder.build(
                catalog.require("netzwerk-neu-a1"),
                new CurriculumImportConfig("netzwerk-neu-a1", 7L, null, null, null, null, null, null).normalized(),
                dates,
                "book.pdf");

        List<DraftLesson> lessons = p.modules().stream().flatMap(m -> m.lessons().stream()).toList();
        assertThat(lessons.get(0).plannedDate()).isEqualTo(LocalDate.of(2026, 9, 7));
        assertThat(lessons.get(1).plannedDate()).isEqualTo(LocalDate.of(2026, 9, 9));
        assertThat(lessons.get(2).plannedDate()).isEqualTo(LocalDate.of(2026, 9, 11));
        // Only three slots were known — the rest stay unscheduled rather than being invented.
        assertThat(lessons.get(3).plannedDate()).isNull();
        assertThat(p.warnings()).anyMatch(w -> w.contains("Lịch lớp"));
    }

    @Test
    void sourcePagesCoverTheBooksOwnNumbering() {
        DraftModule first = buildNetzwerk().modules().get(0);

        assertThat(first.sourcePageFrom()).isEqualTo(8);
        assertThat(first.sourcePageTo()).isEqualTo(17);
        assertThat(first.lessons()).allSatisfy(l -> {
            assertThat(l.sourcePageFrom()).isNotNull().isGreaterThanOrEqualTo(8);
            assertThat(l.sourcePageTo()).isNotNull().isLessThanOrEqualTo(17);
        });
    }

    @Test
    void clientIdsAreUniqueAcrossTheWholeDraft() {
        CurriculumImportPreview p = buildNetzwerk();
        List<String> ids = new java.util.ArrayList<>();
        p.modules().forEach(m -> {
            ids.add(m.clientId());
            m.lessons().forEach(l -> ids.add(l.clientId()));
        });
        assertThat(ids).doesNotHaveDuplicates().allSatisfy(id -> assertThat(id).isNotBlank());
    }

    // ── Configurability (must not be Netzwerk-specific) ─────────────────────

    @Test
    void sessionsPerChapterAndUnitsPerSessionAreHonoured() {
        CurriculumImportPreview p = builder.build(
                catalog.require("netzwerk-neu-a1"),
                new CurriculumImportConfig("netzwerk-neu-a1", 7L, "A1", 2, 3, true, null, null).normalized(),
                List.of(), "book.pdf");

        List<DraftModule> chapters = p.modules().stream()
                .filter(m -> DraftModule.KIND_CHAPTER.equals(m.kind())).toList();

        assertThat(chapters).allSatisfy(m -> assertThat(m.lessons()).hasSize(2));
        // 12 chapters × 2 + 4 reviews × 1
        assertThat(p.modules().stream().mapToInt(m -> m.lessons().size()).sum()).isEqualTo(28);
        assertThat(p.modules().stream().flatMap(m -> m.lessons().stream()))
                .allSatisfy(l -> assertThat(l.estimatedUnits()).isEqualTo(3));
    }

    @Test
    void reviewUnitsAreOmittedWhenSeparateReviewSessionsIsOff() {
        CurriculumImportPreview p = builder.build(
                catalog.require("netzwerk-neu-a1"),
                new CurriculumImportConfig("netzwerk-neu-a1", 7L, null, null, null, false, null, null).normalized(),
                List.of(), "book.pdf");

        assertThat(p.modules()).hasSize(12);
        assertThat(p.modules().stream().mapToInt(m -> m.lessons().size()).sum()).isEqualTo(36);
        assertThat(p.modules()).noneMatch(m -> DraftModule.KIND_REVIEW.equals(m.kind()));
    }

    @Test
    void aGoalPoorTemplateWarnsInsteadOfInventingCanDoStatements() {
        CurriculumTemplate thin = new CurriculumTemplate(
                "thin", "Thin book", "A2", 1, 3, 4,
                List.of(new TemplateUnit(1, "Nur ein Ziel", "CHAPTER", 4, 9,
                        List.of("etwas sagen"),
                        Map.of("WORTSCHATZ", List.of("W1", "W2", "W3"),
                               "GRAMMATIK", List.of("G1", "G2", "G3"),
                               "STRATEGIE", List.of("S1", "S2", "S3")))));

        CurriculumImportPreview p = builder.build(
                thin,
                new CurriculumImportConfig("thin", 7L, "A2", null, null, null, null, null).normalized(),
                List.of(), "thin.pdf");

        assertThat(p.warnings()).isNotEmpty();
        // The single genuine goal is used; nothing is fabricated to reach the minimum of two.
        assertThat(p.modules().get(0).lessons())
                .anySatisfy(l -> assertThat(l.canDoStatements()).hasSizeLessThan(2));
    }

    private List<DraftLesson> allLessons() {
        return buildNetzwerk().modules().stream().flatMap(m -> m.lessons().stream()).toList();
    }
}
