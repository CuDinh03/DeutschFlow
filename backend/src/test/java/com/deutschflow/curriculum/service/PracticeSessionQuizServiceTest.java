package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * A3: đề luyện kỹ năng xuống trình duyệt KHÔNG được mang đáp án; đúng/sai chỉ có sau khi trả lời
 * (/check), đáp án chữ + giải thích chỉ có sau khi nộp (/review).
 */
@ExtendWith(MockitoExtension.class)
class PracticeSessionQuizServiceTest {

    /** Mọi tên khoá có thể chứa/suy ra đáp án — không được xuất hiện ở BẤT KỲ độ sâu nào của đề. */
    static final Set<String> ANSWER_KEYS = Set.of(
            "correctAnswer", "correct_answer", "correct_index", "correctIndex", "answer", "answers",
            "isCorrect", "is_correct", "correct", "accept_also", "correct_order", "expected_answer",
            "expected_response", "expected_phrases", "example_answer", "grading_keywords",
            "explanation", "explanation_vi", "explanation_en", "explanation_de", "grammar_rule_vi",
            "translation_vi", "sentence_vi", "solution", "pairs");

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Mock
    PracticeNodeService practiceNodeService;

    static final String LESEN_JSON = """
            {"reading_passage": {"text_type": "E-Mail", "text_de": "Liebe Nachbarn, ...", "solution": "x"},
             "exercises": [
               {"type": "READ_AND_CHOOSE", "instruction_de": "Lies.", "question_de": "Wen?",
                "options": ["Die Kollegen", "Die Nachbarn", "Die Familie"], "correct_index": 1,
                "explanation_vi": "hàng xóm", "explanation_de": "Liebe Nachbarn", "explanation_en": "neighbours"},
               {"type": "READ_AND_FILL", "sentence_with_blank": "Die Party ist am ___.", "hint_de": "Tag",
                "correct_answer": "Samstag", "accept_also": ["samstag"], "grammar_rule_vi": "rule",
                "answer": "Samstag", "isCorrect": true},
               {"type": "SPEAKING_REPEAT", "sentence_de": "Guten Morgen!", "sentence_vi": "Chào buổi sáng",
                "expected_answer": "Guten Morgen", "grading_keywords": ["Morgen"]},
               {"type": "REORDER_WORDS", "words": ["heißt", "Wie", "Sie", "?"],
                "correct_order": ["Wie", "heißt", "Sie", "?"], "translation_vi": "Bạn tên gì?"}
             ]}
            """;

    private Map<String, Object> detail(String status, String exercisesJson) throws Exception {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("sessionId", 42L);
        d.put("skillType", "LESEN");
        d.put("generation", 1);
        d.put("status", status);
        d.put("scorePercent", 0);
        d.put("exercises", MAPPER.readValue(exercisesJson, Object.class));
        d.put("sourceNodeTitle", "Begrüßung");
        d.put("sourceNodeTitleVi", "Chào hỏi");
        return d;
    }

    private PracticeSessionQuizService service() {
        return new PracticeSessionQuizService(practiceNodeService);
    }

