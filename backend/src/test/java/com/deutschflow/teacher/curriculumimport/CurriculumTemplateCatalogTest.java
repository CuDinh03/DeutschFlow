package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.teacher.curriculumimport.template.CurriculumTemplate;
import com.deutschflow.teacher.curriculumimport.template.TemplateUnit;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The shipped template catalog is data the whole feature stands on, so it is asserted like code:
 * the Netzwerk neu A1 entry must describe exactly the book a teacher holds (12 Kapitel, 4 Plattform,
 * reviews after chapters 3/6/9/12), and every content tag it uses must be one the lesson writer
 * accepts — a tag typo in JSON would only surface as a 400 at commit time otherwise.
 */
class CurriculumTemplateCatalogTest {

    private static final Set<String> CONTENT_TAGS =
            Set.of("WORTSCHATZ", "GRAMMATIK", "AUSSPRACHE", "LANDESKUNDE", "REDEMITTEL", "STRATEGIE");

    private CurriculumTemplateCatalog catalog;

    @BeforeEach
    void setUp() {
        catalog = new CurriculumTemplateCatalog(new ObjectMapper());
    }

    @Test
    void listsTheShippedTemplates() {
        assertThat(catalog.list())
                .extracting("id")
                .contains("netzwerk-neu-a1");
    }

    @Test
    void netzwerkA1HasTwelveChaptersAndFourReviews() {
        CurriculumTemplate t = catalog.require("netzwerk-neu-a1");

        assertThat(t.level()).isEqualTo("A1");
        assertThat(t.chapterCount()).isEqualTo(12);
        assertThat(t.reviewCount()).isEqualTo(4);
        assertThat(t.units()).hasSize(16);
    }

    @Test
    void chapterTitlesMatchTheBookInOrder() {
        List<String> chapters = catalog.require("netzwerk-neu-a1").units().stream()
                .filter(TemplateUnit::isChapter)
                .map(TemplateUnit::title)
                .toList();

        assertThat(chapters).containsExactly(
                "Guten Tag!",
                "Freunde, Kollegen und ich",
                "In Hamburg",
                "Guten Appetit!",
                "Alltag und Familie",
                "Zeit mit Freunden",
                "Arbeitsalltag",
                "Fit und gesund",
                "Meine Wohnung",
                "Studium und Beruf",
                "Die Jacke gefällt mir!",
                "Ab in den Urlaub!");
    }

    @Test
    void reviewUnitsFollowChapters3_6_9_12() {
        List<TemplateUnit> units = catalog.require("netzwerk-neu-a1").units();

        // Index of each review unit in reading order; a Plattform sits after every third chapter.
        List<Integer> reviewPositions = java.util.stream.IntStream.range(0, units.size())
                .filter(i -> !units.get(i).isChapter())
                .boxed().toList();

        assertThat(reviewPositions).containsExactly(3, 7, 11, 15);
    }

    @Test
    void everyUnitHasGoalsAndAPageSpan() {
        for (TemplateUnit u : catalog.require("netzwerk-neu-a1").units()) {
            assertThat(u.title()).as("title").isNotBlank();
            assertThat(u.goals()).as("goals of %s", u.title()).isNotEmpty();
            assertThat(u.bookPageFrom()).as("pageFrom of %s", u.title()).isNotNull().isPositive();
            assertThat(u.bookPageTo()).as("pageTo of %s", u.title())
                    .isNotNull().isGreaterThanOrEqualTo(u.bookPageFrom());
        }
    }

    @Test
    void everyContentTagIsOnTheLessonWriterWhitelist() {
        for (TemplateUnit u : catalog.require("netzwerk-neu-a1").units()) {
            assertThat(u.content().keySet())
                    .as("content tags of %s", u.title())
                    .isSubsetOf(CONTENT_TAGS);
        }
    }

    @Test
    void unknownTemplateIdIsRejected() {
        assertThatThrownBy(() -> catalog.require("does-not-exist"))
                .isInstanceOf(com.deutschflow.common.exception.BadRequestException.class);
    }
}
