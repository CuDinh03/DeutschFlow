package com.deutschflow.examstudio;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nhịp nền của bộ điều phối "Tạo bộ đề tự động": mỗi 10 giây đẩy các lượt đang chạy thêm một bước. Nhịp chỉ đọc DB
 * và XẾP job; phần gọi AI chạy trên pool của AiJobWorker nên nhịp này không giữ luồng lập lịch.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamSetRunScheduler {

    private final ExamSetRunService runs;

    /** Tắt trong integration test để nhịp nền không chen vào ca test (xem ghi chú ở AiJobWorker). */
    @Value("${app.exam-studio.set-runs.scheduled-enabled:true}")
    private boolean enabled;

    @Scheduled(fixedDelayString = "${app.exam-studio.set-runs.tick-ms:10000}", initialDelay = 30_000)
    public void tick() {
        if (!enabled) return;
        try {
            runs.tickAll();
        } catch (RuntimeException e) {
            log.error("[ExamSet] nhịp điều phối lỗi: {}", e.getMessage(), e);
        }
    }
}
