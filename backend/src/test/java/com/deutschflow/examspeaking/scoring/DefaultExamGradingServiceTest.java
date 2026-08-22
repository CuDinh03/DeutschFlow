package com.deutschflow.examspeaking.scoring;

import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.RubricRef;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.deutschflow.examspeaking.api.model.Utterance;
import com.deutschflow.examspeaking.config.ExamSpeakingProperties;
import com.deutschflow.examspeaking.metrics.FluencyMetricExtractor;
import com.deutschflow.examspeaking.metrics.GoetheWordlist;
import com.deutschflow.examspeaking.metrics.LexicalProfiler;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Pipeline chấm với LLM giả: LLM trả band/lỗi, CODE quyết điểm; mật độ lỗi đè band Strukturen. */
class DefaultExamGradingServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final OpenAiChatClient chat = mock(OpenAiChatClient.class);
    private final ExamBlueprintCatalog catalog = mock(ExamBlueprintCatalog.class);
    private DefaultExamGradingService service;

    @BeforeEach
    void setUp() {
        GoetheWordlist wl = new GoetheWordlist();
        wl.load();
        ExamSpeakingProperties props = new ExamSpeakingProperties(true, 1, 400, 600, 1800);
        service = new DefaultExamGradingService(catalog, chat, mock(LlmTierResolver.class), mapper,
                new FluencyMetricExtractor(), new LexicalProfiler(wl), new FluencyBandMapper(), new ErrorDensityBandMapper(),
                new IntelligibilityBandMapper(), new GradingPromptBuilder(), new RubricScorer(), new ScoreAggregator(),
                mock(AiUsageLedgerService.class), props);
    }

    private static AiChatCompletionResult reply(String json) {
        return new AiChatCompletionResult(json, TokenUsage.exact(100, 50, 150), "test", "test-model");
    }

    @Test
    @DisplayName("Goethe A1 (VHN): trạng thái từng nhiệm vụ từ LLM → điểm thô × 1,66; Aussprache không có trong rubric A1")
    void gradesGoetheA1FromItemStatuses() {
        ExamBlueprint bp = new ExamBlueprint(1, ExamProvider.GOETHE, "A1", 1, "A1", 0, List.of(), RubricScorerTest.goetheA1());
        when(catalog.find(ExamProvider.GOETHE, "A1")).thenReturn(Optional.of(bp));
        when(chat.chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean())).thenAnswer(inv -> {
            List<ChatMessage> msgs = inv.getArgument(0);
            String user = msgs.get(msgs.size() - 1).content();
            if (user.contains("Teil 1")) {
                return reply("{\"items\":[{\"code\":\"VORSTELLUNG\",\"status\":\"VOLL\",\"quote\":\"Ich heiße Anna\"},{\"code\":\"BUCHSTABIEREN\",\"status\":\"VOLL\"},{\"code\":\"ZAHL\",\"status\":\"VOLL\"}],\"criteria\":[],\"errors\":[]}");
            }
            if (user.contains("Teil 2")) {
                return reply("{\"items\":[{\"code\":\"FRAGE_1\",\"status\":\"VOLL\"},{\"code\":\"ANTWORT_1\",\"status\":\"halbe\"},{\"code\":\"FRAGE_2\",\"status\":\"VOLL\"},{\"code\":\"ANTWORT_2\",\"status\":\"VOLL\"}],\"criteria\":[],\"errors\":[{\"code\":\"VERB.CONJUGATION\",\"original\":\"ich trinke gern Kaffee trinken\",\"correction\":\"ich trinke gern Kaffee\",\"severity\":\"MINOR\"}]}");
            }
            return reply("{\"items\":[{\"code\":\"BITTE_1\",\"status\":\"VOLL\"},{\"code\":\"REAKTION_1\",\"status\":\"VOLL\"},{\"code\":\"BITTE_2\",\"status\":\"VOLL\"},{\"code\":\"REAKTION_2\",\"status\":\"VOLL\"}],\"criteria\":[],\"errors\":[]}");
        });
        ParticipantBundle bundle = new ParticipantBundle(bp.rubricRef(), List.of(
                part(1, TaskArchetype.SELF_INTRO, "Ich heiße Anna, ich bin 25 Jahre alt und komme aus Vietnam."),
                part(2, TaskArchetype.CARD_QA, "Was trinkst du gern? Ich trinke gern Kaffee trinken."),
                part(3, TaskArchetype.REQUEST_RESPOND, "Können Sie bitte das Fenster öffnen? Ja, gern.")), "AI", "Anna");

        Ergebnisbogen e = service.grade(7L, bundle, bp.rubricRef());
        // thô: 3 + (1.5 + 0.75 + 1.5 + 1.5) + 6 = 14.25 → ×1,66 = 23.655 → 24
        assertThat(e.total()).isEqualTo(24.0);
        assertThat(e.maxPoints()).isEqualTo(25.0);
        assertThat(e.passes()).isEqualTo(1);
        assertThat(e.errors()).hasSize(1);
        assertThat(e.errors().get(0).teilNo()).isEqualTo(2);
        assertThat(e.parts().get(1).criteria()).anyMatch(c -> c.code().equals("ANTWORT_1") && c.band().equals("HALB") && c.points() == 0.75);
    }

    @Test
    @DisplayName("Goethe B1 (A–E): mật độ lỗi đếm được đè band Strukturen; Aussprache text-only → chưa chấm; Wortschatz có số đo")
    void gradesGoetheB1WithCodeOverrides() {
        ExamBlueprint bp = new ExamBlueprint(2, ExamProvider.GOETHE, "B1", 1, "B1", 900, List.of(), RubricScorerTest.goetheB1());
        when(catalog.find(ExamProvider.GOETHE, "B1")).thenReturn(Optional.of(bp));
        String fiveErrors = "\"errors\":[" + String.join(",", java.util.Collections.nCopies(5,
                "{\"code\":\"CASE.PREP_DAT_MIT\",\"original\":\"mit der Bus\",\"correction\":\"mit dem Bus\",\"severity\":\"MAJOR\"}")) + "]";
        when(chat.chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean())).thenAnswer(inv -> {
            List<ChatMessage> msgs = inv.getArgument(0);
            String user = msgs.get(msgs.size() - 1).content();
            if (user.contains("Teil 1")) {
                return reply("{\"items\":[],\"criteria\":[{\"code\":\"ERFUELLUNG\",\"band\":\"A\",\"evidence\":[\"Vorschlag gemacht\"]},{\"code\":\"INTERAKTION\",\"band\":\"B\"},{\"code\":\"WORTSCHATZ\",\"band\":\"B\"},{\"code\":\"STRUKTUREN\",\"band\":\"A\"}]," + fiveErrors + "}");
            }
            if (user.contains("Teil 2")) {
                return reply("{\"items\":[],\"criteria\":[{\"code\":\"ERFUELLUNG\",\"band\":\"B\"},{\"code\":\"KOHAERENZ\",\"band\":\"B\"},{\"code\":\"WORTSCHATZ\",\"band\":\"B\"},{\"code\":\"STRUKTUREN\",\"band\":\"B\"}],\"errors\":[]}");
            }
            return reply("{\"items\":[],\"criteria\":[{\"code\":\"ERFUELLUNG\",\"band\":\"A\"}],\"errors\":[]}");
        });
        String forty = "Ich schlage vor, dass wir am Samstag mit der Bus fahren, weil das billig ist. Wir können dann zusammen essen gehen und danach ins Kino gehen, wenn du willst und Zeit hast, okay gut.";
        ParticipantBundle bundle = new ParticipantBundle(bp.rubricRef(), List.of(
                part(1, TaskArchetype.PLAN_NEGOTIATE, forty),
                part(2, TaskArchetype.PRESENT, "Mein Thema ist Sport. Ich spreche über Vorteile und Nachteile. Zum Schluss danke ich Ihnen."),
                part(3, TaskArchetype.FEEDBACK_FOLLOWUP, "Deine Präsentation war interessant. Hast du selbst ein Hobby?")), "AI", "K");

        Ergebnisbogen e = service.grade(7L, bundle, bp.rubricRef());
        Ergebnisbogen.CriterionResult strukturenT1 = e.parts().get(0).criteria().stream()
                .filter(c -> c.code().equals("STRUKTUREN")).findFirst().orElseThrow();
        // 5 lỗi MAJOR / 33 từ ≈ 15/100 → B1: >12 → E (LLM nói A nhưng code quyết)
        assertThat(strukturenT1.band()).isEqualTo("E");
        assertThat(strukturenT1.evidence()).anyMatch(s -> s.contains("Mật độ lỗi"));
        Ergebnisbogen.CriterionResult aussprache = e.global().get(0);
        assertThat(aussprache.scored()).isFalse();
        assertThat(e.maxPoints()).isEqualTo(84.0);
        assertThat(e.parts().get(0).criteria().stream().filter(c -> c.code().equals("WORTSCHATZ")).findFirst().orElseThrow()
                .evidence()).anyMatch(s -> s.contains("wordlist Goethe"));
        assertThat(e.total()).isGreaterThan(0);
        assertThat(e.passRule()).contains("60");
    }

    private static ParticipantBundle.PartTranscript part(int teil, TaskArchetype a, String text) {
        return new ParticipantBundle.PartTranscript(teil, a, "", List.of(Utterance.candidateText(text)),
                List.of(new Utterance("PRUEFER", "Bitte.", List.of(), null, null)));
    }
}
