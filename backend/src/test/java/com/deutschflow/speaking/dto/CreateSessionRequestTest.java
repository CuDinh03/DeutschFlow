package com.deutschflow.speaking.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Trần {@code topic} 2000 (V304, 05/09/2026). Trước đó 200 làm bài giao SPEAKING_SCENARIO
 * (chuỗi "Chủ đề / Mô tả chi tiết / Gợi ý" ghép từ kịch bản AI) trả 400 ngay khi bấm bắt đầu.
 */
class CreateSessionRequestTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private boolean topicHasViolation(String topic) {
        var req = new CreateSessionRequest(topic, "A2", "DEFAULT", "V1", "LESSON", null, null, 42L);
        return !validator.validateProperty(req, "topic").isEmpty();
    }

    @Test
    void scenarioTopicLongerThanOldLimitIsAccepted() {
        String scenario = "Chủ đề: Im Restaurant bestellen\n\nMô tả chi tiết: "
                + "Sie sind mit einem Freund in einem Restaurant in Berlin. ".repeat(8)
                + "\n\nGợi ý: Was möchten Sie trinken? Haben Sie eine Speisekarte? Was kostet das?";
        assertTrue(scenario.length() > 200, "ca này phải dài hơn trần cũ 200");
        assertFalse(topicHasViolation(scenario));
    }

    @Test
    void topicAtExactly2000IsAccepted() {
        assertFalse(topicHasViolation("x".repeat(2000)));
    }

    @Test
    void topicOver2000IsRejected() {
        assertTrue(topicHasViolation("x".repeat(2001)));
    }

    @Test
    void nullTopicIsAllowed() {
        assertFalse(topicHasViolation(null));
    }
}
