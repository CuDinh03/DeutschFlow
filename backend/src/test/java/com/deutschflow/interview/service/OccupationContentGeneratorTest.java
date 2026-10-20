package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.Occupation;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.entity.OccupationTerm;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.interview.repository.OccupationRepository;
import com.deutschflow.interview.repository.OccupationTermRepository;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OccupationContentGeneratorTest {

    @Mock OpenAiChatClient chatClient;
    @Mock OccupationRepository occupationRepository;
    @Mock OccupationQuestionRepository questionRepository;
    @Mock OccupationTermRepository termRepository;

    private OccupationContentGenerator generator;

    private static final Occupation NURSE = Occupation.builder()
            .code("pflegefachkraft").nameDe("Pflegefachmann/-frau").nameEn("Registered nurse")
            .nameVi("Điều dưỡng").workplace("pflege").build();
    private static final Occupation WAITER = Occupation.builder()
            .code("kellner").nameDe("Kellner/in").nameEn("Waiter").nameVi("Phục vụ bàn").workplace("gastro")
            .legacyPersonaCode("NIKLAS").legacyPositionDe("Kellner/in").build();

    @BeforeEach
    void setUp() {
        generator = new OccupationContentGenerator(chatClient, new ObjectMapper(), occupationRepository,
                questionRepository, termRepository);
        lenient().when(questionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(termRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void parseKeepsSixCleanQuestionsAndNormalisesFields() throws Exception {
        String json = """
                {"questions":[
                  {"questionDe":"  Wie   versorgen Sie eine chronische Wunde? ","topicKey":"Wund-Versorgung Ü","difficulty":"beginner"},
                  {"questionDe":"Wie versorgen Sie eine chronische Wunde?","topicKey":"dup","difficulty":"BEGINNER"},
                  {"questionDe":"","topicKey":"leer"},
                  {"questionDe":"%s","topicKey":"lang"},
                  {"questionDe":"Frage 2?","difficulty":"hard"},
                  {"questionDe":"Frage 3?"},{"questionDe":"Frage 4?"},{"questionDe":"Frage 5?"},
                  {"questionDe":"Frage 6?"},{"questionDe":"Frage 7?"}],
                 "terms":[
                  {"termDe":"die Wundversorgung","meaningEn":"wound care","meaningVi":"chăm sóc vết thương","exampleDe":"Ich übernehme die Wundversorgung."},
                  {"termDe":"Die Wundversorgung","meaningEn":"dup","meaningVi":"dup"},
                  {"termDe":"der Dekubitus","meaningEn":"pressure ulcer"}]}
                """.formatted("x".repeat(401));

        OccupationContentGenerator.Generated g = generator.parse(json, "pflegefachkraft", "llama-3.3-70b");

        assertThat(g.questions()).hasSize(6);
        OccupationQuestion first = g.questions().get(0);
        assertThat(first.getQuestionDe()).isEqualTo("Wie versorgen Sie eine chronische Wunde?");
        assertThat(first.getTopicKey()).isEqualTo("wund_versorgung_ue");
        assertThat(first.getDifficulty()).isEqualTo("BEGINNER");
        assertThat(first.getId()).startsWith("occ_pflegefachkraft_");
        assertThat(first.getStatus()).isEqualTo(OccupationContentStatus.AI_GENERATED);
        assertThat(first.getSourceModel()).isEqualTo("llama-3.3-70b");
        assertThat(g.questions().get(1).getDifficulty()).isEqualTo("INTERMEDIATE");
        assertThat(g.questions().get(1).getTopicKey()).isEqualTo("fachkompetenz");
        assertThat(g.questions()).extracting(OccupationQuestion::getQuestionDe).doesNotContain("Frage 7?");
        assertThat(g.questions()).extracting(OccupationQuestion::getId).doesNotHaveDuplicates();

        // Từ trùng (khác hoa thường) và từ thiếu nghĩa tiếng Việt bị bỏ.
        assertThat(g.terms()).extracting(OccupationTerm::getTermDe).containsExactly("die Wundversorgung");
    }

    @Test
    void curatedOrAlreadyGeneratedOccupationsAreNeverAutoGenerated() {
        when(occupationRepository.findById("kellner")).thenReturn(Optional.of(WAITER));
        assertThat(generator.generateIfMissing("kellner")).isEmpty();

        when(occupationRepository.findById("pflegefachkraft")).thenReturn(Optional.of(NURSE));
        when(questionRepository.existsByOccupationCode("pflegefachkraft")).thenReturn(true);
        assertThat(generator.generateIfMissing("pflegefachkraft")).isEmpty();

        verifyNoInteractions(chatClient);
    }

    @Test
    void generatesAndSavesForAGeneralOccupation() {
        when(occupationRepository.findById("pflegefachkraft")).thenReturn(Optional.of(NURSE));
        when(questionRepository.existsByOccupationCode("pflegefachkraft")).thenReturn(false);
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult(sixAndSix(), null, "groq", "llama"));

        Optional<OccupationContentGenerator.Generated> g = generator.generateIfMissing("pflegefachkraft");

        assertThat(g).isPresent();
        assertThat(g.get().questions()).hasSize(6);
        assertThat(g.get().terms()).hasSize(6);
        verify(questionRepository).saveAll(anyList());
        verify(termRepository).saveAll(anyList());
    }

    @Test
    void tooFewQuestionsOrAiFailureSavesNothing() {
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult("{\"questions\":[{\"questionDe\":\"Nur eine?\"}],\"terms\":[]}",
                        null, "groq", "llama"))
                .thenThrow(new RuntimeException("timeout"));

        assertThat(generator.generate(NURSE)).isEmpty();
        assertThat(generator.generate(NURSE)).isEmpty();
        verify(questionRepository, never()).saveAll(any());
        verify(termRepository, never()).saveAll(any());
    }

    @Test
    void existingTermsAreNotInsertedTwice() {
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult(sixAndSix(), null, "groq", "llama"));
        when(termRepository.existsByOccupationCodeAndTermDeIgnoreCase(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1).equals("der Begriff 1"));

        Optional<OccupationContentGenerator.Generated> g = generator.generate(NURSE);

        assertThat(g).isPresent();
        assertThat(g.get().terms()).extracting(OccupationTerm::getTermDe).doesNotContain("der Begriff 1").hasSize(5);
    }

    @Test
    void promptNamesTheOccupationAndForbidsAggTopics() {
        assertThat(OccupationContentGenerator.userPrompt(NURSE))
                .contains("Pflegefachmann/-frau").contains("Registered nurse").contains("pflege");
        assertThat(OccupationContentGenerator.SYSTEM_PROMPT).contains("AGG").contains("Sie");
    }

    private static String sixAndSix() {
        StringBuilder sb = new StringBuilder("{\"questions\":[");
        for (int i = 1; i <= 6; i++) {
            if (i > 1) sb.append(',');
            sb.append("{\"questionDe\":\"Fachfrage ").append(i).append("?\",\"topicKey\":\"t").append(i)
                    .append("\",\"difficulty\":\"INTERMEDIATE\"}");
        }
        sb.append("],\"terms\":[");
        for (int i = 1; i <= 6; i++) {
            if (i > 1) sb.append(',');
            sb.append("{\"termDe\":\"der Begriff ").append(i).append("\",\"meaningEn\":\"term\",\"meaningVi\":\"từ\"}");
        }
        return sb.append("]}").toString();
    }
}
