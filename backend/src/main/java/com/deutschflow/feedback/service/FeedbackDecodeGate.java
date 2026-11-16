package com.deutschflow.feedback.service;

import com.deutschflow.common.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Trần số ảnh góp ý giải mã CÙNG LÚC trên một tiến trình. Một ảnh 40 triệu điểm ảnh chiếm vài trăm MB khi
 * giải mã; hạn mức theo người không chặn được nhiều người (hoặc nhiều luồng) cùng tải một lúc, nên giới
 * hạn thêm ở đây. Hết chỗ quá thời gian chờ thì trả 503 "thử lại sau" thay vì xếp hàng vô hạn.
 *
 * <p>Ảnh sau khi mã hoá lại cũng có trần dung lượng: file đầu vào nhỏ nhưng mã hoá lại phình to (vd. JPEG
 * nén rất mạnh) thì bị từ chối, để một lượt tải không thành một object R2 vài chục MB.
 */
@Component
public class FeedbackDecodeGate {

    static final String BUSY = "Máy chủ đang xử lý nhiều ảnh. Thử lại sau ít phút.";

    private final Semaphore permits;
    private final long waitMillis;
    private final int maxOutputBytes;

    public FeedbackDecodeGate(
            @Value("${app.feedback.image.max-concurrent-decodes:2}") int maxConcurrent,
            @Value("${app.feedback.image.decode-wait-ms:5000}") long waitMillis,
            @Value("${app.feedback.image.max-output-bytes:10485760}") int maxOutputBytes) {
        this.permits = new Semaphore(Math.max(1, maxConcurrent), true);
        this.waitMillis = Math.max(0, waitMillis);
        this.maxOutputBytes = maxOutputBytes;
    }

    public FeedbackImageProcessor.Processed decode(byte[] raw) {
        boolean acquired;
        try {
            acquired = permits.tryAcquire(waitMillis, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, BUSY);
        }
        if (!acquired) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, BUSY);
        }
        try {
            FeedbackImageProcessor.Processed image = FeedbackImageProcessor.process(raw);
            if (image.bytes().length > maxOutputBytes) {
                throw new BadRequestException(FeedbackImageProcessor.WRONG_TYPE);
            }
            return image;
        } finally {
            permits.release();
        }
    }

    /** Cho test: lấy trực tiếp semaphore để giả lập máy chủ đang bận. */
    Semaphore permits() {
        return permits;
    }
}
