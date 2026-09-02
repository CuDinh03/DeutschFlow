package com.deutschflow.curriculum.service;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bảo vệ bất biến: job sinh bài HỎNG phải được ghi là {@code FAILED}, không phải {@code COMPLETED}.
 *
 * <p>Sự cố prod 2026-09-01: model Fireworks bị gỡ nên mọi lần sinh bài đều hỏng, nhưng
 * {@code generatePracticeSession} bắt hết ngoại lệ và TRẢ VỀ {@code Map.of("status","FAILED",…)}
 * thay vì ném ra, khiến khối {@code catch} bọc ngoài không bao giờ chạy và job được ghi
 * {@code COMPLETED} với {@code errorMessage = null}. Hai hậu quả:
 * <ul>
 *   <li>Client rẽ theo trạng thái VỎ job nên vào nhánh thành công, không thấy {@code sessionId}
 *       rồi hiện câu lỗi chung — câu tiếng Việt tử tế của backend bị nuốt.</li>
 *   <li>Mọi thống kê đếm job {@code FAILED} báo 0 trong khi 100% job hỏng ⇒ sự cố chạy âm thầm
 *       11 tiếng, không cảnh báo nào nổ. Đây chính là thứ khiến nó lọt lưới.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PracticeNodeJobSettlementTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock GroqChatClient groqChatClient;
    @Mock AiUsageLedgerService aiUsageLedgerService;
    @Mock AsyncJobService asyncJobService;
    @Mock XpService xpService;
    @Mock com.deutschflow.srs.service.SrsVocabScheduler srsVocabScheduler;
    @Mock QuotaService quotaService;
    @Mock OrgPoolGuard orgPoolGuard;

    /** Chạy thẳng trên luồng gọi để test không phải chờ CompletableFuture. */
    private final Executor directExecutor = Runnable::run;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private PracticeNodeService service;

    @BeforeEach
    void setUp() {
        service = new PracticeNodeService(
                jdbcTemplate,
                groqChatClient,
                org.mockito.Mockito.mock(com.deutschflow.ai.tier.LlmTierResolver.class),
                aiUsageLedgerService,
                objectMapper,
                asyncJobService,
                xpService,
                srsVocabScheduler,
                quotaService,
                orgPoolGuard,
                directExecutor
        );
    }

    // ─── settleJob: quyết định COMPLETED hay FAILED ──────────────────────────

    @Test
    void ghiFailedKhiKetQuaBaoFailed() throws Exception {
        UUID jobId = UUID.randomUUID();

        service.settleJob(jobId, Map.of(
                "status", "FAILED",
                "error", "Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau."));

        verify(asyncJobService).failJob(jobId, "Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau.");
        verify(asyncJobService, never()).completeJob(any(), anyString());
    }

    @Test
    void ghiFailedVoiCauDuPhongKhiThieuThongDiepLoi() throws Exception {
        UUID jobId = UUID.randomUUID();

        service.settleJob(jobId, Map.of("status", "FAILED", "error", "   "));

        verify(asyncJobService).failJob(jobId, "Sinh bài tập thất bại.");
        verify(asyncJobService, never()).completeJob(any(), anyString());
    }

    @Test
    void ghiCompletedKhiSinhBaiThanhCong() throws Exception {
        UUID jobId = UUID.randomUUID();

        service.settleJob(jobId, Map.of("sessionId", 42, "status", "ACTIVE"));

        verify(asyncJobService).completeJob(eq(jobId), anyString());
        verify(asyncJobService, never()).failJob(any(), anyString());
    }

    // ─── Đường thật: wrapper async phải đi qua settleJob ─────────────────────

    @Test
    void wrapperAsyncGhiFailedKhiSinhBaiHong() {
        UUID jobId = UUID.randomUUID();
        when(asyncJobService.createJob(anyString(), anyLong()))
                .thenReturn(AsyncJob.builder().id(jobId).jobType("GENERATE_PRACTICE").build());
        // jdbcTemplate mặc định trả danh sách rỗng ⇒ loadSourceNode ném NotFoundException, và
        // generatePracticeSession nuốt nó thành Map FAILED — đúng khuôn đã gây ra sự cố prod.

        service.startPracticeSessionAsync(7L, 106L, "HOEREN");

        verify(asyncJobService).failJob(eq(jobId), anyString());
        verify(asyncJobService, never()).completeJob(any(), anyString());
    }
}
