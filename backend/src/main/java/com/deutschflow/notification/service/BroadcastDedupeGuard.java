package com.deutschflow.notification.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Cửa sổ chống gửi-trùng cho các đường broadcast (audit C1/F-M9 + R-M6, 03/09/2026).
 *
 * <p>Broadcast là thao tác một-chiều tới hàng nghìn người: một cú double-click, một retry của
 * client, hay một chuỗi PATCH đổi giờ bảo trì liên tiếp đều biến thành N lượt push lặp cho TOÀN BỘ
 * user. Guard giữ một khoá theo nội-dung-và-đối-tượng trong cửa sổ ngắn (mặc định 5 phút,
 * {@code app.notifications.broadcast.dedupe-window-seconds}); lượt thứ hai cùng khoá trong cửa sổ
 * bị caller chặn lại (ném 409 ở broadcast admin, bỏ qua êm ở broadcast bảo trì).
 *
 * <p><b>Giới hạn có chủ đích:</b> trạng thái nằm trong bộ nhớ tiến trình (Caffeine) — đủ cho
 * kiến trúc một-instance hiện tại; restart giữa hai lượt gửi thì cửa sổ reset. Đổi sang khoá DB nếu
 * chạy nhiều instance.
 */
@Component
public class BroadcastDedupeGuard {

    private final Cache<String, Boolean> recent;

    public BroadcastDedupeGuard(
            @Value("${app.notifications.broadcast.dedupe-window-seconds:300}") long windowSeconds) {
        this.recent = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(Math.max(1, windowSeconds)))
                .maximumSize(10_000)
                .build();
    }

    /**
     * Giữ khoá cho {@code key}. Trả {@code true} nếu đây là lượt ĐẦU trong cửa sổ (được phép gửi);
     * {@code false} nếu một lượt cùng khoá đã chạy trong cửa sổ (trùng lặp — caller phải chặn).
     * {@code putIfAbsent} trên map của Caffeine là atomic nên hai luồng đua chỉ một bên thắng.
     */
    public boolean tryAcquire(String key) {
        return recent.asMap().putIfAbsent(key, Boolean.TRUE) == null;
    }
}
