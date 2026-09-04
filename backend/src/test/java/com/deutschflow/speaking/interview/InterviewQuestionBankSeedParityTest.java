package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * R1 parity guarantee for the question bank: every persona-specific HARD_SKILLS question in the
 * in-memory {@link InterviewQuestionBank} must be seeded verbatim into interview_question by V187,
 * so the bank can be reduced to a thin fallback in the next release without losing coverage.
 *
 * <p>Asserted against the rendered bank text with position at its blank default ("diese Position"),
 * which is exactly what the migration seeds.
 */
class InterviewQuestionBankSeedParityTest {

    /** V187 seed gốc + V271 (Đợt E1 10/08) seed 3 câu gen_* mới — parity đọc GỘP cả hai. */
    private static final List<String> MIGRATIONS = List.of(
            "db/migration/V187__seed_persona_topic_pools.sql",
            "db/migration/V271__seed_gen_hard_skills_depth.sql");

    /** Personas whose HARD_SKILLS questions were migrated, plus DEFAULT (the generic branch). */
    private static final List<SpeakingPersona> SEEDED_PERSONAS = List.of(
            SpeakingPersona.LUKAS, SpeakingPersona.EMMA, SpeakingPersona.ANNA, SpeakingPersona.KLAUS,
            SpeakingPersona.WEBER, SpeakingPersona.SARAH, SpeakingPersona.SCHNEIDER,
            SpeakingPersona.LENA, SpeakingPersona.THOMAS, SpeakingPersona.PETRA,
            SpeakingPersona.MAX, SpeakingPersona.OLIVER, SpeakingPersona.NIKLAS,
            SpeakingPersona.NINA, SpeakingPersona.HANNIE, SpeakingPersona.DEFAULT);

    @Test
    void everyHardSkillsBankQuestionIsSeededVerbatim() {
        String sql = MIGRATIONS.stream().map(InterviewQuestionBankSeedParityTest::readMigration)
                .reduce("", (a, b) -> a + "\n" + b);

        for (SpeakingPersona persona : SEEDED_PERSONAS) {
            List<InterviewQuestionDef> hardSkills = InterviewQuestionBank
                    .forPersona(persona, "diese Position").stream()
                    .filter(q -> q.phase() == InterviewPhase.HARD_SKILLS)
                    .toList();

            assertThat(hardSkills)
                    .as("bank should expose HARD_SKILLS questions for %s", persona.name())
                    .isNotEmpty();

            for (InterviewQuestionDef q : hardSkills) {
                assertThat(sql)
                        .as("migration seed must contain id '%s' (persona %s)", q.id(), persona.name())
                        .contains("'" + q.id() + "'");
                assertThat(sql)
                        .as("migration seed must contain verbatim text for '%s'", q.id())
                        .contains(q.questionDe());
            }
        }
    }

    private static String readMigration(String migration) {
        try (InputStream is = InterviewQuestionBankSeedParityTest.class.getClassLoader()
                .getResourceAsStream(migration)) {
            if (is != null) {
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (IOException ignored) {
            // fall through to filesystem
        }
        try {
            return Files.readString(Path.of("src/main/resources/" + migration), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + migration, e);
        }
    }
}
