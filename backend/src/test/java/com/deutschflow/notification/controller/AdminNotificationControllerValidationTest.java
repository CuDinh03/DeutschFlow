package com.deutschflow.notification.controller;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.notification.dto.BroadcastNotificationResponse;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * C1/F-M9 (03/09/2026): title/body của broadcast trước đây chỉ @NotBlank — một body vài MB nhân bản
 * vào N hàng user_notifications + N push Expo. @Size(200/2000) phải chặn ngay tại biên, TRƯỚC khi
 * chạm service.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminNotificationController — @Size chặn payload khổng lồ (C1)")
class AdminNotificationControllerValidationTest {

    @Mock UserNotificationService userNotificationService;
    @Mock AuditLogService auditLogService;

    @InjectMocks
    AdminNotificationController controller;

    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    private static String json(String title, String body) {
        return "{\"audienceType\":\"ALL\",\"payload\":{\"title\":\"" + title + "\",\"body\":\"" + body + "\"}}";
    }

    @Test
    @DisplayName("title 201 ký tự → 400, service không được chạm")
    void oversizedTitle_isRejectedAtTheBoundary() throws Exception {
        mvc.perform(post("/api/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("a".repeat(201), "b")))
                .andExpect(status().isBadRequest());

        verify(userNotificationService, never()).broadcastToAudience(any());
    }

    @Test
    @DisplayName("body 2001 ký tự → 400, service không được chạm")
    void oversizedBody_isRejectedAtTheBoundary() throws Exception {
        mvc.perform(post("/api/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("t", "b".repeat(2001))))
                .andExpect(status().isBadRequest());

        verify(userNotificationService, never()).broadcastToAudience(any());
    }

    @Test
    @DisplayName("đúng biên (200/2000) vẫn qua — không siết quá tay")
    void boundarySizes_areAccepted() throws Exception {
        when(userNotificationService.broadcastToAudience(any()))
                .thenReturn(new BroadcastNotificationResponse(3, "sent"));

        mvc.perform(post("/api/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("a".repeat(200), "b".repeat(2000))))
                .andExpect(status().isOk());
    }
}
