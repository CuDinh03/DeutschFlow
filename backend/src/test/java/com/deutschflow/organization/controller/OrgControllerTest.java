package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.OrgClassDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.service.OrgAnalyticsService;
import com.deutschflow.organization.service.OrgBillingService;
import com.deutschflow.organization.service.OrgEntitlementService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgInvitationService;
import com.deutschflow.organization.service.OrgMembershipService;
import com.deutschflow.organization.service.OrgRosterService;
import com.deutschflow.organization.service.OrgService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Standalone MockMvc tests for {@link OrgController} POST /api/org/classes — the org-admin
 * create-class endpoint (G-3 follow-up).
 *
 * <p>Closes two coverage gaps that service-layer unit tests (OrgServiceTest) cannot reach:
 * <ul>
 *   <li><b>RBAC boundary:</b> the handler calls {@code orgGuard.assertOrgAdmin} before the service.
 *       A non-admin (guard throws {@link ForbiddenException}) must get 403 and the service must NOT
 *       run. If the guard call were ever removed, this test fails.</li>
 *   <li><b>{@code @Valid} binding:</b> a blank name, a name over 120 chars, or a null teacherId must
 *       be rejected with 400 at request-binding time — before the controller body runs.</li>
 * </ul>
 *
 * <p>{@code ForbiddenException}/{@code BadRequestException} carry {@code @ResponseStatus}, and bean
 * validation surfaces as 400 via the standalone resolver, so no {@code GlobalExceptionHandler}
 * advice is needed (null), mirroring {@link AdminOrganizationControllerTest}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OrgController — RBAC boundaries")
class OrgControllerTest {

    private MockMvc mvc;

    @Mock private OrgGuard orgGuard;
    @Mock private OrgService orgService;
    @Mock private OrgInvitationService orgInvitationService;
    @Mock private OrgMembershipService orgMembershipService;
    @Mock private OrgRosterService orgRosterService;
    @Mock private OrgAnalyticsService orgAnalyticsService;
    @Mock private OrgEntitlementService orgEntitlementService;
    @Mock private OrgBillingService orgBillingService;

    @InjectMocks private OrgController controller;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Org-admin principal — belongs to org 10 (so requireOrgId passes). */
    private final User orgAdmin = User.builder()
            .id(1L)
            .email("owner@trungtam.com")
            .role(User.Role.TEACHER)
            .displayName("Chủ trung tâm")
            .passwordHash("hashed")
            .orgId(10L)
            .build();

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, orgAdmin);
    }

    private static Map<String, Object> body(Object name, Object teacherId) {
        Map<String, Object> m = new HashMap<>();
        m.put("name", name);
        m.put("teacherId", teacherId);
        return m;
    }

    private String json(Object name, Object teacherId) throws Exception {
        return objectMapper.writeValueAsString(body(name, teacherId));
    }

    @Test
    @DisplayName("org-admin hợp lệ → 200 + lớp vừa tạo")
    void createClass_orgAdmin_returns200() throws Exception {
        OrgClassDto dto = new OrgClassDto(123L, "A1.1 Tối", "ABCD1234", 99L, LocalDateTime.now());
        when(orgService.createClass(eq(10L), eq("A1.1 Tối"), eq(99L))).thenReturn(dto);

        mvc.perform(post("/api/org/classes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("A1.1 Tối", 99)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(123))
                .andExpect(jsonPath("$.name").value("A1.1 Tối"))
                .andExpect(jsonPath("$.teacherId").value(99));
    }

    @Test
    @DisplayName("không phải org-admin (guard ném Forbidden) → 403, KHÔNG gọi service")
    void createClass_nonAdmin_returns403_serviceNotCalled() throws Exception {
        doThrow(new ForbiddenException("Chỉ quản trị viên tổ chức mới được thao tác này"))
                .when(orgGuard).assertOrgAdmin(anyLong(), anyLong());

        mvc.perform(post("/api/org/classes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("Lớp X", 99)))
                .andExpect(status().isForbidden());

        verify(orgService, never()).createClass(anyLong(), anyString(), anyLong());
    }

    @Test
    @DisplayName("tên lớp trống → 400 (@NotBlank), KHÔNG gọi service")
    void createClass_blankName_returns400() throws Exception {
        mvc.perform(post("/api/org/classes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("", 99)))
                .andExpect(status().isBadRequest());

        verify(orgService, never()).createClass(anyLong(), anyString(), anyLong());
    }

    @Test
    @DisplayName("teacherId null → 400 (@NotNull), KHÔNG gọi service")
    void createClass_nullTeacher_returns400() throws Exception {
        mvc.perform(post("/api/org/classes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("Lớp X", null)))
                .andExpect(status().isBadRequest());

        verify(orgService, never()).createClass(anyLong(), anyString(), anyLong());
    }

    @Test
    @DisplayName("tên lớp dài quá 120 ký tự → 400 (@Size)")
    void createClass_nameTooLong_returns400() throws Exception {
        String tooLong = "a".repeat(121);

        mvc.perform(post("/api/org/classes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(tooLong, 99)))
                .andExpect(status().isBadRequest());

        verify(orgService, never()).createClass(anyLong(), anyString(), anyLong());
    }

    // ── DELETE /api/org/members/{userId} — RBAC boundary (C-2/H-5) ──────────────

    @Test
    @DisplayName("DELETE member: non-admin (guard ném Forbidden) → 403, KHÔNG gọi service")
    void removeMember_nonAdmin_returns403_serviceNotCalled() throws Exception {
        doThrow(new ForbiddenException("Chỉ quản trị viên tổ chức mới được thao tác này"))
                .when(orgGuard).assertOrgAdmin(anyLong(), anyLong());

        mvc.perform(delete("/api/org/members/77"))
                .andExpect(status().isForbidden());

        verify(orgMembershipService, never()).removeMember(anyLong(), anyLong());
        verify(orgEntitlementService, never()).revokeStudent(anyLong());
    }

    // ── POST /api/org/members/{userId}/transfer-ownership — OWNER-only (C-2 recovery) ──

    @Test
    @DisplayName("transfer-ownership: OWNER hợp lệ → 200 + thành viên chủ sở hữu mới")
    void transferOwnership_owner_returns200() throws Exception {
        when(orgMembershipService.transferOwnership(eq(10L), eq(1L), eq(77L)))
                .thenReturn(new OrgMemberDto(77L, "new@trungtam.com", "Chủ mới", "OWNER", "ACTIVE", Instant.now()));

        mvc.perform(post("/api/org/members/77/transfer-ownership"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(77))
                .andExpect(jsonPath("$.role").value("OWNER"));
    }

    @Test
    @DisplayName("transfer-ownership: không phải OWNER (guard ném Forbidden) → 403, KHÔNG gọi service")
    void transferOwnership_nonOwner_returns403_serviceNotCalled() throws Exception {
        doThrow(new ForbiddenException("Chỉ chủ sở hữu tổ chức mới được thao tác này"))
                .when(orgGuard).assertOrgOwner(anyLong(), anyLong());

        mvc.perform(post("/api/org/members/77/transfer-ownership"))
                .andExpect(status().isForbidden());

        verify(orgMembershipService, never()).transferOwnership(anyLong(), anyLong(), anyLong());
    }
}
