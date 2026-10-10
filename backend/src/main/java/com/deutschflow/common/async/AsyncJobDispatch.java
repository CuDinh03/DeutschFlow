package com.deutschflow.common.async;

import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import lombok.extern.slf4j.Slf4j;

import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

/**
 * Giao thân của một job {@code async_jobs} cho executor — và KHÔNG để job mồ côi khi executor từ chối.
 *
 * <p>Vì sao: {@code aiExecutor} có hàng đợi giới hạn (30) với chính sách mặc định là từ chối. Trước
 * đây các nơi gọi viết {@code CompletableFuture.runAsync(task, aiExecutor)} SAU khi đã
 * {@code createJob}: lúc bão AI call, executor ném {@link RejectedExecutionException} lên request
 * (500 "ERR-x") trong khi job vừa tạo nằm PENDING vĩnh viễn — client nào kịp lấy jobId sẽ poll tới
 * hết kiên nhẫn, và chỉ việc quét {@link StaleAsyncJobExpirer} 30′ sau mới dọn.
 *
 * <p>Nay: bị từ chối ⇒ job được đánh FAILED NGAY bằng câu người đọc được, rồi ném
 * {@link AiServiceException} mã {@link AiErrorCode#AI_BUSY} ⇒ {@code GlobalExceptionHandler} trả 503
 * + {@code Retry-After} — cùng hợp đồng "AI đang bận" mà client đã xử lý. Suất giữ chỗ pool trung tâm
 * của request (nếu có) được {@code OrgReservationRefundFilter} hoàn trả vì request kết thúc lỗi.
 *
 * <p>Hàm tĩnh chứ không phải method của {@link AsyncJobService}: test đơn vị mock
 * {@code AsyncJobService} sẽ biến một method dispatch thành no-op và thân job im lặng không chạy.
 */
@Slf4j
public final class AsyncJobDispatch {

    /** Hiện cho người dùng qua {@code errorMessage} của job và {@code detail} của 503. */
    public static final String BUSY_MESSAGE =
            "Hệ thống đang bận xử lý nhiều yêu cầu cùng lúc. Bạn hãy thử lại sau ít giây.";

    static final int BUSY_RETRY_AFTER_SECONDS = 10;

    private AsyncJobDispatch() {
    }

    /**
     * Chạy {@code task} trên {@code executor}; executor từ chối ⇒ {@code jobs.failJob(jobId, …)} rồi
     * ném {@link AiServiceException} (AI_BUSY). Nơi gọi chạy NGẦM (prefetch) bắt ngoại lệ này để
     * không làm hỏng request chính — job đã được đánh FAILED trước khi ném.
     */
    public static void runOrFail(AsyncJobService jobs, UUID jobId, Executor executor, Runnable task) {
        try {
            executor.execute(task);
        } catch (RejectedExecutionException rejected) {
            jobs.failJob(jobId, BUSY_MESSAGE);
            log.warn("[AsyncJobDispatch] Executor từ chối job {} (pool + hàng đợi đầy) — đã đánh FAILED", jobId);
            throw new AiServiceException(AiErrorCode.AI_BUSY, BUSY_MESSAGE, BUSY_RETRY_AFTER_SECONDS, rejected);
        }
    }
}
