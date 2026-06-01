package com.deutschflow.speaking.interview;

import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.deutschflow.interview.service.PersonaRegistryService;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * R1 parity guarantee: the DB-backed {@code topic_pools_json} seeded by Flyway V187 must produce
 * the exact same {@code topicFocusForSession} output as the in-memory {@code topicPools()} switch,
 * for every interview-capable persona across a range of seeds.
 *
 * <p>This reads the real migration file (not a hand-copied fixture) so a drift between the seed
 * and the switch fails the build before the switch can be removed in the next release.
 */
class PersonaTopicPoolParityTest {

    private static final String MIGRATION =
            "db/migration/V187__seed_persona_topic_pools.sql";

    /** The 15 interview-capable personas — those with an explicit (non-default) topicPools branch. */
    private static final List<SpeakingPersona> INTERVIEW_PERSONAS = List.of(
            SpeakingPersona.LUKAS, SpeakingPersona.EMMA, SpeakingPersona.ANNA, SpeakingPersona.KLAUS,
            SpeakingPersona.WEBER, SpeakingPersona.SARAH, SpeakingPersona.SCHNEIDER,
            SpeakingPersona.LENA, SpeakingPersona.THOMAS, SpeakingPersona.PETRA,
            SpeakingPersona.MAX, SpeakingPersona.OLIVER, SpeakingPersona.NIKLAS,
            SpeakingPersona.NINA, SpeakingPersona.HANNIE);

    @Test
    void migrationSeedsTopicPoolsForAllInterviewPersonas() {
        Map<String, String> seeded = parseSeededPools();
        for (SpeakingPersona persona : INTERVIEW_PERSONAS) {
            assertThat(seeded)
                    .as("V187 must seed topic_pools_json for %s", persona.name())
                    .containsKey(persona.name());
        }
    }

    @Test
    void dbTopicFocus_matchesSwitch_forEveryPersonaAndSeed() {
        Map<String, String> seeded = parseSeededPools();
        PersonaInterviewRegistry switchRegistry = new PersonaInterviewRegistry(); // no service → switch path
        PersonaInterviewRegistry dbRegistry = new PersonaInterviewRegistry(null, dbBackedService(seeded));

        String position = "Allgemeine Position";
        for (SpeakingPersona persona : INTERVIEW_PERSONAS) {
            // 24 seeds covers ≥2 full cycles for 2/3/4-pool personas, catching count or order drift.
            for (int seed = 0; seed < 24; seed++) {
                String fromSwitch = switchRegistry.topicFocusForSession(persona, position, seed);
                String fromDb = dbRegistry.topicFocusForSession(persona, position, seed);
                assertThat(fromDb)
                        .as("topicFocusForSession parity for %s @ seed=%d", persona.name(), seed)
                        .isEqualTo(fromSwitch);
            }
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /** Real service over a mocked repository that returns the JSON parsed from the migration. */
    private static PersonaRegistryService dbBackedService(Map<String, String> seeded) {
        InterviewPersonaRepository repo = mock(InterviewPersonaRepository.class);
        when(repo.findByCodeAndActiveTrue(anyString())).thenAnswer(inv -> {
            String code = inv.getArgument(0);
            String json = seeded.get(code);
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(InterviewPersonaEntity.builder()
                    .code(code).topicPoolsJson(json).build());
        });
        return new PersonaRegistryService(repo, new ObjectMapper());
    }

    /** Extracts {@code code -> topic_pools_json} from the V187 UPDATE statements. */
    private static Map<String, String> parseSeededPools() {
        String sql = readMigration();
        Pattern p = Pattern.compile(
                "topic_pools_json\\s*=\\s*'(.+?)'::jsonb\\s+WHERE\\s+code\\s*=\\s*'([A-Z]+)'");
        Map<String, String> result = new HashMap<>();
        Matcher m = p.matcher(sql);
        while (m.find()) {
            result.put(m.group(2), m.group(1));
        }
        assertThat(result).as("parsed at least the 15 interview personas from V187").hasSizeGreaterThanOrEqualTo(15);
        return result;
    }

    private static String readMigration() {
        try (InputStream is = PersonaTopicPoolParityTest.class.getClassLoader().getResourceAsStream(MIGRATION)) {
            if (is != null) {
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (IOException ignored) {
            // fall through to filesystem
        }
        try {
            return Files.readString(Path.of("src/main/resources/" + MIGRATION), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + MIGRATION, e);
        }
    }
}
