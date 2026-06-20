package com.deutschflow.security;

import com.deutschflow.common.security.SseTicketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for SseTicketService using the in-memory fallback (null Redis).
 * Redis-backed behaviour is structurally identical; only the storage layer changes.
 */
@DisplayName("SseTicketService (in-memory fallback) Unit Tests")
class SseTicketServiceTest {

    private final SseTicketService service = new SseTicketService(null);

    @Test
    @DisplayName("issue returns a non-blank opaque ticket")
    void issue_returnsNonBlankTicket() {
        String ticket = service.issue("user@example.com");
        assertThat(ticket).isNotBlank();
    }

    @Test
    @DisplayName("consume returns subject for a valid ticket")
    void consume_validTicket_returnsSubject() {
        String ticket = service.issue("user@example.com");

        var result = service.consume(ticket);

        assertThat(result).contains("user@example.com");
    }

    @Test
    @DisplayName("consume is single-use: second call returns empty")
    void consume_singleUse_secondCallEmpty() {
        String ticket = service.issue("user@example.com");
        service.consume(ticket); // first use

        var result = service.consume(ticket);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("consume returns empty for unknown ticket")
    void consume_unknownTicket_returnsEmpty() {
        var result = service.consume("not-a-real-ticket");
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("consume returns empty for null ticket")
    void consume_nullTicket_returnsEmpty() {
        var result = service.consume(null);
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("consume returns empty for blank ticket")
    void consume_blankTicket_returnsEmpty() {
        var result = service.consume("   ");
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("each issue call produces a distinct ticket")
    void issue_producesDistinctTickets() {
        String t1 = service.issue("a@x.com");
        String t2 = service.issue("a@x.com");
        assertThat(t1).isNotEqualTo(t2);
    }

    @Test
    @DisplayName("ttlSeconds returns positive value")
    void ttlSeconds_positive() {
        assertThat(service.ttlSeconds()).isPositive();
    }
}
