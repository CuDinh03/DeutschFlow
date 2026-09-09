package com.deutschflow.organization.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Mốc neo đình chỉ trung tâm (Đợt 4, V316(d)).
 *
 * <p>Owner đã chốt: hết hạn thì chỉ-đọc NGAY, còn đình chỉ thì vẫn cho 7 ngày ân hạn chỉ-đọc. Vế
 * sau chỉ tính được khi có một mốc neo RIÊNG cho đình chỉ. Bài này canh đúng hai quyết định dễ bị
 * "tối ưu" hỏng về sau:
 * <ul>
 *   <li>mốc neo là cột riêng, KHÔNG mượn {@code updated_at} (mượn = fail-open);</li>
 *   <li>backfill lấy {@code now()}, KHÔNG lấy mốc quá khứ (lấy quá khứ = cắt quyền ghi ngay lúc
 *       deploy của trung tâm có thể đang thương lượng).</li>
 * </ul>
 * Hành vi thật trên PostgreSQL do {@code ClassEnrollmentLifecycleIntegrationTest} kiểm.
 */
@DisplayName("Organization suspension anchor (V316(d)) Unit Tests")
class OrganizationSuspensionAnchorTest {

    private static final String MIGRATION = "db/migration/V316__enrollment_lifecycle_foundation.sql";

    // ── entity ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("suspendedAt cùng KIỂU với validUntil để máy trạng thái so được hai mốc")
    void suspendedAt_hasSameTypeAsValidUntil() throws Exception {
        Field suspendedAt = Organization.class.getDeclaredField("suspendedAt");
        Field validUntil = Organization.class.getDeclaredField("validUntil");

        assertThat(suspendedAt.getType())
                .as("suspendedAt phải khớp kiểu validUntil (%s) — lệch kiểu là không so sánh nổi",
                        validUntil.getType().getName())
                .isEqualTo(validUntil.getType());
    }

    @Test
    @DisplayName("suspendedAt neo vào cột riêng suspended_at, cho phép NULL = không bị đình chỉ")
    void suspendedAt_mapsToOwnNullableColumn() throws Exception {
        Column column = Organization.class.getDeclaredField("suspendedAt").getAnnotation(Column.class);

        assertThat(column).isNotNull();
        assertThat(column.name()).isEqualTo("suspended_at");
        assertThat(column.nullable())
                .as("NULL = không bị đình chỉ, nên cột phải nullable")
                .isTrue();
    }

    @Test
    @DisplayName("trung tâm dựng mới KHÔNG mang mốc đình chỉ")
    void newOrganization_hasNoSuspensionAnchor() {
        Organization org = Organization.builder().name("TT").slug("tt").build();

        assertThat(org.getSuspendedAt()).isNull();
    }

    @Test
    @DisplayName("chuyển sang đình chỉ thì ĐÓNG mốc neo ngay — không có mốc là không đếm nổi ân hạn")
    void changeStatus_toSuspended_anchorsNow() {
        Organization org = Organization.builder().name("TT").slug("tt").build();
        Instant before = Instant.now();

        org.changeStatus("SUSPENDED");

        assertThat(org.getStatus()).isEqualTo("SUSPENDED");
        assertThat(org.getSuspendedAt())
                .as("đình chỉ mà không đóng mốc ⇒ ân hạn không bao giờ hết (fail-open)")
                .isNotNull()
                .isAfterOrEqualTo(before);
    }

    @Test
    @DisplayName("mở lại trung tâm thì XOÁ mốc neo — lần đình chỉ sau phải có đủ 7 ngày ân hạn")
    void changeStatus_backToActive_clearsAnchor() {
        Organization org = Organization.builder().name("TT").slug("tt").build();
        org.changeStatus("SUSPENDED");

        org.changeStatus("ACTIVE");

        assertThat(org.getStatus()).isEqualTo("ACTIVE");
        assertThat(org.getSuspendedAt())
                .as("giữ mốc cũ ⇒ lần đình chỉ sau thừa hưởng mốc đã quá hạn, cắt ngay không ân hạn")
                .isNull();
    }

    @Test
    @DisplayName("lưu lại một trung tâm ĐANG bị đình chỉ KHÔNG đẩy mốc neo ra xa")
    void changeStatus_alreadySuspended_keepsFirstAnchor() {
        Organization org = Organization.builder().name("TT").slug("tt").build();
        org.changeStatus("SUSPENDED");
        Instant firstAnchor = org.getSuspendedAt();

        org.changeStatus("SUSPENDED");

        assertThat(org.getSuspendedAt())
                .as("ân hạn đếm từ lần đình chỉ thật, không phải từ lần bấm lưu gần nhất")
                .isEqualTo(firstAnchor);
    }

    // ── migration ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("V316 thêm organizations.suspended_at TIMESTAMPTZ (chạy lại được)")
    void migration_addsSuspendedAtColumn() {
        assertThat(normalizedSqlWithoutComments())
                .contains("alter table organizations add column if not exists suspended_at timestamptz");
    }

    @Test
    @DisplayName("V316 backfill lấy now(), chỉ đụng trung tâm đang bị đình chỉ, và chạy lại là no-op")
    void migration_backfillUsesNowAndIsGuarded() {
        String backfill = backfillStatement();

        assertThat(backfill).contains("set suspended_at = now()");
        assertThat(backfill)
                .as("chỉ backfill trung tâm ĐANG bị đình chỉ")
                .contains("status <> 'active'");
        assertThat(backfill)
                .as("`IS NULL` giữ câu này idempotent và không đè mốc thật")
                .contains("suspended_at is null");
    }

    @Test
    @DisplayName("V316 backfill KHÔNG neo vào mốc quá khứ (updated_at / now() - interval)")
    void migration_backfillNeverAnchorsInThePast() {
        String backfill = backfillStatement();

        assertThat(backfill)
                .as("updated_at dịch theo mọi lần sửa bản ghi ⇒ ân hạn không bao giờ hết (fail-open)")
                .doesNotContain("updated_at");
        assertThat(backfill)
                .as("mốc quá khứ = cắt phăng quyền ghi ngay lúc deploy")
                .doesNotContain("interval")
                .doesNotContain("now() -");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Câu UPDATE backfill của V316, đã bỏ chú thích và gộp khoảng trắng, chữ thường. */
    private static String backfillStatement() {
        String statement = Arrays.stream(normalizedSqlWithoutComments().split(";"))
                .filter(s -> s.contains("update organizations"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("V316 thiếu câu backfill UPDATE organizations"));
        return statement.trim();
    }

    /** SQL của V316: bỏ mọi chú thích `--`, gộp khoảng trắng, đưa về chữ thường. */
    private static String normalizedSqlWithoutComments() {
        String stripped = readMigration().replaceAll("--[^\\n]*", " ");
        return stripped.replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static String readMigration() {
        try (InputStream is = OrganizationSuspensionAnchorTest.class.getClassLoader()
                .getResourceAsStream(MIGRATION)) {
            if (is != null) {
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
            return Files.readString(Path.of("src/main/resources/" + MIGRATION), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
