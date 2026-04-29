package com.deutschflow.grammar;

import com.deutschflow.grammar.dto.GrammarValidateRequest;
import com.deutschflow.grammar.service.LegoGrammarValidatorService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LegoGrammarValidatorServiceTest {

    private final LegoGrammarValidatorService service = new LegoGrammarValidatorService();

    @Test
    void shouldValidateCorrectOrderDragAnswer() {
        var response = service.validate(new GrammarValidateRequest(
                "ich|lerne|deutsch",
                "ich|lerne|deutsch",
                "|",
                "GRAMMAR",
                "A1"
        ));
        assertTrue(response.valid());
    }

    @Test
    void shouldDetectVerbPositionError() {
        var response = service.validate(new GrammarValidateRequest(
                "ich|deutsch|lerne",
                "ich|lerne|deutsch",
                "|",
                "GRAMMAR",
                "A1"
        ));
        assertFalse(response.valid());
        assertTrue(response.errors().stream().anyMatch(e -> "VERB_POSITION".equals(e.code())));
    }
}
