package com.deutschflow.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Bulkhead cho các endpoint auth ĐẮT (login/register) — giới hạn số request CÙNG LÚC được vào vùng
 * chạy BCrypt.
 *
 * <p><b>Vì sao cần thêm lớp này khi đã có rate-limit theo IP:</b> rate-limit theo IP về bản chất
 * không chặn được tấn công <i>phân tán</i>. Mười nghìn IP, mỗi IP một request/giây, không IP nào
 * chạm ngưỡng nào cả — nhưng tổng lại đủ để lấp kín toàn bộ 48 Tomcat thread bằng BCrypt. Khi đó
 * không chỉ đăng nhập chết, mà CẢ APP chết theo vì không còn thread nào phục vụ những endpoint
 * khác. Bulkhead khoanh thiệt hại lại: auth quá tải thì auth trả 429, phần còn lại vẫn chạy.
 *
 * <p>Còn một tác dụng phụ đáng kể: BCrypt là CPU-bound. Thả 48 thread cùng băm trên 2 vCPU chỉ tạo
 * ra thrashing — mỗi lần băm lâu hơn nhiều so với 70ms lý thuyết, độ trễ nổ tung, hàng đợi dồn.
 * Giữ số luồng băm đồng thời ở mức nhỏ khiến từng lần băm vẫn nhanh và CPU còn chỗ thở.
 *
 * <p><b>Timeout là trần cứng, cố ý ngắn.</b> Chốt chặn này chỉ có giá trị nếu nó từ chối NHANH:
 * request nằm chờ lâu thì vẫn đang giữ Tomcat thread — đúng thứ ta muốn tránh. Nhưng cũng không thể
 * bằng 0, vì một lớp học đăng nhập cùng lúc là chuyện thường: 30 request qua 8 permit, mỗi lượt
 * ~70ms, tổng ~260ms — nằm gọn trong ngân sách mặc định 500ms.
 *
 * <p>Cấu hình: {@code app.auth.bulkhead.*}. Đặt {@code enabled=false} là đường thoát khi chặn nhầm.
 */
@Component
@Slf4j
public class AuthConcurrencyLimiter {

    private final Semaphore semaphore;
    private final long acquireTimeoutMs;
    private final boolean enabled;
    private final int permits;

    public AuthConcurrencyLimiter(
            @Value("${app.auth.bulkhead.max-concurrent:8}")   int maxConcurrent,
            @Value("${app.auth.bulkhead.acquire-timeout-ms:500}") long acquireTimeoutMs,
            @Value("${app.auth.bulkhead.enabled:true}")       boolean enabled) {
        this.permits = Math.max(1, maxConcurrent);
        this.acquireTimeoutMs = Math.max(0L, acquireTimeoutMs);
        this.enabled = enabled;
        // fair=true: hàng đợi FIFO. Dưới tải, không-fair sẽ để một số request bị bỏ đói vô hạn
        // trong khi request mới chen ngang — nghĩa là người dùng thật thỉnh thoảng bị 429 ngẫu nhiên.
        this.semaphore = new Semaphore(this.permits, true);
        log.info("[AuthBulkhead] enabled={}, permits={}, acquire timeout={}ms",
                this.enabled, this.permits, this.acquireTimeoutMs);
    }

    /** true = được vào vùng đắt (BẮT BUỘC gọi {@link #release()} trong finally). */
    public boolean tryAcquire() throws InterruptedException {
        if (!enabled) {
            return true;
        }
        return semaphore.tryAcquire(acquireTimeoutMs, TimeUnit.MILLISECONDS);
    }

    /** Trả permit. Không được gọi khi {@link #tryAcquire()} trả false — sẽ tạo permit từ hư không. */
    public void release() {
        if (!enabled) {
            return;
        }
        semaphore.release();
    }

    /** Giây gợi ý cho client lùi lại; luôn >= 1 để header Retry-After có nghĩa. */
    public int retryAfterSeconds() {
        return 1;
    }

    /** Visible for tests. */
    int availablePermits() {
        return semaphore.availablePermits();
    }
}
