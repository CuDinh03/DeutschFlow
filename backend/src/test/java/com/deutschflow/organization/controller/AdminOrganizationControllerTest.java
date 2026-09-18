package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.CreateOrgRequest;
import com.deutschflow.organization.dto.OrgDto;
import com.deutschflow.organization.dto.OrgInvoiceDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.UpdateOrgRequest;
import com.deutschflow.organization.service.AdminOrgService;
import com.deutschflow.organization.service.OrgBillingService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lightweight standalone MockMvc test for {@link AdminOrganizationController}.
 *
 * <p>Security (role-gating) is enforced by the full Spring Security filter chain in production,
 * so we cannot test the 403 path via annotation-based {@code @PreAuthorize} in a standalone
 * MockMvc setup without loading the full application context. Instead we test the behaviour of
 * the controller <em>after</em> the guard has been evaluated:
 *
 * <ul>
 *   <li>ADMIN (authorized): service is called, 200 OK with org body</li>
 *   <li>Not-admin (simulated by service throwing ForbiddenException): 403 returned by
 *       {@link com.deutschflow.common.exception.GlobalExceptionHandler}</li>
 * </ul>
 *
 * <p>The 403-for-TEACHER path verified here mirrors what Spring Security produces for real —
 * the {@code GlobalExceptionHandler} maps {@code ForbiddenException} to HTTP 403.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminOrganizationController MockMvc Tests")
class AdminOrganizationControllerTest {

    private MockMvc mvc;

    @Mock
    private AdminOrgService adminOrgService;

