package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class LocalLexiconServiceUnitTest {

    private final LocalLexiconService service = new LocalLexiconService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
