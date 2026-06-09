package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Exam Question Sanitizer")
class ExamQuestionSanitizerTest {

    private static final ObjectMapper om = new ObjectMapper();
    private ExamQuestionSanitizer sanitizer;

    @BeforeEach
    void setUp() {
        sanitizer = new ExamQuestionSanitizer();
    }

    // A realistic exam: a Richtig/Falsch item, a Matching item, and a Multiple-Choice item,
    // each carrying the answer key (`correct`) and an explanation the client must not see.
    private static final String SECTIONS_JSON = """
        {
          "sections": [
            {
              "name": "LESEN",
              "teile": [
                {
                  "teil": 1,
                  "items": [
                    {"id": "L1-1", "question": "Frage 1", "correct": "richtig", "explanation_vi": "vì..."},
                    {"id": "L1-2", "question": "Frage 2", "correct": "falsch"}
                  ]
                },
                {
                  "teil": 2,
                  "items": [
                    {"id": "L2-1", "text": "Aussage", "correct": "C", "explanation": "because"},
                    {"id": "L2-2", "question": "MC?", "options": {"A": "a", "B": "b"}, "correct": "B"}
                  ]
                }
              ]
            }
          ]
        }
        """;

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> itemsOf(String json) throws Exception {
        Map<String, Object> root = om.readValue(json, Map.class);
        List<Map<String, Object>> sections = (List<Map<String, Object>>) root.get("sections");
        return sections.stream()
                .flatMap(s -> ((List<Map<String, Object>>) s.get("teile")).stream())
                .flatMap(t -> ((List<Map<String, Object>>) t.get("items")).stream())
                .toList();
    }

    @Test
    @DisplayName("removes correct + explanation from every item")
    void stripAnswerKey_removesAnswerFields() throws Exception {
        String sanitized = sanitizer.stripAnswerKey(SECTIONS_JSON);

        assertNotNull(sanitized);
        for (Map<String, Object> item : itemsOf(sanitized)) {
            assertFalse(item.containsKey("correct"), "correct must be removed from " + item.get("id"));
            assertFalse(item.containsKey("correct_answer"), "correct_answer must be removed");
            assertFalse(item.containsKey("explanation_vi"), "explanation_vi must be removed");
            assertFalse(item.containsKey("explanation"), "explanation must be removed");
        }
        // Belt-and-suspenders: the literal answer strings should be gone from the payload.
        assertFalse(sanitized.contains("\"correct\""), "no 'correct' key should remain in the JSON");
        assertFalse(sanitized.contains("explanation"), "no explanation should remain in the JSON");
    }

    @Test
    @DisplayName("derives type from the answer key before stripping it")
    void stripAnswerKey_derivesType() throws Exception {
        Map<String, String> typeById = itemsOf(sanitizer.stripAnswerKey(SECTIONS_JSON)).stream()
                .collect(java.util.stream.Collectors.toMap(
                        i -> (String) i.get("id"), i -> (String) i.get("type")));

        assertEquals("RICHTIG_FALSCH", typeById.get("L1-1"));
        assertEquals("RICHTIG_FALSCH", typeById.get("L1-2"));
        assertEquals("MATCHING", typeById.get("L2-1"));
        assertEquals("MULTIPLE_CHOICE", typeById.get("L2-2"));
    }

    @Test
    @DisplayName("preserves non-answer content (question, text, options)")
    void stripAnswerKey_preservesContent() throws Exception {
        List<Map<String, Object>> items = itemsOf(sanitizer.stripAnswerKey(SECTIONS_JSON));

        Map<String, Object> mc = items.stream()
                .filter(i -> "L2-2".equals(i.get("id"))).findFirst().orElseThrow();
        assertEquals("MC?", mc.get("question"));
        assertEquals(Map.of("A", "a", "B", "b"), mc.get("options"), "options must survive (needed to render MC)");

        Map<String, Object> rf = items.stream()
                .filter(i -> "L1-1".equals(i.get("id"))).findFirst().orElseThrow();
        assertEquals("Frage 1", rf.get("question"));
    }

    @Test
    @DisplayName("handles teile serialized as an object map (not just an array)")
    void stripAnswerKey_teileAsObjectMap() throws Exception {
        String json = """
            {"sections":[{"name":"LESEN","teile":{"1":{"items":[
              {"id":"X1","correct":"richtig"}
            ]}}}]}
            """;
        String sanitized = sanitizer.stripAnswerKey(json);
        assertNotNull(sanitized);
        assertFalse(sanitized.contains("\"correct\""));
        assertTrue(sanitized.contains("RICHTIG_FALSCH"));
    }

    @Test
    @DisplayName("returns null/blank input unchanged")
    void stripAnswerKey_nullOrBlank_returnedAsIs() {
        assertNull(sanitizer.stripAnswerKey(null));
        assertEquals("", sanitizer.stripAnswerKey(""));
        assertEquals("   ", sanitizer.stripAnswerKey("   "));
    }

    @Test
    @DisplayName("returns null on malformed JSON — never the raw input")
    void stripAnswerKey_malformed_returnsNull() {
        String malformed = "{not valid json, correct: 'richtig'";
        assertNull(sanitizer.stripAnswerKey(malformed),
                "must fail safe to null, never echo the answer-bearing input back");
    }
}