    /** T-01/T-03: hai cộng tác viên còn lại của controller — trước đây để null vì chưa ca nào chạm tới. */
    @Mock
    private OrgBillingService billingService;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private AdminOrganizationController controller;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Admin user — owns an org. */
    private final User adminUser = User.builder()
            .id(1L)
            .email("admin@deutschflow.com")
            .role(User.Role.ADMIN)
            .displayName("Platform Admin")
            .passwordHash("hashed")
            .build();

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, adminUser);
    }

    // ------------------------------------------------------------------ POST /api/admin/organizations

    @Test
    @DisplayName("POST /api/admin/organizations — ADMIN caller: returns 200 with created org")
    void createOrganization_adminRole_returns200() throws Exception {
        OrgDto orgDto = new OrgDto(1L, "Test School", "test-school", null, 0, "ACTIVE", 1L, 0L, null, null, 0L, false);
        when(adminOrgService.createOrganization(any(CreateOrgRequest.class), any())).thenReturn(orgDto);

        CreateOrgRequest request = new CreateOrgRequest(
                "Test School", "test-school", null, null, "owner@school.edu");

        mvc.perform(post("/api/admin/organizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test School"))
                .andExpect(jsonPath("$.slug").value("test-school"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("POST /api/admin/organizations — service throws ForbiddenException: returns 403")
    void createOrganization_forbiddenFromService_returns403() throws Exception {
        // Simulate what happens when a non-admin slips through (service-level guard).
        when(adminOrgService.createOrganization(any(CreateOrgRequest.class), any()))
                .thenThrow(new ForbiddenException("Admin only"));

        CreateOrgRequest request = new CreateOrgRequest(
                "Any School", "any-school", null, null, null);

        mvc.perform(post("/api/admin/organizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/admin/organizations — org with name returns 200 with expected fields")
    void createOrganization_withSeatLimit_returnsOrgDto() throws Exception {
        OrgDto orgDto = new OrgDto(2L, "Big School", "big-school", "PRO", 100, "ACTIVE", 0L, 0L, null, null, 0L, false);
        when(adminOrgService.createOrganization(any(CreateOrgRequest.class), any())).thenReturn(orgDto);

        CreateOrgRequest request = new CreateOrgRequest(
                "Big School", "big-school", "PRO", 100, "owner@bigschool.edu");

        mvc.perform(post("/api/admin/organizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seatLimit").value(100))
                .andExpect(jsonPath("$.planCode").value("PRO"));
    }

    // ------------------------------------------------------------------ POST /api/admin/organizations/{id}/force-owner

    /**
     * Cổng validation (@Valid) là lớp chặn ĐẦU TIÊN của lý do bắt buộc: một body thiếu lý do phải
     * chết ở đây với 400, trước khi service kịp làm gì. Dùng JSON thô để mô phỏng đúng thứ client
     * gửi, không đi qua record (record không dựng được giá trị null cho @NotNull một cách "tự nhiên").
     */
    @Test
    @DisplayName("POST /{id}/force-owner — lý do trống / quá ngắn / thiếu người nhận: 400, KHÔNG gọi service")
    void forceOwner_invalidBody_returns400_neverCallsService() throws Exception {
        String[] badBodies = {
                "{\"newOwnerUserId\": 7, \"reason\": \"\"}",
                "{\"newOwnerUserId\": 7, \"reason\": \"   \"}",
                "{\"newOwnerUserId\": 7, \"reason\": \"ngắn quá\"}",
                "{\"newOwnerUserId\": 7}",
                "{\"reason\": \"Giám đốc cũ nghỉ việc, không bàn giao\"}",
        };
        for (String body : badBodies) {
            mvc.perform(post("/api/admin/organizations/5/force-owner")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
        verify(adminOrgService, never()).forceOwner(any(), any(), any(), any());
    }

    @Test
    @DisplayName("POST /{id}/force-owner — body hợp lệ: 200, service nhận đúng orgId / người nhận / lý do, actor là admin gọi")
    void forceOwner_validBody_returns200AndPassesArguments() throws Exception {
        String reason = "Giám đốc cũ nghỉ việc, không bàn giao tài khoản.";
        when(adminOrgService.forceOwner(any(), eq(5L), eq(7L), eq(reason)))
                .thenReturn(new OrgMemberDto(7L, "gv@tt.vn", "GV", "OWNER", "ACTIVE", Instant.now(), null));

        mvc.perform(post("/api/admin/organizations/5/force-owner")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newOwnerUserId\": 7, \"reason\": \"" + reason + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(7))
                .andExpect(jsonPath("$.role").value("OWNER"));

        verify(adminOrgService).forceOwner(
                eq(new AuditActor(adminUser.getId(), adminUser.getEmail(), "ADMIN")), eq(5L), eq(7L), eq(reason));
    }

    // ------------------------------------------------------------------ PATCH /api/admin/organizations/{id}

    /**
     * T-03: body của màn "Sửa gói & giấy phép" phải tới service NGUYÊN VẸN — kể cả hai cờ mới
     * ({@code poolUnlimited}, {@code clearValidUntil}) mà bản JSON trước T-03 chưa từng gửi. Đọc JSON
     * thô để chắc Jackson ánh xạ đúng tên trường; record có constructor compat nên một trường mới gõ
     * sai tên sẽ im lặng thành null chứ không 400.
     */
    @Test
    @DisplayName("PATCH /{id} — body JSON có seatLimit / poolUnlimited / clearValidUntil / validUntil: tới service đúng từng trường, actor là admin gọi")
    void updateOrganization_bodyReachesService_withFlagsAndActor() throws Exception {
        OrgDto orgDto = new OrgDto(5L, "TT", "tt", "ULTRA", 30, "ACTIVE", 2L, 25L,
                Instant.parse("2026-12-31T16:59:59Z"), null, 0L, true);
        when(adminOrgService.updateOrganization(eq(5L), any(UpdateOrgRequest.class), any())).thenReturn(orgDto);

        mvc.perform(patch("/api/admin/organizations/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"ultra\",\"seatLimit\":30,\"poolUnlimited\":true,"
                                + "\"validUntil\":\"2026-12-31T16:59:59Z\",\"clearValidUntil\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planCode").value("ULTRA"))
                .andExpect(jsonPath("$.poolUnlimited").value(true))
                .andExpect(jsonPath("$.validUntil").exists());

        ArgumentCaptor<UpdateOrgRequest> req = ArgumentCaptor.forClass(UpdateOrgRequest.class);
        verify(adminOrgService).updateOrganization(eq(5L), req.capture(),
                eq(new AuditActor(adminUser.getId(), adminUser.getEmail(), "ADMIN")));
        assertThat(req.getValue().planCode()).isEqualTo("ultra");
        assertThat(req.getValue().seatLimit()).isEqualTo(30);
        assertThat(req.getValue().poolUnlimited()).isTrue();
        assertThat(req.getValue().clearValidUntil()).isFalse();
        assertThat(req.getValue().validUntil()).isEqualTo(Instant.parse("2026-12-31T16:59:59Z"));
        assertThat(req.getValue().status()).isNull();
        assertThat(req.getValue().monthlyTokenPool()).isNull();
    }

    // ------------------------------------------------------------------ PATCH /{id}/invoices/{invoiceId}/status

    /**
     * T-01: nút "Đã thu" trên màn hoá đơn là thao tác TIỀN (PAID kích hoạt giấy phép) — controller
     * phải chuyển đúng orgId/invoiceId/trạng thái VÀ danh tính admin đang bấm xuống service (L-10),
     * nếu không sổ trung tâm ghi "ai đó" đã đánh dấu hoá đơn đã thu.
     */
    @Test
    @DisplayName("PATCH /{id}/invoices/{invoiceId}/status — chuyển đúng org/hoá đơn/trạng thái + danh tính admin xuống service")
    void updateInvoiceStatus_passesIdsStatusAndAdminIdentity() throws Exception {
        OrgInvoiceDto paid = new OrgInvoiceDto(42L, 5L, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31),
                25, 12_500_000L, "PAID", "DFINVABC123DEF", null, Instant.now(), Instant.now());
        when(billingService.updateStatus(5L, 42L, "PAID", adminUser.getId(), adminUser.getEmail(), "ADMIN"))
                .thenReturn(paid);

        mvc.perform(patch("/api/admin/organizations/5/invoices/42/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PAID\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.status").value("PAID"));

        verify(billingService).updateStatus(5L, 42L, "PAID", adminUser.getId(), adminUser.getEmail(), "ADMIN");
    }
}
