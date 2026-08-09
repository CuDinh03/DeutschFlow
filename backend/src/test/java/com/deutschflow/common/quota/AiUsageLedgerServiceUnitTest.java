package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgQuotaService;
import com.deutschflow.organization.service.OrgQuotaService.OrgMembership;
import com.deutschflow.organization.service.OrgQuotaService.OrgReservation;
import com.deutschflow.speaking.ai.TokenUsage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.invocation.Invocation;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 2 kênh token (26/07): charge trừ vào ĐÚNG MỘT kênh theo {@code org_members.role} —
 * STUDENT/B2C → ví cá nhân, staff org → counter pool trung tâm. Sổ cái event vẫn ghi cho mọi
 * thành viên (ledger INSERT không đổi — chỉ chỗ TRỪ tách kênh).
 */
@ExtendWith(MockitoExtension.class)
class AiUsageLedgerServiceUnitTest {

    private static final OrgMembership STUDENT_MEMBER = new OrgMembership(11L, "STUDENT");
    private static final OrgMembership TEACHER_MEMBER = new OrgMembership(11L, "TEACHER");

    @Mock JdbcTemplate jdbcTemplate;
    @Mock QuotaService quotaService;
    @Mock OrgQuotaService orgQuotaService;

    @InjectMocks
    AiUsageLedgerService service;

    @AfterEach
    void clearHolder() {
        OrgReservationHolder.take();
    }

    @Test
    void serviceConstructedWithMocks() {
        assertThat(service).isNotNull();
    }

    // ── V270: ghi phần prompt được cache để COGS thôi khai vống (~3× với chat) ──

    /**
     * Tham số của lệnh INSERT ledger (bỏ chuỗi SQL): userId, provider, model, prompt, cached,
     * completion, total, feature, requestId, sessionId, userId.
     *
     * <p>Đọc thẳng invocation của mock thay vì {@code ArgumentCaptor}/stub: tham số thứ hai của
     * {@code JdbcTemplate.update} là varargs, và matcher varargs của Mockito không khớp nổi 11 đối
     * số rời (cách kẹp còn đổi theo phiên bản). Quét invocation không cần matcher nào nên không
     * phụ thuộc chi tiết đó, và cũng không đụng giá trị trả về của các lệnh khác mà test còn lại
     * đang verify.
     */
    private Object[] ledgerInsertArgs() {
        for (Invocation inv : mockingDetails(jdbcTemplate).getInvocations()) {
            Object[] raw = inv.getArguments();
            if (raw.length > 0 && String.valueOf(raw[0]).contains("INSERT INTO ai_token_usage_events")) {
                return (raw.length == 2 && raw[1] instanceof Object[] arr)
                        ? arr
                        : Arrays.copyOfRange(raw, 1, raw.length);
            }
        }
        return null;
    }

    private Object[] insertArgs() {
        Object[] args = ledgerInsertArgs();
        assertThat(args).as("ledger INSERT phải được gọi").isNotNull();
        return args;
    }

    @Test
    @DisplayName("overload TokenUsage ghi cached_prompt_tokens vào ledger")
    void record_fromTokenUsage_writesCachedTokens() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(null);

        service.record(7L, "GROQ", "model-x",
                TokenUsage.exact(1_151, 120, 1_271, 1_150), "SPEAKING_CHAT", null, null);

