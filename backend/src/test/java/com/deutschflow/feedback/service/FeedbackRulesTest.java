package com.deutschflow.feedback.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.feedback.FeedbackEnums.Area;
import com.deutschflow.feedback.FeedbackEnums.Audience;
import com.deutschflow.feedback.FeedbackEnums.Status;
import com.deutschflow.feedback.dto.FeedbackDtos.TechInfo;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Quy tắc góp ý: tiêu đề, độ dài, thông tin kỹ thuật, chuyển trạng thái, phần theo vai trò")
class FeedbackRulesTest {

    @Test
    @DisplayName("BR-01: tiêu đề là dòng đầu của nội dung")
    void title_isFirstLine() {
        assertThat(FeedbackService.titleOf("Cho nghe lại đoạn Hören khi đang luyện từng Teil\nVì mình…"))
                .isEqualTo("Cho nghe lại đoạn Hören khi đang luyện từng Teil");
    }

    @Test
    @DisplayName("BR-01: dòng đầu dài hơn 80 ký tự bị cắt và thêm dấu …")
    void title_isCutAt80() {
        String title = FeedbackService.titleOf("ạ".repeat(100));
        assertThat(title).endsWith("…");
        assertThat(title.codePointCount(0, title.length())).isEqualTo(81);
    }

    @Test
    @DisplayName("BR-02: 'Lỗi rồi!' (8 ký tự) không gửi được, 'Không nghe được' (15) gửi được")
    void content_lengthIsCountedInCodePoints() {
        assertThatThrownBy(() -> FeedbackService.normalizeContent("  Lỗi rồi!  "))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Viết ít nhất 10 ký tự để gửi.");
        assertThat(FeedbackService.normalizeContent("  Không nghe được ")).isEqualTo("Không nghe được");
        assertThatThrownBy(() -> FeedbackService.normalizeContent("a".repeat(2001)))
                .isInstanceOf(BadRequestException.class);
        assertThat(FeedbackService.normalizeContent("a".repeat(2000))).hasSize(2000);
    }

    @Test
    @DisplayName("BR-04: đường dẫn trang bỏ query (có thể chứa token), giữ đúng các trường cho phép")
    void techInfo_isSanitized() {
        Map<String, Object> info = FeedbackService.sanitizeTechInfo(new TechInfo(
                "/danh-gia/abc?token=secret#x", " Safari 18 ", "iOS 18", "phone", "web-123", "vi", "400x900"));

        assertThat(info).containsEntry("page", "/danh-gia/abc")
                .containsEntry("browser", "Safari 18")
                .doesNotContainKeys("ip", "userAgent");
        assertThat(FeedbackService.sanitizeTechInfo(new TechInfo(" ", null, null, null, null, null, null))).isNull();
    }

    @Test
    @DisplayName("BR-04: server tự thay đoạn token trong đường dẫn bằng :token, kể cả khi client quên lọc")
    void techInfo_tokenPathSegmentsAreMaskedServerSide() {
        assertThat(FeedbackService.stripQuery("/phieu/abc123")).isEqualTo("/phieu/:token");
        assertThat(FeedbackService.stripQuery("/certificate/xyz/view?x=1")).isEqualTo("/certificate/:token/view");
        assertThat(FeedbackService.stripQuery("/v2/student/exam")).isEqualTo("/v2/student/exam");
        assertThat(FeedbackService.stripQuery("/report/")).isEqualTo("/report/");
    }

    @ParameterizedTest(name = "{0} → {1}: {2}")
    @CsvSource({
            "NEW, READ, true",
            "NEW, IN_PROGRESS, true",
            "READ, SHIPPED, true",
            "IN_PROGRESS, DECLINED, true",
            "SHIPPED, IN_PROGRESS, true",
            "DECLINED, READ, true",
            "SHIPPED, DECLINED, false",
            "DECLINED, SHIPPED, false",
            "READ, NEW, false",
            "IN_PROGRESS, READ, false",
            "READ, READ, true",
    })
    @DisplayName("Mục 9: bảng chuyển trạng thái")
    void statusTransitions(Status from, Status to, boolean allowed) {
        assertThat(from.canMoveTo(to)).isEqualTo(allowed);
    }

    @Test
    @DisplayName("FBK-13: mỗi vai trò chỉ chọn được phần của mình; ADMIN không gửi góp ý")
    void areasFollowAudience() {
        assertThat(Audience.of(User.Role.OWNER)).isEqualTo(Audience.ORG);
        assertThat(Audience.of(User.Role.MANAGER)).isEqualTo(Audience.ORG);
        assertThat(Audience.of(User.Role.ADMIN)).isNull();
        assertThat(Area.forAudience(Audience.STUDENT)).contains(Area.EXAM, Area.IOS_APP).doesNotContain(Area.GRADING);
        assertThat(Area.forAudience(Audience.TEACHER)).contains(Area.GRADING).doesNotContain(Area.EXAM);
        assertThat(Area.forAudience(Audience.ORG)).contains(Area.STUDENTS, Area.REPORTS).doesNotContain(Area.GRADING);
    }
}
