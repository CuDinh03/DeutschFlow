package com.deutschflow.organization.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luật D5 dưới dạng quyết định thuần: hết hạn / đình chỉ ⇒ chỉ đọc, ân hạn 7 ngày cho HẾT HẠN.
 */
@DisplayName("OrgLicenseState — luật chế độ chỉ đọc (D5)")
class OrgLicenseStateTest {

    private static final Instant NOW = Instant.parse("2026-09-09T00:00:00Z");

    @Test
    @DisplayName("ACTIVE + không có hạn (vô thời hạn) → ghi bình thường")
    void active_noValidUntil_writable() {
        assertThat(OrgLicenseState.evaluate("ACTIVE", null, NOW)).isEqualTo(OrgLicenseState.Mode.ACTIVE);
        assertThat(OrgLicenseState.evaluate("ACTIVE", null, NOW).writable()).isTrue();
    }

    @Test
    @DisplayName("ACTIVE + hạn còn ở tương lai → ghi bình thường")
    void active_notYetExpired_writable() {
        Instant later = NOW.plus(1, ChronoUnit.DAYS);
        assertThat(OrgLicenseState.evaluate("ACTIVE", later, NOW)).isEqualTo(OrgLicenseState.Mode.ACTIVE);
    }

    @Test
    @DisplayName("hết hạn nhưng còn trong 7 ngày ân hạn → GRACE, VẪN ghi được")
    void expiredWithinGrace_writable() {
        Instant expired = NOW.minus(6, ChronoUnit.DAYS);
        OrgLicenseState.Mode mode = OrgLicenseState.evaluate("ACTIVE", expired, NOW);
        assertThat(mode).isEqualTo(OrgLicenseState.Mode.GRACE);
        assertThat(mode.writable()).isTrue();
    }

    @Test
    @DisplayName("đúng mốc cuối ân hạn (hết hạn + 7 ngày chẵn) vẫn còn ghi được")
    void expiredExactlyAtGraceEnd_writable() {
        Instant expired = NOW.minus(7, ChronoUnit.DAYS);
        assertThat(OrgLicenseState.evaluate("ACTIVE", expired, NOW)).isEqualTo(OrgLicenseState.Mode.GRACE);
    }

    @Test
    @DisplayName("quá ân hạn 7 ngày → CHỈ ĐỌC, lý do EXPIRED")
    void expiredPastGrace_readOnly() {
        Instant expired = NOW.minus(7, ChronoUnit.DAYS).minusSeconds(1);
        OrgLicenseState.Mode mode = OrgLicenseState.evaluate("ACTIVE", expired, NOW);
        assertThat(mode).isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(mode.writable()).isFalse();
        assertThat(OrgLicenseState.reason("ACTIVE")).isEqualTo(OrgLicenseState.Reason.EXPIRED);
    }

    @Test
    @DisplayName("SUSPENDED cắt NGAY — không ân hạn, kể cả khi hạn giấy phép còn xa")
    void suspended_readOnlyImmediately() {
        Instant far = NOW.plus(365, ChronoUnit.DAYS);
        assertThat(OrgLicenseState.evaluate("SUSPENDED", far, NOW))
                .isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(OrgLicenseState.evaluate("SUSPENDED", null, NOW))
                .isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(OrgLicenseState.reason("SUSPENDED")).isEqualTo(OrgLicenseState.Reason.SUSPENDED);
    }

    @Test
    @DisplayName("trạng thái lạ / null → fail-safe CHỈ ĐỌC, không cho ghi bừa")
    void unknownStatus_failsSafe() {
        assertThat(OrgLicenseState.evaluate(null, null, NOW)).isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(OrgLicenseState.evaluate("PENDING", null, NOW)).isEqualTo(OrgLicenseState.Mode.READ_ONLY);
    }

    @Test
    @DisplayName("thông điệp phân biệt đình chỉ với hết hạn, và nói cách mở lại")
    void message_tellsWhatToDo() {
        assertThat(OrgLicenseState.message(OrgLicenseState.Reason.SUSPENDED))
                .contains("tạm ngưng").contains("quản trị hệ thống");
        assertThat(OrgLicenseState.message(OrgLicenseState.Reason.EXPIRED))
                .contains("hết hạn").contains("thanh toán");
    }
}
