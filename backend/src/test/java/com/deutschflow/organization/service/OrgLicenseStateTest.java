package com.deutschflow.organization.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luật giấy phép owner chốt 09/09/2026 dưới dạng quyết định thuần: hết hạn HOẶC đình chỉ ⇒ CHỈ ĐỌC
 * NGAY; 7 ngày ân hạn là quãng chỉ-đọc TRƯỚC KHI CẮT, áp cho cả hai nguyên nhân.
 *
 * <p>Phần lớn ca ở đây là ca BIÊN: đúng mốc, ngay sau mốc, đúng mốc +7 ngày, ngay sau mốc +7 ngày.
 * Đổi {@code isAfter} thành {@code isBefore}/{@code !isBefore} ở một nhánh là lệch nguyên một ngày
 * mà ca "giữa quãng" không hề thấy.
 */
@DisplayName("OrgLicenseState — máy trạng thái giấy phép trung tâm")
class OrgLicenseStateTest {

    private static final Instant NOW = Instant.parse("2026-09-09T00:00:00Z");
    private static final Instant NEVER_SUSPENDED = null;

    private static OrgLicenseState.Mode onExpiry(Instant validUntil) {
        return OrgLicenseState.evaluate("ACTIVE", validUntil, NEVER_SUSPENDED, NOW);
    }

    private static OrgLicenseState.Mode onSuspension(Instant suspendedAt) {
        // Hạn giấy phép còn xa: chỉ nhánh đình chỉ được quyết.
        return OrgLicenseState.evaluate("SUSPENDED", NOW.plus(365, ChronoUnit.DAYS), suspendedAt, NOW);
    }

    // ---------------------------------------------------------------- còn hiệu lực

    @Test
    @DisplayName("ACTIVE + không có hạn = VÔ THỜI HẠN → ghi bình thường")
    void active_noValidUntil_writable() {
        assertThat(onExpiry(null)).isEqualTo(OrgLicenseState.Mode.ACTIVE);
        assertThat(onExpiry(null).writable()).isTrue();
    }

    @Test
    @DisplayName("ACTIVE + hạn còn ở tương lai → ghi bình thường")
    void active_notYetExpired_writable() {
        assertThat(onExpiry(NOW.plus(1, ChronoUnit.DAYS))).isEqualTo(OrgLicenseState.Mode.ACTIVE);
    }

    // ---------------------------------------------------------------- biên HẾT HẠN

    @Test
    @DisplayName("BIÊN: đúng giây validUntil — chưa quá hạn → VẪN ACTIVE")
    void expiry_exactlyAtValidUntil_stillActive() {
        assertThat(onExpiry(NOW)).isEqualTo(OrgLicenseState.Mode.ACTIVE);
    }

    @Test
    @DisplayName("BIÊN: một giây sau validUntil → CHỈ ĐỌC NGAY (không còn quãng ghi được)")
    void expiry_oneSecondAfter_readOnlyImmediately() {
        OrgLicenseState.Mode mode = onExpiry(NOW.minusSeconds(1));
        assertThat(mode).isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(mode.writable()).isFalse();
        assertThat(mode.cut()).isFalse();
    }

    @Test
    @DisplayName("BIÊN: đúng mốc validUntil + 7 ngày — vẫn CHỈ ĐỌC, chưa cắt")
    void expiry_exactlyAtGraceEnd_stillReadOnly() {
        assertThat(onExpiry(NOW.minus(7, ChronoUnit.DAYS))).isEqualTo(OrgLicenseState.Mode.READ_ONLY);
    }

    @Test
    @DisplayName("BIÊN: một giây sau validUntil + 7 ngày → CẮT")
    void expiry_oneSecondAfterGraceEnd_cut() {
        OrgLicenseState.Mode mode = onExpiry(NOW.minus(7, ChronoUnit.DAYS).minusSeconds(1));
        assertThat(mode).isEqualTo(OrgLicenseState.Mode.CUT);
        assertThat(mode.cut()).isTrue();
        assertThat(mode.writable()).isFalse();
        assertThat(OrgLicenseState.reason("ACTIVE")).isEqualTo(OrgLicenseState.Reason.EXPIRED);
    }

    // ---------------------------------------------------------------- biên ĐÌNH CHỈ

    @Test
    @DisplayName("BIÊN: đúng giây suspendedAt → CHỈ ĐỌC (không cắt phăng như luật cũ)")
    void suspension_exactlyAtAnchor_readOnly() {
        OrgLicenseState.Mode mode = onSuspension(NOW);
        assertThat(mode).isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(mode.writable()).isFalse();
        assertThat(mode.cut()).isFalse();
    }

