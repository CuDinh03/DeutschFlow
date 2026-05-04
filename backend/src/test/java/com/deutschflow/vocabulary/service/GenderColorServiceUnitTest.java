package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class GenderColorServiceUnitTest {

    private final GenderColorService service = new GenderColorService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
