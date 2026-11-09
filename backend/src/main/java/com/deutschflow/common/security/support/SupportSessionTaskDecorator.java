package com.deutschflow.common.security.support;

/**
 * Mang ngữ cảnh phiên hỗ trợ chỉ-đọc sang thread của executor (review #805).
 *
 * <p>Cờ phiên hỗ trợ ({@link SupportSessionContextHolder}) và lưới READ ONLY của DB ({@link SupportSessionDbGuard})
 * là ThreadLocal của thread request. Việc đẩy sang {@code @Async}/executor chạy ở thread khác nên trước đây
 * thoát cả hai: guard AI (vd. {@code GeminiApiClient} chạy trong {@code @Async("aiExecutor")}) không bao giờ nổ,
 * và connection lấy ở đó không bị ép READ ONLY. Hiện mọi việc nền đều khởi từ POST (đã bị chặn) nên chưa có lỗ
 * thật — decorator này biến quy ước đó thành ràng buộc: việc nền khởi từ một request hỗ trợ chạy với đúng ngữ
 * cảnh đó, nên gọi AI sẽ ném {@link SupportSessionReadOnlyException} và ghi DB sẽ bị Postgres từ chối.
 *
 * <p>Khôi phục (không xoá trắng) trạng thái cũ của thread sau khi chạy: với {@code CallerRunsPolicy} tác vụ
 * chạy NGAY trên thread request — xoá trắng sẽ gỡ luôn ngữ cảnh của chính request đó.
 */
public final class SupportSessionTaskDecorator {

    private SupportSessionTaskDecorator() {
    }

    public static Runnable wrap(Runnable task) {
        SupportSessionContext captured = SupportSessionContextHolder.current();
        boolean capturedDbGuard = SupportSessionDbGuard.isActive();
        if (captured == null && !capturedDbGuard) {
            return task;
        }
        return () -> {
            SupportSessionContext previous = SupportSessionContextHolder.current();
            boolean previousDbGuard = SupportSessionDbGuard.isActive();
            SupportSessionContextHolder.set(captured);
            if (capturedDbGuard) {
                SupportSessionDbGuard.enter();
            }
            try {
                task.run();
            } finally {
                SupportSessionContextHolder.set(previous);
                if (previousDbGuard) {
                    SupportSessionDbGuard.enter();
                } else {
                    SupportSessionDbGuard.exit();
                }
            }
        };
    }
}
