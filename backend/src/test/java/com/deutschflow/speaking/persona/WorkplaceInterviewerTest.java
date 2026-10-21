package com.deutschflow.speaking.persona;

import com.deutschflow.interview.prompt.InterviewPromptLayer.InterviewPromptContext;
import com.deutschflow.interview.prompt.PersonaPromptLayer;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.tts.XttsPersonaVoiceResolver;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Người tuyển dụng theo nơi làm việc (đợt 2c A + B + E): mỗi nhóm {@code occupation.workplace}
 * có đúng một người, đủ dữ liệu để phỏng vấn (DB seed, giọng, prompt), nhân vật khác không đổi.
 */
class WorkplaceInterviewerTest {

    private static final List<SpeakingPersona> INTERVIEWERS =
            Arrays.stream(SpeakingPersona.values()).filter(SpeakingPersona::isWorkplaceInterviewer).toList();

    @Test
    void everyWorkplaceInV334Check_hasExactlyOneInterviewer() {
        Matcher m = Pattern.compile("CHECK \\(workplace IN\\s*\\(([^)]*)\\)\\)")
                .matcher(read("V334__occupation_catalog.sql"));
        assertThat(m.find()).isTrue();
        Set<String> workplaces = new LinkedHashSet<>();
        Matcher q = Pattern.compile("'([a-z]+)'").matcher(m.group(1));
        while (q.find()) {
            workplaces.add(q.group(1));
        }

        assertThat(workplaces).hasSize(8);
        assertThat(INTERVIEWERS).extracting(SpeakingPersona::workplace).containsExactlyInAnyOrderElementsOf(workplaces);
        for (String w : workplaces) {
            assertThat(SpeakingPersona.forWorkplace(w)).isPresent();
        }
    }

    @Test
    void forWorkplace_isCaseInsensitive_andEmptyForUnknown() {
        assertThat(SpeakingPersona.forWorkplace(" Pflege ")).contains(SpeakingPersona.KRUEGER);
        assertThat(SpeakingPersona.forWorkplace("bau")).contains(SpeakingPersona.BRANDT);
        assertThat(SpeakingPersona.forWorkplace("weltraum")).isEmpty();
        assertThat(SpeakingPersona.forWorkplace(null)).isEmpty();
    }

    @Test
    void existingPersonas_areNotWorkplaceInterviewers() {
        for (SpeakingPersona p : List.of(SpeakingPersona.DEFAULT, SpeakingPersona.LUKAS, SpeakingPersona.KLAUS,
                SpeakingPersona.MARIE, SpeakingPersona.TUAN)) {
            assertThat(p.workplace()).as(p.name()).isNull();
            assertThat(p.workplaceInterviewFocus()).as(p.name()).isNull();
        }
    }

    @Test
    void v336_seedsEveryInterviewer() {
        String sql = read("V336__workplace_interviewers.sql");
        for (SpeakingPersona p : INTERVIEWERS) {
            assertThat(sql).as("V336 INSERT for %s", p.name()).contains("('" + p.name() + "',");
            assertThat(sql).as("V336 topic pools for %s", p.name()).contains("WHERE code = '" + p.name() + "';");
        }
    }

    @Test
    void everyInterviewer_hasNameRoleVoiceAndInterviewPrompt() {
        XttsPersonaVoiceResolver voices = new XttsPersonaVoiceResolver();
        for (SpeakingPersona p : INTERVIEWERS) {
            assertThat(p.displayName()).as(p.name()).matches("(Frau|Herr) .+");
            assertThat(p.communicationRole()).as(p.name()).isNotBlank();
            assertThat(voices.resolve(p)).as("XTTS voice for %s", p.name()).isPresent();

            String greeting = p.buildGreetingInstruction("", "Pflege", "keine", SpeakingSessionMode.INTERVIEW,
                    "Altenpfleger/in");
            assertThat(greeting).contains(p.displayName(), "\"Altenpfleger/in\"", p.workplaceInterviewFocus());
            assertThat(p.personaPromptSection("B1")).contains(p.displayName());
        }
    }

    @Test
    void personaPromptLayer_usesWorkplaceFocusWithPosition() {
        StringBuilder sb = new StringBuilder();
        new PersonaPromptLayer().appendTo(sb, context(SpeakingPersona.BRANDT, "Friseur/in"));

        assertThat(sb.toString())
                .contains("Du bist Herr Brandt")
                .contains(SpeakingPersona.BRANDT.workplaceInterviewFocus())
                .contains("Prüfe alles konkret für die Position \"Friseur/in\"");
    }

    private static InterviewPromptContext context(SpeakingPersona p, String position) {
        return new InterviewPromptContext(p.name(), p.displayName(), "Bauleiter / Handwerksmeister",
                "Construction / Bau", position, "1-2Y", "B1", 1, 1, "Hard Skills", "3", "", "", "ASK", "",
                "", 20, "", "", false, null, null, null);
    }

    private static String read(String migration) {
        try {
            return Files.readString(Path.of("src/main/resources/db/migration/" + migration), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
