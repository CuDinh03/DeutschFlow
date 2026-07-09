package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;

import com.deutschflow.common.exception.BadRequestException;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@ExtendWith(MockitoExtension.class)
class WordQueryServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock GenderColorService genderColorService;

    @InjectMocks
    WordQueryService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    @Test
    void listWords_rejectsUnknownStatus() {
        // Validation runs before any query, so no jdbcTemplate stubbing is needed.
        assertThrows(BadRequestException.class, () -> service.listWords(
                1L, null, null, null, null, null, null, null, "BOGUS", null, 0, 20));
    }

    @Test
    void listWords_acceptsKnownStatusCaseInsensitively() {
        // 'learning' (lowercase, as the mobile chip sends it) must pass validation. It then hits
        // the mocked jdbcTemplate (null count) and fails downstream — so we assert only that a
        // valid status is NOT rejected with BadRequestException.
        try {
            service.listWords(1L, null, null, null, null, null, null, null, "learning", null, 0, 20);
        } catch (BadRequestException e) {
            throw new AssertionError("valid status must not be rejected", e);
        } catch (Exception ignored) {
            // expected: downstream failure from the mocked jdbcTemplate returning a null count
        }
    }
}
