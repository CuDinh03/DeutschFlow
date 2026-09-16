package com.deutschflow.examspeaking.session;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Câu của bạn thi ảo khi đường AI không trả lời được.
 *
 * <p>Đây không chỉ là chuyện của test: mỗi lần đường AI hỏng, người học THẬT nhận đúng câu này giữa
 * phòng thi. Trước bản vá, bước „trả lời câu hỏi về bài trình bày" rơi vào câu đệm
 * „Ach so, verstehe." — không dính gì tới câu thí sinh vừa hỏi; còn bước „nhận xét và đặt câu hỏi"
 * thì KHÔNG hỏi gì cả, nên lượt sau của thí sinh treo, không có gì để trả lời.
 */
@DisplayName("Câu dự phòng của bạn thi ảo")
class FallbackReplyTest {

    @Test
    @DisplayName("lấy danh từ trong câu HỎI, không lấy trong câu kể đứng trước")
    void picksNounFromTheQuestionSentence() {
        String said = "Ich fand deinen Vortrag interessant. Fährst du auch im Winter mit dem Fahrrad?";

        assertThat(AiInterlocutorService.questionKeyword(said))
                .as("„Vortrag“ nằm ở câu kể; câu hỏi mới là thứ bạn thi phải trả lời")
                .isEqualTo("Winter");
    }

    @Test
    @DisplayName("bỏ qua từ đầu câu vì tiếng Đức luôn viết hoa từ đầu câu")
    void ignoresSentenceInitialWord() {
        assertThat(AiInterlocutorService.questionKeyword("Wohnst du gern in Berlin?")).isEqualTo("Berlin");
        assertThat(AiInterlocutorService.questionKeyword("Magst du Musik?")).isEqualTo("Musik");
    }

    @Test
    @DisplayName("không có câu hỏi thì vẫn lấy được danh từ trong lời vừa nói")
    void noQuestionMark_stillFindsANoun() {
        assertThat(AiInterlocutorService.questionKeyword("Ich arbeite gern im Garten.")).isEqualTo("Garten");
    }

    @Test
    @DisplayName("giữ nguyên ß và dấu tiếng Đức")
    void keepsGermanLetters() {
        assertThat(AiInterlocutorService.questionKeyword("Wie kommst du zur Straße?")).isEqualTo("Straße");
        assertThat(AiInterlocutorService.questionKeyword("Machst du gern Übungen?")).isEqualTo("Übungen");
    }

    @Test
    @DisplayName("không tìm được danh từ thì trả rỗng — nơi gọi dùng câu chung, KHÔNG dựng câu què")
    void noNoun_returnsEmpty() {
        assertThat(AiInterlocutorService.questionKeyword("ja")).isEmpty();
        assertThat(AiInterlocutorService.questionKeyword("und du?")).isEmpty();
        assertThat(AiInterlocutorService.questionKeyword("")).isEmpty();
        assertThat(AiInterlocutorService.questionKeyword(null)).isEmpty();
    }

    @Test
    @DisplayName("từ quá ngắn không tính là danh từ")
    void tooShortWordIsNotANoun() {
        assertThat(AiInterlocutorService.questionKeyword("Hast du AB gesehen?")).isEmpty();
    }
}
