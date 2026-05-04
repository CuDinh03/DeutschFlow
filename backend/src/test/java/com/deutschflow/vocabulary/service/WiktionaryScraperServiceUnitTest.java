package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class WiktionaryScraperServiceUnitTest {

    private final WiktionaryScraperService service = new WiktionaryScraperService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
