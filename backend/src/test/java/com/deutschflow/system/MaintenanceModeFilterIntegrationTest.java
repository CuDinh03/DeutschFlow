package com.deutschflow.system;

import com.deutschflow.system.entity.MaintenanceWindow;
import com.deutschflow.system.repository.MaintenanceWindowRepository;
import com.deutschflow.system.service.MaintenanceStateService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AC-MAINT-02 qua CHUỖI FILTER THẬT (pattern {@code RbacContractTest}): khi có window
 * ACTIVE mode FULL — user thường và khách nhận 503 problem+json {@code code=MAINTENANCE};
 * admin, {@code /api/public/system/status}, login và OPTIONS vẫn sống; ANNOUNCE_ONLY
 * không chặn gì. Tự skip khi không có Postgres.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("MaintenanceModeFilter — 503 contract through the real security chain")
class MaintenanceModeFilterIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private MaintenanceWindowRepository repository;
    @Autowired private MaintenanceStateService stateService;

    @AfterEach
    void cleanup() {
        // Context Spring cache giữa các test class — window ACTIVE sót lại sẽ 503 cả suite.
        repository.deleteAll();
        stateService.refreshNow();
    }

    private void startMaintenance(MaintenanceWindow.Mode mode) {
        repository.save(MaintenanceWindow.builder()
                .title("Nâng cấp cơ sở dữ liệu")
                .note("Dự kiến 30 phút.")
                .startsAt(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(5))
                .endsAt(LocalDateTime.now(ZoneOffset.UTC).plusMinutes(25))
                .mode(mode)
                .status(MaintenanceWindow.Status.ACTIVE)
                .autoActivate(false)
                .autoComplete(false)
                .createdBy("admin@test.local")
                .build());
        stateService.refreshNow();
    }

    @Test
    @DisplayName("không bảo trì: status trả OK, API thường không dính header bảo trì")
    void noMaintenance_statusOk() throws Exception {
        mockMvc.perform(get("/api/public/system/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.serverTimeUtc").exists())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("FULL: học viên nhận 503 problem+json code=MAINTENANCE + Retry-After + X-DF-Maintenance")
    void full_blocksStudentWith503Contract() throws Exception {
        startMaintenance(MaintenanceWindow.Mode.FULL);
        mockMvc.perform(get("/api/notifications/unread-count"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(header().string("X-DF-Maintenance", "1"))
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.extensions.code").value("MAINTENANCE"))
                .andExpect(jsonPath("$.extensions.windowId").exists())
                .andExpect(jsonPath("$.extensions.endsAtUtc").exists())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("bảo trì")));
    }

    @Test
    @DisplayName("FULL: khách chưa đăng nhập cũng nhận 503 MAINTENANCE (không phải 401 mù)")
    void full_blocksAnonymousToo() throws Exception {
        startMaintenance(MaintenanceWindow.Mode.FULL);
        mockMvc.perform(get("/api/notifications/unread-count"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.extensions.code").value("MAINTENANCE"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("FULL: admin bypass toàn phần — vẫn thao tác được console bảo trì")
    void full_adminBypasses() throws Exception {
        startMaintenance(MaintenanceWindow.Mode.FULL);
        mockMvc.perform(get("/api/admin/maintenance-windows"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("X-DF-Maintenance"));
    }

    @Test
    @DisplayName("FULL: probe status vẫn 200 với status=MAINTENANCE + thông tin window (đường dây nóng luôn trả lời)")
    void full_statusStillAnswers() throws Exception {
        startMaintenance(MaintenanceWindow.Mode.FULL);
        mockMvc.perform(get("/api/public/system/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MAINTENANCE"))
                .andExpect(jsonPath("$.active.title").value("Nâng cấp cơ sở dữ liệu"))
                .andExpect(jsonPath("$.active.endsAtUtc").exists());
    }

    @Test
    @DisplayName("FULL: login và OPTIONS không bị chặn (admin còn đường vào; preflight không được chết)")
    void full_loginAndPreflightSurvive() throws Exception {
        startMaintenance(MaintenanceWindow.Mode.FULL);
        // Sai credential → 4xx là chuyện của auth; điều cần chốt là KHÔNG phải 503 bảo trì.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"x@x.x\",\"password\":\"wrong\"}"))
                .andExpect(header().doesNotExist("X-DF-Maintenance"));
        mockMvc.perform(options("/api/notifications/unread-count"))
                .andExpect(header().doesNotExist("X-DF-Maintenance"));
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("ANNOUNCE_ONLY: không chặn API; status trả OK nhưng kèm active để client hiện banner")
    void announceOnly_doesNotBlock() throws Exception {
        startMaintenance(MaintenanceWindow.Mode.ANNOUNCE_ONLY);
        // Hợp đồng của FILTER: không 503 bảo trì, không header — controller phía sau làm gì
        // với principal mock là chuyện của nó, không chốt ở đây.
        mockMvc.perform(get("/api/notifications/unread-count"))
                .andExpect(header().doesNotExist("X-DF-Maintenance"))
                .andExpect(result -> {
                    if (result.getResponse().getStatus() == 503) {
                        throw new AssertionError("ANNOUNCE_ONLY không được chặn API (nhận 503)");
                    }
                });
        mockMvc.perform(get("/api/public/system/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.active.mode").value("ANNOUNCE_ONLY"));
    }
}
