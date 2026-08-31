package com.deutschflow.ai.queue;

import lombok.RequiredArgsConstructor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Entry point LỊCH cho việc dọn job AI kẹt — logic thật ở {@link StaleAiJobMaintenance}.
 *
 * <p>Vì sao cần: {@link AiJobRepository#claimPendingJobs} đã lọc bỏ job quá hạn để worker không gọi
 * AI cho backlog đã hết giá trị (bài học từ sự cố 10/06–23/08: worker chết 2,5 tháng, lúc sống lại
 * suýt xử lý cả đống job cũ). Nhưng lọc mà không dọn thì job quá hạn nằm PENDING vĩnh viễn — người
 * học thấy "đang chờ" mãi và bảng cứ phình. PROCESSING mồ côi (worker bị restart/deploy cắt ngang)
 * cùng số phận vì claim lẫn expirer PENDING đều không đụng tới nó.
 *
 * <p>Khác {@code DataRetentionJob} ở chỗ: chỗ kia XOÁ bản ghi hết hạn lưu trữ, còn ở đây ta GIỮ bản
 * ghi và chỉ chuyển trạng thái sang FAILED, để lịch sử của người học vẫn phản ánh đúng chuyện gì đã
 * xảy ra.
 *
 * <p>Kiến trúc chống hai cái bẫy đã đâm phải:
 * <ul>
 *   <li>KHÔNG tự-gọi method @Transactional cùng bean (proxy bị bỏ qua — chính bug đã giết
 *       AiJobWorker.claimJobs): wrapper này gọi bean {@link StaleAiJobMaintenance} qua proxy.</li>
 *   <li>KHÔNG kiểm logic qua entry point mang @SchedulerLock trong integration test: ShedLock giữ
 *       khoá trong bảng chung của DB, mà CI dùng MỘT Postgres Testcontainers cho mọi Spring context
 *       còn sống trong context-cache — scheduler nền của context khác tranh khoá làm lời gọi tay bị
 *       skip im lặng. Test gọi thẳng StaleAiJobMaintenance.</li>
 * </ul>
 *
 * <p>Method mang @SchedulerLock phải trả {@code void} (ShedLock ném LockingNotSupportedException
 * với kiểu nguyên thuỷ) — {@code SchedulerLockVoidContractTest} khoá ràng buộc này cho MỌI entry
 * point bằng quét bytecode.
 */
@Component
@RequiredArgsConstructor
public class StaleAiJobExpirer {

    private final StaleAiJobMaintenance maintenance;

    /** Job PENDING quá hạn — hằng đêm 03:15, trước DataRetentionJob (03:30). */
    @Scheduled(cron = "${app.ai-jobs.expire-cron:0 15 3 * * *}")
    @SchedulerLock(name = "staleAiJobExpire", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void expireStalePendingJobs() {
        maintenance.expireStalePending();
    }

    /**
     * Job PROCESSING mồ côi — quét mỗi ~5 phút chứ không chờ cron đêm: người học đang NGỒI NHÌN
     * spinner của chính job đó. initialDelay > 0 để không chạy ngay lúc boot (đỡ ồn khi deploy).
     */
    @Scheduled(
            fixedDelayString = "${app.ai-jobs.processing-sweep-delay-ms:300000}",
            initialDelayString = "${app.ai-jobs.processing-sweep-initial-delay-ms:60000}")
    @SchedulerLock(name = "staleAiProcessingExpire", lockAtMostFor = "PT4M", lockAtLeastFor = "PT30S")
    public void expireStaleProcessingJobs() {
        maintenance.expireStaleProcessing();
    }
}
