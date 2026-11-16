package com.deutschflow.feedback;

import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Góp ý GĐ1 đi đúng chuỗi thật Spring Security → controller → Postgres (đặc tả gopycapnhat).
 * R2 được giả bằng {@link MockBean}; mọi thứ khác là thật. Tự bỏ qua khi không có Postgres.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Góp ý GĐ1: gửi, chống trùng, quyền, hộp góp ý admin, thông báo, xoá tài khoản")
class FeedbackFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private com.deutschflow.user.service.AccountDeletionService accountDeletionService;
    @Autowired private com.deutschflow.feedback.service.FeedbackOrphanCleanupService orphanCleanup;
    @MockBean private S3StorageService storage;

    private User student;
    private User other;
    private User teacher;
    private User admin;

    @BeforeEach
    void seed() {
        student = account(User.Role.STUDENT);
        other = account(User.Role.STUDENT);
        teacher = account(User.Role.TEACHER);
        admin = account(User.Role.ADMIN);
        when(storage.presignedGetUrl(anyString(), any())).thenReturn("https://signed.example/x");
    }

    @Test
    @DisplayName("FBK-09: gửi 201; gửi lại cùng clientRequestId trả cùng bản ghi, không tạo bản thứ hai")
    void submit_isIdempotentByClientRequestId() throws Exception {
        String rid = UUID.randomUUID().toString();
        Map<String, Object> first = json(submit(student, body("IDEA", "EXAM", "Cho nghe lại đoạn Hören khi luyện", rid))
                .andExpect(status().isCreated()));
        Map<String, Object> again = json(submit(student, body("IDEA", "EXAM", "Cho nghe lại đoạn Hören khi luyện", rid))
                .andExpect(status().isCreated()));

        assertThat(again.get("id")).isEqualTo(first.get("id"));
        assertThat(first.get("status")).isEqualTo("NEW");
        assertThat(first.get("title")).isEqualTo("Cho nghe lại đoạn Hören khi luyện");
        assertThat(count("SELECT count(*) FROM feedback_items WHERE user_id = ?", student.getId())).isEqualTo(1);
    }

    @Test
    @DisplayName("BR-02 + FBK-04: dưới 10 ký tự → 400; phần của vai trò khác → 400")
    void submit_validatesContentAndArea() throws Exception {
        submit(student, body("BUG", "EXAM", "Lỗi rồi!", null)).andExpect(status().isBadRequest());
        submit(student, body("IDEA", "GRADING", "Màn chấm bài khó dùng quá", null)).andExpect(status().isBadRequest());
        submit(teacher, body("IDEA", "GRADING", "Màn chấm bài khó dùng quá", null)).andExpect(status().isCreated());
    }

    @Test
    @DisplayName("Ma trận quyền: ADMIN không gửi góp ý (403); học viên không vào hộp góp ý admin (403)")
    void permissions() throws Exception {
        submit(admin, body("IDEA", "OTHER", "Admin không gửi góp ý ở đây", null)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/feedback").with(user(student))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/feedback/status").with(user(teacher))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1],\"status\":\"READ\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("FBK-10 + FBK-23: 'Góp ý của tôi' chỉ có góp ý của chính mình và không có ghi chú nội bộ")
    void mine_isScopedAndHidesInternalNote() throws Exception {
        long mine = id(submit(student, body("IDEA", "VOCABULARY", "Thêm thẻ từ vựng theo nghề", null)));
        submit(other, body("IDEA", "VOCABULARY", "Góp ý của người khác đây", null));
        mockMvc.perform(put("/api/admin/feedback/{id}/internal-note", mine).with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"BI-MAT-NOI-BO\"}"))
                .andExpect(status().isNoContent());

        String body = mockMvc.perform(get("/api/feedback/mine").with(user(student)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        List<Map<String, Object>> items = objectMapper.readValue(body, new TypeReference<>() {});
        assertThat(items).extracting(m -> ((Number) m.get("id")).longValue()).containsExactly(mine);
        assertThat(body).doesNotContain("BI-MAT-NOI-BO").doesNotContain("internalNote");
    }

    @Test
    @DisplayName("FBK-20…22 + BR-07/08: đọc, trả lời, từ chối có lý do, ra mắt chỉ báo một lần")
    void adminFlow_sendsNotificationsOnce() throws Exception {
        long id = id(submit(student, body("BUG", "SPEAKING", "Ghi âm Sprechen tự dừng trên Safari", null)));

        mockMvc.perform(post("/api/admin/feedback/{id}/mark-read", id).with(user(admin))).andExpect(status().isOk());
        assertThat(statusOf(id)).isEqualTo("READ");

        mockMvc.perform(post("/api/admin/feedback/{id}/replies", id).with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"Đã gặp lại lỗi, đang sửa.\"}"))
                .andExpect(status().isOk());
        assertThat(outbox("FEEDBACK_REPLIED", student)).isEqualTo(1);

        changeStatus(id, "DECLINED", "ngắn").andExpect(status().isBadRequest());

        changeStatus(id, "SHIPPED", null).andExpect(status().isOk());
        changeStatus(id, "IN_PROGRESS", null).andExpect(status().isOk());
        changeStatus(id, "SHIPPED", null).andExpect(status().isOk());
        assertThat(outbox("FEEDBACK_SHIPPED", student)).as("mở lại rồi ra mắt lần nữa không báo lần hai").isEqualTo(1);

        mockMvc.perform(get("/api/feedback/mine").with(user(student)))
                .andExpect(jsonPath("$[0].status").value("SHIPPED"))
                .andExpect(jsonPath("$[0].replies[0].body").value("Đã gặp lại lỗi, đang sửa."));

        long traces = count("SELECT count(*) FROM audit_logs WHERE event_name = 'admin.feedback.status_changed' "
                + "AND actor_user_id = ?", admin.getId());
        assertThat(traces).as("ba lần đổi trạng thái, ba vết").isEqualTo(3);
        long leaked = count("SELECT count(*) FROM audit_logs WHERE actor_user_id = ? AND metadata_json::text LIKE ?",
                admin.getId(), "%Safari%");
        assertThat(leaked).as("vết không chép nội dung góp ý").isZero();
    }

    @Test
    @DisplayName("DECLINED lưu lời giải thích thành lời trả lời và gửi FEEDBACK_REPLIED")
    void decline_requiresExplanationAndReplies() throws Exception {
        long id = id(submit(student, body("IDEA", "ROADMAP", "Cho đổi thứ tự bài trong lộ trình", null)));

        changeStatus(id, "DECLINED", "Lộ trình đang xếp theo giáo trình, chưa đổi tay được lúc này.")
                .andExpect(status().isOk());

        assertThat(statusOf(id)).isEqualTo("DECLINED");
        assertThat(count("SELECT count(*) FROM feedback_replies WHERE feedback_id = ?", id)).isEqualTo(1);
        assertThat(outbox("FEEDBACK_REPLIED", student)).isEqualTo(1);
    }

    @Test
    @DisplayName("FBK-17/28: lọc Chưa đọc, góp ý điểm thấp đứng đầu; có số đếm từng trạng thái")
    void adminList_putsLowScoresFirstInUnread() throws Exception {
        long high = id(submit(student, bodyWithScore("Ứng dụng dùng thích lắm", 5)));
        long low = id(submit(other, bodyWithScore("Khó dùng quá, không tìm thấy bài", 2)));

        Map<String, Object> page = json(mockMvc.perform(get("/api/admin/feedback").param("status", "NEW")
                .param("q", "dùng").with(user(admin))).andExpect(status().isOk()));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) page.get("items");
        List<Long> ids = items.stream().map(m -> ((Number) m.get("id")).longValue()).toList();
        assertThat(ids.indexOf(low)).isLessThan(ids.indexOf(high));
        assertThat(items.get(ids.indexOf(low)).get("lowScore")).isEqualTo(true);
        assertThat(page.get("statusCounts")).isInstanceOf(Map.class);
    }

    @Test
    @DisplayName("FBK-06 + BR-03: tải ảnh lên tiền tố feedback/, ảnh của người khác không gắn được")
    void attachments_areOwnedAndPrivate() throws Exception {
        MockMultipartFile png = new MockMultipartFile("file", "a.png", "image/png", png());
        Map<String, Object> uploaded = json(mockMvc.perform(multipart("/api/feedback/attachments").file(png)
                .with(user(student))).andExpect(status().isCreated()));
        long attachmentId = ((Number) uploaded.get("id")).longValue();
        verify(storage).uploadBytes(any(), startsWith("feedback/"), any());

        Map<String, Object> stolen = body("BUG", "EXAM", "Thử gắn ảnh của người khác", null);
        stolen.put("attachmentIds", List.of(attachmentId));
        submit(other, stolen).andExpect(status().isBadRequest());

        Map<String, Object> ok = body("BUG", "EXAM", "Lỗi hiện ở màn này, xem ảnh", null);
        ok.put("attachmentIds", List.of(attachmentId));
        long id = id(submit(student, ok));
        assertThat(count("SELECT count(*) FROM feedback_attachments WHERE feedback_id = ?", id)).isEqualTo(1);

        mockMvc.perform(delete("/api/feedback/attachments/{id}", attachmentId).with(user(student)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/admin/feedback/{id}", id).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments[0].url").value("https://signed.example/x"))
                .andExpect(jsonPath("$.authorEmail").doesNotExist());
    }

    @Test
    @DisplayName("FBK-64: xoá tài khoản xoá góp ý, ảnh, lời trả lời; file ảnh trên R2 xoá sau commit")
    void accountDeletion_removesFeedbackAndFiles() throws Exception {
        MockMultipartFile png = new MockMultipartFile("file", "a.png", "image/png", png());
        long attachmentId = ((Number) json(mockMvc.perform(multipart("/api/feedback/attachments").file(png)
                .with(user(student))).andExpect(status().isCreated())).get("id")).longValue();
        String key = jdbc.queryForObject("SELECT object_key FROM feedback_attachments WHERE id = ?", String.class,
                attachmentId);
        Map<String, Object> withImage = body("GENERAL", "OTHER", "Một nhận xét chung về ứng dụng", null);
        withImage.put("attachmentIds", List.of(attachmentId));
        long id = id(submit(student, withImage));
        mockMvc.perform(post("/api/admin/feedback/{id}/replies", id).with(user(admin))
                .contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"Cảm ơn bạn.\"}"));

        accountDeletionService.deleteAccount(student.getId());

        assertThat(count("SELECT count(*) FROM feedback_items WHERE id = ?", id)).isZero();
        assertThat(count("SELECT count(*) FROM feedback_attachments WHERE id = ?", attachmentId)).isZero();
        assertThat(count("SELECT count(*) FROM feedback_replies WHERE feedback_id = ?", id)).isZero();
        verify(storage).deleteFile(key);
    }

    @Test
    @DisplayName("Quyền ảnh: người khác không xoá được ảnh chưa gắn của mình (404, file còn); ADMIN tải ảnh → 403")
    void attachments_otherUserCannotDelete_adminCannotUpload() throws Exception {
        MockMultipartFile png = new MockMultipartFile("file", "a.png", "image/png", png());
        long attachmentId = ((Number) json(mockMvc.perform(multipart("/api/feedback/attachments").file(png)
                .with(user(student))).andExpect(status().isCreated())).get("id")).longValue();

        mockMvc.perform(delete("/api/feedback/attachments/{id}", attachmentId).with(user(other)))
                .andExpect(status().isNotFound());
        verify(storage, never()).deleteFile(anyString());
        assertThat(count("SELECT count(*) FROM feedback_attachments WHERE id = ?", attachmentId)).isEqualTo(1);

        mockMvc.perform(multipart("/api/feedback/attachments").file(png).with(user(admin)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("BR-03: ảnh tải lên quá 24 giờ chưa gắn thì bị dọn (dòng + file sau commit); ảnh đã gắn giữ nguyên")
    void orphanCleanup_removesOnlyOldUnattached() throws Exception {
        MockMultipartFile png = new MockMultipartFile("file", "a.png", "image/png", png());
        long orphan = ((Number) json(mockMvc.perform(multipart("/api/feedback/attachments").file(png)
                .with(user(student))).andExpect(status().isCreated())).get("id")).longValue();
        long fresh = ((Number) json(mockMvc.perform(multipart("/api/feedback/attachments").file(png)
                .with(user(student))).andExpect(status().isCreated())).get("id")).longValue();
        long kept = ((Number) json(mockMvc.perform(multipart("/api/feedback/attachments").file(png)
                .with(user(student))).andExpect(status().isCreated())).get("id")).longValue();
        Map<String, Object> withImage = body("BUG", "EXAM", "Lỗi hiện ở màn này, xem ảnh", null);
        withImage.put("attachmentIds", List.of(kept));
        submit(student, withImage).andExpect(status().isCreated());
        jdbc.update("UPDATE feedback_attachments SET created_at = now() - interval '25 hours' WHERE id IN (?, ?)",
                orphan, kept);
        String orphanKey = jdbc.queryForObject("SELECT object_key FROM feedback_attachments WHERE id = ?",
                String.class, orphan);

        orphanCleanup.purgeOnce(java.time.Instant.now());

        assertThat(count("SELECT count(*) FROM feedback_attachments WHERE id = ?", orphan)).isZero();
        assertThat(count("SELECT count(*) FROM feedback_attachments WHERE id IN (?, ?)", fresh, kept)).isEqualTo(2);
        verify(storage).deleteFile(orphanKey);
    }

    // ── tiện ích ─────────────────────────────────────────────────────────────

    private ResultActions submit(User who, Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/api/feedback").with(user(who))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions changeStatus(long id, String status, String explanation) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("ids", List.of(id));
        body.put("status", status);
        if (explanation != null) body.put("explanation", explanation);
        return mockMvc.perform(post("/api/admin/feedback/status").with(user(admin))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)));
    }

    private static Map<String, Object> body(String type, String area, String content, String rid) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("type", type);
        m.put("area", area);
        m.put("content", content);
        m.put("allowContact", false);
        if (rid != null) m.put("clientRequestId", rid);
        return m;
    }

    private static Map<String, Object> bodyWithScore(String content, int score) {
        Map<String, Object> m = body("GENERAL", "OTHER", content, null);
        m.put("satisfaction", score);
        return m;
    }

    private Map<String, Object> json(ResultActions result) throws Exception {
        String s = result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readValue(s, new TypeReference<>() {});
    }

    private long id(ResultActions result) throws Exception {
        return ((Number) json(result.andExpect(status().isCreated())).get("id")).longValue();
    }

    private String statusOf(long id) {
        return jdbc.queryForObject("SELECT status FROM feedback_items WHERE id = ?", String.class, id);
    }

    private long outbox(String type, User recipient) {
        return count("SELECT count(*) FROM notification_outbox WHERE notification_type = ? AND recipient_id = ?",
                type, recipient.getId());
    }

    private long count(String sql, Object... args) {
        Long n = jdbc.queryForObject(sql, Long.class, args);
        return n == null ? 0 : n;
    }

    private static byte[] png() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(30, 20, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }

    private User account(User.Role role) {
        return userRepository.save(User.builder()
                .email("fb-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("FB " + role.name())
                .role(role)
                .build());
    }
}
