package com.deutschflow.testsupport;

import com.deutschflow.common.quota.QuotaVnCalendar;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;

/**
 * Ghim {@link Clock} của ứng dụng vào một mốc cố định cho integration test về hạn mức token.
 *
 * <p><b>Vì sao cần:</b> ví token cộng dồn theo NGÀY LỊCH {@code Asia/Ho_Chi_Minh}. Test dựng dữ
 * liệu bằng {@code Instant.now()} rồi gọi service — service lại đọc "bây giờ" LẦN THỨ HAI ở bước
 * trừ ví. Nửa đêm giờ VN rơi vào giữa hai lần đọc là service thấy đã sang ngày mới và cộng dồn ví
 * THÊM một ngày: assert {@code grant − n} nhận về {@code 2×grant − n}. Với offset dựng dữ liệu 10
 * phút, cửa sổ vỡ là 00:00–00:10 giờ VN (17:00–17:10 UTC) mỗi ngày — đủ để CI chạy đêm đỏ oan.
 * Ghim đồng hồ khiến cả hai phía đọc CÙNG một mốc, hết phụ thuộc giờ CI chạy.
 *
 * <p><b>Ghim thôi CHƯA đủ — mốc còn phải cách xa nửa đêm VN.</b> Test dựng gói "vừa provision 10
 * phút trước" bằng {@code FIXED_NOW.minusSeconds(600)}. Đặt {@code FIXED_NOW} vào 00:05 giờ VN thì
 * mốc đó rơi sang NGÀY HÔM TRƯỚC, ví được cộng dồn hai ngày — lần này là đúng ngữ nghĩa ngày lịch,
 * chỉ có tiền đề "một ngày grant" của assert là sai. Đã thử và test đỏ đúng như vậy, nên bên dưới
 * có rào chặn để không ai vô tình dời mốc về sát ranh giới rồi lại đi truy một lỗi không tồn tại.
 *
 * <p>Bối cảnh đầy đủ: {@code backend/QUOTA_CLOCK_TESTING.md}.
 *
 * <p>Chỉ ảnh hưởng thời gian phía Java. Các đường tính theo đồng hồ DB
 * ({@code now() AT TIME ZONE 'Asia/Ho_Chi_Minh'} trong {@code org_monthly_token_counters}) không
 * đụng bean này và vẫn nhất quán với chính chúng.
 */
@TestConfiguration
public class FixedClockTestConfig {

    /**
     * 2026-05-15T12:00 giờ VN. Giữa ngày, trùng ngày với các mốc hard-code sẵn trong test hạn mức,
     * và đủ xa nửa đêm để dữ liệu dựng lệch vài chục phút vẫn nằm gọn trong một ngày lịch VN.
     */
    public static final Instant FIXED_NOW = Instant.parse("2026-05-15T05:00:00Z");

    /** Khoảng an toàn tối thiểu tới nửa đêm giờ VN — rộng hơn nhiều so với offset test dựng dữ liệu. */
    private static final Duration MIN_MARGIN_FROM_VN_MIDNIGHT = Duration.ofHours(1);

    static {
        LocalTime vnTime = FIXED_NOW.atZone(QuotaVnCalendar.ZONE).toLocalTime();
        long marginSecs = Math.min(
                vnTime.toSecondOfDay(),
                Duration.ofDays(1).toSeconds() - vnTime.toSecondOfDay());
        if (marginSecs < MIN_MARGIN_FROM_VN_MIDNIGHT.toSeconds()) {
            throw new IllegalStateException(
                    "FIXED_NOW (" + vnTime + " giờ VN) quá sát nửa đêm Asia/Ho_Chi_Minh. Test hạn mức "
                    + "dựng gói/ví lệch vài chục phút quanh mốc này; sát ranh giới thì phần dựng lệch "
                    + "sang ngày lịch khác và ví được cộng dồn thêm một ngày — assert vỡ mà không phải "
                    + "do lỗi sản phẩm. Chọn mốc cách nửa đêm VN ít nhất "
                    + MIN_MARGIN_FROM_VN_MIDNIGHT.toHours() + " giờ.");
        }
    }

    @Bean
    @Primary
    public Clock fixedClock() {
        return Clock.fixed(FIXED_NOW, ZoneOffset.UTC);
    }
}
