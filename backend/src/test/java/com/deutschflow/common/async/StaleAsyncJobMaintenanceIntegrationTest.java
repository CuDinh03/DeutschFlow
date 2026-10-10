package com.deutschflow.common.async;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dọn job {@code async_jobs} bị bỏ rơi (restart/deploy cắt ngang việc chạy trong bộ nhớ, hoặc
 * executor từ chối nhận việc) — trước đây không có việc nền nào quét bảng này nên job nằm
 * PENDING/PROCESSING vĩnh viễn.
 *
 * <p>Gọi thẳng bean LOGIC {@link StaleAsyncJobMaintenance}, không gọi entry point mang
 * {@code @SchedulerLock}: ShedLock giữ khoá trong bảng chung, scheduler nền của context khác trong
 * context-cache tranh khoá làm lời gọi tay bị skip im lặng (cùng lý do với StaleAiJobGuardIntegrationTest).
 * Cũng vì scheduler nền có thể dọn trước ta, mọi khẳng định đọc TRẠNG THÁI hàng của chính ca này,
 * không đọc số lượng trả về.
 *
 * <p>Ngưỡng dùng giá trị mặc định: 30′ chung, 120′ cho loại chạy lâu (CURRICULUM_IMPORT_PREVIEW,
 * VIDEO_RENDER_VOCAB).
 */
@SpringBootTest
class StaleAsyncJobMaintenanceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_321L;

    @Autowired private StaleAsyncJobMaintenance maintenance;
    @Autowired private AsyncJobService asyncJobService;
    @Autowired private AsyncJobSseService sseService;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM async_jobs WHERE created_by_user_id = ?", UID);
    }

    /** Job ở {@code status}, lần cập nhật cuối cách đây {@code minutes} phút. */
    private UUID job(String type, AsyncJob.Status status, int minutes) {
        UUID id = asyncJobService.createJob(type, UID).getId();
        // updated_at do @UpdateTimestamp quản — lùi tuổi bằng SQL trực tiếp.
        jdbc.update("UPDATE async_jobs SET status = ?, updated_at = NOW() - make_interval(mins => ?) WHERE id = ?",
                status.name(), minutes, id);
        return id;
    }

    private Map<String, Object> row(UUID id) {
        return jdbc.queryForMap("SELECT status, error_message, result_payload FROM async_jobs WHERE id = ?", id);
    }

    @Test
    @DisplayName("FINISH_EXAM kẹt PENDING lẫn PROCESSING quá 30′ → FAILED kèm câu người đọc được")
    void abandonedFinishExam_isFailed() {
        UUID pending = job("FINISH_EXAM", AsyncJob.Status.PENDING, 31);
        UUID processing = job("FINISH_EXAM", AsyncJob.Status.PROCESSING, 45);

        maintenance.expireStale();

        for (UUID id : new UUID[]{pending, processing}) {
            Map<String, Object> r = row(id);
            assertThat(r.get("status")).isEqualTo("FAILED");
            assertThat(r.get("error_message")).isEqualTo(StaleAsyncJobMaintenance.EXPIRED_MESSAGE);
        }
    }

    @Test
    @DisplayName("job còn trong hạn và job đã kết thúc không bị đụng tới")
    void freshAndFinishedJobs_areLeftAlone() {
        UUID fresh = job("FINISH_EXAM", AsyncJob.Status.PROCESSING, 5);
        UUID done = job("GENERATE_PRACTICE", AsyncJob.Status.PENDING, 0);
        asyncJobService.completeJob(done, "{\"ok\":true}");
        jdbc.update("UPDATE async_jobs SET updated_at = NOW() - INTERVAL '2 days' WHERE id = ?", done);
        UUID failed = job("GENERATE_PRACTICE", AsyncJob.Status.FAILED, 600);

        maintenance.expireStale();

        assertThat(row(fresh).get("status")).isEqualTo("PROCESSING");
        assertThat(row(done).get("status")).isEqualTo("COMPLETED");
        assertThat(row(done).get("result_payload")).isEqualTo("{\"ok\":true}");
        assertThat(row(failed).get("error_message")).isNull();
    }

    @Test
    @DisplayName("loại chạy lâu (phân tích giáo trình, render video) có ngưỡng riêng 120′")
    void longRunningTypes_useTheirOwnThreshold() {
        UUID importRunning = job("CURRICULUM_IMPORT_PREVIEW", AsyncJob.Status.PROCESSING, 60);
        UUID videoRunning = job("VIDEO_RENDER_VOCAB", AsyncJob.Status.PROCESSING, 90);
        UUID importDead = job("CURRICULUM_IMPORT_PREVIEW", AsyncJob.Status.PROCESSING, 121);

        maintenance.expireStale();

        assertThat(row(importRunning).get("status")).isEqualTo("PROCESSING");
        assertThat(row(videoRunning).get("status")).isEqualTo("PROCESSING");
        assertThat(row(importDead).get("status")).isEqualTo("FAILED");
    }

    @Test
    @DisplayName("client đang nghe SSE của job bị dọn nhận sự kiện FAILED và kênh được đóng")
    void expiredJob_closesItsSseSubscribers() {
        UUID id = job("FINISH_EXAM", AsyncJob.Status.PENDING, 40);
        sseService.register(id);
        assertThat(sseService.activeEmitterCount(id)).isEqualTo(1);

        maintenance.expireStale();

        assertThat(row(id).get("status")).isEqualTo("FAILED");
        assertThat(sseService.activeEmitterCount(id)).isZero();
    }
}
