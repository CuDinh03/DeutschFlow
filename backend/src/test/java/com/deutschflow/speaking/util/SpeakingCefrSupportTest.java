package com.deutschflow.speaking.util;

import com.deutschflow.user.entity.UserLearningProfile;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Trần band luyện tập (QA 09/08 mục F, owner chốt 10/08): currentLevel + 1 bậc,
 * KHÔNG theo targetLevel — mục tiêu C1 của hồ sơ từng kéo band phiên lên C1/C2
 * ngay với học viên B1.
 */
class SpeakingCefrSupportTest {

    private static UserLearningProfile profile(UserLearningProfile.CurrentLevel cur,
                                               UserLearningProfile.TargetLevel target) {
        return UserLearningProfile.builder()
                .currentLevel(cur)
                .targetLevel(target)
                .goalType(UserLearningProfile.GoalType.CERT)
                .build();
    }

    @Test
    void ceiling_laCurrentLevelCongMot_khongPhaiTargetLevel() {
        var p = profile(UserLearningProfile.CurrentLevel.B1, UserLearningProfile.TargetLevel.C1);
        assertThat(SpeakingCefrSupport.ceilingBand(p)).isEqualTo("B2");
    }

    @Test
    void ceiling_a0TinhNhuA1_tranA2() {
        var p = profile(UserLearningProfile.CurrentLevel.A0, UserLearningProfile.TargetLevel.C2);
        assertThat(SpeakingCefrSupport.ceilingBand(p)).isEqualTo("A2");
    }

    @Test
    void ceiling_hoSoTrong_tranB2() {
        assertThat(SpeakingCefrSupport.ceilingBand(null)).isEqualTo("B2");
        assertThat(SpeakingCefrSupport.ceilingBand(profile(null, UserLearningProfile.TargetLevel.C1)))
                .isEqualTo("B2");
    }

    @Test
    void clampToProfileRange_phienC1CuaHocVienB1_keoVeB2() {
        var p = profile(UserLearningProfile.CurrentLevel.B1, UserLearningProfile.TargetLevel.C1);
        assertThat(SpeakingCefrSupport.clampToProfileRange("C1", p)).isEqualTo("B2");
    }

    @Test
    void applyKnobClamp_khongVuotTranMoi() {
        var p = profile(UserLearningProfile.CurrentLevel.B1, UserLearningProfile.TargetLevel.C2);
        assertThat(SpeakingCefrSupport.applyKnobClamp("B2", 1, p)).isEqualTo("B2");
    }
}
