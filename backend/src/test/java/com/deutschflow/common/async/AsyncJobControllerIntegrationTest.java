package com.deutschflow.common.async;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GAP-11: {@code GET /api/async-jobs/{id}} và {@code /stream} chỉ trả job của CHÍNH người gọi.
 *
 * <p>Chạy qua filter chain thật (JWT/method security) nên kiểm được cả 401 cho khách. Ba tài khoản:
 * chủ job, người khác cùng vai, ADMIN. Job không creator (legacy) mô phỏng bằng cách ghi thẳng entity.
 * Self-skips khi không có Postgres — xem {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("GAP-11: quyền đọc kết quả job nền ở /api/async-jobs")
class AsyncJobControllerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PAYLOAD = "{\"score\":42,\"secret\":\"owner-only\"}";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private AsyncJobService asyncJobService;
    @Autowired private AsyncJobRepository asyncJobRepository;
    @Autowired private AsyncJobSseService asyncJobSseService;

    private User owner;
    private User other;
    private User admin;

    @BeforeEach
    void seedUsers() {
        owner = upsert("asyncjob-owner@local.test", User.Role.STUDENT);
        other = upsert("asyncjob-other@local.test", User.Role.STUDENT);
        admin = upsert("asyncjob-admin@local.test", User.Role.ADMIN);
    }

    private User upsert(String email, User.Role role) {
        return userRepository.findByEmail(email).orElseGet(() -> userRepository.save(User.builder()
                .email(email).passwordHash("x").displayName(email).role(role).build()));
    }

    private AsyncJob completedJobOf(Long creatorId) {
        AsyncJob job = asyncJobService.createJob("IT_ASYNC_JOB", creatorId);
        asyncJobService.completeJob(job.getId(), PAYLOAD);
        return job;
    }

    /** Job legacy tạo trước khi bắt buộc creator — ghi thẳng entity vì service không còn overload đó. */
    private AsyncJob creatorlessCompletedJob() {
        return asyncJobRepository.save(AsyncJob.builder()
                .id(UUID.randomUUID()).jobType("LEGACY_NO_CREATOR")
                .status(AsyncJob.Status.COMPLETED.name()).resultPayload(PAYLOAD).build());
    }

    @Test
    @DisplayName("chủ job đọc được job của mình kèm resultPayload")
    void ownerReadsOwnJob() throws Exception {
        AsyncJob job = completedJobOf(owner.getId());
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()).with(user(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(job.getId().toString()))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.resultPayload").value(PAYLOAD));
    }

    @Test
    @DisplayName("người khác đã đăng nhập → 404, thân phản hồi không chứa payload")
    void otherUserGets404WithoutPayload() throws Exception {
        AsyncJob job = completedJobOf(owner.getId());
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()).with(user(other)))
                .andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString("owner-only"))));
    }

    @Test
    @DisplayName("ADMIN đọc được job của bất kỳ ai")
    void adminReadsAnyJob() throws Exception {
        AsyncJob job = completedJobOf(owner.getId());
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultPayload").value(PAYLOAD));
    }

    @Test
    @DisplayName("khách (không đăng nhập) → 401, không phải 404/200")
    void anonymousGets401() throws Exception {
        AsyncJob job = completedJobOf(owner.getId());
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("job không creator: người dùng thường 404, ADMIN vẫn đọc được")
    void creatorlessJobHiddenFromUsersButVisibleToAdmin() throws Exception {
        AsyncJob job = creatorlessCompletedJob();
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()).with(user(owner)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()).with(user(admin)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("job có endpoint riêng (GENERATE_PPTX) không đọc được qua endpoint chung, kể cả creator; ADMIN vẫn đọc")
    void scopedJobTypesAreNotServedByGenericEndpoint() throws Exception {
        AsyncJob job = asyncJobService.createJob("GENERATE_PPTX", owner.getId());
        asyncJobService.completeJob(job.getId(), PAYLOAD);
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()).with(user(owner)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/async-jobs/{id}/stream", job.getId())
                        .with(user(owner)).accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isNotFound());
        assertEquals(0, asyncJobSseService.activeEmitterCount(job.getId()));
        mockMvc.perform(get("/api/async-jobs/{id}", job.getId()).with(user(admin)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("job không tồn tại → 404 cho cả chủ lẫn ADMIN")
    void unknownJobIs404() throws Exception {
        mockMvc.perform(get("/api/async-jobs/{id}", UUID.randomUUID()).with(user(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("SSE: người khác → 404 và KHÔNG có emitter nào được đăng ký cho job")
    void streamOtherUser404AndNoEmitter() throws Exception {
        AsyncJob job = asyncJobService.createJob("IT_ASYNC_JOB", owner.getId());
        mockMvc.perform(get("/api/async-jobs/{id}/stream", job.getId())
                        .with(user(other)).accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isNotFound());
        assertEquals(0, asyncJobSseService.activeEmitterCount(job.getId()));
    }

    @Test
    @DisplayName("SSE: chủ job đăng ký được luồng; hai lần đăng ký giữ hai emitter")
    void streamOwnerRegistersEmitters() throws Exception {
        AsyncJob job = asyncJobService.createJob("IT_ASYNC_JOB", owner.getId());
        try {
            MvcResult first = mockMvc.perform(get("/api/async-jobs/{id}/stream", job.getId())
                            .with(user(owner)).accept(MediaType.TEXT_EVENT_STREAM))
                    .andExpect(request().asyncStarted())
                    .andReturn();
            assertEquals(200, first.getResponse().getStatus());
            assertEquals(1, asyncJobSseService.activeEmitterCount(job.getId()));

            mockMvc.perform(get("/api/async-jobs/{id}/stream", job.getId())
                            .with(user(owner)).accept(MediaType.TEXT_EVENT_STREAM))
                    .andExpect(request().asyncStarted());
            assertEquals(2, asyncJobSseService.activeEmitterCount(job.getId()));
        } finally {
            // Đóng luồng để không giữ emitter/async request sống qua các test khác.
            asyncJobService.completeJob(job.getId(), PAYLOAD);
        }
        assertEquals(0, asyncJobSseService.activeEmitterCount(job.getId()));
        assertEquals(PAYLOAD, asyncJobRepository.findById(job.getId()).orElseThrow().getResultPayload());
    }
}
