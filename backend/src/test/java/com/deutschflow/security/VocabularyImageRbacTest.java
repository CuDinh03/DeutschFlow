package com.deutschflow.security;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Khoá vành đai {@code /api/v2/admin/vocabulary/images/**} qua filter chain Spring Security THẬT
 * (audit F-H1, 03/09/2026).
 *
 * <p>Trước bản vá: {@code GET .../review/{wordId}} để {@code @PreAuthorize("isAuthenticated()")}
 * nên STUDENT gọi được, và 7 endpoint còn lại mở cho TEACHER dù nằm trong namespace admin —
 * trong khi prefix {@code /api/v2/admin/**} lại KHÔNG có backstop URL. Owner đã chốt đường ảnh từ
 * vựng là quản trị nội dung → ADMIN-only toàn bộ (frontend chỉ gọi từ trang
 * {@code /v2/admin/vocabulary}, không UI giáo viên nào dùng).
 *
 * <p>Sai role trên principal đã xác thực → 403; thiếu auth (anonymous) → 401, qua authentication
 * entry point. Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Vocabulary image admin RBAC contract (F-H1)")
class VocabularyImageRbacTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // ------------------------------------------------------ review (từng để isAuthenticated())

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT bị cấm (403) trên GET .../images/review/{wordId}")
    void studentForbiddenOnReview() throws Exception {
        mockMvc.perform(get("/api/v2/admin/vocabulary/images/review/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER bị cấm (403) trên GET .../images/review/{wordId}")
    void teacherForbiddenOnReview() throws Exception {
        mockMvc.perform(get("/api/v2/admin/vocabulary/images/review/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Chưa đăng nhập bị từ chối (401) trên GET .../images/review/{wordId}")
    void unauthenticatedRejectedOnReview() throws Exception {
        mockMvc.perform(get("/api/v2/admin/vocabulary/images/review/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER bị cấm (403) trên POST .../images/review/{wordId}/approve")
    void teacherForbiddenOnApprove() throws Exception {
        mockMvc.perform(post("/api/v2/admin/vocabulary/images/review/1/approve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------ override / unsplash (từng mở TEACHER)

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER bị cấm (403) trên POST .../images/{wordId}/override")
    void teacherForbiddenOnOverride() throws Exception {
        mockMvc.perform(post("/api/v2/admin/vocabulary/images/1/override")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER bị cấm (403) trên GET .../images/unsplash/search")
    void teacherForbiddenOnUnsplashSearch() throws Exception {
        mockMvc.perform(get("/api/v2/admin/vocabulary/images/unsplash/search").param("q", "hund"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT bị cấm (403) trên GET .../images/missing-count")
    void studentForbiddenOnMissingCount() throws Exception {
        mockMvc.perform(get("/api/v2/admin/vocabulary/images/missing-count"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------ batch (từng mở TEACHER)

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER bị cấm (403) trên POST .../images/batch/generate")
    void teacherForbiddenOnBatchGenerate() throws Exception {
        mockMvc.perform(post("/api/v2/admin/vocabulary/images/batch/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT bị cấm (403) trên POST .../images/batch/preview")
    void studentForbiddenOnBatchPreview() throws Exception {
        mockMvc.perform(post("/api/v2/admin/vocabulary/images/batch/preview"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------ backstop URL (bài bắt đúng F-H1)

    /**
     * Chứng minh vành đai nằm ở TẦNG URL chứ không phải nhờ {@code @PreAuthorize} của từng method.
     *
     * <p>Path dưới đây cố tình không có controller nào nhận. Nếu backstop URL bị gỡ khỏi
     * {@code SecurityConfig}, request rơi xuống {@code anyRequest().authenticated()} → STUDENT đã
     * đăng nhập QUA được authorization và nhận 404 (không tìm thấy handler). Nhận 403 nghĩa là
     * authorization chặn trước cả handler mapping — đúng thứ đã thiếu ở F-H1 và là lý do một
     * endpoint quên annotation từng gọi được bởi mọi user.
     */
    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("Backstop URL: STUDENT nhận 403 (không phải 404) trên path không tồn tại dưới namespace admin")
    void urlBackstopDeniesBeforeHandlerMapping() throws Exception {
        mockMvc.perform(get("/api/v2/admin/__backstop_probe__"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/__backstop_probe__"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------ galerie: cùng prefix, đã ADMIN-only

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER bị cấm (403) trên GET .../vocabulary/galerie/overview (backstop cùng prefix)")
    void teacherForbiddenOnGalerieAdmin() throws Exception {
        mockMvc.perform(get("/api/v2/admin/vocabulary/galerie/overview"))
                .andExpect(status().isForbidden());
    }
}
