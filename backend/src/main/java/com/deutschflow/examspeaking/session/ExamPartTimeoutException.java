package com.deutschflow.examspeaking.session;

import com.deutschflow.common.exception.ConflictException;

/**
 * Lượt nói tới khi Teil (mock) đã hết giờ quá grace: phiên ĐÃ được chuyển sang phần kế tiếp trong cùng
 * transaction và request trả 409. Tách kiểu riêng để {@code @Transactional(noRollbackFor)} giữ lại
 * bước chuyển phần — trước đây ném ConflictException thường làm rollback, client nhận 409 "đã chuyển"
 * nhưng server vẫn đứng ở Teil cũ.
 */
public class ExamPartTimeoutException extends ConflictException {

    public ExamPartTimeoutException(String message) {
        super(message);
    }
}
