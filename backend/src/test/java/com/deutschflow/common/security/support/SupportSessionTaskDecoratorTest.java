package com.deutschflow.common.security.support;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Review #805: ngữ cảnh phiên hỗ trợ phải theo việc nền sang thread executor, và không làm bẩn thread. */
class SupportSessionTaskDecoratorTest {

    private static final SupportSessionContext CTX = new SupportSessionContext(7L, 1L, "admin@x", 9L);

    @AfterEach
    void clean() {
        SupportSessionContextHolder.clear();
        SupportSessionDbGuard.exit();
    }

    @Test
    void ngoaiPhienHoTro_traVeNguyenTacVu() {
        Runnable task = () -> { };
        assertThat(SupportSessionTaskDecorator.wrap(task)).isSameAs(task);
    }

    @Test
    void trongPhienHoTro_threadNenThayNguCanh_guardAiNo_vaThreadDuocDonSach() throws Exception {
        SupportSessionContextHolder.set(CTX);
        SupportSessionDbGuard.enter();
        AtomicReference<SupportSessionContext> seen = new AtomicReference<>();
        AtomicBoolean dbGuard = new AtomicBoolean();
        AtomicReference<Throwable> aiError = new AtomicReference<>();
        Runnable wrapped = SupportSessionTaskDecorator.wrap(() -> {
            seen.set(SupportSessionContextHolder.current());
            dbGuard.set(SupportSessionDbGuard.isActive());
            try {
                SupportSessionContextHolder.assertNotSupportSession("test");
            } catch (Throwable t) {
                aiError.set(t);
            }
        });
        SupportSessionContextHolder.clear();
        SupportSessionDbGuard.exit();

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            pool.submit(wrapped).get(5, TimeUnit.SECONDS);
            Future<Boolean> leaked = pool.submit(() ->
                    SupportSessionContextHolder.isActive() || SupportSessionDbGuard.isActive());
            assertThat(leaked.get(5, TimeUnit.SECONDS)).as("thread pool không còn cờ sau tác vụ").isFalse();
        } finally {
            pool.shutdownNow();
        }
        assertThat(seen.get()).isEqualTo(CTX);
        assertThat(dbGuard.get()).isTrue();
        assertThat(aiError.get()).isInstanceOf(SupportSessionReadOnlyException.class);
    }

    @Test
    void callerRuns_khoiPhucNguCanhCuaChinhRequest() {
        SupportSessionContextHolder.set(CTX);
        SupportSessionDbGuard.enter();
        SupportSessionTaskDecorator.wrap(() -> { }).run(); // chạy ngay trên thread gọi (CallerRunsPolicy)
        assertThat(SupportSessionContextHolder.current()).isEqualTo(CTX);
        assertThat(SupportSessionDbGuard.isActive()).isTrue();
        assertThatThrownBy(() -> SupportSessionContextHolder.assertNotSupportSession("x"))
                .isInstanceOf(SupportSessionReadOnlyException.class);
    }
}
