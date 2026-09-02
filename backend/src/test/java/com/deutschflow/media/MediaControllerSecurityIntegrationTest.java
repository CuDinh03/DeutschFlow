package com.deutschflow.media;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Vành đai của {@code MediaController} qua filter chain Spring Security thật. File này trước đây
 * rỗng (bị xoá ruột trong commit "backup file") — điền lại cùng bản vá audit F-M6 (03/09/2026).
 *
 * <p>{@code GET /api/v2/media/{id}} từng không gác gì, nên mọi user đăng nhập đọc được
 * {@code s3Key} / {@code url} / người upload của asset bất kỳ chỉ bằng cách dò id. Ranh giới
 * uploader-vs-admin (và quy ước trả 404 thay vì 403) được phủ ở tầng service trong
 * {@code MediaAssetServiceIntegrationTest}; ở đây chỉ khoá phần role.
 *
 * <p>Tự bỏ qua khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("MediaController security contract (F-M6)")
class MediaControllerSecurityIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(roles = "STUDENT")
    @DisplayName("STUDENT bị cấm (403) trên GET /api/v2/media/{id}")
    void studentForbiddenOnGetById() throws Exception {
        mockMvc.perform(get("/api/v2/media/1")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Chưa đăng nhập bị từ chối (401) trên GET /api/v2/media/{id}")
    void unauthenticatedRejectedOnGetById() throws Exception {
        mockMvc.perform(get("/api/v2/media/1")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    @DisplayName("TEACHER qua được cổng role, id không tồn tại thì 404 (không phải 403)")
    void teacherPassesRoleGateAndGetsNotFound() throws Exception {
        // Phân biệt "chặn ở tầng role" với "chặn ở tầng sở hữu": TEACHER phải đi qua @PreAuthorize
        // rồi mới gặp phán quyết 404 của MediaAssetService#getMediaByIdForReader.
        mockMvc.perform(get("/api/v2/media/999999999")).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Chưa đăng nhập bị từ chối (401) trên GET /api/v2/media")
    void unauthenticatedRejectedOnList() throws Exception {
        mockMvc.perform(get("/api/v2/media")).andExpect(status().isUnauthorized());
    }
}
