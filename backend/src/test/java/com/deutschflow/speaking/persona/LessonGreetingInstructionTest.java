package com.deutschflow.speaking.persona;

import com.deutschflow.speaking.contract.SpeakingSessionMode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * QA prod 10/08: greeting LESSON cụt (bong bóng chỉ "A, B, C") vì lời dặn cũ
 * "ai_speech_de: chỉ chứa từ/cụm Đức đang dạy" mâu thuẫn hợp đồng LESSON
 * (ai_speech_de = câu tiếng Việt dẫn dắt, UI render làm bong bóng chính).
 */
class LessonGreetingInstructionTest {

    @Test
    void caBaPersonaLesson_yeuCauCauTiengVietHoanChinh_camLietKeTro() {
        for (SpeakingPersona p : new SpeakingPersona[]{
                SpeakingPersona.TUAN, SpeakingPersona.LAN, SpeakingPersona.MINH}) {
            String g = p.buildGreetingInstruction("alphabet", null, "", SpeakingSessionMode.LESSON);
            assertThat(g).as("persona %s", p)
                    .contains("câu tiếng Việt HOÀN CHỈNH")
                    .contains("DỮ KIỆN BẮT BUỘC")
                    .doesNotContain("chỉ chứa từ/cụm Đức");
        }
    }

    @Test
    void greetingLesson_khongConDoiHoi3Suggestions() {
        // Schema chỉ định nghĩa đúng 2 suggestions — lời dặn cũ đòi 3 là mâu thuẫn hợp đồng.
        String g = SpeakingPersona.TUAN.buildGreetingInstruction("numbers", null, "", SpeakingSessionMode.LESSON);
        assertThat(g).doesNotContain("3 lựa chọn");
    }
}
