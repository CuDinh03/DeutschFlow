package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.CreateOrgRequest;
import com.deutschflow.organization.dto.OrgDto;
import com.deutschflow.organization.service.AdminOrgService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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
        OrgDto orgDto = new OrgDto(1L, "Test School", "test-school", null, 0, "ACTIVE", 1L, 0L, 0L, 0L, null, null);
        when(adminOrgService.createOrganization(any(CreateOrgRequest.class))).thenReturn(orgDto);

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
        when(adminOrgService.createOrganization(any(CreateOrgRequest.class)))
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
        OrgDto orgDto = new OrgDto(2L, "Big School", "big-school", "PRO", 100, "ACTIVE", 0L, 0L, 0L, 0L, null, null);
        when(adminOrgService.createOrganization(any(CreateOrgRequest.class))).thenReturn(orgDto);

        CreateOrgRequest request = new CreateOrgRequest(
                "Big School", "big-school", "PRO", 100, "owner@bigschool.edu");

        mvc.perform(post("/api/admin/organizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seatLimit").value(100))
                .andExpect(jsonPath("$.planCode").value("PRO"));
    }
}
