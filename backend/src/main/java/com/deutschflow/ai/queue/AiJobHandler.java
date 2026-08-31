package com.deutschflow.ai.queue;

import java.util.Map;

/**
 * Handler cắm được cho {@link AiJobWorker}: module mới đăng ký bean implement interface này thay vì sửa
 * switch trong worker. {@code jobType()} phải là hằng duy nhất.
 */
public interface AiJobHandler {

    String jobType();

    Map<String, Object> handle(AiJob job) throws Exception;

    /**
     * Worker gọi SAU khi đã đánh dấu job FAILED, để module chủ job đưa trạng thái domain của nó
     * (ví dụ phiên thi đang GRADING) sang trạng thái lỗi mà client nhìn thấy được — thay vì kẹt
     * "đang chờ" vĩnh viễn trong khi job đã chết từ lâu. Implement PHẢI tự lo transaction
     * (REQUIRES_NEW qua TransactionTemplate — đang ở ngữ cảnh catch, không có transaction bao) và
     * không được ném: lỗi ở đây chỉ log, sweep định kỳ của module là lưới đỡ cuối.
     */
    default void onFailure(AiJob job, Exception cause) {
    }
}
