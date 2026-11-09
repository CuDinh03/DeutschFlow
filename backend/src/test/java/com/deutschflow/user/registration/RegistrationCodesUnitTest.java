package com.deutschflow.user.registration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RegistrationCodesUnitTest {

    private static final byte[] PEPPER = "unit-pepper-0123456789abcdef0123456789abcdef".getBytes(StandardCharsets.UTF_8);

    @RepeatedTest(200)
    @DisplayName("mã sinh ra luôn đúng 6 chữ số (kể cả khi bắt đầu bằng 0)")
    void generatesSixDigits() {
        assertThat(RegistrationCodes.generate()).matches("^\\d{6}$");
    }

    @Test
    @DisplayName("HMAC khác nhau với hai pendingId dù cùng mã; khớp đúng mã, sai mã thì không")
    void hashBindsPendingId() {
        String a = RegistrationCodes.hash(PEPPER, 1, "123456");
        String b = RegistrationCodes.hash(PEPPER, 2, "123456");
        assertThat(a).hasSize(64).isNotEqualTo(b);
        assertThat(RegistrationCodes.matches(PEPPER, 1, "123456", a)).isTrue();
        assertThat(RegistrationCodes.matches(PEPPER, 1, "123457", a)).isFalse();
        assertThat(RegistrationCodes.matches(PEPPER, 2, "123456", a)).isFalse();
    }

    @Test
    @DisplayName("đổi pepper ⇒ hash khác (rò DB không đủ để vét cạn)")
    void pepperMatters() {
        byte[] other = "another-pepper-0123456789abcdef0123456789ab".getBytes(StandardCharsets.UTF_8);
        assertThat(RegistrationCodes.hash(PEPPER, 7, "000123")).isNotEqualTo(RegistrationCodes.hash(other, 7, "000123"));
    }

    @Test
    @DisplayName("11. bật công tắc mà thiếu MAIL_HOST hoặc pepper ⇒ không khởi động được")
    void configRefusesToBootWithoutMailOrPepper() {
        String pepper = "p".repeat(32);
        assertThatThrownBy(() -> new RegistrationVerificationConfig(true, pepper, 60, 5, 60, true, ""))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("MAIL_HOST");
        assertThatThrownBy(() -> new RegistrationVerificationConfig(true, "", 60, 5, 60, true, "smtp.x"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("PEPPER");
        assertThatThrownBy(() -> new RegistrationVerificationConfig(true, "short", 60, 5, 60, true, "smtp.x"))
                .isInstanceOf(IllegalStateException.class);
        // Tắt thì không đòi gì — đúng trạng thái prod trước khi có hòm thư.
        assertThat(new RegistrationVerificationConfig(false, "", 60, 5, 60, true, "").enabled()).isFalse();
        assertThat(new RegistrationVerificationConfig(true, pepper, 60, 5, 60, true, "smtp.x").enabled()).isTrue();
    }

    @Test
    @DisplayName("11b. công tắc bật ⇒ /register cũ ĐÓNG dù LEGACY_REGISTER_ENABLED=true (bug 09/11: app cũ tạo tài khoản không mã)")
    void legacyRegisterClosedWheneverVerificationOn() {
        String pepper = "p".repeat(32);
        // Đúng tổ hợp prod 09/11: bật mã PIN, LEGACY_REGISTER_ENABLED không đặt (mặc định true).
        assertThat(new RegistrationVerificationConfig(true, pepper, 60, 5, 60, true, "smtp.x")
                .legacyRegisterAllowed()).isFalse();
        assertThat(new RegistrationVerificationConfig(true, pepper, 60, 5, 60, false, "smtp.x")
                .legacyRegisterAllowed()).isFalse();
        // Công tắc tắt (rollback) ⇒ cờ legacy quyết định.
        assertThat(new RegistrationVerificationConfig(false, "", 60, 5, 60, true, "")
                .legacyRegisterAllowed()).isTrue();
        assertThat(new RegistrationVerificationConfig(false, "", 60, 5, 60, false, "")
                .legacyRegisterAllowed()).isFalse();
    }
}
