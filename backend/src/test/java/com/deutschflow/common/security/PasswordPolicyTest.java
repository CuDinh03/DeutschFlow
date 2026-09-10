package com.deutschflow.common.security;

import com.deutschflow.common.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt sàn mật khẩu dùng chung (Gói 0 PR-0D).
 *
 * <p>Trước đợt này KHÔNG một ca test nào trên toàn backend phủ sàn mật khẩu — đó là lý do ba con số
 * khác nhau (8 / 6 / 0) cùng tồn tại ở bảy cửa mà không lượt chạy nào đỏ. Bộ ca này khoá cả GIÁ TRỊ
 * lẫn RANH GIỚI, để lần sau ai hạ sàn hoặc thêm một cửa tự chế con số riêng thì có thứ đỏ lên.
 */
class PasswordPolicyTest {

    @Test
    @DisplayName("Sàn là 8 — hằng, không phải con số chép tay ở từng cửa")
    void minLengthIsEight() {
        assertThat(PasswordPolicy.MIN_LENGTH).isEqualTo(8);
        assertThat(PasswordPolicy.MAX_LENGTH).isEqualTo(100);
        assertThat(PasswordPolicy.MESSAGE).contains("8");
    }

    @ParameterizedTest(name = "\"{0}\" bị từ chối")
    @ValueSource(strings = { "", "a", "1234567", "bảy ký" })
    @DisplayName("Ngắn hơn sàn thì ném BadRequestException kèm câu nói rõ số ký tự")
    void tooShortRejected(String raw) {
        assertThatThrownBy(() -> PasswordPolicy.requireStrongEnough(raw))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(PasswordPolicy.MESSAGE);
    }

    @Test
    @DisplayName("null bị từ chối — không NPE, cùng một câu lỗi")
    void nullRejected() {
        assertThatThrownBy(() -> PasswordPolicy.requireStrongEnough(null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(PasswordPolicy.MESSAGE);
    }

    @ParameterizedTest(name = "\"{0}\" đi qua")
    @ValueSource(strings = { "12345678", "mật khẩu tiếng Việt", "        " })
    @DisplayName("Đúng sàn trở lên thì đi qua — kể cả toàn khoảng trắng")
    void longEnoughPasses(String raw) {
        assertThatCode(() -> PasswordPolicy.requireStrongEnough(raw)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Ranh giới: 7 ký tự chặn, 8 ký tự qua — chốt đúng một nấc, không lệch off-by-one")
    void boundaryIsExact() {
        assertThatThrownBy(() -> PasswordPolicy.requireStrongEnough("1234567"))
                .isInstanceOf(BadRequestException.class);
        assertThatCode(() -> PasswordPolicy.requireStrongEnough("12345678")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Đếm KÝ TỰ, không đếm byte — mật khẩu tiếng Việt 8 chữ cái vẫn qua")
    void countsCharactersNotBytes() {
        // "mậtkhẩu8" là 8 ký tự nhưng nhiều hơn 8 byte UTF-8. Nếu ai đó đổi sang đo getBytes().length
        // thì ca này vẫn xanh — nhưng ca ngược lại bên dưới sẽ đỏ, nên cặp này khoá được cả hai chiều.
        assertThatCode(() -> PasswordPolicy.requireStrongEnough("mậtkhẩu8")).doesNotThrowAnyException();
        // 7 ký tự tiếng Việt = hơn 8 byte; đo theo byte sẽ cho qua sai.
        assertThatThrownBy(() -> PasswordPolicy.requireStrongEnough("mậtkhẩu"))
                .isInstanceOf(BadRequestException.class);
    }
}
