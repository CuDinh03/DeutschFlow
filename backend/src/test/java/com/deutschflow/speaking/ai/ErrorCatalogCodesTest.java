package com.deutschflow.speaking.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorCatalogCodesTest {

    @Test
    void codesCompactForPrompt_includesAllOrderedCodes() {
        String compact = ErrorCatalog.codesCompactForPrompt();
        for (String code : ErrorCatalog.ORDERED_CODES) {
            assertThat(compact).contains(code);
        }
    }
}
