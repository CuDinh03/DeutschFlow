package com.deutschflow.ai.queue;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dọn job AI kẹt ở PENDING quá lâu.
 *
 * <p>Vì sao cần: {@link AiJobRepository#claimPendingJobs} đã lọc bỏ job quá hạn để worker không gọi
 * AI cho backlog đã hết giá trị (bài học từ sự cố 10/06–23/08: worker chết 2,5 tháng, lúc sống lại
 * suýt xử lý cả đống job cũ). Nhưng lọc mà không dọn thì job quá hạn nằm PENDING vĩnh viễn — người
 * học thấy "đang chờ" mãi và bảng cứ phình. Lớp này đóng nốt vế còn lại.
 *
 * <p>Khác {@code DataRetentionJob} ở chỗ: chỗ kia XOÁ bản ghi hết hạn lưu trữ, còn ở đây ta GIỮ bản
 * ghi và chỉ chuyển trạng thái sang FAILED, để lịch sử của người học vẫn phản ánh đúng chuyện gì đã
 * xảy ra.
 */
@Component
@Slf4j
public class StaleAiJobExpirer {

    /** Tiền tố tra cứu: SELECT count(*) FROM ai_jobs WHERE error_msg LIKE 'STALE_PENDING_EXPIRED%' */
    static final String REASON_PREFIX = "STALE_PENDING_EXPIRED";

    private final AiJobRepository aiJobRepository;
    private final boolean enabled;
    private final int maxAgeDays;

    public StaleAiJobExpirer(
            AiJobRepository aiJobRepository,
            @Value("${app.ai-jobs.expire-enabled:true}") boolean enabled,
            @Value("${app.ai-jobs.max-age-days:7}") int maxAgeDays) {
        this.aiJobRepository = aiJobRepository;
        this.enabled = enabled;
        this.maxAgeDays = Math.max(1, maxAgeDays);
    }

    /**
     * Đánh dấu FAILED job PENDING cũ hơn {@code app.ai-jobs.max-age-days}. Chạy hằng đêm 03:15,
     * trước DataRetentionJob (03:30).
     *
     * <p>CỐ Ý chỉ có MỘT method: mọi annotation (@Scheduled, @SchedulerLock, @Transactional) nằm
     * chung một entry point nên không tồn tại đường tự-gọi nào để proxy bị bỏ qua. Tách ra thành
     * "expireScheduled() gọi expireStalePendingJobs()" trông sạch hơn nhưng chính là cái bẫy đã
     * giết AiJobWorker suốt 10/06–23/08: tự-gọi trong cùng bean ⇒ @Transactional vô hiệu ⇒
     * @Modifying query ném TransactionRequiredException. Đừng tách lại.
     *
     * <p>Trả về {@code void} là BẮT BUỘC, không phải lựa chọn phong cách: ShedLock ném
     * {@code LockingNotSupportedException: Can not lock method returning primitive value} nếu method
     * mang @SchedulerLock trả về kiểu nguyên thuỷ. Số job đã đổi trạng thái xem ở log WARN bên dưới,
     * hoặc đếm bằng: SELECT count(*) FROM ai_jobs WHERE error_msg LIKE 'STALE_PENDING_EXPIRED%'.
     */
    @Scheduled(cron = "${app.ai-jobs.expire-cron:0 15 3 * * *}")
    @SchedulerLock(name = "staleAiJobExpire", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    @Transactional
    public void expireStalePendingJobs() {
        if (!enabled) {
            return;
        }
        String reason = REASON_PREFIX + ": job kẹt PENDING quá " + maxAgeDays + " ngày nên không còn được worker "
                + "nhận (xem AiJobRepository.claimPendingJobs). Người học cần chạy lại nếu vẫn muốn có đánh giá.";
        int expired = aiJobRepository.expireStalePending(maxAgeDays, reason);
        if (expired > 0) {
            log.warn("[StaleAiJobExpirer] Đã đánh dấu FAILED {} job PENDING cũ hơn {} ngày", expired, maxAgeDays);
        }
    }
}
