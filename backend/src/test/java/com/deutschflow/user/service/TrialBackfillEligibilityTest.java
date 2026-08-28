package com.deutschflow.user.service;

import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Q1 (quyết định owner 28/08) — trial 7 ngày chỉ dành cho tài khoản VỪA TỰ ĐĂNG KÝ.
 *
 * <p>Trước bản vá, bất kỳ STUDENT nào chưa có dòng subscription nào cũng được cấp trial
 * PRO ngay lúc đăng nhập. Nghĩa là một tài khoản tạo từ năm ngoái đăng nhập lần đầu hôm
 * nay nhận trọn 7 ngày PRO, và một tài khoản do trung tâm tạo hộ (hợp đồng B2B, không
 * thuộc phễu trial) cũng vậy. Đó là phát quyền lợi không ai chủ ý, đồng thời làm hỏng
 * phép đo cohort trial.
 *
 * <p>Luật được tách thành hàm THUẦN + static để test gọi thẳng, thay vì phải dựng cả
 * AuthService với toàn bộ phụ thuộc của nó chỉ để kiểm một điều kiện.
 */
class TrialBackfillEligibilityTest {

    private static User user(User.CreatedVia via, LocalDateTime createdAt) {
        User u = User.builder().id(1L).email("a@local.test").displayName("A")
                .role(User.Role.STUDENT).createdVia(via).build();
        u.setCreatedAt(createdAt);
        return u;
    }

    @Test
    @DisplayName("tự đăng ký hôm nay → ĐƯỢC nhận trial")
    void freshSelfSignupIsEligible() {
        assertThat(AuthService.isFreshSelfSignup(user(User.CreatedVia.SELF, LocalDateTime.now().minusMinutes(5))))
                .isTrue();
    }

    @Test
    @DisplayName("tự đăng ký nhưng đã quá 7 ngày → KHÔNG nhận trial")
    void staleSelfSignupIsNotEligible() {
        // Thiếu subscription ở tài khoản cũ là dữ liệu cần vá tay, không phải người mới.
        assertThat(AuthService.isFreshSelfSignup(user(User.CreatedVia.SELF, LocalDateTime.now().minusDays(8))))
                .isFalse();
    }

    @Test
    @DisplayName("tài khoản do người khác tạo hộ → KHÔNG nhận trial dù mới tinh")
    void nonSelfSignupIsNotEligible() {
        LocalDateTime now = LocalDateTime.now();
        assertThat(AuthService.isFreshSelfSignup(user(User.CreatedVia.ADMIN, now))).isFalse();
        assertThat(AuthService.isFreshSelfSignup(user(User.CreatedVia.MANAGER, now))).isFalse();
        assertThat(AuthService.isFreshSelfSignup(user(User.CreatedVia.OWNER, now))).isFalse();
        assertThat(AuthService.isFreshSelfSignup(user(User.CreatedVia.CSV, now))).isFalse();
    }

    @Test
    @DisplayName("thiếu createdAt → KHÔNG nhận trial (fail-closed)")
    void missingCreatedAtIsNotEligible() {
        assertThat(AuthService.isFreshSelfSignup(user(User.CreatedVia.SELF, null))).isFalse();
    }

    @Test
    @DisplayName("sát mốc 7 ngày vẫn còn hạn")
    void justInsideBoundaryIsEligible() {
        assertThat(AuthService.isFreshSelfSignup(
                user(User.CreatedVia.SELF, LocalDateTime.now().minusDays(7).plusMinutes(1)))).isTrue();
    }
}
