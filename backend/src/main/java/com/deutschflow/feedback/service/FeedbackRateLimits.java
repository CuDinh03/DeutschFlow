package com.deutschflow.feedback.service;

import com.deutschflow.moderation.service.ModerationRateLimiterService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Hạn mức của góp ý (BR-05, FBK-68): gửi góp ý 5/giờ + 20/ngày, tải ảnh 15/giờ + 60/ngày mỗi người.
 *
 * <p>Hai bộ đếm dùng lại lớp hai cửa sổ của kiểm duyệt (Redis + dự phòng bộ nhớ) với tiền tố khoá riêng.
 * Cố ý KHÔNG đăng ký chúng làm bean: thêm bean cùng kiểu {@link ModerationRateLimiterService} sẽ làm
 * {@code ContentReportService} không biết nhận bean nào.
 */
@Component
public class FeedbackRateLimits {

    private final ModerationRateLimiterService submit;
    private final ModerationRateLimiterService upload;

    public FeedbackRateLimits(
            @Value("${app.feedback.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.feedback.rate-limit.submit-hour-max:5}") int submitHourMax,
            @Value("${app.feedback.rate-limit.submit-day-max:20}") int submitDayMax,
            @Value("${app.feedback.rate-limit.upload-hour-max:15}") int uploadHourMax,
            @Value("${app.feedback.rate-limit.upload-day-max:60}") int uploadDayMax,
            ObjectProvider<StringRedisTemplate> redis) {
        StringRedisTemplate template = redis.getIfAvailable();
        this.submit = new ModerationRateLimiterService(
                "rl:feedback:submit", enabled, submitHourMax, 3600, submitDayMax, 86400, template);
        this.upload = new ModerationRateLimiterService(
                "rl:feedback:upload", enabled, uploadHourMax, 3600, uploadDayMax, 86400, template);
    }

    public ModerationRateLimiterService submit() {
        return submit;
    }

    public ModerationRateLimiterService upload() {
        return upload;
    }
}
