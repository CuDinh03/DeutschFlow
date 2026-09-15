package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.organization.dto.CreateOrgRequest;
import com.deutschflow.organization.dto.OrgDetailDto;
import com.deutschflow.organization.dto.OrgDto;
import com.deutschflow.organization.dto.UpdateOrgRequest;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * T-03 (10/09/2026) — màn admin "Sửa gói & giấy phép": phần backend của
 * {@link AdminOrgService#updateOrganization} và {@link AdminOrgService#createOrganization}.
 *
 * <p>Tách khỏi {@code AdminOrgServiceLifecycleTest} (đã quá 800 dòng). Máy trạng thái D5
 * (đình chỉ/mở lại, mốc neo ân hạn) đã có ca ở lớp đó — ở đây KHÔNG lặp lại; chỉ kiểm bốn việc
 * T-03 thêm vào: clamp ghế, xoá hạn giấy phép, hai cần gạt pool nhất quán, và vết liệt kê trường
 * đổi kèm giá trị cũ/mới.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminOrgService — T-03 sửa gói/ghế/hạn mức/hạn giấy phép")
class AdminOrgServiceLicenceUpdateTest {

    private static final Long ORG_ID = 5L;
    private static final AuditActor ADMIN = new AuditActor(1L, "admin@deutschflow.vn", "ADMIN");
    private static final Instant OLD_UNTIL = Instant.parse("2026-10-31T16:59:59Z");
    private static final Instant NEW_UNTIL = Instant.parse("2026-12-31T16:59:59Z");

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrgMembershipService orgMembershipService;
    @Mock private OrgInvitationService orgInvitationService;
    @Mock private OrgMemberRepository orgMemberRepository;
    @Mock private OrgEntitlementService orgEntitlementService;
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserNotificationService userNotificationService;
    @Mock private AuditLogService auditLogService;

    private AdminOrgService service;

    @BeforeEach
    void setUp() {
        service = new AdminOrgService(organizationRepository, orgMembershipService, orgInvitationService,
                orgMemberRepository, orgEntitlementService, userRepository, passwordEncoder,
                userNotificationService, auditLogService);
    }

    /** Trung tâm ACTIVE, gói PRO, 50 ghế, pool 200k token (metered), hạn 31/10. */
    private Organization org() {
        Organization org = new Organization();
        org.setId(ORG_ID);
        org.setName("TT Test");
        org.setSlug("tt-test");
        org.setPlanCode("PRO");
        org.setSeatLimit(50);
        org.setStatus("ACTIVE");
        org.setMonthlyTokenPool(200_000L);
        org.setPoolUnlimited(false);
        org.setValidUntil(OLD_UNTIL);
        return org;
    }

    private Organization stubOrg() {
        Organization org = org();
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(organizationRepository.save(any(Organization.class))).thenAnswer(i -> i.getArgument(0));
        when(orgMemberRepository.findByIdOrgIdAndStatus(eq(ORG_ID), eq("ACTIVE"))).thenReturn(List.of());
        return org;
    }

    private static UpdateOrgRequest req(String planCode, Integer seatLimit, Instant validUntil,
                                        Long pool, Boolean unlimited, Boolean clearValidUntil) {
        return new UpdateOrgRequest(planCode, seatLimit, null, validUntil, pool, unlimited, clearValidUntil);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturedAuditMeta() {
        ArgumentCaptor<Map> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.org.updated"), eq(ADMIN),
                eq("ORG"), eq(String.valueOf(ORG_ID)), eq(ORG_ID), meta.capture());
        return meta.getValue();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> change(Map<String, Object> meta, String field) {
        Map<String, Object> changes = (Map<String, Object>) meta.get("changes");
        assertThat(changes).as("changes phải có trường " + field).containsKey(field);
        return (Map<String, Object>) changes.get(field);
    }

    // ------------------------------------------------------------------ ghế

    @Test
    @DisplayName("seatLimit âm → clamp về 0 (0 = không giới hạn có tên, không phải số âm lọt DB)")
    void updateOrganization_negativeSeatLimit_clampedToZero() {
        Organization org = stubOrg();

        OrgDto dto = service.updateOrganization(ORG_ID, req(null, -7, null, null, null, null), ADMIN);

        assertThat(org.getSeatLimit()).isZero();
        assertThat(dto.seatLimit()).isZero();
        Map<String, Object> seat = change(capturedAuditMeta(), "seatLimit");
        assertThat(seat).containsEntry("from", 50).containsEntry("to", 0);
    }

    @Test
    @DisplayName("hạ ghế dưới sĩ số: backend vẫn lưu (DEC-16 — giữ người cũ, chặn thêm mới ở upsertMember), vết ghi 50 → 30")
    void updateOrganization_lowerSeatLimit_savedAndAudited() {
        Organization org = stubOrg();

        service.updateOrganization(ORG_ID, req(null, 30, null, null, null, null), ADMIN);

        assertThat(org.getSeatLimit()).isEqualTo(30);
        Map<String, Object> meta = capturedAuditMeta();
        assertThat((List<String>) meta.get("changedFields")).containsExactly("seatLimit");
        assertThat(change(meta, "seatLimit")).containsEntry("from", 50).containsEntry("to", 30);
    }

    // ------------------------------------------------------------------ hạn giấy phép

    @Test
    @DisplayName("clearValidUntil=true → validUntil về null (vô thời hạn), vết ghi hạn cũ → null")
    void updateOrganization_clearValidUntil_setsPerpetual() {
        Organization org = stubOrg();

        OrgDto dto = service.updateOrganization(ORG_ID, req(null, null, null, null, null, true), ADMIN);

        assertThat(org.getValidUntil()).isNull();
        assertThat(dto.validUntil()).isNull();
        Map<String, Object> until = change(capturedAuditMeta(), "validUntil");
        assertThat(until).containsEntry("from", OLD_UNTIL.toString());
        assertThat(until.get("to")).isNull();
    }

    @Test
    @DisplayName("validUntil mới → áp và ghi vết dạng chuỗi ISO (không phụ thuộc module thời gian của ObjectMapper)")
    void updateOrganization_newValidUntil_appliedAndAuditedAsIso() {
        Organization org = stubOrg();

        service.updateOrganization(ORG_ID, req(null, null, NEW_UNTIL, null, null, null), ADMIN);

        assertThat(org.getValidUntil()).isEqualTo(NEW_UNTIL);
        Map<String, Object> until = change(capturedAuditMeta(), "validUntil");
        assertThat(until).containsEntry("from", OLD_UNTIL.toString()).containsEntry("to", NEW_UNTIL.toString());
    }

    @Test
    @DisplayName("vừa đặt validUntil vừa clearValidUntil=true → 400, không lưu, không ghi vết")
    void updateOrganization_setAndClearValidUntil_rejected() {
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org()));

        assertThatThrownBy(() -> service.updateOrganization(ORG_ID,
                req(null, null, NEW_UNTIL, null, null, true), ADMIN))
                .isInstanceOf(BadRequestException.class);

        verify(organizationRepository, never()).save(any());
        verify(auditLogService, never()).log(anyString(), any(AuditActor.class), anyString(), anyString(), any(), any());
    }

    // ------------------------------------------------------------------ pool AI nhân sự

    @Test
    @DisplayName("poolUnlimited=true → bật unlimited, pool GIỮ NGUYÊN kể cả khi body gửi kèm pool khác")
    void updateOrganization_poolUnlimited_keepsPoolNumber() {
        Organization org = stubOrg();

        service.updateOrganization(ORG_ID, req(null, null, null, 999L, true, null), ADMIN);

        assertThat(org.isPoolUnlimited()).isTrue();
        assertThat(org.getMonthlyTokenPool()).isEqualTo(200_000L);
        Map<String, Object> meta = capturedAuditMeta();
        assertThat((List<String>) meta.get("changedFields")).containsExactly("poolUnlimited");
        assertThat(change(meta, "poolUnlimited")).containsEntry("from", false).containsEntry("to", true);
    }

    @Test
    @DisplayName("poolUnlimited=false + pool mới → tắt unlimited và áp pool (âm clamp về 0)")
    void updateOrganization_poolMetered_appliesClampedPool() {
        Organization org = stubOrg();
        org.setPoolUnlimited(true);

        service.updateOrganization(ORG_ID, req(null, null, null, -5L, false, null), ADMIN);

        assertThat(org.isPoolUnlimited()).isFalse();
        assertThat(org.getMonthlyTokenPool()).isZero();
        Map<String, Object> meta = capturedAuditMeta();
        assertThat((List<String>) meta.get("changedFields")).containsExactly("poolUnlimited", "monthlyTokenPool");
        assertThat(change(meta, "monthlyTokenPool")).containsEntry("from", 200_000L).containsEntry("to", 0L);
    }

    // ------------------------------------------------------------------ vết

    @Test
    @DisplayName("đổi nhiều trường một lượt: vết liệt kê đúng các trường đổi kèm cũ/mới, KHÔNG liệt kê trường gửi nhưng không đổi")
    void updateOrganization_auditListsOnlyRealChanges() {
        stubOrg();

        // planCode "pro" chuẩn hoá thành PRO = giá trị cũ ⇒ không phải thay đổi.
        service.updateOrganization(ORG_ID, req("pro", 80, NEW_UNTIL, 500_000L, null, null), ADMIN);

        Map<String, Object> meta = capturedAuditMeta();
        assertThat(meta).containsEntry("fromStatus", "ACTIVE").containsEntry("toStatus", "ACTIVE");
        assertThat((List<String>) meta.get("changedFields"))
                .containsExactly("seatLimit", "validUntil", "monthlyTokenPool");
        assertThat(change(meta, "monthlyTokenPool")).containsEntry("from", 200_000L).containsEntry("to", 500_000L);
        // Không PII: bản kê chỉ có mã/số/mốc thời gian.
        assertThat(meta.keySet()).containsExactlyInAnyOrder("fromStatus", "toStatus", "changedFields", "changes");
    }

    @Test
    @DisplayName("Lưu nguyên trạng (không trường nào đổi) → KHÔNG ghi vết admin.org.updated")
    void updateOrganization_noChange_noAudit() {
        stubOrg();

        service.updateOrganization(ORG_ID, req("PRO", 50, OLD_UNTIL, 200_000L, false, false), ADMIN);

        verify(auditLogService, never()).log(anyString(), any(AuditActor.class), anyString(), anyString(), any(), any());
    }

    // ------------------------------------------------------------------ tạo org có pool

    @Test
    @DisplayName("createOrganization: nhận monthlyTokenPool/poolUnlimited lúc tạo → org mới không rơi vào 429 ORG_BUDGET_NOT_CONFIGURED")
    @SuppressWarnings("unchecked")
    void createOrganization_withPool_setsPoolAndAudits() {
        when(organizationRepository.existsBySlug("tt-moi")).thenReturn(false);
        ArgumentCaptor<Organization> saved = ArgumentCaptor.forClass(Organization.class);
        when(organizationRepository.save(saved.capture())).thenAnswer(i -> {
            Organization o = i.getArgument(0);
            o.setId(ORG_ID);
            return o;
        });
        when(orgMemberRepository.findByIdOrgIdAndStatus(eq(ORG_ID), eq("ACTIVE"))).thenReturn(List.of());

        OrgDto dto = service.createOrganization(new CreateOrgRequest("TT Mới", "tt-moi", "PRO", -3, null,
                null, null, 300_000L, false), ADMIN);

        assertThat(saved.getValue().getMonthlyTokenPool()).isEqualTo(300_000L);
        assertThat(saved.getValue().isPoolUnlimited()).isFalse();
        assertThat(saved.getValue().getSeatLimit()).as("ghế âm lúc tạo cũng clamp về 0").isZero();
        assertThat(dto.monthlyTokenPool()).isEqualTo(300_000L);

        ArgumentCaptor<Map> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.org.created"), eq(ADMIN),
                eq("ORG"), eq(String.valueOf(ORG_ID)), eq(ORG_ID), meta.capture());
        assertThat(meta.getValue()).containsEntry("monthlyTokenPool", 300_000L).containsEntry("poolUnlimited", false);
    }

    @Test
    @DisplayName("createOrganization: không truyền pool → giữ fail-safe cũ (pool=0, unlimited=false); poolUnlimited=true → unlimited")
    void createOrganization_poolDefaults() {
        when(organizationRepository.existsBySlug(anyString())).thenReturn(false);
        ArgumentCaptor<Organization> saved = ArgumentCaptor.forClass(Organization.class);
        when(organizationRepository.save(saved.capture())).thenAnswer(i -> {
            Organization o = i.getArgument(0);
            o.setId(ORG_ID);
            return o;
        });
        when(orgMemberRepository.findByIdOrgIdAndStatus(eq(ORG_ID), eq("ACTIVE"))).thenReturn(List.of());

        service.createOrganization(new CreateOrgRequest("A", "a", "PRO", 10, null), ADMIN);
        assertThat(saved.getValue().getMonthlyTokenPool()).isZero();
        assertThat(saved.getValue().isPoolUnlimited()).isFalse();

        service.createOrganization(new CreateOrgRequest("B", "b", "PRO", 10, null, null, null, null, true), ADMIN);
        assertThat(saved.getValue().isPoolUnlimited()).isTrue();
    }

    // ------------------------------------------------------------------ DTO chi tiết

    @Test
    @DisplayName("getOrganization: DTO chi tiết mang validUntil + suspendedAt để màn T-03 hiện đúng hạn và mốc đình chỉ")
    void getOrganization_detailCarriesLicenceFields() {
        Organization org = org();
        org.changeStatus("SUSPENDED");
        when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        when(orgInvitationService.listPending(ORG_ID)).thenReturn(List.of());

        OrgDetailDto dto = service.getOrganization(ORG_ID);

        assertThat(dto.validUntil()).isEqualTo(OLD_UNTIL);
        assertThat(dto.suspendedAt()).isNotNull();
        assertThat(dto.monthlyTokenPool()).isEqualTo(200_000L);
        assertThat(dto.poolUnlimited()).isFalse();
    }
}
