package com.deutschflow.user.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class PersonalizationRulesetServiceUnitTest {

    private final PersonalizationRulesetService service = new PersonalizationRulesetService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
