package com.deutschflow.practice.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.practice.dto.PracticeExerciseDto;
import com.deutschflow.practice.dto.PracticeGradeRequest;
import com.deutschflow.practice.dto.PracticeGradeResponse;
import com.deutschflow.practice.dto.PracticeQuizDto;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A3: thư viện bài tập bổ trợ — đề không kèm đáp án, đáp án + giải thích chỉ có sau khi nộp. */
@ExtendWith(MockitoExtension.class)
class PracticeQuizServiceTest {

    static final List<String> ANSWER_KEYS = List.of(
            "correctAnswer", "correct_answer", "correct_index", "correctIndex", "answer", "answers",
            "isCorrect", "is_correct", "explanation", "contentJson");

    @Mock PracticeExerciseRepository exerciseRepository;
    @Mock PracticeService practiceService;
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private PracticeQuizService service() {
        return new PracticeQuizService(exerciseRepository, practiceService, objectMapper, jdbcTemplate);
    }

    static PracticeExercise gradable() {
        String content = """
                {"title": "Artikel", "instructions": "Wähle.", "readingText": "Das ist ein Haus.",
                 "questions": [
                   {"id": "q1", "type": "mc", "question": "___ Haus", "options": ["der", "die", "das"],
                    "correctAnswer": "das", "explanation": "Haus ist neutral."},
                   {"question": "Ist das ein Haus?", "correctAnswer": "Ja, das ist ein Haus.", "explanation": "Ja."},
                   {"id": "open", "question": "Beschreibe dein Haus.", "explanation": "Freie Antwort."}
                 ]}
                """;
        return PracticeExercise.builder().id(10L).exerciseType("NORMAL").cefrLevel("A1").skillType("READING")
                .examName("Artikel A1").sourceName("DeutschFlow").xpReward(100).contentJson(content).build();
    }

    static List<String> allKeys(JsonNode node) {
        List<String> keys = new ArrayList<>();
        if (node.isObject()) {
            for (Iterator<Map.Entry<String, JsonNode>> it = node.fields(); it.hasNext(); ) {
                Map.Entry<String, JsonNode> e = it.next();
                keys.add(e.getKey());
                keys.addAll(allKeys(e.getValue()));
            }
        } else if (node.isArray()) {
            node.forEach(n -> keys.addAll(allKeys(n)));
        }
        return keys;
    }

    @Test
    void quizHasNoAnswerFields() throws Exception {
        when(exerciseRepository.findById(10L)).thenReturn(Optional.of(gradable()));

        PracticeQuizDto quiz = service().quiz(10L);
        JsonNode json = objectMapper.valueToTree(quiz);

        assertThat(allKeys(json)).doesNotContainAnyElementsOf(ANSWER_KEYS);
        assertThat(objectMapper.writeValueAsString(quiz))
                .doesNotContain("Haus ist neutral")
                .doesNotContain("Ja, das ist ein Haus.");
        assertThat(quiz.title()).isEqualTo("Artikel");
        assertThat(quiz.readingText()).isEqualTo("Das ist ein Haus.");
        assertThat(quiz.gradableCount()).isEqualTo(2);
        assertThat(quiz.questions()).extracting(PracticeQuizDto.Question::id).containsExactly("q1", "q2", "open");
        assertThat(quiz.questions()).extracting(PracticeQuizDto.Question::gradable).containsExactly(true, true, false);
        assertThat(quiz.questions().get(0).options()).containsExactly("der", "die", "das");
    }

    @Test
    void gradeReturnsVerdictAnswerAndExplanationAndRecordsTheAttempt() throws Exception {
        when(exerciseRepository.findById(10L)).thenReturn(Optional.of(gradable()));

        PracticeGradeResponse res = service().grade(5L, 10L, new PracticeGradeRequest(
                Map.of("q1", "die", "q2", "ja, das ist ein Haus"), 100));

        assertThat(res.graded()).isTrue();
        assertThat(res.correctCount()).isEqualTo(1);
        assertThat(res.total()).isEqualTo(2);
        assertThat(res.scorePercent()).isEqualTo(50); // client's 100 is ignored for gradable exercises
        assertThat(res.questions()).hasSize(3);
        assertThat(res.questions().get(0))
                .isEqualTo(new PracticeGradeResponse.QuestionResult("q1", false, "das", "Haus ist neutral."));
        assertThat(res.questions().get(1).correct()).isTrue();
        assertThat(res.questions().get(2))
                .isEqualTo(new PracticeGradeResponse.QuestionResult("open", null, null, "Freie Antwort."));

        ArgumentCaptor<PracticeSubmitRequest> captor = ArgumentCaptor.forClass(PracticeSubmitRequest.class);
        verify(practiceService).submitPracticeResult(eq(5L), captor.capture());
        PracticeSubmitRequest sent = captor.getValue();
        assertThat(sent.getPracticeId()).isEqualTo(10L);
        JsonNode data = objectMapper.readTree(sent.getAnswerDataJson());
        // PracticeService re-grades from this map — the shape must stay {answers: {qid: value}}.
        assertThat(data.path("answers").path("q1").asText()).isEqualTo("die");
        assertThat(data.path("graded").asBoolean()).isTrue();
    }

