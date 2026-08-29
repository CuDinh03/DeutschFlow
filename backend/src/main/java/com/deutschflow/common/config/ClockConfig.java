package com.deutschflow.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Đồng hồ hệ thống dạng bean, để service đọc thời gian qua {@link Clock} thay vì gọi thẳng
 * {@code Instant.now()}.
 *
 * <p><b>Vì sao cần:</b> hạn mức token tính theo ngày lịch {@code Asia/Ho_Chi_Minh}
 * ({@link com.deutschflow.common.quota.QuotaVnCalendar}). Test nào dựng dữ liệu bằng đồng hồ treo
 * tường rồi gọi service tự đọc {@code Instant.now()} lần thứ hai sẽ vỡ nếu nửa đêm giờ VN rơi vào
 * giữa hai lần đọc — ví được cộng dồn hai ngày thay vì một. Có bean này thì test ghim được một mốc
 * duy nhất cho cả hai phía thay vì phụ thuộc thời điểm CI chạy.
 *
 * <p>Bối cảnh đầy đủ (lỗi gốc, công thức cộng dồn, ranh giới không được vượt):
 * {@code backend/QUOTA_CLOCK_TESTING.md}.
 *
 * <p>Production luôn dùng {@link Clock#systemUTC()} — {@code clock.instant()} trả về đúng thứ mà
 * {@code Instant.now()} trả về, không đổi hành vi.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock systemClock() {
        return Clock.systemUTC();
    }
}
