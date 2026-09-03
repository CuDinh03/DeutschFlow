package com.deutschflow.notification.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * C1/F-M9 + R-M6 (03/09/2026): cửa sổ chống gửi-trùng cho broadcast — lượt thứ hai cùng khoá
 * trong cửa sổ phải bị từ chối, khoá khác nhau không chặn lẫn nhau.
 */
@DisplayName("BroadcastDedupeGuard — idempotency trong cửa sổ")
class BroadcastDedupeGuardTest {

    @Test
    @DisplayName("lượt đầu được phép, lượt thứ hai cùng khoá trong cửa sổ bị chặn")
    void secondAcquireWithinWindowIsRejected() {
        BroadcastDedupeGuard guard = new BroadcastDedupeGuard(300);

        assertThat(guard.tryAcquire("k1")).isTrue();
        assertThat(guard.tryAcquire("k1")).isFalse();
    }

    @Test
    @DisplayName("khoá khác nhau độc lập — không chặn lẫn nhau")
    void differentKeysAreIndependent() {
        BroadcastDedupeGuard guard = new BroadcastDedupeGuard(300);

        assertThat(guard.tryAcquire("k1")).isTrue();
        assertThat(guard.tryAcquire("k2")).isTrue();
    }

    @Test
    @DisplayName("cửa sổ 0/âm bị nâng sàn lên 1s — không tắt được guard bằng config lỗi")
    void nonPositiveWindowStillGuards() {
        BroadcastDedupeGuard guard = new BroadcastDedupeGuard(0);

        assertThat(guard.tryAcquire("k1")).isTrue();
        assertThat(guard.tryAcquire("k1")).isFalse(); // vẫn trong 1s sàn
    }
}
