package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.payment.service.SubscriptionActivationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgEntitlementService Unit Tests")
class OrgEntitlementServiceTest {

    @Mock private SubscriptionActivationService subscriptionActivationService;
    @Mock private AuditLogService auditLogService;
    @Mock private JdbcTemplate jdbcTemplate;

    private OrgEntitlementService service;

    private static final Long USER_ID = 77L;

    @BeforeEach
    void setUp() {
        service = new OrgEntitlementService(subscriptionActivationService, auditLogService, jdbcTemplate);
    }

    // ------------------------------------------------------------------ helpers

    private Organization orgWithPlan(String planCode) {
        return Organization.builder()
                .id(1L)
                .name("Acme Org")
                .slug("acme")
                .planCode(planCode)
                .build();
    }

    private Organization orgWithPlanAndValidUntil(String planCode, Instant validUntil) {
        return Organization.builder()
                .id(1L)
                .name("Acme Org")
                .slug("acme")
                .planCode(planCode)
                .validUntil(validUntil)
                .build();
    }

    // ------------------------------------------------------------------ grantStudent — with planCode

    @Test
    @DisplayName("grantStudent with planCode: calls activateWithExplicitEnd with ORG source + notifyAdmins=false")
    void grantStudent_withPlanCode_callsActivateWithExplicitEnd() {
        Organization org = orgWithPlan("PRO");

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService).activateOrg(
                eq(USER_ID), eq("PRO"), any(Instant.class), any(Instant.class));
        // Đường cũ xoá sạch mọi gói ACTIVE — không được gọi nữa, nếu không gói cá nhân lại bị đốt.
        verify(subscriptionActivationService, never())
                .activateWithExplicitEnd(anyLong(), anyString(), any(), any(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("grantStudent with planCode: startsAt is approximately now (within 5 seconds)")
    void grantStudent_withPlanCode_startsAtIsNow() {
        Organization org = orgWithPlan("ULTRA");
        Instant before = Instant.now();

        service.grantStudent(USER_ID, org);

        ArgumentCaptor<Instant> startsAtCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(subscriptionActivationService).activateOrg(
                anyLong(), anyString(), startsAtCaptor.capture(), any(Instant.class));
        Instant startsAt = startsAtCaptor.getValue();
        assertThat(startsAt).isAfterOrEqualTo(before);
        assertThat(startsAt).isBefore(before.plusSeconds(5));
    }

    @Test
    @DisplayName("grantStudent with explicit validUntil: endsAt equals org.validUntil")
    void grantStudent_withValidUntil_endsAtEqualsValidUntil() {
        Instant validUntil = Instant.now().plus(365, ChronoUnit.DAYS);
        Organization org = orgWithPlanAndValidUntil("PRO", validUntil);

        service.grantStudent(USER_ID, org);

        ArgumentCaptor<Instant> endsAtCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(subscriptionActivationService).activateOrg(
                anyLong(), anyString(), any(Instant.class), endsAtCaptor.capture());
        assertThat(endsAtCaptor.getValue()).isEqualTo(validUntil);
    }

    @Test
    @DisplayName("grantStudent with null validUntil: endsAt falls back to ~5-year horizon")
    void grantStudent_nullValidUntil_endsAtIsDefaultHorizon() {
        Organization org = orgWithPlan("PRO"); // validUntil = null → default 1825-day horizon

        Instant before = Instant.now();
        service.grantStudent(USER_ID, org);

        ArgumentCaptor<Instant> endsAtCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(subscriptionActivationService).activateOrg(
                anyLong(), anyString(), any(Instant.class), endsAtCaptor.capture());
        Instant endsAt = endsAtCaptor.getValue();
        // Default horizon is 1825 days (≈ 5 years); verify it is well into the future
        assertThat(endsAt).isAfter(before.plus(1820, ChronoUnit.DAYS));
        assertThat(endsAt).isBefore(before.plus(1830, ChronoUnit.DAYS));
    }

    // ------------------------------------------------------------------ grantStudent — null / blank planCode

    @Test
    @DisplayName("grantStudent with null planCode: does nothing (no-op)")
    void grantStudent_nullPlanCode_doesNothing() {
        Organization org = orgWithPlan(null);

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService, never())
                .activateOrg(anyLong(), anyString(), any(), any());
    }

    @Test
    @DisplayName("grantStudent with blank planCode: does nothing (no-op)")
    void grantStudent_blankPlanCode_doesNothing() {
        Organization org = orgWithPlan("   ");

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService, never())
                .activateOrg(anyLong(), anyString(), any(), any());
    }

    @Test
    @DisplayName("grantStudent with empty planCode: does nothing (no-op)")
    void grantStudent_emptyPlanCode_doesNothing() {
        Organization org = orgWithPlan("");

        service.grantStudent(USER_ID, org);

        verify(subscriptionActivationService, never())
                .activateOrg(anyLong(), anyString(), any(), any());
    }