    /** Thu mọi tên khoá trong cây JSON (đệ quy). */
    static List<String> allKeys(Object node) {
        List<String> keys = new ArrayList<>();
        if (node instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                keys.add(String.valueOf(e.getKey()));
                keys.addAll(allKeys(e.getValue()));
            }
        } else if (node instanceof Collection<?> c) {
            for (Object o : c) {
                keys.addAll(allKeys(o));
            }
        }
        return keys;
    }

    @Test
    void quizHasNoAnswerKeysAnywhere() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE", LESEN_JSON));

        Map<String, Object> quiz = service().quiz(7L, 42L);

        assertThat(allKeys(quiz)).doesNotContainAnyElementsOf(ANSWER_KEYS);
        // Serialized JSON too (what the browser actually receives).
        String json = MAPPER.writeValueAsString(quiz);
        for (String key : ANSWER_KEYS) {
            assertThat(json).doesNotContain("\"" + key + "\"");
        }
        assertThat(json).doesNotContain("Samstag").doesNotContain("hàng xóm");
    }

    @Test
    void quizKeepsWhatTheRunnerNeedsToRender() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE", LESEN_JSON));

        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) service().quiz(7L, 42L).get("exercises");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> exercises = (List<Map<String, Object>>) payload.get("exercises");

        assertThat(payload.get("reading_passage"))
                .isEqualTo(Map.of("text_type", "E-Mail", "text_de", "Liebe Nachbarn, ..."));
        assertThat(exercises).hasSize(4);
        assertThat(exercises.get(0)).containsEntry("answer_mode", "choice")
                .containsEntry("options", List.of("Die Kollegen", "Die Nachbarn", "Die Familie"));
        assertThat(exercises.get(1)).containsEntry("answer_mode", "text")
                .containsEntry("sentence_with_blank", "Die Party ist am ___.");
        assertThat(exercises.get(2)).containsEntry("answer_mode", "spoken")
                .containsEntry("sentence_de", "Guten Morgen!");
        assertThat(exercises.get(3)).containsEntry("answer_mode", "none")
                .containsEntry("words", List.of("heißt", "Wie", "Sie", "?"));
    }

    @Test
    void bareArrayPayloadStaysAnArray() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE", """
                [{"type": "LISTEN_AND_CHOOSE", "audio_transcript": "Um 14 Uhr.", "options": ["13", "14"],
                  "correct_index": 1, "explanation_vi": "x"}]
                """));

        Object exercises = service().quiz(7L, 42L).get("exercises");

        assertThat(exercises).isInstanceOf(List.class);
        assertThat(allKeys(exercises)).doesNotContainAnyElementsOf(ANSWER_KEYS);
    }

    @Test
    void checkGradesOnServerAndRevealsOnlyTheChoiceKey() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE", LESEN_JSON));

        Map<String, Object> answers = new LinkedHashMap<>();
        answers.put("0", 2);                 // wrong option
        answers.put("1", " SAMSTAG ");       // right text (case/space-insensitive)
        answers.put("2", "spoken");          // speaking self-confirm
        answers.put("99", 1);                // out of range → ignored
        answers.put("abc", 1);               // not an index → ignored

        @SuppressWarnings("unchecked")
        Map<String, Map<String, Object>> results =
                (Map<String, Map<String, Object>>) service().check(7L, 42L, answers).get("results");

        assertThat(results).containsOnlyKeys("0", "1", "2");
        assertThat(results.get("0")).containsEntry("correct", false).containsEntry("correctIndex", 1);
        // Text answers: right/wrong only — the key itself waits for /review (after submit).
        assertThat(results.get("1")).containsOnlyKeys("correct").containsEntry("correct", true);
        assertThat(results.get("2")).containsEntry("correct", true);
    }

    @Test
    void checkIgnoresTheClientCorrectFlag() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE", LESEN_JSON));

        @SuppressWarnings("unchecked")
        Map<String, Map<String, Object>> results = (Map<String, Map<String, Object>>) service()
                .check(7L, 42L, Map.of("1", Map.of("answer", "Sonntag", "correct", true))).get("results");

        assertThat(results.get("1")).containsEntry("correct", false);
    }

    @Test
    void checkOnlyReadsTheSession() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE", LESEN_JSON));

        service().check(7L, 42L, Map.of("0", 1));

        verify(practiceNodeService).getSessionDetail(7L, 42L);
        verifyNoMoreInteractions(practiceNodeService);
    }

    @Test
    void reviewRefusesBeforeSubmit() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("ACTIVE", LESEN_JSON));

        assertThatThrownBy(() -> service().review(7L, 42L)).isInstanceOf(ConflictException.class);
    }

    @Test
    void reviewAfterSubmitReturnsAnswersAndExplanations() throws Exception {
        when(practiceNodeService.getSessionDetail(7L, 42L)).thenReturn(detail("COMPLETED", LESEN_JSON));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> exercises =
                (List<Map<String, Object>>) service().review(7L, 42L).get("exercises");

        assertThat(exercises.get(0)).containsEntry("correct_index", 1).containsEntry("explanation_vi", "hàng xóm");
        assertThat(exercises.get(1)).containsEntry("correct_answer", "Samstag");
    }

    @Test
    void anotherUsersSessionIsNotFoundOnEveryRoute() {
        // Ownership lives in getSessionDetail's WHERE id = ? AND user_id = ? (see the IT for the real SQL).
        when(practiceNodeService.getSessionDetail(8L, 42L))
                .thenThrow(new NotFoundException("Practice session not found: 42"));

        assertThatThrownBy(() -> service().quiz(8L, 42L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service().check(8L, 42L, Map.of("0", 1))).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service().review(8L, 42L)).isInstanceOf(NotFoundException.class);
    }
}
