package com.deutschflow.common.retention;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Vỏ lịch chạy của việc dọn bản ghi âm học viên chưa thành niên. Toàn bộ nghiệp vụ nằm ở
 * {@link MinorAudioRetentionService}; ở đây chỉ có ba thứ: giờ chạy, khoá giữa các node, và một chốt
 * bắt mọi ngoại lệ để một đêm hỏng không giết luồng scheduler của cả tiến trình.
 *
 * <p><b>04:30 giờ Việt Nam</b> — khe trống sau {@code DataRetentionJob} (03:30) và
 * {@code UserNotificationRetentionJob} (04:00). Xếp sau cả hai là cố ý: hai job kia xoá theo lô hàng
 * trăm nghìn dòng, chồng lên nhau chỉ để tranh I/O của cùng một RDS.
 *
 * <p>🪤 <b>{@code zone = "Asia/Ho_Chi_Minh"} bắt buộc.</b> Container chạy giờ UTC; không ghim zone
 * thì "04:30" thành 11:30 trưa giờ Việt Nam — job xoá chạy giữa giờ cao điểm. Cùng lý do
 * {@code MinorPolicy} ghim zone cho phép tính tuổi.
 *
 * <p>🪤 <b>{@code @SchedulerLock} đòi phương thức trả {@code void}.</b> Trả về một giá trị thì
 * ShedLock bỏ qua trong im lặng và job chạy trên MỌI node — với một job XOÁ thì đó là nhiều node
 * cùng gọi DELETE lên cùng những object S3. Số đếm của lượt chạy lấy ở
 * {@link MinorAudioRetentionService#purgeOnce(Instant)} khi cần cho ca test, không lấy ở đây.
 *
 * <p>{@code lockAtMostFor = PT30M} tính theo trần {@code max-objects-per-run}: trần mặc định 500
 * đối tượng MỖI KHO, ba kho, mỗi lần xoá S3 cỡ vài chục mili-giây ⇒ vài phút là cùng. Nửa tiếng là
 * biên rộng để một lần S3 chậm không làm khoá hết hạn giữa chừng rồi node khác nhảy vào chạy song
 * song.
 */
@Slf4j
@Component
public class MinorAudioRetentionJob {

    private final MinorAudioRetentionService retentionService;
    private final boolean enabled;

    public MinorAudioRetentionJob(
            MinorAudioRetentionService retentionService,
            @Value("${app.minor.audio-retention.enabled:true}") boolean enabled) {
        this.retentionService = retentionService;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${app.minor.audio-retention.cron:0 30 4 * * *}", zone = "Asia/Ho_Chi_Minh")
    @SchedulerLock(name = "minorAudioRetention", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void purgeMinorAudio() {
        if (!enabled) {
            return;
        }
        try {
            retentionService.purgeOnce(Instant.now());
        } catch (RuntimeException e) {
            // Dọn dẹp là việc tốt-nhất-có-thể. Ném ra khỏi đây là mất luôn các lượt sau.
            log.warn("[MinorAudioRetentionJob] lượt dọn thất bại: {}", e.getMessage(), e);
        }
    }
}
