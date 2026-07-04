package com.deutschflow.common.quota;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AiUsageLedgerServiceUnitTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock QuotaService quotaService;

    @InjectMocks
    AiUsageLedgerService service;

    @Test
    void serviceConstructedWithMocks() {
        assertThat(service).isNotNull();
    }

    // ── record() — token features still charge org pool + wallet (regression) ──

    @Test
    @DisplayName("record charges the org counter + wallet with totalTokens")
    void record_chargesPoolAndWallet() {
        service.record(7L, "GROQ", "llama", 100, 400, 500, "TEACHER_AI_GRADING", null, null);

        // org_monthly_token_counters increment + wallet debit for the full totalTokens.
        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), eq(500L), eq(7L));
        verify(quotaService).applyUsageDebit(eq(7L), eq(500L), any(Instant.class));
    }

    @Test
    @DisplayName("record with zero totalTokens does not touch counter or wallet")
    void record_zeroTokens_noCharge() {
        service.record(7L, "GROQ", "llama", 0, 0, 0, "FEATURE", null, null);

        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    // ── recordStt() — STT now draws down org pool + wallet (audit M-3) ──

    @Test
    @DisplayName("recordStt charges duration-derived tokens to org pool + wallet")
    void recordStt_chargesByDuration() {
        service.recordStt(42L, "STT_TRANSCRIBE", "whisper-large-v3", 10.0);

        // stt_usage_events insert always happens.
        verify(jdbcTemplate).update(contains("stt_usage_events"), eq(42L), eq("STT_TRANSCRIBE"),
                eq("whisper-large-v3"), eq(10.0));

        // 10s * 20 tokens/s = 200 token-equivalents charged to counter + wallet.
        ArgumentCaptor<Long> tokens = ArgumentCaptor.forClass(Long.class);
        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), tokens.capture(), eq(42L));
        assertThat(tokens.getValue()).isEqualTo(200L);
        verify(quotaService).applyUsageDebit(eq(42L), eq(200L), any(Instant.class));
    }

    @Test
    @DisplayName("recordStt with zero duration logs the event but charges nothing")
    void recordStt_zeroDuration_noCharge() {
        service.recordStt(42L, "STT_TRANSCRIBE", "whisper-large-v3", 0.0);

        verify(jdbcTemplate).update(contains("stt_usage_events"), any(), any(), any(), any());
        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    @Test
    @DisplayName("recordStt with null user charges nothing")
    void recordStt_nullUser_noCharge() {
        service.recordStt(null, "STT_TRANSCRIBE", "whisper-large-v3", 12.0);

        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }
}
