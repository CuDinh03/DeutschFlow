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

        // stt_usage_events insert always happens (M-4: userId lặp lại cho subquery org_members).
        verify(jdbcTemplate).update(contains("stt_usage_events"), eq(42L), eq("STT_TRANSCRIBE"),
                eq("whisper-large-v3"), eq(10.0), eq(42L));

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

        verify(jdbcTemplate).update(contains("stt_usage_events"), any(), any(), any(), any(), any());
        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    // ── H-3 reconcile — charge chỉ ghi delta khi request đã giữ chỗ tại gate ──

    @org.junit.jupiter.api.AfterEach
    void clearHolder() {
        OrgReservationHolder.take();
    }

    @Test
    @DisplayName("với reservation trong holder: charge ghi delta = actual − reserved vào đúng org đã giữ")
    void record_withReservation_writesDeltaOnly() {
        OrgReservationHolder.replace(
                new com.deutschflow.organization.service.OrgQuotaService.OrgReservation(11L, 400L),
                r -> { throw new AssertionError("không có suất cũ để hoàn"); });

        service.record(7L, "GROQ", "gpt-oss-20b", 100, 400, 500, "SPEAKING_CHAT", null, null);

        // delta = 500 − 400 = +100, ghi thẳng theo orgId 11 (không subquery org_members).
        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), eq(11L), eq(100L), eq(100L));
        // Ví cá nhân vẫn debit đủ số thật.
        verify(quotaService).applyUsageDebit(eq(7L), eq(500L), any(Instant.class));
        // Suất đã được tiêu thụ — holder phải trống để filter cuối request không hoàn nhầm.
        assertThat(OrgReservationHolder.take()).isNull();
    }

    @Test
    @DisplayName("delta âm (thực tế ít hơn ước lượng) vẫn được ghi để trả lại phần giữ thừa")
    void record_actualBelowReserved_negativeDelta() {
        OrgReservationHolder.replace(
                new com.deutschflow.organization.service.OrgQuotaService.OrgReservation(11L, 800L),
                r -> { throw new AssertionError(); });

        service.record(7L, "GROQ", "gpt-oss-20b", 100, 200, 300, "SPEAKING_CHAT", null, null);

        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), eq(11L), eq(-500L), eq(-500L));
    }

    @Test
    @DisplayName("delta = 0 (ước lượng trúng) → không đụng counter, chỉ debit ví")
    void record_exactReservation_skipsCounter() {
        OrgReservationHolder.replace(
                new com.deutschflow.organization.service.OrgQuotaService.OrgReservation(11L, 500L),
                r -> { throw new AssertionError(); });

        service.record(7L, "GROQ", "gpt-oss-20b", 100, 400, 500, "SPEAKING_CHAT", null, null);

        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"),
                any(), any(), any());
        verify(quotaService).applyUsageDebit(eq(7L), eq(500L), any(Instant.class));
    }

    @Test
    @DisplayName("recordStt with null user charges nothing")
    void recordStt_nullUser_noCharge() {
        service.recordStt(null, "STT_TRANSCRIBE", "whisper-large-v3", 12.0);

        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }
}
