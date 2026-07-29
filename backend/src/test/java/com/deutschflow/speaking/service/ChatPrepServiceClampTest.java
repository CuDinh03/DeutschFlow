package com.deutschflow.speaking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hợp đồng ngân sách completion token cho speaking turn/greeting (sự cố greeting 29/07):
 * clamp-theo-quota không được phép cấp cap tí hon làm JSON chắc chắn cụt (cùng bệnh R-G5
 * đã vá cho eval ở PR #257) — sàn 1024; config vẫn là trần tuyệt đối.
 */
class ChatPrepServiceClampTest {

    private static final int CONFIG_2000 = 2_000;

    @Test
    @DisplayName("ví đầy: cap = config (2000), không bị 512 cũ ghìm")
    void fullWalletGetsConfigCap() {
        assertThat(ChatPrepService.clampCompletionBudget(CONFIG_2000, 400_000L)).isEqualTo(2_000);
    }

    @Test
    @DisplayName("ví gần cạn (50 token): floor 1024 thay vì cap tí hon chắc chắn fail JSON")
    void nearEmptyWalletIsFlooredNotStarved() {
        assertThat(ChatPrepService.clampCompletionBudget(CONFIG_2000, 50L)).isEqualTo(1_024);
    }

    @Test
    @DisplayName("ví âm/0: vẫn floor 1024 — assertAllowed đã chặn user hết quota từ trước")
    void zeroRemainingStillFloored() {
        assertThat(ChatPrepService.clampCompletionBudget(CONFIG_2000, 0L)).isEqualTo(1_024);
    }

    @Test
    @DisplayName("remaining nằm giữa floor và config: dùng đúng remaining")
    void remainingBetweenFloorAndConfigIsUsedAsIs() {
        assertThat(ChatPrepService.clampCompletionBudget(CONFIG_2000, 1_500L)).isEqualTo(1_500);
    }

    @Test
    @DisplayName("config thấp hơn floor: config vẫn là trần tuyệt đối (admin cố tình ghìm)")
    void configRemainsAbsoluteCeiling() {
        assertThat(ChatPrepService.clampCompletionBudget(800, 50L)).isEqualTo(800);
        assertThat(ChatPrepService.clampCompletionBudget(800, 400_000L)).isEqualTo(800);
    }
}
