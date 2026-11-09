package com.deutschflow.common.security.support;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.ai.GuardedOpenAiChatClient;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Các chốt chặn phụ thuộc {@link SupportSessionContextHolder}: AI (client chat, cổng hạn mức, pool trung tâm) và
 * làm giàu vết audit (admin là actor, người dùng là subject).
 */
@DisplayName("Phiên hỗ trợ — chặn AI và làm giàu audit")
class SupportSessionGuardsTest {

    private static final SupportSessionContext CTX = new SupportSessionContext(77L, 1L, "admin@df.test", 9L);

    @AfterEach
    void cleanup() {
        SupportSessionContextHolder.clear();
        SupportSessionDbGuard.exit();
    }

    @Test
    @DisplayName("GuardedOpenAiChatClient: trong phiên hỗ trợ → SupportSessionReadOnlyException, provider không bị gọi")
    void guardedChatClientTrips() {
        OpenAiChatClient provider = mock(OpenAiChatClient.class);
        GuardedOpenAiChatClient guarded = new GuardedOpenAiChatClient(provider);
        SupportSessionContextHolder.set(CTX);

        assertThatThrownBy(() -> guarded.chatCompletion(List.of(), null, 0.2, 10, true))
                .isInstanceOf(SupportSessionReadOnlyException.class);
        assertThatThrownBy(() -> guarded.chatCompletionForTier(List.of(), null, 0.2, 10))
                .isInstanceOf(SupportSessionReadOnlyException.class);
        assertThatThrownBy(() -> guarded.chatCompletionStream(List.of(), null, 0.2, 10, t -> { }, r -> { }, null))
                .isInstanceOf(SupportSessionReadOnlyException.class);
        verify(provider, never()).chatCompletion(any(), any(), org.mockito.ArgumentMatchers.anyDouble(), any(),
                org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    @DisplayName("GuardedOpenAiChatClient ngoài phiên hỗ trợ → chuyển tiếp nguyên vẹn")
    void guardedChatClientDelegates() {
        OpenAiChatClient provider = mock(OpenAiChatClient.class);
        new GuardedOpenAiChatClient(provider).chatCompletion(List.of(), "m", 0.2, 10, false);
        verify(provider).chatCompletion(List.of(), "m", 0.2, 10, false);
    }

    @Test
    @DisplayName("QuotaService.assertAllowed và OrgPoolGuard trong phiên hỗ trợ → chặn trước mọi truy vấn")
    void quotaGatesTrip() {
        QuotaService quota = mock(QuotaService.class, CALLS_REAL_METHODS);
        OrgPoolGuard pool = mock(OrgPoolGuard.class, CALLS_REAL_METHODS);
        SupportSessionContextHolder.set(CTX);

        assertThatThrownBy(() -> quota.assertAllowed(9L, Instant.now(), 100L))
                .isInstanceOf(SupportSessionReadOnlyException.class)
                .extracting(e -> SupportSessionReadOnlyException.CODE).isEqualTo("SUPPORT_SESSION_READ_ONLY");
        assertThatThrownBy(() -> pool.assertOrgPoolAvailable(9L, 100L))
                .isInstanceOf(SupportSessionReadOnlyException.class);
    }

    @Test
    @DisplayName("AuditLogService: actor = admin, metadata có subject_user_id + support_session_id")
    @SuppressWarnings("unchecked")
    void auditEnrichment() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ObjectMapper mapper = new ObjectMapper();
        AuditLogService audit = new AuditLogService(jdbc, mapper);
        SupportSessionContextHolder.set(CTX);

        // Điểm gọi như GlobalExceptionHandler: actor dựng từ principal (= người dùng đích).
        audit.log("some.event", new AuditActor(9L, "hocvien@df.test", "STUDENT"), "USER", "9", Map.of("k", "v"));

        ArgumentCaptor<Object> args = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(anyString(), args.capture(), args.capture(), args.capture(), args.capture(),
                args.capture(), args.capture(), args.capture(), args.capture(), args.capture());
        List<Object> v = args.getAllValues();
        assertThat(v.get(0)).isEqualTo("some.event");
        assertThat(v.get(1)).isEqualTo(1L);
        assertThat(v.get(2)).isEqualTo("admin@df.test");
        assertThat(v.get(3)).isEqualTo("ADMIN");
        Map<String, Object> meta = mapper.readValue((String) v.get(6), Map.class);
        assertThat(meta).containsEntry("k", "v").containsEntry("subject_user_id", 9)
                .containsEntry("support_session_id", 77);
        assertThat(v.get(8)).as("trung tâm suy theo người dùng đích").isEqualTo(9L);
    }

    @Test
    @DisplayName("AuditLogService ngoài phiên hỗ trợ: giữ nguyên actor")
    void auditUnchangedOutsideSupport() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditLogService audit = new AuditLogService(jdbc, new ObjectMapper());
        audit.log("e", new AuditActor(9L, "a@b", "STUDENT"), "USER", "9", null);
        verify(jdbc).update(anyString(), eq("e"), eq(9L), eq("a@b"), eq("STUDENT"), eq("USER"), eq("9"), any(),
                any(), eq(9L));
    }
}