    @Test
    void externalResourceWithoutKeyUsesClampedSelfConfirmation() {
        PracticeExercise external = PracticeExercise.builder().id(11L).cefrLevel("A1").skillType("LISTENING")
                .xpReward(20).contentJson("{}").sourceUrl("https://example.org").build();
        when(exerciseRepository.findById(11L)).thenReturn(Optional.of(external));

        PracticeGradeResponse res = service().grade(5L, 11L, new PracticeGradeRequest(Map.of(), 100));

        assertThat(res.graded()).isFalse();
        assertThat(res.scorePercent()).isEqualTo(100);
        assertThat(res.questions()).isEmpty();
        verify(practiceService).submitPracticeResult(eq(5L), any());
    }

    @Test
    void scoreAndXpComeFromTheHistoryRowTheServerJustWrote() {
        // PracticeService (A2/#808) may apply its own rule — e.g. a fixed small XP for external
        // resources — so the response echoes the persisted row instead of score% × xpReward.
        PracticeExercise external = PracticeExercise.builder().id(11L).cefrLevel("A1").skillType("LISTENING")
                .xpReward(100).contentJson("{}").sourceUrl("https://example.org").build();
        when(exerciseRepository.findById(11L)).thenReturn(Optional.of(external));
        when(jdbcTemplate.queryForObject(org.mockito.ArgumentMatchers.anyString(), eq(Long.class), eq(5L), eq(11L)))
                .thenReturn(3L);
        when(jdbcTemplate.queryForList(org.mockito.ArgumentMatchers.anyString(), eq(5L), eq(11L), eq(3L)))
                .thenReturn(List.of(Map.of("score_percent", 100, "xp_earned", 5)));

        PracticeGradeResponse res = service().grade(5L, 11L, new PracticeGradeRequest(Map.of(), 100));

        assertThat(res.xpEarned()).isEqualTo(5);
        assertThat(res.scorePercent()).isEqualTo(100);
    }

    @Test
    void xpIsNullWhenNoNewHistoryRowIsFound() {
        when(exerciseRepository.findById(10L)).thenReturn(Optional.of(gradable()));

        PracticeGradeResponse res = service().grade(5L, 10L, new PracticeGradeRequest(Map.of("q1", "das"), null));

        assertThat(res.xpEarned()).isNull(); // client falls back to its own estimate
        assertThat(res.scorePercent()).isEqualTo(50);
    }

    @Test
    void unknownExerciseIs404AndRecordsNothing() {
        when(exerciseRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().quiz(404L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service().grade(5L, 404L, new PracticeGradeRequest(Map.of(), null)))
                .isInstanceOf(NotFoundException.class);
        verify(practiceService, never()).submitPracticeResult(any(), any());
    }

    @Test
    void catalogDropsContentJson() throws Exception {
        PracticeExerciseDto dto = new PracticeExerciseDto(gradable());
        when(practiceService.getExercises(null, "A1", null, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(dto)));

        var page = service().catalog(null, "A1", null, PageRequest.of(0, 20));

        JsonNode json = objectMapper.valueToTree(page.getContent());
        assertThat(allKeys(json)).doesNotContainAnyElementsOf(ANSWER_KEYS);
        assertThat(json.get(0).path("examName").asText()).isEqualTo("Artikel A1");
        assertThat(json.get(0).path("xpReward").asInt()).isEqualTo(100);
    }

    @Test
    void normalizationMatchesTheLegacyGrader() {
        assertThat(PracticeQuizService.normalizeAnswer("  Ja,  das ist ein Haus! ")).isEqualTo("ja das ist ein haus");
    }
}
