package com.deutschflow.grammar.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class LegoGrammarValidatorServiceUnitTest {

    private final LegoGrammarValidatorService service = new LegoGrammarValidatorService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
