package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.Text;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Dấu vân tay bản nháp: bài cũ (không phải Nghe) không đổi sau khi Text có thêm trường Nghe")
class ContentHashCompatTest {

    private final ObjectMapper om = new ObjectMapper();

    @Test
    @DisplayName("bài không phải Nghe: chuỗi băm bỏ hai trường null mới, giống hệt JSON trước đợt Nghe")
    void oldTextKeepsOldJson() throws Exception {
        Text old = new Text("Titel", "Vorspann", "Ein Text.", List.of());
        String now = om.writeValueAsString(old);
        assertThat(now).endsWith(",\"audioTurns\":null,\"framingDe\":null}");
        String forHash = ExamDraftService.textJsonForHash(now);
        assertThat(forHash).doesNotContain("audioTurns").doesNotContain("framingDe").endsWith("\"writingPoints\":null}");
        // Đúng bằng JSON nếu record chưa có hai trường mới.
        assertThat(forHash).isEqualTo(now.replace(",\"audioTurns\":null,\"framingDe\":null", ""));
    }

    @Test
    @DisplayName("bài Nghe (trường có giá trị) và chuỗi lạ giữ nguyên")
    void hoerenUntouched() throws Exception {
        Text h = new Text("", "", "Hallo.", List.of(), null, null, null, null, null, null,
                List.of(new ExamStudioDtos.AudioTurn("PRUEFER", null, "Hallo.", null)), "Rahmen");
        String json = om.writeValueAsString(h);
        assertThat(ExamDraftService.textJsonForHash(json)).isEqualTo(json);
        assertThat(ExamDraftService.textJsonForHash(null)).isNull();
        assertThat(ExamDraftService.textJsonForHash("{}")).isEqualTo("{}");
    }
}
