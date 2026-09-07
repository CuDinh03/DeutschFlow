package com.deutschflow.organization.service;

import com.deutschflow.organization.entity.Organization;
import com.deutschflow.payment.service.SubscriptionActivationService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DEC-09 (owner chốt Q1 ngày 07/09): quyền của TRUNG TÂM hiệu lực trong lúc là thành viên, còn gói
 * cá nhân đã trả tiền chỉ TẠM DỪNG và giữ nguyên phần thời hạn còn lại.
 *
 * <p>Trước PR-A4, đường cấp gói trung tâm đi qua {@code activateWithExplicitEnd} — hàm đó ENDED mọi
 * dòng ACTIVE. Nghĩa là thêm một học viên đang trả tiền vào trung tâm sẽ đốt sạch phần họ đã mua, và
 * rời trung tâm cũng không lấy lại được. Không ca nào bắt được điều đó vì test cũ toàn mock.
 *
 * <p>Chạy trên Postgres THẬT với Flyway thật: trạng thái {@code PAUSED}, cột {@code paused_at} và
 * mệnh đề {@code RETURNING} đều là thứ mock không kiểm được.
 */
@SpringBootTest
@DisplayName("Gói cá nhân và gói trung tâm cùng tồn tại (DEC-09)")
class OrgEntitlementCoexistenceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private OrgEntitlementService orgEntitlementService;
    @Autowired private SubscriptionActivationService subscriptionActivationService;

    private static final String EMAIL_PREFIX = "coexist-it-";

    @AfterEach
    void tearDown() {
        String owned = "(SELECT id FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%')";
        jdbcTemplate.update("DELETE FROM user_ai_token_wallets WHERE user_id IN " + owned);
        jdbcTemplate.update("DELETE FROM user_subscriptions WHERE user_id IN " + owned);
        // KHÔNG dọn audit_logs: bảng chỉ-ghi-thêm, trigger trg_audit_logs_immutable (C14) chặn DELETE.
        // Mỗi ca dùng một userId riêng nên đếm theo target_id vẫn chính xác dù dòng cũ còn nằm đó.
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%'");
    }

    // ------------------------------------------------------------------ helpers

    private Long newUser(String tag) {
        return userRepository.save(User.builder()
                .email(EMAIL_PREFIX + tag + "-" + System.nanoTime() + "@test.com")
                .passwordHash("$2a$10$h").displayName("Coexist IT")
                .role(User.Role.STUDENT).build()).getId();
    }

    /** Gói cá nhân người dùng đã bỏ tiền mua. */
    private void buyPersonalPlan(Long userId, String source, String planCode, Instant endsAt) {
        Instant now = Instant.now();
        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source, created_at, updated_at)
                VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
                """, userId, planCode, Timestamp.from(now),
                endsAt == null ? null : Timestamp.from(endsAt), source,
                Timestamp.from(now), Timestamp.from(now));
    }

    private Organization org(Instant validUntil) {
        return Organization.builder().id(1L).name("Acme").slug("acme")
                .planCode("PRO").validUntil(validUntil).build();
    }

    private List<Map<String, Object>> rows(Long userId) {
        return jdbcTemplate.queryForList("""
                SELECT source, status, plan_code, ends_at, paused_at
                FROM user_subscriptions WHERE user_id = ? ORDER BY id
                """, userId);
    }

    private Map<String, Object> one(Long userId, String source, String status) {
        List<Map<String, Object>> found = rows(userId).stream()
                .filter(r -> source.equals(r.get("source")) && status.equals(r.get("status")))
                .toList();
        assertThat(found).as("đúng một dòng %s ở trạng thái %s", source, status).hasSize(1);
        return found.get(0);
    }

    private long activeCount(Long userId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'",
                Integer.class, userId);
        return n == null ? 0 : n;
    }

    private long auditCount(Long userId, String event) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND target_id = ?",
                Integer.class, event, String.valueOf(userId));
        return n == null ? 0 : n;
    }

    // ------------------------------------------------------------------ ca kiểm

    @Test
    @DisplayName("Vào trung tâm: gói đã trả tiền chuyển sang tạm dừng, KHÔNG bị kết thúc")
    void vaoTrungTam_goiDaTraTien_chiTamDung() {
        Long userId = newUser("pause");
        Instant endsAt = Instant.now().plus(30, ChronoUnit.DAYS);
        buyPersonalPlan(userId, "SEPAY", "PRO", endsAt);

        orgEntitlementService.grantStudent(userId, org(Instant.now().plus(365, ChronoUnit.DAYS)));

        Map<String, Object> paused = one(userId, "SEPAY", "PAUSED");
        assertThat(paused.get("paused_at")).as("mốc tạm dừng phải được ghi").isNotNull();
        // Thời hạn gốc GIỮ NGUYÊN — đây chính là thứ bản cũ đốt mất.
        assertThat(((Timestamp) paused.get("ends_at")).toInstant())
                .isCloseTo(endsAt, org.assertj.core.api.Assertions.within(1, ChronoUnit.SECONDS));

        one(userId, "ORG", "ACTIVE");
        assertThat(activeCount(userId)).as("chỉ một quyền lợi hiệu lực").isEqualTo(1);
        assertThat(auditCount(userId, "org_entitlement_paused")).isEqualTo(1);
    }

    @Test
    @DisplayName("Rời trung tâm: thời hạn ĐÓNG BĂNG suốt lúc ở trung tâm, trả lại nguyên vẹn")
    void roiTrungTam_thoiHanDongBang() {
        Long userId = newUser("resume");
        buyPersonalPlan(userId, "SEPAY", "PRO", Instant.now().plus(10, ChronoUnit.DAYS));
        orgEntitlementService.grantStudent(userId, org(null));

        // Giả lập ĐÃ Ở TRUNG TÂM 3 NGÀY: lúc tạm dừng (3 ngày trước) gói còn đúng 10 ngày, nên lùi
        // CẢ HAI mốc lại 3 ngày. Chỉ lùi `paused_at` là mô phỏng sai — nó biến thành "gói còn 13 ngày".
        jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET paused_at = paused_at - INTERVAL '3 days', ends_at = ends_at - INTERVAL '3 days'
                WHERE user_id = ? AND status = 'PAUSED'
                """, userId);

        orgEntitlementService.revokeStudent(userId);

        Map<String, Object> resumed = one(userId, "SEPAY", "ACTIVE");
        assertThat(resumed.get("paused_at")).as("mốc tạm dừng phải được xoá").isNull();
        // Đúng 10 ngày, KHÔNG phải 7: ba ngày ở trung tâm không được ăn vào gói người ta đã trả tiền
        // (DEC-09). Đây là lời hứa cốt lõi của cả PR này.
        Duration remaining = Duration.between(Instant.now(), ((Timestamp) resumed.get("ends_at")).toInstant());
        assertThat(remaining.toHours()).isBetween(10L * 24 - 1, 10L * 24 + 1);

        assertThat(activeCount(userId)).isEqualTo(1);
        assertThat(auditCount(userId, "org_entitlement_resumed")).isEqualTo(1);
    }

    @Test
    @DisplayName("Gói nền (DEFAULT/TRIAL) thì KẾT THÚC chứ không tạm dừng — chỉ tiền mới được giữ")
    void goiNen_ketThucChuKhongTamDung() {
        Long userId = newUser("default");
        buyPersonalPlan(userId, "DEFAULT", "DEFAULT", null); // gói nền thật không có hạn
        buyPersonalPlan(userId, "TRIAL", "PRO", Instant.now().plus(5, ChronoUnit.DAYS));

        orgEntitlementService.grantStudent(userId, org(null));

        assertThat(rows(userId)).filteredOn(r -> "PAUSED".equals(r.get("status"))).isEmpty();
        one(userId, "DEFAULT", "ENDED");
        one(userId, "TRIAL", "ENDED");
        assertThat(activeCount(userId)).isEqualTo(1);
        assertThat(auditCount(userId, "org_entitlement_paused")).isZero();
    }

    @Test
    @DisplayName("Gói đã hết hạn thì kết thúc, không hồi sinh nó thành tạm dừng")
    void goiDaHetHan_khongTamDung() {
        Long userId = newUser("expired");
        buyPersonalPlan(userId, "SEPAY", "PRO", Instant.now().minus(1, ChronoUnit.DAYS));

        orgEntitlementService.grantStudent(userId, org(null));

        one(userId, "SEPAY", "ENDED");
        assertThat(rows(userId)).filteredOn(r -> "PAUSED".equals(r.get("status"))).isEmpty();
    }

    @Test
    @DisplayName("Apple gia hạn khi đang tạm dừng: chỉ dời hạn, KHÔNG đẻ dòng ACTIVE thứ hai")
    void appleGiaHanKhiTamDung_chiDoiHan() {
        Long userId = newUser("apple-renew");
        buyPersonalPlan(userId, "APPLE", "PRO", Instant.now().plus(10, ChronoUnit.DAYS));
        orgEntitlementService.grantStudent(userId, org(null));

        Instant xaHon = Instant.now().plus(40, ChronoUnit.DAYS);
        subscriptionActivationService.extendOrActivateApple(userId, "PRO", Instant.now(), xaHon, false);

        Map<String, Object> apple = one(userId, "APPLE", "PAUSED");
        assertThat(((Timestamp) apple.get("ends_at")).toInstant())
                .isCloseTo(xaHon, org.assertj.core.api.Assertions.within(1, ChronoUnit.SECONDS));
        assertThat(activeCount(userId)).as("quyền trung tâm vẫn là quyền duy nhất hiệu lực").isEqualTo(1);
        one(userId, "ORG", "ACTIVE");
    }

    @Test
    @DisplayName("Gia hạn Apple đến trễ mang hạn CŨ hơn thì không được rút ngắn")
    void appleGiaHanTre_khongRutNganHan() {
        Long userId = newUser("apple-stale");
        Instant xa = Instant.now().plus(40, ChronoUnit.DAYS);
        buyPersonalPlan(userId, "APPLE", "PRO", xa);
        orgEntitlementService.grantStudent(userId, org(null));

        subscriptionActivationService.extendOrActivateApple(
                userId, "PRO", Instant.now(), Instant.now().plus(5, ChronoUnit.DAYS), false);

        assertThat(((Timestamp) one(userId, "APPLE", "PAUSED").get("ends_at")).toInstant())
                .isCloseTo(xa, org.assertj.core.api.Assertions.within(1, ChronoUnit.SECONDS));
    }

    @Test
    @DisplayName("Mua Apple TRONG LÚC ở trung tâm: ghi thẳng vào trạng thái tạm dừng")
    void muaAppleKhiOTrungTam_ghiVaoTamDung() {
        Long userId = newUser("apple-buy");
        orgEntitlementService.grantStudent(userId, org(null));

        Instant endsAt = Instant.now().plus(30, ChronoUnit.DAYS);
        subscriptionActivationService.extendOrActivateApple(userId, "PRO", Instant.now(), endsAt, false);

        one(userId, "APPLE", "PAUSED");
        one(userId, "ORG", "ACTIVE");
        assertThat(activeCount(userId)).as("mua gói mới KHÔNG được đè lên quyền của trung tâm").isEqualTo(1);

        // Và rời trung tâm thì gói vừa mua phải sống dậy nguyên vẹn.
        orgEntitlementService.revokeStudent(userId);
        Duration remaining = Duration.between(Instant.now(),
                ((Timestamp) one(userId, "APPLE", "ACTIVE").get("ends_at")).toInstant());
        assertThat(remaining.toDays()).isBetween(29L, 30L);
    }

    @Test
    @DisplayName("Hoàn tiền Apple kết thúc cả dòng đang tạm dừng — không để sót quyền chờ sống dậy")
    void hoanTienApple_ketThucCaDongTamDung() {
        Long userId = newUser("apple-refund");
        buyPersonalPlan(userId, "APPLE", "PRO", Instant.now().plus(30, ChronoUnit.DAYS));
        orgEntitlementService.grantStudent(userId, org(null));

        subscriptionActivationService.endAppleSubscription(userId);
        orgEntitlementService.revokeStudent(userId);

        one(userId, "APPLE", "ENDED");
        assertThat(rows(userId)).filteredOn(r -> "APPLE".equals(r.get("source")) && "ACTIVE".equals(r.get("status")))
                .as("quyền đã hoàn tiền không được sống lại").isEmpty();
    }

    @Test
    @DisplayName("Giấy phép trung tâm hết hạn: quyền lợi ORG kết thúc và gói cá nhân trở lại")
    void giayPhepTrungTamHetHan_khoiPhucGoiCaNhan() {
        Long userId = newUser("org-expiry");
        buyPersonalPlan(userId, "SEPAY", "PRO", Instant.now().plus(20, ChronoUnit.DAYS));
        orgEntitlementService.grantStudent(userId, org(Instant.now().plus(1, ChronoUnit.DAYS)));

        // Giả lập giấy phép đã hết hạn.
        jdbcTemplate.update("UPDATE user_subscriptions SET ends_at = ? WHERE user_id = ? AND source = 'ORG'",
                Timestamp.from(Instant.now().minus(1, ChronoUnit.HOURS)), userId);

        orgEntitlementService.expireAndResume(userId);

        one(userId, "ORG", "ENDED");
        one(userId, "SEPAY", "ACTIVE");
        assertThat(activeCount(userId)).isEqualTo(1);
    }

    @Test
    @DisplayName("Nhiều gói cùng tạm dừng: chỉ gói còn nhiều thời hạn nhất sống lại, phần còn lại kết thúc")
    void nhieuGoiTamDung_chiGoiDaiNhatSongLai() {
        Long userId = newUser("multi");
        buyPersonalPlan(userId, "APPLE", "PRO", Instant.now().plus(5, ChronoUnit.DAYS));
        buyPersonalPlan(userId, "SEPAY", "ULTRA", Instant.now().plus(50, ChronoUnit.DAYS));
        orgEntitlementService.grantStudent(userId, org(null));
        assertThat(rows(userId)).filteredOn(r -> "PAUSED".equals(r.get("status"))).hasSize(2);

        orgEntitlementService.revokeStudent(userId);

        one(userId, "SEPAY", "ACTIVE");
        one(userId, "APPLE", "ENDED");
        assertThat(activeCount(userId)).as("không bao giờ hai quyền lợi cùng hiệu lực").isEqualTo(1);
    }

    @Test
    @DisplayName("Ví AI không bị nhân đôi qua vòng vào–ra trung tâm")
    void viKhongNhanDoi() {
        Long userId = newUser("wallet");
        buyPersonalPlan(userId, "SEPAY", "PRO", Instant.now().plus(30, ChronoUnit.DAYS));

        orgEntitlementService.grantStudent(userId, org(null));
        orgEntitlementService.revokeStudent(userId);
        orgEntitlementService.grantStudent(userId, org(null));

        Integer wallets = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_ai_token_wallets WHERE user_id = ?", Integer.class, userId);
        assertThat(wallets).isLessThanOrEqualTo(1);
    }
}
