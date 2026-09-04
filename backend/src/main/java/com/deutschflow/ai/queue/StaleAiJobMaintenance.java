package com.deutschflow.ai.queue;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Logic dọn job kẹt, TÁCH khỏi entry point @Scheduled của {@link StaleAiJobExpirer}.
 *
 * <p>Vì sao tách bean: entry point scheduled mang @SchedulerLock, mà ShedLock giữ khoá trong bảng
 * chung của DB ({@code lockAtLeastFor}) — trên CI, mọi Spring context còn sống trong context-cache
 * dùng CHUNG một Postgres Testcontainers, scheduler nền của các context cũ tranh khoá liên tục nên
 * integration test gọi tay entry point bị skip im lặng và assert đỏ. Test gọi thẳng bean này
 * (không khoá); wrapper scheduled gọi qua proxy nên @Transactional vẫn hiệu lực — KHÔNG có đường
 * tự-gọi nào (bẫy proxy 10/06–23/08).
 */
@Component
@Slf4j
public class StaleAiJobMaintenance {

    /** Tiền tố tra cứu: SELECT count(*) FROM ai_jobs WHERE error_msg LIKE 'STALE_PENDING_EXPIRED%' */
    static final String REASON_PREFIX = "STALE_PENDING_EXPIRED";

    /** Tiền tố tra cứu: SELECT count(*) FROM ai_jobs WHERE error_msg LIKE 'STALE_PROCESSING_EXPIRED%' */
    static final String PROCESSING_REASON_PREFIX = "STALE_PROCESSING_EXPIRED";

    private final AiJobRepository aiJobRepository;
    private final boolean enabled;
    private final int maxAgeDays;
    private final int processingMaxMinutes;

    public StaleAiJobMaintenance(
            AiJobRepository aiJobRepository,
            @Value("${app.ai-jobs.expire-enabled:true}") boolean enabled,
            @Value("${app.ai-jobs.max-age-days:7}") int maxAgeDays,
            @Value("${app.ai-jobs.processing-max-minutes:30}") int processingMaxMinutes) {
        this.aiJobRepository = aiJobRepository;
        this.enabled = enabled;
        this.maxAgeDays = Math.max(1, maxAgeDays);
        this.processingMaxMinutes = Math.max(5, processingMaxMinutes);
    }

    /** Đánh dấu FAILED job PENDING cũ hơn {@code app.ai-jobs.max-age-days}. */
    @Transactional
    public void expireStalePending() {
        if (!enabled) {
            return;
        }
        String reason = REASON_PREFIX + ": job kẹt PENDING quá " + maxAgeDays + " ngày nên không còn được worker "
                + "nhận (xem AiJobRepository.claimPendingJobs). Người học cần chạy lại nếu vẫn muốn có đánh giá.";
        int expired = aiJobRepository.expireStalePending(maxAgeDays, reason);
        if (expired > 0) {
            log.warn("[StaleAiJobMaintenance] Đã đánh dấu FAILED {} job PENDING cũ hơn {} ngày", expired, maxAgeDays);
        }
    }

    /**
     * Lease cho PROCESSING: job bị worker bỏ rơi giữa chừng (restart/deploy cắt ngang — PROCESSING
     * không có heartbeat) bị đánh FAILED sau {@code app.ai-jobs.processing-max-minutes} (mặc định
     * 30′, sàn 5′) để client/sweep của module chủ thấy lỗi thật thay vì "đang xử lý" vĩnh viễn.
     */
    @Transactional
    public void expireStaleProcessing() {
        if (!enabled) {
            return;
        }
        String reason = PROCESSING_REASON_PREFIX + ": job kẹt PROCESSING quá " + processingMaxMinutes
                + " phút — worker đã bị dừng giữa chừng (restart/deploy), không ai quay lại xử lý."
                + " Người học cần chấm lại/chạy lại nếu vẫn muốn có đánh giá.";
        int expired = aiJobRepository.expireStaleProcessing(processingMaxMinutes, reason);
        if (expired > 0) {
            log.warn("[StaleAiJobMaintenance] Đã đánh dấu FAILED {} job kẹt PROCESSING quá {} phút",
                    expired, processingMaxMinutes);
        }
    }
}