    // ------------------------------------------------------------------ revokeStudent

    @Test
    @DisplayName("revokeStudent: runs UPDATE setting status=ENDED for user's ORG-sourced active subscription")
    void revokeStudent_runsEndedUpdate() {
        service.revokeStudent(USER_ID);

        ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(
                anyString(),
                argsCaptor.capture()
        );
        Object[] args = argsCaptor.getValue();
        // args: [Timestamp(now), userId, "ORG"]
        assertThat(args).hasSize(3);
        assertThat(args[1]).isEqualTo(USER_ID);
        assertThat(args[2]).isEqualTo("ORG");
    }

    @Test
    @DisplayName("revokeStudent: SQL contains ENDED status and WHERE on source=ORG")
    void revokeStudent_sqlContainsEndedAndOrgSource() {
        service.revokeStudent(USER_ID);

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).update(sqlCaptor.capture(), any(Object[].class));
        String sql = sqlCaptor.getValue();
        assertThat(sql).containsIgnoringCase("ENDED");
        assertThat(sql).containsIgnoringCase("source");
    }

    @Test
    @DisplayName("revokeStudent: KHÔNG kích hoạt gói mới, nhưng PHẢI hỏi đường khôi phục")
    void revokeStudent_khongKichHoatNhungPhaiKhoiPhuc() {
        service.revokeStudent(USER_ID);

        verify(subscriptionActivationService, never())
                .activateWithExplicitEnd(anyLong(), anyString(), any(), any(), anyString(), anyBoolean());
        verify(subscriptionActivationService, never())
                .activatePlan(anyLong(), anyString(), anyInt());
        // Thiếu lời gọi này thì học viên rời trung tâm mất trắng gói cá nhân đang tạm dừng.
        verify(subscriptionActivationService).resumePausedIfAny(USER_ID);
    }

    // ------------------------------------------------------------------ sổ kiểm toán

    @Test
    @DisplayName("grantStudent: mỗi gói cá nhân bị tạm dừng ghi một dòng org_entitlement_paused")
    void grantStudent_ghiSoMoiGoiBiTamDung() {
        when(subscriptionActivationService.activateOrg(anyLong(), anyString(), any(), any()))
                .thenReturn(List.of(
                        new SubscriptionActivationService.PausedRow("APPLE", "PRO", 1_209_600L),
                        new SubscriptionActivationService.PausedRow("SEPAY", "ULTRA", 86_400L)));

        service.grantStudent(USER_ID, orgWithPlan("PRO"));

        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService, times(2)).log(
                eq("org_entitlement_paused"), isNull(), eq("USER"), eq(String.valueOf(USER_ID)),
                meta.capture());
        assertThat(meta.getAllValues()).extracting(m -> m.get("source")).containsExactly("APPLE", "SEPAY");
        assertThat(meta.getAllValues().get(0)).containsEntry("remainingSeconds", 1_209_600L);
        assertThat(meta.getAllValues().get(0)).containsEntry("orgId", 1L);
    }

    @Test
    @DisplayName("grantStudent: không có gói cá nhân nào thì KHÔNG ghi sổ")
    void grantStudent_khongCoGoiCaNhan_khongGhiSo() {
        when(subscriptionActivationService.activateOrg(anyLong(), anyString(), any(), any()))
                .thenReturn(List.of());

        service.grantStudent(USER_ID, orgWithPlan("PRO"));

        verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("revokeStudent: khôi phục được gói nào thì ghi org_entitlement_resumed")
    void revokeStudent_ghiSoKhiKhoiPhuc() {
        when(subscriptionActivationService.resumePausedIfAny(USER_ID))
                .thenReturn(Optional.of(new SubscriptionActivationService.ResumedRow("APPLE", "PRO", 604_800L)));

        service.revokeStudent(USER_ID);

        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(
                eq("org_entitlement_resumed"), isNull(), eq("USER"), eq(String.valueOf(USER_ID)),
                meta.capture());
        assertThat(meta.getValue()).containsEntry("source", "APPLE");
        assertThat(meta.getValue()).containsEntry("remainingSeconds", 604_800L);
        // Không có trung tâm nào trong ngữ cảnh khôi phục — đừng bịa orgId.
        assertThat(meta.getValue()).doesNotContainKey("orgId");
    }

    @Test
    @DisplayName("revokeStudent: không có gì để khôi phục thì KHÔNG ghi sổ")
    void revokeStudent_khongCoGiKhoiPhuc_khongGhiSo() {
        when(subscriptionActivationService.resumePausedIfAny(USER_ID)).thenReturn(Optional.empty());

        service.revokeStudent(USER_ID);

        verifyNoInteractions(auditLogService);
    }
}