        // Thứ tự tham số: userId, provider, model, prompt, cached, completion, total, …
        Object[] args = insertArgs();
        assertThat(args[3]).isEqualTo(1_151);
        assertThat(args[4]).isEqualTo(1_150);
        assertThat(args[5]).isEqualTo(120);
        assertThat(args[6]).isEqualTo(1_271);
        // Ví vẫn trừ theo TỔNG token như trước — cache làm đổi GIÁ, không đổi số token đã tiêu.
        verify(quotaService).applyUsageDebit(eq(7L), eq(1_271L), any(Instant.class));
    }

    @Test
    @DisplayName("chữ ký cũ (không có số cache) ghi cached=0 ⇒ định giá y như trước, không viết lại lịch sử")
    void record_legacySignature_writesZeroCached() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(null);

        service.record(7L, "GROQ", "model-x", 100, 400, 500, "TEACHER_AI_GRADING", null, null);

        assertThat(insertArgs()[4]).isEqualTo(0);
    }

    @Test
    @DisplayName("cached > prompt (upstream báo vô lý) bị kẹp về prompt — không tạo hàng tự mâu thuẫn")
    void record_clampsCachedAbovePrompt() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(null);

        service.record(7L, "GROQ", "model-x",
                TokenUsage.exact(100, 50, 150, 9_999), "SPEAKING_CHAT", null, null);

        assertThat(insertArgs()[4]).isEqualTo(100);
    }

    @Test
    @DisplayName("usage null: không ghi ledger, không trừ gì (call site chỉ cần kiểm null một lần)")
    void record_nullUsage_noOp() {
        service.record(7L, "GROQ", "model-x", (TokenUsage) null, "SPEAKING_CHAT", null, null);

        assertThat(ledgerInsertArgs()).as("usage null thì không được ghi ledger").isNull();
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    // ── Kênh 1: B2C + STUDENT org — ví cá nhân, KHÔNG đụng counter pool ──

    @Test
    @DisplayName("B2C (không membership): debit ví, không đụng counter pool")
    void record_b2c_debitsWalletOnly() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(null);

        service.record(7L, "GROQ", "llama", 100, 400, 500, "TEACHER_AI_GRADING", null, null);

        verify(quotaService).applyUsageDebit(eq(7L), eq(500L), any(Instant.class));
        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
    }

    @Test
    @DisplayName("HỌC VIÊN org: debit ví, counter pool trung tâm KHÔNG bị cộng (tách kênh)")
    void record_studentMember_debitsWalletOnly_poolUntouched() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(STUDENT_MEMBER);

        service.record(7L, "GROQ", "llama", 100, 400, 500, "SPEAKING_CHAT", null, null);

        verify(quotaService).applyUsageDebit(eq(7L), eq(500L), any(Instant.class));
        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
    }

    @Test
    @DisplayName("HỌC VIÊN org có suất giữ chỗ sót trong holder: KHÔNG tiêu thụ — để filter hoàn trả")
    void record_studentMember_staleReservationLeftForRefundFilter() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(STUDENT_MEMBER);
        OrgReservation stale = new OrgReservation(11L, 400L);
        OrgReservationHolder.replace(stale, r -> { throw new AssertionError("không có suất cũ"); });

        service.record(7L, "GROQ", "llama", 100, 400, 500, "SPEAKING_CHAT", null, null);

        verify(quotaService).applyUsageDebit(eq(7L), eq(500L), any(Instant.class));
        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        // Suất còn nguyên cho OrgReservationRefundFilter — không bị nuốt mất rồi lệch pool.
        assertThat(OrgReservationHolder.take()).isEqualTo(stale);
    }

    // ── Kênh 2: staff org — counter pool trung tâm, KHÔNG debit ví (Q1) ──

    @Test
    @DisplayName("Staff org (không reservation): cộng counter theo orgId membership, ví KHÔNG bị trừ")
    void record_staffMember_chargesPool_walletUntouched() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(TEACHER_MEMBER);

        service.record(7L, "GROQ", "llama", 100, 400, 500, "TEACHER_AI_GRADING", null, null);

        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), eq(11L), eq(500L));
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    @Test
    @DisplayName("record với totalTokens=0 không đụng counter lẫn ví")
    void record_zeroTokens_noCharge() {
        service.record(7L, "GROQ", "llama", 0, 0, 0, "FEATURE", null, null);

        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    // ── recordStt() — STT quy giây → token-tương-đương, theo cùng ranh giới kênh ──

    @Test
    @DisplayName("STT của staff: 10s ≈ 200 token cộng vào pool, ví không bị trừ")
    void recordStt_staff_chargesPoolByDuration() {
        when(orgQuotaService.resolveActiveMembership(42L)).thenReturn(TEACHER_MEMBER);

        service.recordStt(42L, "STT_TRANSCRIBE", "whisper-large-v3", 10.0);

        // stt_usage_events insert luôn chạy (M-4: userId lặp lại cho subquery org_members).
        verify(jdbcTemplate).update(contains("stt_usage_events"), eq(42L), eq("STT_TRANSCRIBE"),
                eq("whisper-large-v3"), eq(10.0), eq(42L));
        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), eq(11L), eq(200L));
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    @Test
    @DisplayName("STT của học viên org: trừ ví 200 token-tương-đương, pool không đổi")
    void recordStt_student_debitsWalletOnly() {
        when(orgQuotaService.resolveActiveMembership(42L)).thenReturn(STUDENT_MEMBER);

        service.recordStt(42L, "STT_TRANSCRIBE", "whisper-large-v3", 10.0);

        verify(quotaService).applyUsageDebit(eq(42L), eq(200L), any(Instant.class));
        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
    }

    @Test
    @DisplayName("recordStt với duration=0 chỉ ghi event, không charge")
    void recordStt_zeroDuration_noCharge() {
        service.recordStt(42L, "STT_TRANSCRIBE", "whisper-large-v3", 0.0);

        verify(jdbcTemplate).update(contains("stt_usage_events"), any(), any(), any(), any(), any());
        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    @Test
    @DisplayName("recordStt với user null không charge gì")
    void recordStt_nullUser_noCharge() {
        service.recordStt(null, "STT_TRANSCRIBE", "whisper-large-v3", 12.0);

        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }

    // ── H-3 reconcile — chỉ còn trên kênh staff (STUDENT không tạo reservation metered nữa) ──

    @Test
    @DisplayName("staff với reservation trong holder: charge ghi delta = actual − reserved, ví không bị trừ")
    void record_staffWithReservation_writesDeltaOnly() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(TEACHER_MEMBER);
        OrgReservationHolder.replace(new OrgReservation(11L, 400L),
                r -> { throw new AssertionError("không có suất cũ để hoàn"); });

        service.record(7L, "GROQ", "gpt-oss-20b", 100, 400, 500, "TEACHER_AI_GRADING", null, null);

        // delta = 500 − 400 = +100, ghi thẳng theo orgId 11 đã giữ.
        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), eq(11L), eq(100L), eq(100L));
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
        // Suất đã được tiêu thụ — holder phải trống để filter cuối request không hoàn nhầm.
        assertThat(OrgReservationHolder.take()).isNull();
    }

    @Test
    @DisplayName("delta âm (thực tế ít hơn ước lượng) vẫn được ghi để trả lại phần giữ thừa")
    void record_actualBelowReserved_negativeDelta() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(TEACHER_MEMBER);
        OrgReservationHolder.replace(new OrgReservation(11L, 800L),
                r -> { throw new AssertionError(); });

        service.record(7L, "GROQ", "gpt-oss-20b", 100, 200, 300, "TEACHER_AI_GRADING", null, null);

        verify(jdbcTemplate).update(contains("org_monthly_token_counters"), eq(11L), eq(-500L), eq(-500L));
    }

    @Test
    @DisplayName("delta = 0 (ước lượng trúng) → không đụng counter, ví cũng không")
    void record_exactReservation_skipsCounter() {
        when(orgQuotaService.resolveActiveMembership(7L)).thenReturn(TEACHER_MEMBER);
        OrgReservationHolder.replace(new OrgReservation(11L, 500L),
                r -> { throw new AssertionError(); });

        service.record(7L, "GROQ", "gpt-oss-20b", 100, 400, 500, "TEACHER_AI_GRADING", null, null);

        verify(jdbcTemplate, never()).update(contains("org_monthly_token_counters"),
                any(), any(), any());
        verify(quotaService, never()).applyUsageDebit(anyLong(), anyLong(), any());
    }
}