    @Test
    @DisplayName("BIÊN: đúng mốc suspendedAt + 7 ngày — vẫn CHỈ ĐỌC, chưa cắt")
    void suspension_exactlyAtGraceEnd_stillReadOnly() {
        assertThat(onSuspension(NOW.minus(7, ChronoUnit.DAYS)))
                .isEqualTo(OrgLicenseState.Mode.READ_ONLY);
    }

    @Test
    @DisplayName("BIÊN: một giây sau suspendedAt + 7 ngày → CẮT, lý do SUSPENDED")
    void suspension_oneSecondAfterGraceEnd_cut() {
        assertThat(onSuspension(NOW.minus(7, ChronoUnit.DAYS).minusSeconds(1)))
                .isEqualTo(OrgLicenseState.Mode.CUT);
        assertThat(OrgLicenseState.reason("SUSPENDED")).isEqualTo(OrgLicenseState.Reason.SUSPENDED);
    }

    @Test
    @DisplayName("đình chỉ thắng cả hạn giấy phép còn xa 365 ngày")
    void suspension_beatsFutureValidUntil() {
        assertThat(onSuspension(NOW.minus(1, ChronoUnit.DAYS)))
                .isEqualTo(OrgLicenseState.Mode.READ_ONLY);
    }

    // ---------------------------------------------------------------- fail-safe

    @Test
    @DisplayName("đình chỉ mà KHÔNG có mốc neo (sửa tay vào DB) → CẮT, tuyệt đối không fail-open")
    void suspended_withoutAnchor_cutsNotFailOpen() {
        OrgLicenseState.Mode mode = OrgLicenseState.evaluate("SUSPENDED", null, null, NOW);
        assertThat(mode).isEqualTo(OrgLicenseState.Mode.CUT);
        assertThat(mode.writable()).isFalse();
        // Kể cả khi hạn giấy phép còn xa — không mốc neo thì không đếm nổi ân hạn.
        assertThat(OrgLicenseState.evaluate("SUSPENDED", NOW.plus(365, ChronoUnit.DAYS), null, NOW))
                .isEqualTo(OrgLicenseState.Mode.CUT);
    }

    @Test
    @DisplayName("trạng thái lạ / null → fail-safe, không bao giờ ghi được")
    void unknownStatus_failsSafe() {
        assertThat(OrgLicenseState.evaluate(null, null, null, NOW).writable()).isFalse();
        assertThat(OrgLicenseState.evaluate("PENDING", null, NOW, NOW))
                .isEqualTo(OrgLicenseState.Mode.READ_ONLY);
        assertThat(OrgLicenseState.evaluate("PENDING", null, null, NOW))
                .isEqualTo(OrgLicenseState.Mode.CUT);
    }

    @Test
    @DisplayName("mốc neo đình chỉ KHÔNG ảnh hưởng trung tâm còn ACTIVE (dữ liệu thừa cũng vô hại)")
    void activeOrg_ignoresStaleAnchor() {
        assertThat(OrgLicenseState.evaluate("ACTIVE", null, NOW.minus(90, ChronoUnit.DAYS), NOW))
                .isEqualTo(OrgLicenseState.Mode.ACTIVE);
    }

    // ---------------------------------------------------------------- thông điệp

    @Test
    @DisplayName("thông điệp KHÔNG còn nói 'quá 7 ngày ân hạn' — chỉ-đọc bắt đầu NGAY khi hết hạn")
    void message_noLongerClaimsGraceElapsed() {
        String expired = OrgLicenseState.message(OrgLicenseState.Reason.EXPIRED);
        assertThat(expired).contains("hết hạn").contains("thanh toán").doesNotContain("ân hạn");
        String suspended = OrgLicenseState.message(OrgLicenseState.Reason.SUSPENDED);
        assertThat(suspended).contains("tạm ngưng").contains("quản trị hệ thống")
                .doesNotContain("ân hạn");
    }

    @Test
    @DisplayName("chỉ ACTIVE mới ghi được; CHỈ ĐỌC và CẮT đều chặn ghi")
    void onlyActiveIsWritable() {
        assertThat(OrgLicenseState.Mode.ACTIVE.writable()).isTrue();
        assertThat(OrgLicenseState.Mode.READ_ONLY.writable()).isFalse();
        assertThat(OrgLicenseState.Mode.CUT.writable()).isFalse();
        assertThat(OrgLicenseState.Mode.CUT.cut()).isTrue();
        assertThat(OrgLicenseState.Mode.READ_ONLY.cut()).isFalse();
        assertThat(OrgLicenseState.Mode.ACTIVE.cut()).isFalse();
    }
}
